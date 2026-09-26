import { Request, Response, NextFunction } from 'express';
import { InventoryService } from './inventory.service';
import { successResponse, paginatedResponse } from '../../shared/utils/response';
import { z } from 'zod';

const inventoryService = new InventoryService();

const adjustSchema = z.object({
  quantity: z.number().refine((n) => n !== 0, { message: 'Quantity adjustment cannot be zero' }),
  reason: z.string().optional(),
});

export class InventoryController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string | undefined;

      const result = await inventoryService.list(page, limit, search);
      paginatedResponse(res, result);
    } catch (error) {
      next(error);
    }
  }

  async getByProductId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId } = req.params;
      const inventory = await inventoryService.getByProductId(productId);
      successResponse(res, inventory);
    } catch (error) {
      next(error);
    }
  }

  async adjust(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId } = req.params;
      const validated = adjustSchema.parse(req.body);
      const user = (req as any).user;

      const inventory = await inventoryService.adjustPhysicalQuantity(
        productId,
        validated.quantity,
        user.id
      );

      successResponse(res, inventory);
    } catch (error) {
      next(error);
    }
  }
}
