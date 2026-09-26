import { PrismaClient, Inventory } from '@prisma/client';
import { NotFoundError, BusinessRuleError, ErrorCode } from '../../shared/errors';
import { PaginationMeta } from '../../shared/types';
import { Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export interface InventoryWithAvailable extends Inventory {
  availableQuantity: Prisma.Decimal;
}

export interface InventoryListResult {
  items: Array<InventoryWithAvailable & { product: { id: string; sku: string; name: string } }>;
  meta: PaginationMeta;
}

export interface AdjustInventoryInput {
  productId: string;
  quantity: number;
  reason?: string;
}

export class InventoryService {
  /**
   * List inventory with pagination
   */
  async list(
    page: number = 1,
    limit: number = 10,
    search?: string
  ): Promise<InventoryListResult> {
    const skip = (page - 1) * limit;

    const where = search
      ? {
          product: {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { sku: { contains: search, mode: 'insensitive' as const } },
            ],
          },
        }
      : {};

    const [items, total] = await Promise.all([
      prisma.inventory.findMany({
        where,
        skip,
        take: limit,
        include: {
          product: {
            select: { id: true, sku: true, name: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.inventory.count({ where }),
    ]);

    const itemsWithAvailable = items.map((item) => ({
      ...item,
      availableQuantity: item.physicalQuantity.minus(item.reservedQuantity),
    }));

    return {
      items: itemsWithAvailable,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get inventory by product ID
   */
  async getByProductId(productId: string): Promise<InventoryWithAvailable> {
    const inventory = await prisma.inventory.findUnique({
      where: { productId },
    });

    if (!inventory) {
      throw new NotFoundError('Inventory', productId);
    }

    return {
      ...inventory,
      availableQuantity: inventory.physicalQuantity.minus(inventory.reservedQuantity),
    };
  }

  /**
   * Get inventory for multiple products (with row-level locking)
   */
  async getInventoryForUpdate(productIds: string[]): Promise<Map<string, Inventory>> {
    const inventories = await prisma.$queryRaw<Inventory[]>`
      SELECT * FROM inventory
      WHERE "productId" IN (${Prisma.join(productIds)})
      FOR UPDATE
    `;

    const map = new Map<string, Inventory>();
    for (const inv of inventories) {
      map.set(inv.productId, inv);
    }

    return map;
  }

  /**
   * Adjust physical quantity (ADMIN only)
   */
  async adjustPhysicalQuantity(
    productId: string,
    adjustment: number,
    actorId: string
  ): Promise<Inventory> {
    const inventory = await this.getByProductId(productId);

    const newPhysical = Number(inventory.physicalQuantity) + adjustment;

    if (newPhysical < 0) {
      throw new BusinessRuleError(
        ErrorCode.INVALID_QUANTITY,
        'Physical quantity cannot be negative',
        {
          current: inventory.physicalQuantity.toString(),
          adjustment,
          result: newPhysical,
        }
      );
    }

    if (newPhysical < Number(inventory.reservedQuantity)) {
      throw new BusinessRuleError(
        ErrorCode.INVALID_QUANTITY,
        'Physical quantity cannot be less than reserved quantity',
        {
          current: inventory.physicalQuantity.toString(),
          adjustment,
          reserved: inventory.reservedQuantity.toString(),
        }
      );
    }

    const updated = await prisma.inventory.update({
      where: { productId },
      data: { physicalQuantity: newPhysical },
    });

    await this.logAudit(actorId, 'INVENTORY_ADJUSTED', 'Inventory', productId, {
      adjustment,
      previousPhysical: inventory.physicalQuantity.toString(),
      newPhysical: updated.physicalQuantity.toString(),
    });

    return updated;
  }

  /**
   * Reserve inventory (used in sales order confirmation)
   * MUST be called within a transaction with row-level locking
   */
  async reserveInventory(
    tx: Prisma.TransactionClient,
    productId: string,
    quantity: number
  ): Promise<Inventory> {
    const inventory = await tx.inventory.findUnique({
      where: { productId },
    });

    if (!inventory) {
      throw new NotFoundError('Inventory', productId);
    }

    const available = inventory.physicalQuantity.minus(inventory.reservedQuantity);

    if (available.lessThan(quantity)) {
      throw new BusinessRuleError(
        ErrorCode.INSUFFICIENT_INVENTORY,
        `Insufficient inventory for product ${productId}`,
        {
          productId,
          requested: quantity,
          available: available.toString(),
          physical: inventory.physicalQuantity.toString(),
          reserved: inventory.reservedQuantity.toString(),
        }
      );
    }

    return tx.inventory.update({
      where: { productId },
      data: {
        reservedQuantity: inventory.reservedQuantity.plus(quantity),
      },
    });
  }

  /**
   * Release reserved inventory (used in dispatch or order cancellation)
   * MUST be called within a transaction
   */
  async releaseReservedInventory(
    tx: Prisma.TransactionClient,
    productId: string,
    quantity: number
  ): Promise<Inventory> {
    const inventory = await tx.inventory.findUnique({
      where: { productId },
    });

    if (!inventory) {
      throw new NotFoundError('Inventory', productId);
    }

    const newReserved = inventory.reservedQuantity.minus(quantity);

    if (newReserved.lessThan(0)) {
      throw new BusinessRuleError(
        ErrorCode.INVALID_QUANTITY,
        'Cannot release more than reserved quantity',
        {
          productId,
          releaseQuantity: quantity,
          currentReserved: inventory.reservedQuantity.toString(),
        }
      );
    }

    return tx.inventory.update({
      where: { productId },
      data: { reservedQuantity: newReserved },
    });
  }

  /**
   * Dispatch inventory (reduce physical and reserved)
   * MUST be called within a transaction
   */
  async dispatchInventory(
    tx: Prisma.TransactionClient,
    productId: string,
    quantity: number
  ): Promise<Inventory> {
    const inventory = await tx.inventory.findUnique({
      where: { productId },
    });

    if (!inventory) {
      throw new NotFoundError('Inventory', productId);
    }

    const newPhysical = inventory.physicalQuantity.minus(quantity);
    const newReserved = inventory.reservedQuantity.minus(quantity);

    if (newPhysical.lessThan(0)) {
      throw new BusinessRuleError(
        ErrorCode.INVALID_QUANTITY,
        'Physical quantity cannot go negative',
        { productId, quantity, current: inventory.physicalQuantity.toString() }
      );
    }

    if (newReserved.lessThan(0)) {
      throw new BusinessRuleError(
        ErrorCode.DISPATCH_EXCEEDS_RESERVED,
        'Dispatch quantity exceeds reserved quantity',
        {
          productId,
          dispatchQuantity: quantity,
          reserved: inventory.reservedQuantity.toString(),
        }
      );
    }

    return tx.inventory.update({
      where: { productId },
      data: {
        physicalQuantity: newPhysical,
        reservedQuantity: newReserved,
      },
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
