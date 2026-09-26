import { Request, Response, NextFunction } from 'express';
import { ProductsService } from './products.service';
import { successResponse, paginatedResponse } from '../../shared/utils/response';
import { z } from 'zod';

const productsService = new ProductsService();

const createProductSchema = z.object({
  sku: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  category: z.string().max(100).optional(),
  unit: z.string().max(20).default('PCS'),
});

const updateProductSchema = createProductSchema.partial().omit({ sku: true });

export class ProductsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string | undefined;

      const result = await productsService.list(page, limit, search);
      paginatedResponse(res, result);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const product = await productsService.getById(id);
      successResponse(res, product);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createProductSchema.parse(req.body);
      const product = await productsService.create(validated);
      successResponse(res, product, 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const validated = updateProductSchema.parse(req.body);
      const product = await productsService.update(id, validated);
      successResponse(res, product);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await productsService.delete(id);
      successResponse(res, { message: 'Product deactivated successfully' });
    } catch (error) {
      next(error);
    }
  }
}
