# Concurrency: Inventory Reservation

## The Problem

Consider this race condition scenario:

```
Initial State:
  Product A: physical = 100, reserved = 0, available = 100

Request 1: Reserve 80 units
Request 2: Reserve 50 units

Without proper locking, both requests could:
1. Read available = 100
2. Both decide 100 >= requested
3. Both update reserved
4. Final: reserved = 130 (INVALID!)
```

This violates the invariant: `reserved <= physical`

## The Solution: Row-Level Locking

We use PostgreSQL's `SELECT ... FOR UPDATE` within a transaction to prevent race conditions.

### Implementation

```typescript
async confirm(id: string, userId: string): Promise<SalesOrder> {
  return prisma.$transaction(async (tx) => {
    // 1. Get order items
    const order = await tx.salesOrder.findUnique({
      where: { id },
      include: { items: true },
    });

    // 2. LOCK inventory rows for all products
    const inventories = await tx.$queryRaw`
      SELECT id, "productId", "physicalQuantity", "reservedQuantity"
      FROM inventory
      WHERE "productId" IN (${Prisma.join(productIds)})
      FOR UPDATE
    `;

    // 3. Validate availability
    for (const item of order.items) {
      const inventory = inventoryMap.get(item.productId);
      const available = physical - reserved;

      if (available < requested) {
        throw new BusinessRuleError(ErrorCode.INSUFFICIENT_INVENTORY, ...);
      }
    }

    // 4. Update reserved quantities
    await tx.inventory.update({
      where: { productId: item.productId },
      data: { reservedQuantity: reserved + requested },
    });

    // 5. Update order status
    await tx.salesOrder.update({
      where: { id },
      data: { status: SalesOrderStatus.CONFIRMED },
    });

    // Transaction commits (locks released)
  });
}
```

### How It Works

1. **BEGIN TRANSACTION**
2. **SELECT ... FOR UPDATE** - Locks rows, other transactions wait
3. **VALIDATE** - Check availability with guaranteed consistent read
4. **UPDATE** - Modify reserved quantity
5. **COMMIT** - Release locks, other transactions can proceed

If validation fails, transaction rolls back, locks released, no partial state.

## Why Not Other Approaches?

### ❌ Optimistic Locking (Version Column)

```sql
UPDATE inventory
SET reserved = reserved + 80, version = version + 1
WHERE id = X AND version = 5;
```

**Problem:** Doesn't prevent the race condition, just detects it after the fact. Users get retry errors instead of clear "insufficient inventory" messages.

### ❌ Application-Level Mutex

**Problem:** Doesn't work in distributed deployments with multiple API instances.

### ❌ Read-Modify-Write Without Locking

```typescript
const inv = await readInventory();
if (inv.available >= requested) {
  await updateReserved(inv.reserved + requested);
}
```

**Problem:** Classic race condition. Two requests can both pass the check before either updates.

### ✅ Row-Level Locking (Our Choice)

**Advantages:**
- Atomic operation guaranteed by database
- Works in distributed deployments
- Clear error messages for business rules
- No custom synchronization code
- Scales well with PostgreSQL

## Concurrency Test

The project includes an automated concurrency test that verifies:

```
Scenario:
  Available = 100
  Request A = 80
  Request B = 50

Expected:
  One succeeds (reserved = 80)
  One fails with INSUFFICIENT_INVENTORY

NOT:
  Both succeed with reserved = 130
```

See `src/__tests__/inventory-concurrency.test.ts`

## Other Concurrency Concerns

### Quotation Conversion

Prevented by database unique constraint:

```sql
ALTER TABLE sales_orders ADD CONSTRAINT unique_quotation_id UNIQUE (quotation_id);
```

Two concurrent conversions would result in:
1. Both check if quotation already converted (both see "no")
2. Both attempt INSERT
3. One succeeds
4. One fails with unique constraint violation

### Dispatch Creation

Uses same row-level locking approach:

```sql
SELECT * FROM inventory WHERE productId IN (...) FOR UPDATE;
```

Ensures dispatch doesn't exceed reserved quantity.

## Best Practices

1. **Keep transactions short** - Long transactions hold locks longer
2. **Lock only what you need** - Minimize lock scope
3. **Handle deadlocks** - PostgreSQL may detect and abort one transaction
4. **Use consistent lock order** - Always lock products in same order to prevent deadlocks
5. **Test under load** - Verify with concurrent requests, not just sequential tests
