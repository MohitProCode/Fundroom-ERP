import { PrismaClient, Dispatch, SalesOrderStatus, Prisma } from '@prisma/client';
import { NotFoundError, BusinessRuleError, ErrorCode, AuthorizationError } from '../../shared/errors';
import { PaginationMeta } from '../../shared/types';
import { generateDispatchNumber } from '../../shared/utils/business-identifiers';
import { UserRole } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateDispatchInput {
  salesOrderId: string;
  notes?: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
}

export interface DispatchListResult {
  items: Dispatch[];
  meta: PaginationMeta;
}

export class DispatchesService {
  /**
   * List dispatches with pagination
   */
  async list(
    page: number = 1,
    limit: number = 10,
    salesOrderId?: string
  ): Promise<DispatchListResult> {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (salesOrderId) where.salesOrderId = salesOrderId;

    const [items, total] = await Promise.all([
      prisma.dispatch.findMany({
        where,
        skip,
        take: limit,
        include: {
          salesOrder: {
            select: { id: true, orderNumber: true, customer: { select: { id: true, name: true } } },
          },
          items: {
            include: {
              product: { select: { id: true, sku: true, name: true, unit: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.dispatch.count({ where }),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get dispatch by ID
   */
  async getById(id: string): Promise<Dispatch> {
    const dispatch = await prisma.dispatch.findUnique({
      where: { id },
      include: {
        salesOrder: {
          include: {
            customer: true,
            items: { include: { product: true } },
          },
        },
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!dispatch) {
      throw new NotFoundError('Dispatch', id);
    }

    return dispatch as Dispatch;
  }

  /**
   * Create dispatch (ADMIN only)
   * Transactional operation:
   * 1. Validate order is confirmed
   * 2. Lock inventory rows
   * 3. Verify dispatch quantity <= reserved quantity
   * 4. Decrease physical and reserved quantities
   * 5. Create dispatch record
   * 6. Update order status if fully dispatched
   */
  async create(data: CreateDispatchInput, userId: string): Promise<Dispatch> {
    // Verify user is ADMIN
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== UserRole.ADMIN) {
      throw new AuthorizationError('Only ADMIN can create dispatches');
    }

    return prisma.$transaction(async (tx) => {
      // Get sales order with items
      const order = await tx.salesOrder.findUnique({
        where: { id: data.salesOrderId },
        include: { items: true },
      });

      if (!order) {
        throw new NotFoundError('Sales Order', data.salesOrderId);
      }

      if (order.status === SalesOrderStatus.CANCELLED) {
        throw new BusinessRuleError(
          ErrorCode.ORDER_CANCELLED,
          'Cannot dispatch a cancelled order',
          { orderId: data.salesOrderId, status: order.status }
        );
      }

      if (order.status !== SalesOrderStatus.CONFIRMED && order.status !== SalesOrderStatus.DISPATCHED) {
        throw new BusinessRuleError(
          ErrorCode.ORDER_NOT_CONFIRMABLE,
          'Order must be confirmed before dispatch',
          { orderId: data.salesOrderId, status: order.status }
        );
      }

      // Build order items map
      const orderItemsMap = new Map(order.items.map((item) => [item.productId, item]));

      // Validate dispatch items
      for (const item of data.items) {
        const orderItem = orderItemsMap.get(item.productId);

        if (!orderItem) {
          throw new BusinessRuleError(
            ErrorCode.VALIDATION_ERROR,
            `Product ${item.productId} is not in the sales order`,
            { productId: item.productId }
          );
        }

        const alreadyDispatched = Number(orderItem.dispatchedQuantity);
        const ordered = Number(orderItem.quantity);
        const requested = item.quantity;

        if (requested > ordered - alreadyDispatched) {
          throw new BusinessRuleError(
            ErrorCode.DISPATCH_EXCEEDS_ORDER,
            `Dispatch quantity exceeds remaining quantity for product ${item.productId}`,
            {
              productId: item.productId,
              requested,
              ordered,
              alreadyDispatched,
              remaining: ordered - alreadyDispatched,
            }
          );
        }
      }

      // Lock inventory rows
      const productIds = data.items.map((item) => item.productId);
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

      // Validate and prepare inventory updates
      for (const item of data.items) {
        const inventory = inventoryMap.get(item.productId);

        if (!inventory) {
          throw new BusinessRuleError(
            ErrorCode.INVENTORY_NOT_FOUND,
            `Inventory not found for product ${item.productId}`,
            { productId: item.productId }
          );
        }

        const reserved = Number(inventory.reservedQuantity);
        const physical = Number(inventory.physicalQuantity);

        if (item.quantity > reserved) {
          throw new BusinessRuleError(
            ErrorCode.DISPATCH_EXCEEDS_RESERVED,
            `Dispatch quantity exceeds reserved quantity for product ${item.productId}`,
            {
              productId: item.productId,
              dispatchQuantity: item.quantity,
              reserved,
              physical,
            }
          );
        }

        if (item.quantity > physical) {
          throw new BusinessRuleError(
            ErrorCode.INVALID_QUANTITY,
            `Insufficient physical stock for product ${item.productId}`,
            {
              productId: item.productId,
              dispatchQuantity: item.quantity,
              physical,
            }
          );
        }
      }

      // Update inventory and order items
      for (const item of data.items) {
        const inventory = inventoryMap.get(item.productId)!;
        const orderItem = orderItemsMap.get(item.productId)!;

        // Decrease physical and reserved quantities
        await tx.inventory.update({
          where: { productId: item.productId },
          data: {
            physicalQuantity: Number(inventory.physicalQuantity) - item.quantity,
            reservedQuantity: Number(inventory.reservedQuantity) - item.quantity,
          },
        });

        // Update dispatched quantity on order item
        await tx.salesOrderItem.update({
          where: { id: orderItem.id },
          data: {
            dispatchedQuantity: Number(orderItem.dispatchedQuantity) + item.quantity,
          },
        });
      }

      // Create dispatch record
      const dispatchNumber = await generateDispatchNumber();
      const dispatch = await tx.dispatch.create({
        data: {
          dispatchNumber,
          salesOrderId: data.salesOrderId,
          notes: data.notes,
          createdBy: userId,
          items: {
            create: data.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
            })),
          },
        },
        include: {
          items: { include: { product: true } },
        },
      });

      // Check if all items are fully dispatched
      const allItemsDispatched = order.items.every(
        (item) => Number(item.dispatchedQuantity) + (data.items.find((d) => d.productId === item.productId)?.quantity || 0) >= Number(item.quantity)
      );

      if (allItemsDispatched && order.status !== SalesOrderStatus.DISPATCHED) {
        await tx.salesOrder.update({
          where: { id: data.salesOrderId },
          data: { status: SalesOrderStatus.DISPATCHED },
        });
      }

      await this.logAudit(userId, 'DISPATCH_CREATED', 'Dispatch', dispatch.id, {
        dispatchNumber: dispatch.dispatchNumber,
        salesOrderId: data.salesOrderId,
      });

      return dispatch;
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
