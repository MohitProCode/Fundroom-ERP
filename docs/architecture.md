# Architecture Overview

## System Architecture

Fundroom ERP is a production-quality mini ERP system built using the **PERN stack** (PostgreSQL, Express, React, Node.js) following a **modular monolith** architecture.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Frontend (React)                          │
│  - Vite + TypeScript                                                │
│  - TanStack Query for server state                                  │
│  - React Router for navigation                                      │
│  - React Hook Form + Zod for forms/validation                       │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Backend API (Express)                        │
│  - RESTful API (versioned)                                          │
│  - JWT authentication                                               │
│  - Role-based access control (RBAC)                                 │
│  - Modular monolith structure                                       │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Database (PostgreSQL)                          │
│  - Relational data model                                            │
│  - Row-level locking for concurrency                                │
│  - Prisma ORM                                                       │
│  - Decimal precision for monetary values                            │
└─────────────────────────────────────────────────────────────────────┘
```

## Why Modular Monolith?

We chose a **modular monolith** architecture over microservices because:

1. **Simplicity**: Single deployment unit, easier to develop and debug
2. **Transaction boundaries**: Native ACID transactions across modules
3. **Lower operational complexity**: No service mesh, distributed tracing, or inter-service communication
4. **Development speed**: Faster iteration during early development
5. **Team size**: Appropriate for small to medium teams

Each module (auth, customers, products, inventory, enquiries, quotations, sales-orders, dispatches) is logically separated but shares the same database connection and deployment.

## Technology Choices

### Backend

| Technology | Rationale |
|------------|-----------|
| **Node.js + TypeScript** | Type safety, excellent ecosystem, fast development |
| **Express.js** | Mature, minimalist, well-understood |
| **Prisma ORM** | Type-safe database access, excellent migrations, SQL generation |
| **PostgreSQL** | ACID compliance, row-level locking, relational integrity |
| **Zod** | Runtime validation, TypeScript integration |
| **JWT** | Stateless authentication, scalable |
| **Argon2id** | Secure password hashing, resistant to timing attacks |

### Frontend

| Technology | Rationale |
|------------|-----------|
| **React + TypeScript** | Type safety, component reusability |
| **Vite** | Fast development server, optimized builds |
| **TanStack Query** | Server state management, caching, automatic refetching |
| **React Router** | Declarative routing |
| **React Hook Form** | Performant form handling |
| **Tailwind CSS** | Utility-first styling, rapid UI development |

## Module Structure

```
apps/api/src/
├── modules/
│   ├── auth/              # Authentication & authorization
│   ├── customers/         # Customer management
│   ├── products/          # Product catalog
│   ├── inventory/         # Inventory tracking & reservation
│   ├── enquiries/         # Enquiry workflow
│   ├── quotations/        # Quotation calculation & workflow
│   ├── sales-orders/      # Order processing & confirmation
│   └── dispatches/        # Dispatch management
├── middleware/            # Cross-cutting concerns
├── routes/               # Route definitions
├── shared/               # Shared utilities, types, errors
└── app.ts               # Application factory
```

## Key Architectural Patterns

### 1. Layered Architecture

Each module follows a layered pattern:

```
Controller → Service → Repository (Prisma)
```

- **Controllers**: Request parsing, validation, response formatting
- **Services**: Business logic, transactions, domain rules
- **Prisma**: Data access, query generation

### 2. Backend-Authoritative

All business rules are enforced on the backend:

- Quotation totals are calculated server-side
- Authorization is verified on every request
- Inventory availability is checked in transactions
- Status transitions are validated

The frontend is purely presentational and cannot be trusted for business logic.

### 3. Transactional Integrity

Critical operations use database transactions:

- Sales order confirmation (inventory reservation)
- Dispatch (inventory reduction)
- Order cancellation (inventory release)

### 4. State Machines

Business entities follow explicit state transitions:

```
Enquiry:    NEW → QUOTED → WON/LOST
Quotation:  DRAFT → SENT → ACCEPTED/REJECTED
SalesOrder: PENDING → CONFIRMED → DISPATCHED
```

Invalid transitions return domain errors.

## Request Flow

```
HTTP Request
    │
    ▼
Request ID Middleware
    │
    ▼
Authentication Middleware
    │
    ▼
Authorization Middleware (role check)
    │
    ▼
Controller (validation, parsing)
    │
    ▼
Service (business logic, transactions)
    │
    ▼
Prisma (database operations)
    │
    ▼
Response
```

## Error Handling

Centralized error handling with consistent response structure:

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_INVENTORY",
    "message": "Insufficient inventory for product P-1001",
    "details": {
      "requested": 80,
      "available": 70
    },
    "requestId": "abc-123"
  }
}
```

## Security Architecture

1. **Authentication**: JWT with refresh tokens
2. **Authorization**: Role-based access control (RBAC)
3. **Password Security**: Argon2id hashing
4. **Input Validation**: Zod schemas on all inputs
5. **SQL Injection Prevention**: Prisma parameterized queries
6. **Rate Limiting**: On authentication endpoints
7. **Security Headers**: Helmet middleware

## Observability

1. **Structured Logging**: JSON logs for CloudWatch
2. **Request IDs**: Trace requests across logs
3. **Audit Logging**: Business operations tracked
4. **Health Endpoints**: `/health` and `/ready` for monitoring
