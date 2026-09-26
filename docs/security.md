# Security

## Authentication

### Password Security

- **Algorithm**: Argon2id (winner of Password Hashing Competition)
- **Work factor**: Memory-hard, resistant to GPU attacks
- **Storage**: Only hashed passwords stored, never plaintext

```typescript
import argon2 from 'argon2';

// Hashing
const hash = await argon2.hash(password);

// Verification
const isValid = await argon2.verify(hash, password);
```

### JWT Implementation

- **Algorithm**: HS256
- **Access Token Expiry**: 15 minutes
- **Refresh Token Expiry**: 7 days
- **Storage**: Refresh tokens stored in database with revocation support

**JWT Payload:**
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "ADMIN",
  "name": "User Name",
  "iat": 1234567890,
  "exp": 1234568790
}
```

**Best Practices:**
- Short-lived access tokens limit exposure if compromised
- Refresh tokens can be revoked server-side
- Tokens validated on every request

## Authorization

### Role-Based Access Control (RBAC)

Two roles implemented:

| Role | Permissions |
|------|-------------|
| ADMIN | Full access: manage inventory, confirm orders, dispatch |
| SALES_USER | Create customers, enquiries, quotations; view inventory |

### Authorization Middleware

```typescript
export function requireRole(...allowedRoles: UserRole[]) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }
    next();
  };
}
```

### Backend Enforcement

Authorization is **always** verified on the backend:

```typescript
// ❌ Wrong - frontend only
<button disabled={!isAdmin}>Confirm Order</button>

// ✅ Correct - backend check
if (user.role !== UserRole.ADMIN) {
  throw new AuthorizationError('Only ADMIN can confirm orders');
}
```

## Input Validation

### Zod Schemas

All input validated with Zod:

```typescript
const createQuotationSchema = z.object({
  customerId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
  })).min(1),
});
```

### Benefits

- Type inference for TypeScript
- Runtime validation
- Clear error messages
- Prevents malformed data

## SQL Injection Prevention

### Prisma Parameterized Queries

All queries use parameterized statements:

```typescript
// ✅ Safe - Prisma generates parameterized SQL
await prisma.user.findUnique({ where: { email } });

// ✅ Safe - Raw query with parameters
await prisma.$queryRaw`SELECT * FROM users WHERE id = ${id}`;

// ❌ Unsafe - Never concatenate strings
await prisma.$queryRawUnsafe(`SELECT * FROM users WHERE id = ${id}`);
```

## Security Headers

### Helmet Middleware

```typescript
app.use(helmet());
```

Sets headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (HSTS)

## CORS Configuration

```typescript
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
```

- Explicit origin whitelist
- Credentials enabled for cookies/auth headers

## Rate Limiting

### Authentication Endpoints

```typescript
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: 'Too many authentication attempts',
});
```

Prevents brute force attacks on login.

## Secrets Management

### Development

Environment variables in `.env` (not committed):

```env
DATABASE_URL="postgresql://..."
JWT_SECRET="secure-random-string"
```

### Production

Secrets stored in AWS Secrets Manager:

```typescript
// Retrieved at runtime
const dbUrl = await getSecret('fundroom-erp/database-url');
```

**Never committed:**
- Database credentials
- JWT secrets
- API keys
- Passwords

## Error Handling

### Safe Error Responses

```typescript
// ❌ Wrong - exposes internals
return res.status(500).json({ error: err.stack });

// ✅ Correct - generic message
return res.status(500).json({
  error: {
    code: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message,
  },
});
```

### No Stack Traces in Production

Stack traces only shown in development mode.

## Logging

### What We Log

- Request ID, method, path, status, duration
- User ID for audit trail
- Error codes (not messages with sensitive data)

### What We Never Log

- Passwords
- JWT tokens
- Database credentials
- Credit card numbers
- Personal identifiable information (PII)

## Database Security

### Connection

- SSL required in production
- Connection pooling with Prisma

### Least Privilege

Database user has minimal permissions:
- SELECT, INSERT, UPDATE, DELETE on application tables
- No DDL permissions (migrations run separately)
- No access to system tables

## Concurrency Security

### Row-Level Locking

Prevents race conditions in inventory:

```sql
SELECT * FROM inventory WHERE "productId" = $1 FOR UPDATE;
```

Ensures atomic operations under concurrent access.

## HTTPS

### Development

HTTP is acceptable for local development.

### Production

- HTTPS required for all endpoints
- SSL termination at load balancer
- Certificates via AWS Certificate Manager

## Dependency Security

### Audit

Regular security audits:

```bash
npm audit
npm audit fix
```

### Dependabot

GitHub Dependabot enabled for automated vulnerability alerts.

## Security Checklist

- [x] Passwords hashed with Argon2id
- [x] JWT with short expiry
- [x] Refresh token rotation
- [x] Role-based access control
- [x] Input validation with Zod
- [x] Parameterized SQL queries
- [x] Security headers with Helmet
- [x] CORS properly configured
- [x] Rate limiting on auth endpoints
- [x] No secrets in source control
- [x] Safe error messages
- [x] Structured logging (no sensitive data)
- [x] HTTPS in production
- [x] Row-level locking for concurrency

## Reporting Security Issues

If you discover a security vulnerability, please report it privately to security@fundroom.com. Do not open a public issue.
