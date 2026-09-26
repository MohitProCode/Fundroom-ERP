import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest } from '../shared/types';
import { errorResponse } from '../shared/utils/response';
import { ErrorCode, AuthenticationError } from '../shared/errors';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedRequest['user'];
      requestId?: string;
    }
  }
}

/**
 * Authentication Middleware
 * Validates JWT token and attaches user to request
 */
export function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      errorResponse(
        res,
        ErrorCode.UNAUTHORIZED,
        'Authentication required',
        req.requestId,
        401
      );
      return;
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedRequest['user'] & {
        iat: number;
        exp: number;
      };

      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        name: decoded.name,
      };

      next();
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        errorResponse(
          res,
          ErrorCode.TOKEN_EXPIRED,
          'Token has expired',
          req.requestId,
          401
        );
        return;
      }

      if (err instanceof jwt.JsonWebTokenError) {
        errorResponse(
          res,
          ErrorCode.INVALID_TOKEN,
          'Invalid token',
          req.requestId,
          401
        );
        return;
      }

      throw err;
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Optional Authentication Middleware
 * Attaches user if token present, but doesn't require it
 */
export function optionalAuthenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  authenticate(req, res, next);
}
