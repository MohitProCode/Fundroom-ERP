import { PrismaClient, Quotation, QuotationStatus, EnquiryStatus, UserRole } from '@prisma/client';
import { NotFoundError, BusinessRuleError, ErrorCode, StateTransitionError, DuplicateResourceError, AuthorizationError } from '../../shared/errors';
import { PaginationMeta } from '../../shared/types';
import { generateQuotationNumber } from '../../shared/utils/business-identifiers';
import { calculateQuotationTotals, QuotationItemInput } from './quotation-calculator';

const prisma = new PrismaClient();

export interface CreateQuotationInput {
  enquiryId?: string;
  customerId: string;
  validUntil?: string;
  terms?: string;
  notes?: string;
  specialDiscountPercent?: number;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    discountPercent?: number;
    gstPercent?: number;
    notes?: string;
  }>;
}

export interface QuotationListResult {
  items: Quotation[];
  meta: PaginationMeta;
}

// Valid status transitions
const VALID_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  [QuotationStatus.DRAFT]: [QuotationStatus.SENT],
  [QuotationStatus.SENT]: [QuotationStatus.ACCEPTED, QuotationStatus.REJECTED],
  [QuotationStatus.ACCEPTED]: [],
  [QuotationStatus.REJECTED]: [],
};

export class QuotationsService {
  async list(
    page: number = 1,
    limit: number = 10,
    status?: QuotationStatus,
    customerId?: string
  ): Promise<QuotationListResult> {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;

    const [items, total] = await Promise.all([
      prisma.quotation.findMany({
        where,
        skip,
        take: limit,
        include: {
          customer: { select: { id: true, name: true, email: true } },
          items: {
            include: {
              product: { select: { id: true, sku: true, name: true, unit: true } },
            },
          },
          salesOrder: { select: { id: true, orderNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.quotation.count({ where }),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string): Promise<Quotation> {
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        customer: true,
        enquiry: true,
        items: {
          include: {
            product: true,
          },
        },
        salesOrder: true,
      },
    });

    if (!quotation) {
      throw new NotFoundError('Quotation', id);
    }

    return quotation as Quotation;
  }

  async create(data: CreateQuotationInput, userId: string): Promise<Quotation> {
    const actor = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (actor?.role !== UserRole.SALES_USER) {
      throw new AuthorizationError('Only SALES_USER users can prepare quotations');
    }

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: data.customerId },
    });

    if (!customer) {
      throw new NotFoundError('Customer', data.customerId);
    }

    // Verify enquiry if provided
    if (data.enquiryId) {
      const enquiry = await prisma.enquiry.findUnique({
        where: { id: data.enquiryId },
      });

      if (!enquiry) {
        throw new NotFoundError('Enquiry', data.enquiryId);
      }
    }

    // Verify all products exist
    const productIds = data.items.map((item) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
    });

    if (products.length !== productIds.length) {
      const foundIds = products.map((p) => p.id);
      const missingIds = productIds.filter((id) => !foundIds.includes(id));
      throw new BusinessRuleError(
        ErrorCode.NOT_FOUND,
        'One or more products not found',
        { missingProducts: missingIds }
      );
    }

    // Calculate totals (backend-authoritative)
    const totals = calculateQuotationTotals(
      data.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPercent: item.discountPercent,
        gstPercent: item.gstPercent,
      })),
      data.specialDiscountPercent ?? 0
    );

    const quotationNumber = await generateQuotationNumber();

    const quotation = await prisma.$transaction(async (tx) => {
      const quotation = await tx.quotation.create({
      data: {
        quotationNumber,
        enquiryId: data.enquiryId,
        customerId: data.customerId,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        terms: data.terms,
        notes: data.notes,
        createdBy: userId,
        subtotal: totals.subtotal,
        totalDiscount: totals.totalDiscount,
        specialDiscountPercent: totals.specialDiscountPercent,
        specialDiscountAmount: totals.specialDiscountAmount,
        totalGst: totals.totalGst,
        grandTotal: totals.grandTotal,
        items: {
          create: data.items.map((item, index) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountPercent: item.discountPercent ?? 0,
            gstPercent: item.gstPercent ?? 18,
            baseAmount: totals.items[index].baseAmount,
            discountAmount: totals.items[index].discountAmount,
            taxableAmount: totals.items[index].taxableAmount,
            gstAmount: totals.items[index].gstAmount,
            lineTotal: totals.items[index].lineTotal,
            notes: item.notes,
          })),
        },
      },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

      // Update the linked pipeline in the same commit as the quotation.
      if (data.enquiryId) {
        await tx.enquiry.update({
          where: { id: data.enquiryId },
          data: { status: EnquiryStatus.QUOTED },
        });
      }

      return quotation;
    });

    await this.logAudit(userId, 'QUOTATION_CREATED', 'Quotation', quotation.id, {
      quotationNumber: quotation.quotationNumber,
      customerId: data.customerId,
      grandTotal: totals.grandTotal.toString(),
    });

    return quotation;
  }

  async updateStatus(
    id: string,
    newStatus: QuotationStatus,
    userId: string
  ): Promise<Quotation> {
    const quotation = await this.getById(id);

    const actor = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (newStatus === QuotationStatus.SENT && actor?.role !== UserRole.SALES_USER) {
      throw new AuthorizationError('Only SALES_USER users can submit quotations for approval');
    }
    if ((newStatus === QuotationStatus.ACCEPTED || newStatus === QuotationStatus.REJECTED) && actor?.role !== UserRole.ADMIN) {
      throw new AuthorizationError('Only ADMIN users can approve or reject quotations');
    }

    if (!VALID_TRANSITIONS[quotation.status].includes(newStatus)) {
      throw new StateTransitionError(
        `Cannot transition quotation from ${quotation.status} to ${newStatus}`,
        {
          currentStatus: quotation.status,
          requestedStatus: newStatus,
          validTransitions: VALID_TRANSITIONS[quotation.status],
        }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.quotation.update({
        where: { id },
        data: { status: newStatus },
      });

      // Keep the commercial and enquiry pipelines in the same commit.
      if (newStatus === QuotationStatus.ACCEPTED && quotation.enquiryId) {
        await tx.enquiry.update({
          where: { id: quotation.enquiryId },
          data: { status: EnquiryStatus.WON },
        });
      }

      return result;
    });

    const action = newStatus === QuotationStatus.ACCEPTED
      ? 'QUOTATION_ACCEPTED'
      : newStatus === QuotationStatus.REJECTED
      ? 'QUOTATION_REJECTED'
      : 'QUOTATION_STATUS_CHANGED';

    await this.logAudit(userId, action, 'Quotation', id, {
      from: quotation.status,
      to: newStatus,
    });

    return updated;
  }

  async checkCanConvert(quotationId: string): Promise<boolean> {
    const quotation = await this.getById(quotationId);

    if (quotation.status !== QuotationStatus.ACCEPTED) {
      return false;
    }

    // Check if already converted
    const existingOrder = await prisma.salesOrder.findUnique({
      where: { quotationId },
    });

    return !existingOrder;
  }

  private async logAudit(
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: { actorId, action: action as any, entityType, entityId, metadata },
      });
    } catch (error) {
      // Log but don't fail
    }
  }
}
