import { Request, Response, NextFunction } from 'express';
import { EnquiryStatus } from '@prisma/client';
import { EnquiriesService } from './enquiries.service';
import { successResponse, paginatedResponse } from '../../shared/utils/response';
import { z } from 'zod';

const enquiriesService = new EnquiriesService();

const createEnquirySchema = z.object({
  customerId: z.string().uuid(),
  notes: z.string().optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().positive(),
    notes: z.string().optional(),
  })).min(1, 'At least one item is required'),
});

const updateStatusSchema = z.object({
  status: z.nativeEnum(EnquiryStatus),
});

export class EnquiriesController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status as EnquiryStatus | undefined;
      const customerId = req.query.customerId as string | undefined;

      const result = await enquiriesService.list(page, limit, status, customerId);
      paginatedResponse(res, result);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const enquiry = await enquiriesService.getById(id);
      successResponse(res, enquiry);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createEnquirySchema.parse(req.body);
      const user = (req as any).user;

      const enquiry = await enquiriesService.create(validated, user.id);
      successResponse(res, enquiry, 201);
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const validated = updateStatusSchema.parse(req.body);
      const user = (req as any).user;

      const enquiry = await enquiriesService.updateStatus(id, validated.status, user.id);
      successResponse(res, enquiry);
    } catch (error) {
      next(error);
    }
  }
}
