import { Request, Response, NextFunction } from 'express';
import { CustomerActivityType } from '@prisma/client';
import { z } from 'zod';
import { successResponse } from '../../shared/utils/response';
import { CustomerActivitiesService } from './customer-activities.service';

const service = new CustomerActivitiesService();
const createSchema = z.object({ type: z.nativeEnum(CustomerActivityType), subject: z.string().min(1).max(200), notes: z.string().max(2000).optional(), dueAt: z.string().datetime().optional() });

export class CustomerActivitiesController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> { try { const result = await service.list(req.params.id); successResponse(res, result); } catch (error) { next(error); } }
  async create(req: Request, res: Response, next: NextFunction): Promise<void> { try { const user = (req as any).user; const result = await service.create(req.params.id, createSchema.parse(req.body), user.id); successResponse(res, result, 201); } catch (error) { next(error); } }
  async complete(req: Request, res: Response, next: NextFunction): Promise<void> { try { const result = await service.complete(req.params.activityId); successResponse(res, result); } catch (error) { next(error); } }
}
