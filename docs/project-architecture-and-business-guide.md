# Fundroom ERP: Architecture, Strategy, and Business Logic

> Interactive project guide for product, engineering, operations, and QA teams.

<details>
<summary>How to use this guide</summary>

Use the contents links to navigate. Mermaid diagrams render in GitHub, GitLab, and modern Markdown viewers.

</details>

## Contents

- [Overview](#overview)
- [Strategy](#strategy)
- [Architecture](#architecture)
- [Workflow](#workflow)
- [Business rules](#business-rules)
- [Security](#security)
- [Data design](#data-design)
- [Testing and operations](#testing-and-operations)
- [Roadmap](#roadmap)

## Overview

Fundroom ERP is a modular ERP for industrial sales and fulfilment.

Customer -> Enquiry -> Quotation -> Approval -> Sales Order -> Reservation -> Dispatch

The backend is authoritative for prices, totals, permissions, state transitions, and stock. Commercial records stay traceable, critical inventory changes are transactional, and important actions are auditable.

## Strategy

| User | Responsibility | Main workspace |
|---|---|---|
| Sales user | Capture demand, prepare quotations, submit quotes | Enquiries and Quotations |
| Admin | Approve quotes, convert orders, reserve stock, dispatch | Quotations, Orders, Inventory, Dispatches |
| Operations lead | Monitor commercial and fulfilment health | Dashboard and operations |

The current product boundary is the order-to-fulfilment preparation path. Accounting, procurement, payroll, and advanced warehouse management are future capabilities.

## Architecture

Fundroom ERP is a modular monolith: one API deployable, logical domain modules, shared PostgreSQL, and explicit transaction boundaries.

~~~mermaid
flowchart LR
    Browser --> Web[React + Vite]
    Web --> Query[TanStack Query]
    Query --> API[Express REST API]
    API --> Middleware[JWT and role middleware]
    API --> Modules[Domain modules]
    Modules --> Prisma[Prisma ORM]
    Prisma --> DB[(PostgreSQL)]
    Modules --> Audit[Audit log]
~~~

Repository map:

~~~text
apps/api/prisma/       Schema, migrations, seed
apps/api/src/routes/   URL routing and role boundaries
apps/api/src/modules/  Domain controllers and services
apps/api/src/shared/   Errors, responses, identifiers
apps/web/src/pages/    Operational screens
apps/web/src/api/      API client, hooks, frontend types
docs/                  Architecture and operating guides
postman/               Automated API collection
~~~

## Workflow

~~~mermaid
flowchart TD
    A[NEW enquiry] --> B[QUOTED enquiry]
    B --> C[DRAFT quotation]
    C --> D[SENT quotation]
    D --> E[ACCEPTED quotation]
    D --> F[REJECTED quotation]
    E --> G[PENDING order]
    G --> H[CONFIRMED and reserved]
    H --> I[DISPATCHED and deducted]
~~~

| Entity | Allowed transitions |
|---|---|
| Enquiry | NEW -> QUOTED, NEW -> LOST, QUOTED -> WON, QUOTED -> LOST |
| Quotation | DRAFT -> SENT, SENT -> ACCEPTED, SENT -> REJECTED |
| Sales order | PENDING -> CONFIRMED/CANCELLED, CONFIRMED -> DISPATCHED/CANCELLED |

## Business rules

### Enquiries and quotations

- Recent NEW and QUOTED enquiries appear in the quotation form.
- Selecting an enquiry carries its customer and requested products into the draft.
- A linked quotation moves the enquiry to QUOTED in the same transaction.
- Accepting a linked quotation moves the enquiry to WON.

### Quotation totals

~~~text
baseAmount     = quantity * unitPrice
discountAmount = baseAmount * discountPercent / 100
taxableAmount  = baseAmount - discountAmount
gstAmount      = taxableAmount * gstPercent / 100
lineTotal      = taxableAmount + gstAmount
~~~

Special quotation discounts reduce taxable value before GST is recalculated. Money uses PostgreSQL/Prisma Decimal values; client previews are never final totals.

### Sales orders

- Only ACCEPTED quotations can create sales orders.
- DRAFT, SENT, and REJECTED quotations are rejected.
- The quotation relationship on SalesOrder is unique, preventing duplicate conversion.
- Only Admin can approve, convert, confirm, cancel, or dispatch.

### Inventory and dispatch

~~~text
availableQuantity = physicalQuantity - reservedQuantity
~~~

Order confirmation locks inventory rows with PostgreSQL FOR UPDATE, validates every line, and commits order plus reservation changes together. Dispatch validates remaining order quantity, reserved stock, and physical stock, then deducts stock in one transaction. Partial dispatches are supported.

## Security

JWT access tokens protect API requests. Refresh tokens are persisted, expirable, and revocable. Routes enforce roles and services repeat critical checks.

| Operation | Sales user | Admin |
|---|---:|---:|
| View master data and inventory | Yes | Yes |
| Create enquiry and quotation | Yes | Yes |
| Submit quotation | Yes | No ordinary path |
| Approve, convert, confirm, cancel | No | Yes |
| Adjust inventory and dispatch | No | Yes |

## Data design

~~~mermaid
erDiagram
    CUSTOMER ||--o{ ENQUIRY : submits
    ENQUIRY ||--o{ QUOTATION : produces
    QUOTATION ||--o| SALES_ORDER : converts_to
    SALES_ORDER ||--o{ DISPATCH : fulfils
    PRODUCT ||--o| INVENTORY : has
~~~

- UUIDs are internal primary keys.
- Human identifiers use ENQ, QUO, SO, and DSP year-based numbers.
- Monetary values use decimal types rather than floating point.
- Available inventory is derived rather than stored.
- Foreign keys, unique constraints, indexes, and audit metadata protect integrity.

See [database design](./database-design.md) for the detailed schema rationale.

## Testing and operations

| Test area | Protection |
|---|---|
| Quotation calculator | Discounts, GST, rounding, grand totals |
| Quotation conversion | Draft/rejected and duplicate prevention |
| Inventory concurrency | No overselling |
| Authorization | Restricted operations reject unauthorized roles |
| State transitions | Invalid lifecycle jumps are rejected |

Run the API suite:

~~~bash
cd apps/api
npm test
~~~

The [Postman collection](../postman/README.md) chains login, enquiry creation, quotation calculation, approval, conversion, unauthorized dispatch, inventory reservation, and dispatch creation.

Local startup:

~~~bash
docker-compose up -d
cd apps/api
npx prisma migrate dev
npx prisma db seed
npm run dev
~~~

Production priorities are managed secrets, migration-as-release, PostgreSQL backups, request IDs, connection-pool monitoring, and alerts for reservation, conversion, and dispatch failures.

## Roadmap

- PostgreSQL integration tests for real row-lock behavior.
- Server-side search and pagination for high-volume lists.
- Dispatch history and printable documents.
- Quotation PDF/email delivery.
- Warehouse locations, reservation expiry, procurement, accounting, and event integrations.

## References

- [Project README](../README.md)
- [Database design](./database-design.md)
- [Business rules](./business-rules.md)
- [Concurrency handling](./concurrency.md)
- [API documentation](./api.md)
- [Security documentation](./security.md)
- [Deployment guide](./deployment.md)
- [Postman guide](../postman/README.md)
