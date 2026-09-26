import { Request, Response, NextFunction } from 'express';
import { CustomersService } from './customers.service';
import { successResponse, paginatedResponse } from '../../shared/utils/response';
import { ErrorCode } from '../../shared/errors';
import { z } from 'zod';

const customersService = new CustomersService();

// Validation schemas
const createCustomerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().max(50).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
  state: z.string().max(100).optional().or(z.literal('')),
  pincode: z.string().max(20).optional().or(z.literal('')),
  gstNumber: z.string().max(50).optional().or(z.literal('')),
  contactPerson: z.string().max(255).optional().or(z.literal('')),
});

const updateCustomerSchema = createCustomerSchema.partial();

export class CustomersController {
  /**
   * GET /api/v1/customers
   * List all customers
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string | undefined;

      const result = await customersService.list(page, limit, search);

      paginatedResponse(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/customers/:id
   * Get customer by ID
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const customer = await customersService.getById(id);

      successResponse(res, customer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/customers
   * Create new customer
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createCustomerSchema.parse(req.body);

      const customer = await customersService.create(validated);

      successResponse(res, customer, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/customers/:id
   * Update customer
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const validated = updateCustomerSchema.parse(req.body);

      const customer = await customersService.update(id, validated);

      successResponse(res, customer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/customers/:id
   * Delete customer
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      await customersService.delete(id);

      successResponse(res, { message: 'Customer deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}
