import { Request, Response, NextFunction } from 'express';
import { DispatchesService } from './dispatches.service';
import { successResponse, paginatedResponse } from '../../shared/utils/response';
import { z } from 'zod';

const dispatchesService = new DispatchesService();

const createDispatchSchema = z.object({
  salesOrderId: z.string().uuid(),
  notes: z.string().optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).min(1, 'At least one item is required'),
});

export class DispatchesController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const salesOrderId = req.query.salesOrderId as string | undefined;

      const result = await dispatchesService.list(page, limit, salesOrderId);
      paginatedResponse(res, result);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const dispatch = await dispatchesService.getById(id);
      successResponse(res, dispatch);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createDispatchSchema.parse(req.body);
      const user = (req as any).user;

      const dispatch = await dispatchesService.create(validated, user.id);
      successResponse(res, dispatch, 201);
    } catch (error) {
      next(error);
    }
  }
}
