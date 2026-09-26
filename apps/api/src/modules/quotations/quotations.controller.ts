import { Request, Response, NextFunction } from 'express';
import { QuotationStatus } from '@prisma/client';
import { QuotationsService } from './quotations.service';
import { successResponse, paginatedResponse } from '../../shared/utils/response';
import { z } from 'zod';

const quotationsService = new QuotationsService();

const createQuotationSchema = z.object({
  enquiryId: z.string().uuid().optional(),
  customerId: z.string().uuid(),
  validUntil: z.string().optional(),
  terms: z.string().optional(),
  notes: z.string().optional(),
  specialDiscountPercent: z.number().min(0).max(100).optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().positive(),
    discountPercent: z.number().min(0).max(100).optional(),
    gstPercent: z.number().min(0).max(100).optional(),
    notes: z.string().optional(),
  })).min(1, 'At least one item is required'),
});

const updateStatusSchema = z.object({
  status: z.nativeEnum(QuotationStatus),
});

export class QuotationsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status as QuotationStatus | undefined;
      const customerId = req.query.customerId as string | undefined;

      const result = await quotationsService.list(page, limit, status, customerId);
      paginatedResponse(res, result);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const quotation = await quotationsService.getById(id);
      successResponse(res, quotation);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createQuotationSchema.parse(req.body);
      const user = (req as any).user;

      const quotation = await quotationsService.create(validated, user.id);
      successResponse(res, quotation, 201);
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const validated = updateStatusSchema.parse(req.body);
      const user = (req as any).user;

      const quotation = await quotationsService.updateStatus(id, validated.status, user.id);
      successResponse(res, quotation);
    } catch (error) {
      next(error);
    }
  }
}
