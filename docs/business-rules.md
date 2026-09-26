# Business Rules

## Customer

### Creation Rules
- Email must be unique if provided
- GST number must be unique if provided
- Phone number is optional

### Deletion Rules
- Cannot hard delete if sales orders exist
- Soft delete (set `isActive = false`) for customers with orders

## Product

### Creation Rules
- SKU must be unique
- Unit defaults to "PCS" if not specified

### Deletion Rules
- Soft delete only (set `isActive = false`)
- Preserves historical data in orders

## Inventory Model

### Core Principle

```
available_quantity = physical_quantity - reserved_quantity
```

**Available quantity is DERIVED, not stored.**

### Constraints

1. `physical_quantity >= 0` (no negative stock)
2. `reserved_quantity >= 0` (no negative reservations)
3. `reserved_quantity <= physical_quantity` (cannot reserve more than exists)

### Operations

| Operation | Physical | Reserved | Available |
|-----------|----------|----------|-----------|
| Stock Receipt | +N | 0 | +N |
| Reservation | 0 | +N | -N |
| Dispatch | -N | -N | 0 |
| Cancellation | 0 | -N | +N |

## Enquiry Workflow

### Status Flow

```
NEW → QUOTED → WON
              ↘ LOST
```

### Rules

1. **NEW**: Initial state when created
2. **QUOTED**: At least one quotation has been created
3. **WON**: A quotation was accepted and converted
4. **LOST**: Customer declined or no longer interested

### Transitions

| From | To | Trigger |
|------|-----|---------|
| NEW | QUOTED | First quotation created |
| NEW | LOST | Marked as lost |
| QUOTED | WON | Quotation accepted |
| QUOTED | LOST | All quotations rejected |

**Invalid Transitions:**
- NEW → WON (must go through QUOTED)
- WON/LOST → any other state

## Quotation Workflow

### Status Flow

```
DRAFT → SENT → ACCEPTED
              ↘ REJECTED
```

### Rules

1. **DRAFT**: Quotation being prepared, not sent to customer
2. **SENT**: Quotation sent to customer, awaiting response
3. **ACCEPTED**: Customer approved, ready for conversion
4. **REJECTED**: Customer declined

### Calculation Rules (Backend-Authoritative)

For each line item:

```
base_amount = quantity × unit_price
discount_amount = base_amount × discount_percent / 100
taxable_amount = base_amount - discount_amount
gst_amount = taxable_amount × gst_percent / 100
line_total = taxable_amount + gst_amount
```

Grand total:

```
grand_total = sum(line_total)
```

**Critical:** The frontend may display calculations, but backend MUST recalculate and verify.

### Valid Until

- Quotations should have an expiration date
- Expired quotations should not be convertible (business decision)

### Conversion Rules

1. Only **ACCEPTED** quotations can convert to sales orders
2. One quotation → one sales order (enforced by database unique constraint)
3. Conversion copies all line items with calculated totals
4. No inventory reservation at conversion time (only at confirmation)

## Sales Order Workflow

### Status Flow

```
PENDING → CONFIRMED → DISPATCHED
         ↘           ↘
          CANCELLED  CANCELLED
```

### Rules

1. **PENDING**: Created from accepted quotation, awaiting inventory confirmation
2. **CONFIRMED**: Inventory reserved, ready for dispatch
3. **DISPATCHED**: All items shipped
4. **CANCELLED**: Order cancelled

### Confirmation Rules (ADMIN Only)

1. User must have ADMIN role
2. Order must be in PENDING status
3. Inventory must be available for all items
4. Reservation happens atomically in a transaction

**Concurrency-Safe Reservation:**
```
1. Lock inventory rows (SELECT FOR UPDATE)
2. Calculate available = physical - reserved
3. Validate available >= requested
4. Update reserved_quantity
5. Update order status
6. Commit transaction
```

### Cancellation Rules

| Status | Can Cancel? | Effect |
|--------|-------------|--------|
| PENDING | Yes | Order cancelled, no inventory impact |
| CONFIRMED | Yes | Order cancelled, reserved inventory released |
| DISPATCHED | No | Cannot cancel shipped orders |

**Future Enhancement:** Allow partial cancellation for CONFIRMED orders.

## Dispatch Rules

### Authorization

- Only ADMIN can create dispatches

### Prerequisites

1. Order must be CONFIRMED (or already partially DISPATCHED)
2. Dispatch quantity cannot exceed reserved quantity
3. Each dispatch reduces both physical and reserved quantities

### Transaction Flow

```
1. Verify order status
2. Lock inventory rows
3. Validate dispatch <= reserved
4. Decrease physical_quantity
5. Decrease reserved_quantity
6. Create dispatch record
7. If all items dispatched, update order to DISPATCHED
```

### Partial Dispatch

- Multiple dispatches allowed per order
- Track `dispatched_quantity` per item
- Order becomes DISPATCHED when all items fully dispatched

## Role-Based Access Control

### Roles

| Role | Permissions |
|------|-------------|
| ADMIN | All operations including confirm, dispatch, inventory adjust |
| SALES_USER | Create customers, enquiries, quotations, view inventory |

### Protected Operations

| Operation | Required Role |
|-----------|---------------|
| Create/Update Customer | ADMIN, SALES_USER |
| Create/Update Product | ADMIN |
| Adjust Inventory | ADMIN |
| Create Enquiry | ADMIN, SALES_USER |
| Create Quotation | ADMIN, SALES_USER |
| Convert Quotation | ADMIN, SALES_USER |
| Confirm Sales Order | ADMIN only |
| Create Dispatch | ADMIN only |
| Cancel Order | ADMIN, SALES_USER (with restrictions) |

## Error Handling

### Domain Error Codes

| Code | Meaning |
|------|---------|
| INSUFFICIENT_INVENTORY | Not enough stock available |
| QUOTATION_NOT_ACCEPTED | Quotation must be accepted first |
| QUOTATION_ALREADY_CONVERTED | Quotation already has a sales order |
| INVALID_STATE_TRANSITION | Status change not allowed |
| ORDER_NOT_CONFIRMABLE | Order must be PENDING |
| DISPATCH_EXCEEDS_RESERVED | Cannot dispatch more than reserved |
| UNAUTHORIZED | Authentication required |
| FORBIDDEN | Role not permitted |

### Response Format

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_INVENTORY",
    "message": "Insufficient inventory for product IND-001",
    "details": {
      "productId": "abc-123",
      "requested": 80,
      "available": 70
    },
    "requestId": "req-456"
  }
}
```
