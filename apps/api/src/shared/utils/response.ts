import { Response } from 'express';
import { ErrorCode } from '../errors/codes';

/**
 * Standard API Response Structure
 */

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
    requestId: string;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

/**
 * Success Response
 */
export function successResponse<T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  meta?: ApiResponse<T>['meta']
): void {
  const response: ApiResponse<T> = {
    success: true,
    data,
    ...(meta && { meta }),
  };

  res.status(statusCode).json(response);
}

/**
 * Error Response
 */
export function errorResponse(
  res: Response,
  code: ErrorCode,
  message: string,
  requestId: string,
  statusCode: number = 500,
  details?: Record<string, unknown>
): void {
  const response: ApiResponse<never> = {
    success: false,
    error: {
      code,
      message,
      requestId,
      ...(details && { details }),
    },
  };

  res.status(statusCode).json(response);
}

/**
 * Paginated Response
 */
export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function paginatedResponse<T>(
  res: Response,
  data: PaginatedData<T>
): void {
  successResponse(res, data.items, 200, {
    page: data.page,
    limit: data.limit,
    total: data.total,
    totalPages: data.totalPages,
  });
}
