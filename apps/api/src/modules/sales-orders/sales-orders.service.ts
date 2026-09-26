import { PrismaClient, SalesOrder, SalesOrderStatus, QuotationStatus, Prisma } from '@prisma/client';
import { NotFoundError, BusinessRuleError, ErrorCode, StateTransitionError, AuthorizationError } from '../../shared/errors';
import { PaginationMeta } from '../../shared/types';
import { generateSalesOrderNumber } from '../../shared/utils/business-identifiers';
import { UserRole } from '@prisma/client';

const prisma = new PrismaClient();

export interface SalesOrderListResult {
  items: SalesOrder[];
  meta: PaginationMeta;
}

// Valid status transitions
const VALID_TRANSITIONS: Record<SalesOrderStatus, SalesOrderStatus[]> = {
  [SalesOrderStatus.PENDING]: [SalesOrderStatus.CONFIRMED, SalesOrderStatus.CANCELLED],
  [SalesOrderStatus.CONFIRMED]: [SalesOrderStatus.DISPATCHED, SalesOrderStatus.CANCELLED],
  [SalesOrderStatus.DISPATCHED]: [],
  [SalesOrderStatus.CANCELLED]: [],
};

export class SalesOrdersService {
  /**
   * List sales orders with pagination
   */
  async list(
    page: number = 1,
    limit: number = 10,
    status?: SalesOrderStatus,
    customerId?: string
  ): Promise<SalesOrderListResult> {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;

    const [items, total] = await Promise.all([
      prisma.salesOrder.findMany({
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
          dispatches: { select: { id: true, dispatchNumber: true, dispatchDate: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.salesOrder.count({ where }),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get sales order by ID
   */
  async getById(id: string): Promise<SalesOrder> {
    const order = await prisma.salesOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        quotation: {
          include: {
            items: { include: { product: true } },
          },
        },
        items: {
          include: {
            product: true,
          },
        },
        dispatches: {
          include: {
            items: { include: { product: true } },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundError('Sales Order', id);
    }

    return order as SalesOrder;
  }

  /**
   * Convert quotation to sales order
   * Only ACCEPTED quotations can be converted
   * Prevents duplicate conversion via database unique constraint
   */
  async convertQuotation(quotationId: string, userId: string): Promise<SalesOrder> {
    // Verify quotation exists and is accepted
    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      include: {
        items: true,
        customer: true,
      },
    });

    if (!quotation) {
      throw new NotFoundError('Quotation', quotationId);
    }

    if (quotation.status !== QuotationStatus.ACCEPTED) {
      throw new BusinessRuleError(
        ErrorCode.QUOTATION_NOT_ACCEPTED,
        'Only accepted quotations can be converted to sales orders',
        {
          quotationId,
          currentStatus: quotation.status,
          requiredStatus: QuotationStatus.ACCEPTED,
        }
      );
    }

    // Check if already converted (application-level check)
    const existingOrder = await prisma.salesOrder.findUnique({
      where: { quotationId },
    });

    if (existingOrder) {
      throw new BusinessRuleError(
        ErrorCode.QUOTATION_ALREADY_CONVERTED,
        'This quotation has already been converted to a sales order',
        {
          quotationId,
          existingOrderId: existingOrder.id,
          existingOrderNumber: existingOrder.orderNumber,
        }
      );
    }

    const orderNumber = await generateSalesOrderNumber();

    // Create sales order with items (no inventory reservation yet)
    const salesOrder = await prisma.salesOrder.create({
      data: {
        orderNumber,
        quotationId,
        customerId: quotation.customerId,
        createdBy: userId,
        subtotal: quotation.subtotal,
        totalDiscount: quotation.totalDiscount,
        totalGst: quotation.totalGst,
        grandTotal: quotation.grandTotal,
        items: {
          create: quotation.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            reservedQuantity: 0,
            dispatchedQuantity: 0,
            unitPrice: item.unitPrice,
            discountPercent: item.discountPercent,
            gstPercent: item.gstPercent,
            baseAmount: item.baseAmount,
            discountAmount: item.discountAmount,
            taxableAmount: item.taxableAmount,
            gstAmount: item.gstAmount,
            lineTotal: item.lineTotal,
          })),
        },
      },
      include: {
        items: { include: { product: true } },
      },
    });

    await this.logAudit(userId, 'SALES_ORDER_CREATED', 'SalesOrder', salesOrder.id, {
      orderNumber: salesOrder.orderNumber,
      quotationId,
      customerId: quotation.customerId,
    });

    return salesOrder;
  }

  /**
   * Confirm sales order (ADMIN only)
   * Reserves inventory transactionally with row-level locking
   */
  async confirm(id: string, userId: string): Promise<SalesOrder> {
    // Verify user is ADMIN
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== UserRole.ADMIN) {
      throw new AuthorizationError('Only ADMIN can confirm sales orders');
    }

    // Execute within transaction with row-level locking
    const result = await prisma.$transaction(async (tx) => {
      // Get order with items
      const order = await tx.salesOrder.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!order) {
        throw new NotFoundError('Sales Order', id);
      }

      if (order.status !== SalesOrderStatus.PENDING) {
        throw new BusinessRuleError(
          ErrorCode.ORDER_NOT_CONFIRMABLE,
          `Cannot confirm order with status ${order.status}`,
          { currentStatus: order.status, requiredStatus: SalesOrderStatus.PENDING }
        );
      }

      // Lock inventory rows for all products
      const productIds = order.items.map((item) => item.productId);
      const inventories = await tx.$queryRaw<Array<{
        id: string;
        productId: string;
        physicalQuantity: Prisma.Decimal;
        reservedQuantity: Prisma.Decimal;
      }>>`
        SELECT id, "productId", "physicalQuantity", "reservedQuantity"
        FROM inventory
        WHERE "productId" IN (${Prisma.join(productIds)})
        FOR UPDATE
      `;

      const inventoryMap = new Map(inventories.map((inv) => [inv.productId, inv]));

      // Validate availability for all items
      for (const item of order.items) {
        const inventory = inventoryMap.get(item.productId);

        if (!inventory) {
          throw new BusinessRuleError(
            ErrorCode.INVENTORY_NOT_FOUND,
            `Inventory not found for product ${item.productId}`,
            { productId: item.productId }
          );
        }

        const available = Number(inventory.physicalQuantity) - Number(inventory.reservedQuantity);

        if (available < Number(item.quantity)) {
          throw new BusinessRuleError(
            ErrorCode.INSUFFICIENT_INVENTORY,
            `Insufficient inventory for product ${item.productId}`,
            {
              productId: item.productId,
              requested: Number(item.quantity),
              available,
              physical: Number(inventory.physicalQuantity),
              reserved: Number(inventory.reservedQuantity),
            }
          );
        }
      }

      // Reserve inventory for all items
      const updatePromises = order.items.map((item) => {
        const inventory = inventoryMap.get(item.productId)!;
        const newReserved = Number(inventory.reservedQuantity) + Number(item.quantity);

        return Promise.all([
          tx.inventory.update({
            where: { productId: item.productId },
            data: { reservedQuantity: newReserved },
          }),
          tx.salesOrderItem.update({
            where: { id: item.id },
            data: { reservedQuantity: Number(item.quantity) },
          }),
        ]);
      });

      await Promise.all(updatePromises);

      // Update order status
      const confirmed = await tx.salesOrder.update({
        where: { id },
        data: {
          status: SalesOrderStatus.CONFIRMED,
          confirmedBy: userId,
          confirmedAt: new Date(),
        },
        include: {
          items: { include: { product: true } },
        },
      });

      return confirmed;
    });

    await this.logAudit(userId, 'SALES_ORDER_CONFIRMED', 'SalesOrder', id, {
      orderNumber: result.orderNumber,
    });

    // Log inventory reservation
    for (const item of result.items) {
      await this.logAudit(userId, 'INVENTORY_RESERVED', 'Inventory', item.productId, {
        quantity: item.quantity.toString(),
        orderId: id,
      });
    }

    return result;
  }

  /**
   * Cancel sales order
   * Releases reserved inventory if confirmed
   */
  async cancel(id: string, userId: string): Promise<SalesOrder> {
    return prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!order) {
        throw new NotFoundError('Sales Order', id);
      }

      if (!VALID_TRANSITIONS[order.status].includes(SalesOrderStatus.CANCELLED)) {
        throw new StateTransitionError(
          `Cannot cancel order with status ${order.status}`,
          { currentStatus: order.status }
        );
      }

      // Release reserved inventory if order was confirmed
      if (order.status === SalesOrderStatus.CONFIRMED) {
        for (const item of order.items) {
          if (Number(item.reservedQuantity) > 0) {
            await tx.$executeRaw`
              UPDATE inventory
              SET "reservedQuantity" = "reservedQuantity" - ${item.reservedQuantity}
              WHERE "productId" = ${item.productId}
            `;
          }
        }
      }

      const cancelled = await tx.salesOrder.update({
        where: { id },
        data: { status: SalesOrderStatus.CANCELLED },
      });

      await this.logAudit(userId, 'SALES_ORDER_CANCELLED', 'SalesOrder', id, {
        previousStatus: order.status,
      });

      return cancelled;
    });
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
