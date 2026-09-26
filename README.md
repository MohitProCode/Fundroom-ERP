# Fundroom ERP - Production Mini ERP System

A production-quality mini ERP application demonstrating strong software engineering practices with the PERN stack (PostgreSQL, Express, React, Node.js).

## Features

- **Customer Management**: Create and manage customer records
- **Product Catalog**: Industrial product management with SKU tracking
- **Inventory System**: Physical and reserved quantity tracking with concurrency-safe reservations
- **Enquiry Workflow**: NEW → QUOTED → WON/LOST
- **Quotation System**: Backend-calculated totals, discount and GST support
- **Sales Orders**: Conversion from accepted quotations, inventory reservation on confirmation
- **Dispatch Management**: Partial dispatches, automatic inventory updates
- **Role-Based Access Control**: ADMIN and SALES_USER roles
- **Audit Logging**: Track important business operations

## Tech Stack

### Backend
- Node.js + TypeScript
- Express.js
- Prisma ORM
- PostgreSQL
- JWT Authentication (Argon2id for passwords)
- Zod for validation

### Frontend
- React + TypeScript
- Vite
- TanStack Query
- React Router
- React Hook Form
- Tailwind CSS

### Infrastructure
- Docker + Docker Compose
- AWS (ECS Fargate, RDS, S3, CloudFront)

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Docker (optional, for local database)

### 1. Clone and Install

```bash
git clone <repository-url>
cd FundroomERP
npm install
```

### 2. Start PostgreSQL

Using Docker Compose:
```bash
docker-compose up -d
```

Or use your local PostgreSQL instance.

### 3. Configure Environment

```bash
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env`:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/fundroom_erp?schema=public"
JWT_SECRET="your-secret-key-change-in-production"
```

### 4. Run Migrations and Seed

```bash
cd apps/api
npx prisma migrate dev
npx prisma db seed
```

### 5. Start Development Servers

```bash
# Terminal 1 - Backend
cd apps/api
npm run dev

# Terminal 2 - Frontend
cd apps/web
npm run dev
```

### 6. Access the Application

- Frontend: http://localhost:5173
- API: http://localhost:3000
- API Docs: http://localhost:3000/api/docs (if Swagger configured)

### Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@fundroom.com | Admin@123 |
| Sales User | sales@fundroom.com | Sales@123 |

## Project Structure

```
FundroomERP/
├── apps/
│   ├── api/                    # Backend API
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # Database schema
│   │   │   ├── migrations/     # Migration files
│   │   │   └── seed.ts         # Seed data
│   │   └── src/
│   │       ├── modules/        # Feature modules
│   │       ├── middleware/     # Express middleware
│   │       ├── routes/         # Route definitions
│   │       └── shared/         # Shared utilities
│   └── web/                    # React frontend
│       └── src/
│           ├── api/            # API client & hooks
│           ├── components/     # React components
│           ├── context/        # React context
│           └── pages/          # Page components
├── docs/                       # Documentation
├── docker-compose.yml          # Local development database
└── package.json                # Workspace root
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Refresh token
- `POST /api/v1/auth/logout` - Logout
- `GET /api/v1/auth/me` - Current user

### Customers
- `GET /api/v1/customers` - List customers
- `GET /api/v1/customers/:id` - Get customer
- `POST /api/v1/customers` - Create customer

### Products & Inventory
- `GET /api/v1/products` - List products
- `POST /api/v1/products` - Create product (Admin)
- `GET /api/v1/inventory` - List inventory
- `POST /api/v1/inventory/:productId/adjust` - Adjust inventory (Admin)

### Enquiries
- `GET /api/v1/enquiries` - List enquiries
- `POST /api/v1/enquiries` - Create enquiry
- `PATCH /api/v1/enquiries/:id/status` - Update status

### Quotations
- `GET /api/v1/quotations` - List quotations
- `POST /api/v1/quotations` - Create quotation
- `PATCH /api/v1/quotations/:id/status` - Update status

### Sales Orders
- `GET /api/v1/sales-orders` - List orders
- `POST /api/v1/sales-orders/from-quotation` - Convert quotation
- `POST /api/v1/sales-orders/:id/confirm` - Confirm order (Admin)
- `POST /api/v1/sales-orders/:id/cancel` - Cancel order

### Dispatches
- `GET /api/v1/dispatches` - List dispatches
- `POST /api/v1/dispatches` - Create dispatch (Admin)

## Testing

```bash
# Run all tests
npm run test

# Run specific test file
npx vitest run quotation-calculator.test.ts

# Run with coverage
npm run test -- --coverage
```

### Test Coverage

- Quotation calculation (unit tests)
- State transitions (enquiry, quotation, sales order)
- Inventory concurrency
- Authorization checks

## Key Design Decisions

### 1. Backend-Authoritative Calculations
Quotation totals are calculated on the server, never trusted from the client.

### 2. Concurrency-Safe Inventory
Uses PostgreSQL row-level locking (`SELECT FOR UPDATE`) to prevent overselling.

### 3. Transactional Integrity
Critical operations (order confirmation, dispatch) use database transactions.

### 4. Derived Available Quantity
`available = physical - reserved` (calculated, not stored).

### 5. Modular Monolith
Single deployable unit with logical module separation, not microservices.

### 6. UUID + Business Identifiers
UUIDs for internal references, human-readable identifiers (ENQ-2026-000001) for display.

## Documentation

- [Architecture Overview](docs/architecture.md)
- [Database Design](docs/database-design.md)
- [Business Rules](docs/business-rules.md)
- [Concurrency Handling](docs/concurrency.md)
- [API Documentation](docs/api.md)
- [Security](docs/security.md)
- [Deployment Guide](docs/deployment.md)

## Deployment

See [docs/deployment.md](docs/deployment.md) for AWS deployment instructions.

## License

ISC
