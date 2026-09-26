import { Request } from 'express';
import { UserRole } from '@prisma/client';

/**
 * Authenticated Request
 * Extends Express Request with user information
 */
export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    role: UserRole;
    name: string;
  };
  requestId: string;
}

/**
 * Pagination Query Parameters
 */
export interface PaginationQuery {
  page?: string;
  limit?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Pagination Meta
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * JWT Payload
 */
export interface JwtPayload {
  sub: string; // User ID
  email: string;
  role: UserRole;
  name: string;
  iat: number;
  exp: number;
}

/**
 * Calculate Quotation Item
 */
export interface QuotationItemCalculation {
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  gstPercent: number;
}

export interface QuotationItemResult {
  baseAmount: number;
  discountAmount: number;
  taxableAmount: number;
  gstAmount: number;
  lineTotal: number;
}

/**
 * Inventory Availability
 */
export interface InventoryAvailability {
  productId: string;
  physicalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
}
