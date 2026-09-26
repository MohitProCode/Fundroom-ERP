# Database Design

## Why PostgreSQL?

PostgreSQL is the core of this ERP system for several critical reasons:

1. **ACID Compliance**: Full transactional integrity for financial operations
2. **Row-Level Locking**: Essential for concurrency-safe inventory reservation
3. **Decimal Precision**: Native NUMERIC type for monetary values
4. **Relational Integrity**: Foreign keys, constraints, cascading deletes
5. **JSON Support**: Flexible metadata storage when needed
6. **Performance**: Excellent query planner, indexing strategies

## Entity-Relationship Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    User     │     │   Customer  │     │   Product   │
├─────────────┤     ├─────────────┤     ├─────────────┤
│ id          │     │ id          │     │ id          │
│ email       │     │ name        │     │ sku         │
│ password    │     │ email       │     │ name        │
│ name        │     │ phone       │     │ category    │
│ role        │     │ gstNumber   │     │ unit        │
└─────────────┘     └─────────────┘     └─────────────┘
                            │                   │
                            │                   │
                            ▼                   ▼
                      ┌─────────────────────────────┐
                      │         Inventory           │
                      ├─────────────────────────────┤
                      │ productId (FK)              │
                      │ physicalQuantity (DECIMAL)  │
                      │ reservedQuantity (DECIMAL)  │
                      │ available = physical - res  │
                      └─────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
        ▼                                       ▼
┌─────────────┐                         ┌─────────────┐
│   Enquiry   │                         │  Quotation  │
├─────────────┤                         ├─────────────┤
│ id          │◄────────────────────────│ enquiryId   │
│ enquiryNum  │                         │ quotationNum│
│ customerId  │─────────────────────────│ customerId  │
│ status      │                         │ status      │
└─────────────┘                         │ grandTotal  │
                                        └─────────────┘
                                              │
                                              ▼
                                        ┌─────────────┐
                                        │ SalesOrder  │
                                        ├─────────────┤
                                        │ quotationId │ (UNIQUE)
                                        │ customerId  │
                                        │ status      │
                                        └─────────────┘
                                              │
                                              ▼
                                        ┌─────────────┐
                                        │  Dispatch   │
                                        ├─────────────┤
                                        │ salesOrderId│
                                        │ dispatchNum │
                                        └─────────────┘
```

## Core Design Decisions

### 1. UUIDs for Entity IDs

All primary keys use UUIDs:

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
```

**Why?**
- No sequential ID guessing
- Can be generated client-side
- Safe for distributed systems

### 2. Human-Readable Business Identifiers

Business entities have unique, sequential identifiers:

```
ENQ-2026-000001  (Enquiry)
QUO-2026-000001  (Quotation)
SO-2026-000001   (Sales Order)
DSP-2026-000001  (Dispatch)
```

**Why?**
- Easy for humans to reference
- Contains year for quick identification
- Sequential within year

### 3. Decimal Precision for Money

All monetary fields use `DECIMAL(14, 2)`:

```sql
unit_price DECIMAL(14, 2)
grand_total DECIMAL(14, 2)
```

**Why not FLOAT?**
- FLOAT has rounding errors
- DECIMAL is exact
- Critical for financial calculations

### 4. Derived Available Quantity

Available quantity is **not stored** in the database:

```sql
-- This is calculated, not stored
available_quantity = physical_quantity - reserved_quantity
```

**Why?**
- Single source of truth (physical and reserved)
- No synchronization issues
- Always consistent

### 5. Unique Constraint on Quotation → Sales Order

```sql
ALTER TABLE sales_orders ADD CONSTRAINT unique_quotation_id UNIQUE (quotation_id);
```

**Why?**
- Prevents duplicate order creation
- Database-level enforcement
- Works even under concurrent requests

### 6. Row-Level Locking for Inventory

Inventory reservation uses explicit locking:

```sql
SELECT * FROM inventory WHERE "productId" IN (...) FOR UPDATE;
```

**Why?**
- Prevents race conditions
- Ensures consistent reads within transaction
- Critical for overselling prevention

## Key Constraints

### Inventory Integrity

```sql
physical_quantity >= 0
reserved_quantity >= 0
reserved_quantity <= physical_quantity
```

Enforced at application level with transaction boundaries.

### Status Transitions

Status transitions are validated in the application layer:

```typescript
const VALID_TRANSITIONS: Record<Status, Status[]> = {
  PENDING: [CONFIRMED, CANCELLED],
  CONFIRMED: [DISPATCHED, CANCELLED],
  DISPATCHED: [],
  CANCELLED: [],
};
```

### Foreign Key Cascading

```sql
-- Enquiry items cascade on delete
ON DELETE CASCADE

-- Refresh tokens cascade when user deleted
ON DELETE CASCADE
```

## Indexes

Strategic indexes for common queries:

```sql
-- Business identifier lookups
CREATE INDEX idx_enquiry_number ON enquiries(enquiry_number);
CREATE INDEX idx_quotation_number ON quotations(quotation_number);
CREATE INDEX idx_order_number ON sales_orders(order_number);

-- Foreign key indexes
CREATE INDEX idx_enquiry_customer ON enquiries(customer_id);
CREATE INDEX idx_quotation_customer ON quotations(customer_id);

-- Status filters
CREATE INDEX idx_enquiry_status ON enquiries(status);
CREATE INDEX idx_quotation_status ON quotations(status);

-- Audit log queries
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);
```

## Audit Logging

Lightweight audit trail for business operations:

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  actor_id UUID REFERENCES users(id),
  action VARCHAR(50),
  entity_type VARCHAR(50),
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMP
);
```

**Tracked Actions:**
- Authentication events
- Enquiry lifecycle
- Quotation acceptance/rejection
- Sales order confirmation
- Inventory reservation/release
- Dispatch creation

## Migration Strategy

Using Prisma migrations:

```bash
# Development
npx prisma migrate dev --name description

# Production
npx prisma migrate deploy
```

**Why Prisma Migrations?**
- Version controlled
- Declarative schema
- Automatic SQL generation
- Safe for production deployments
