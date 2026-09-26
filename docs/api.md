# API Documentation

## Base URL

```
Production: https://api.fundroom-erp.com/api/v1
Development: http://localhost:3000/api/v1
```

## Authentication

All protected endpoints require a Bearer token:

```
Authorization: Bearer <access_token>
```

Access tokens expire in 15 minutes. Use refresh tokens to obtain new access tokens.

---

## Authentication Endpoints

### POST /auth/login

Authenticate user and receive tokens.

**Request Body:**
```json
{
  "email": "admin@fundroom.com",
  "password": "Admin@123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "admin@fundroom.com",
      "name": "Admin User",
      "role": "ADMIN"
    },
    "accessToken": "eyJ...",
    "refreshToken": "uuid"
  }
}
```

**Errors:**
- `401`: INVALID_CREDENTIALS - Invalid email or password

### POST /auth/refresh

Refresh access token.

**Request Body:**
```json
{
  "refreshToken": "uuid"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "uuid"
  }
}
```

### POST /auth/logout

Logout and revoke refresh token.

**Headers:** Requires authentication

**Request Body:**
```json
{
  "refreshToken": "uuid"
}
```

### GET /auth/me

Get current authenticated user.

**Headers:** Requires authentication

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "admin@fundroom.com",
    "name": "Admin User",
    "role": "ADMIN"
  }
}
```

---

## Customers

### GET /customers

List all customers with pagination.

**Headers:** Requires authentication (ADMIN or SALES_USER)

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `search` (optional): Search by name, email, phone, GST

**Response (200):**
```json
{
  "success": true,
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5
  }
}
```

### GET /customers/:id

Get customer by ID.

**Headers:** Requires authentication

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Steel Corp Industries",
    "email": "info@steelcorp.com",
    "phone": "+91-9876543210",
    "gstNumber": "27AABCS1234A1Z5",
    ...
  }
}
```

### POST /customers

Create new customer.

**Headers:** Requires authentication (ADMIN or SALES_USER)

**Request Body:**
```json
{
  "name": "Steel Corp Industries",
  "email": "info@steelcorp.com",
  "phone": "+91-9876543210",
  "address": "Industrial Area, Phase 2",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400001",
  "gstNumber": "27AABCS1234A1Z5",
  "contactPerson": "Rajesh Kumar"
}
```

**Response (201):** Returns created customer

---

## Products

### GET /products

List all products with pagination.

**Headers:** Requires authentication

**Query Parameters:**
- `page`, `limit`, `search`

### GET /products/:id

Get product by ID with inventory information.

### POST /products

Create new product.

**Headers:** Requires authentication (ADMIN only)

**Request Body:**
```json
{
  "sku": "IND-001",
  "name": "Industrial Motor 5HP",
  "description": "Heavy duty industrial motor",
  "category": "Motors",
  "unit": "PCS"
}
```

---

## Inventory

### GET /inventory

List inventory with available quantities.

