import { ErrorCode } from './codes';

/**
 * Application Error
 * Base error class for all domain errors
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    details?: Record<string, unknown>,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation Error
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.VALIDATION_ERROR, message, 400, details);
  }
}

/**
 * Authentication Error
 */
export class AuthenticationError extends AppError {
  constructor(code: ErrorCode = ErrorCode.UNAUTHORIZED, message: string = 'Authentication required') {
    super(code, message, 401);
  }
}

/**
 * Authorization Error
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(ErrorCode.FORBIDDEN, message, 403);
  }
}

/**
 * Not Found Error
 */
export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string | number) {
    super(
      ErrorCode.NOT_FOUND,
      identifier ? `${resource} with identifier '${identifier}' not found` : `${resource} not found`,
      404
    );
  }
}

/**
 * State Transition Error
 */
export class StateTransitionError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.INVALID_STATE_TRANSITION, message, 400, details);
  }
}

/**
 * Business Rule Error
 */
export class BusinessRuleError extends AppError {
  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(code, message, 422, details);
  }
}

/**
 * Concurrency Error
 */
export class ConcurrencyError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.CONCURRENT_MODIFICATION, message, 409, details);
  }
}

/**
 * Duplicate Resource Error
 */
export class DuplicateResourceError extends AppError {
  constructor(resource: string, identifier?: string) {
    super(
      ErrorCode.DUPLICATE_RESOURCE,
      identifier ? `${resource} with identifier '${identifier}' already exists` : `${resource} already exists`,
      409
    );
  }
}
