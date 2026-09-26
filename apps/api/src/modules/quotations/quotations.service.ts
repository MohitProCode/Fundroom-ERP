import { PrismaClient, Quotation, QuotationStatus, EnquiryStatus } from '@prisma/client';
import { NotFoundError, BusinessRuleError, ErrorCode, StateTransitionError, DuplicateResourceError } from '../../shared/errors';
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
      }))
    );

    const quotationNumber = await generateQuotationNumber();

    const quotation = await prisma.quotation.create({
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

    // Update enquiry status if linked
    if (data.enquiryId) {
      await prisma.enquiry.update({
        where: { id: data.enquiryId },
        data: { status: EnquiryStatus.QUOTED },
      });
    }

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

    const updated = await prisma.quotation.update({
      where: { id },
      data: { status: newStatus },
    });

    // Update enquiry status if quotation is accepted/won
    if (newStatus === QuotationStatus.ACCEPTED && quotation.enquiryId) {
      await prisma.enquiry.update({
        where: { id: quotation.enquiryId },
        data: { status: EnquiryStatus.WON },
      });
    }

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
