import { Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { AuthenticatedRequest } from '../shared/types';
import { errorResponse } from '../shared/utils/response';
import { ErrorCode, AuthorizationError } from '../shared/errors';

/**
 * Role Authorization Middleware
 * Restricts access to specific roles
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      errorResponse(
        res,
        ErrorCode.UNAUTHORIZED,
        'Authentication required',
        req.requestId,
        401
      );
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      errorResponse(
        res,
        ErrorCode.FORBIDDEN,
        `Access denied. Required role: ${allowedRoles.join(' or ')}`,
        req.requestId,
        403
      );
      return;
    }

    next();
  };
}

/**
 * Admin Only Middleware
 * Shortcut for requiring ADMIN role
 */
export function requireAdmin() {
  return requireRole(UserRole.ADMIN);
}

/**
 * Sales User or Admin Middleware
 */
export function requireSalesOrAdmin() {
  return requireRole(UserRole.ADMIN, UserRole.SALES_USER);
}
