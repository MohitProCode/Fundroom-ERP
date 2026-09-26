import { PrismaClient, Enquiry, EnquiryStatus } from '@prisma/client';
import { NotFoundError, BusinessRuleError, ErrorCode, StateTransitionError } from '../../shared/errors';
import { PaginationMeta } from '../../shared/types';
import { generateEnquiryNumber } from '../../shared/utils/business-identifiers';

const prisma = new PrismaClient();

export interface CreateEnquiryInput {
  customerId: string;
  notes?: string;
  items: Array<{
    productId: string;
    quantity: number;
    notes?: string;
  }>;
}

export interface EnquiryListResult {
  items: Enquiry[];
  meta: PaginationMeta;
}

// Valid status transitions
const VALID_TRANSITIONS: Record<EnquiryStatus, EnquiryStatus[]> = {
  [EnquiryStatus.NEW]: [EnquiryStatus.QUOTED, EnquiryStatus.LOST],
  [EnquiryStatus.QUOTED]: [EnquiryStatus.WON, EnquiryStatus.LOST],
  [EnquiryStatus.WON]: [],
  [EnquiryStatus.LOST]: [],
};

export class EnquiriesService {
  async list(
    page: number = 1,
    limit: number = 10,
    status?: EnquiryStatus,
    customerId?: string
  ): Promise<EnquiryListResult> {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;

    const [items, total] = await Promise.all([
      prisma.enquiry.findMany({
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
          _count: { select: { quotations: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.enquiry.count({ where }),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string): Promise<Enquiry> {
    const enquiry = await prisma.enquiry.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
        quotations: {
          select: { id: true, quotationNumber: true, status: true },
        },
      },
    });

    if (!enquiry) {
      throw new NotFoundError('Enquiry', id);
    }

    return enquiry as Enquiry;
  }

  async create(data: CreateEnquiryInput, userId: string): Promise<Enquiry> {
    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: data.customerId },
    });

    if (!customer) {
      throw new NotFoundError('Customer', data.customerId);
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

    const enquiryNumber = await generateEnquiryNumber();

    const enquiry = await prisma.enquiry.create({
      data: {
        enquiryNumber,
        customerId: data.customerId,
        notes: data.notes,
        createdBy: userId,
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
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

    await this.logAudit(userId, 'ENQUIRY_CREATED', 'Enquiry', enquiry.id, {
      enquiryNumber: enquiry.enquiryNumber,
      customerId: data.customerId,
    });

    return enquiry;
  }

  async updateStatus(
    id: string,
    newStatus: EnquiryStatus,
    userId: string
  ): Promise<Enquiry> {
    const enquiry = await this.getById(id);

    if (!VALID_TRANSITIONS[enquiry.status].includes(newStatus)) {
      throw new StateTransitionError(
        `Cannot transition enquiry from ${enquiry.status} to ${newStatus}`,
        {
          currentStatus: enquiry.status,
          requestedStatus: newStatus,
          validTransitions: VALID_TRANSITIONS[enquiry.status],
        }
      );
    }

    const updated = await prisma.enquiry.update({
      where: { id },
      data: { status: newStatus },
    });

    await this.logAudit(userId, 'ENQUIRY_STATUS_CHANGED', 'Enquiry', id, {
      from: enquiry.status,
      to: newStatus,
    });

    return updated;
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
