import { Request, Response, NextFunction } from 'express';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { AppError, ErrorCode } from '../shared/errors';
import { errorResponse } from '../shared/utils/response';
import { logger } from '../shared/utils/logger';

/**
 * Global Error Handler Middleware
 * Catches all errors and returns consistent error responses
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = (req as any).requestId || 'unknown';

  // Log the error
  logger.error(err.message, err, {
    requestId,
    userId: (req as any).user?.id,
    method: req.method,
    path: req.path,
  });

  // Handle known application errors
  if (err instanceof AppError) {
    errorResponse(
      res,
      err.code,
      err.message,
      requestId,
      err.statusCode,
      err.details
    );
    return;
  }

  // Handle Prisma errors
  if (err instanceof PrismaClientKnownRequestError) {
    const prismaError = handlePrismaError(err, requestId);
    errorResponse(
      res,
      prismaError.code,
      prismaError.message,
      requestId,
      prismaError.statusCode,
      prismaError.details
    );
    return;
  }

  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    errorResponse(
      res,
      ErrorCode.VALIDATION_ERROR,
      'Validation failed',
      requestId,
      400,
      { errors: (err as any).errors }
    );
    return;
  }

  // Handle JSON parsing errors
  if (err.name === 'SyntaxError' && 'body' in err) {
    errorResponse(
      res,
      ErrorCode.INVALID_INPUT,
      'Invalid JSON in request body',
      requestId,
      400
    );
    return;
  }

  // Generic internal server error
  const message =
    process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message;

  errorResponse(
    res,
    ErrorCode.INTERNAL_ERROR,
    message,
    requestId,
    500
  );
}

/**
 * Handle Prisma-specific errors
 */
function handlePrismaError(
  err: PrismaClientKnownRequestError,
  requestId: string
): { code: ErrorCode; message: string; statusCode: number; details?: Record<string, unknown> } {
  switch (err.code) {
    case 'P2002':
      // Unique constraint violation
      const target = (err.meta?.target as string[])?.join(', ') || 'resource';
      return {
        code: ErrorCode.DUPLICATE_RESOURCE,
        message: `Duplicate value for: ${target}`,
        statusCode: 409,
        details: { target: err.meta?.target },
      };

    case 'P2025':
      // Record not found
      return {
        code: ErrorCode.NOT_FOUND,
        message: 'Record not found',
        statusCode: 404,
      };

    case 'P2003':
      // Foreign key constraint violation
      return {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Invalid reference to related resource',
        statusCode: 400,
      };

    case 'P2014':
      // Relation violation
      return {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Invalid relation operation',
        statusCode: 400,
      };

    default:
      return {
        code: ErrorCode.DATABASE_ERROR,
        message: 'Database operation failed',
        statusCode: 500,
      };
  }
}