**Headers:** Requires authentication

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "productId": "uuid",
      "physicalQuantity": "100.00",
      "reservedQuantity": "20.00",
      "availableQuantity": "80.00",
      "product": {
        "id": "uuid",
        "sku": "IND-001",
        "name": "Industrial Motor 5HP"
      }
    }
  ]
}
```

### POST /inventory/:productId/adjust

Adjust physical inventory quantity.

**Headers:** Requires authentication (ADMIN only)

**Request Body:**
```json
{
  "quantity": 50,
  "reason": "Stock receipt from supplier"
}
```

**Note:** Positive quantity increases stock, negative decreases.

---

## Enquiries

### GET /enquiries

List enquiries with pagination.

**Query Parameters:**
- `page`, `limit`
- `status`: Filter by status (NEW, QUOTED, WON, LOST)
- `customerId`: Filter by customer

### GET /enquiries/:id

Get enquiry with items and customer details.

### POST /enquiries

Create new enquiry.

**Headers:** Requires authentication (ADMIN or SALES_USER)

**Request Body:**
```json
{
  "customerId": "uuid",
  "notes": "Urgent requirement",
  "items": [
    { "productId": "uuid", "quantity": 5 },
    { "productId": "uuid", "quantity": 3 }
  ]
}
```

### PATCH /enquiries/:id/status

Update enquiry status.

**Headers:** Requires authentication

**Request Body:**
```json
{
  "status": "QUOTED"
}
```

**Valid Transitions:**
- NEW → QUOTED, LOST
- QUOTED → WON, LOST

---

## Quotations

### GET /quotations

List quotations with pagination.

### GET /quotations/:id

Get quotation with calculated totals.

### POST /quotations

Create quotation (backend calculates totals).

**Headers:** Requires authentication

**Request Body:**
```json
{
  "enquiryId": "uuid",
  "customerId": "uuid",
  "validUntil": "2026-12-31",
  "terms": "Payment within 30 days",
  "items": [
    {
      "productId": "uuid",
      "quantity": 5,
      "unitPrice": 75000,
      "discountPercent": 5,
      "gstPercent": 18
    }
  ]
}
```

**Response (201):** Returns quotation with calculated totals

### PATCH /quotations/:id/status

Update quotation status.

**Valid Transitions:**
- DRAFT → SENT
- SENT → ACCEPTED, REJECTED

---

## Sales Orders

### GET /sales-orders

List sales orders with pagination.

### GET /sales-orders/:id

Get sales order with items, dispatches, and inventory status.

### POST /sales-orders/from-quotation

Convert accepted quotation to sales order.

**Headers:** Requires authentication (ADMIN or SALES_USER)

**Request Body:**
```json
{
  "quotationId": "uuid"
}
```

**Response (201):** Returns sales order in PENDING status

**Errors:**
- `422`: QUOTATION_NOT_ACCEPTED - Quotation must be accepted
- `409`: QUOTATION_ALREADY_CONVERTED - Quotation already has an order

### POST /sales-orders/:id/confirm

Confirm sales order and reserve inventory.

**Headers:** Requires authentication (ADMIN only)

**Response (200):** Returns order in CONFIRMED status

**Errors:**
- `403`: FORBIDDEN - Only ADMIN can confirm
- `422`: ORDER_NOT_CONFIRMABLE - Order must be PENDING
- `422`: INSUFFICIENT_INVENTORY - Not enough stock

### POST /sales-orders/:id/cancel

Cancel sales order.

**Headers:** Requires authentication

**Effects:**
- PENDING order: Simply cancelled
- CONFIRMED order: Reserved inventory released

---

## Dispatches

### GET /dispatches

List dispatches with pagination.

### GET /dispatches/:id

Get dispatch details.

### POST /dispatches

Create dispatch (reduce inventory).

**Headers:** Requires authentication (ADMIN only)

**Request Body:**
```json
{
  "salesOrderId": "uuid",
  "notes": "Partial shipment",
  "items": [
    { "productId": "uuid", "quantity": 3 }
  ]
}
```

**Response (201):** Returns dispatch record

**Errors:**
- `403`: FORBIDDEN - Only ADMIN can dispatch
- `422`: ORDER_CANCELLED - Cannot dispatch cancelled order
- `422`: DISPATCH_EXCEEDS_RESERVED - Quantity exceeds reserved

---

## Error Response Format

All errors follow this structure:

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_INVENTORY",
    "message": "Insufficient inventory for product IND-001",
    "details": {
      "productId": "uuid",
      "requested": 80,
      "available": 70
    },
    "requestId": "req-123"
  }
}
```

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | Invalid input data |
| UNAUTHORIZED | 401 | Authentication required |
| INVALID_CREDENTIALS | 401 | Wrong email/password |
| TOKEN_EXPIRED | 401 | JWT token expired |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| INVALID_STATE_TRANSITION | 400 | Invalid status change |
| QUOTATION_NOT_ACCEPTED | 422 | Quotation must be accepted |
| QUOTATION_ALREADY_CONVERTED | 409 | Quotation already has order |
| INSUFFICIENT_INVENTORY | 422 | Not enough stock |
| ORDER_NOT_CONFIRMABLE | 422 | Order must be PENDING |
| DISPATCH_EXCEEDS_RESERVED | 422 | Dispatch > reserved |

---

## Pagination

List endpoints support pagination:

```
GET /customers?page=2&limit=20
```

Response includes metadata:

```json
{
  "meta": {
    "page": 2,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

## Rate Limiting

Authentication endpoints have rate limiting:
- 10 requests per 15 minutes per IP
- Returns 429 when exceeded
