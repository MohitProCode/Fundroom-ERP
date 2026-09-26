import { Request, Response, NextFunction } from 'express';
import { SalesOrderStatus } from '@prisma/client';
import { SalesOrdersService } from './sales-orders.service';
import { successResponse, paginatedResponse } from '../../shared/utils/response';
import { z } from 'zod';

const salesOrdersService = new SalesOrdersService();

export class SalesOrdersController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status as SalesOrderStatus | undefined;
      const customerId = req.query.customerId as string | undefined;

      const result = await salesOrdersService.list(page, limit, status, customerId);
      paginatedResponse(res, result);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const order = await salesOrdersService.getById(id);
      successResponse(res, order);
    } catch (error) {
      next(error);
    }
  }

  async convertQuotation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { quotationId } = req.body;
      const user = (req as any).user;

      const order = await salesOrdersService.convertQuotation(quotationId, user.id);
      successResponse(res, order, 201);
    } catch (error) {
      next(error);
    }
  }

  async confirm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const user = (req as any).user;

      const order = await salesOrdersService.confirm(id, user.id);
      successResponse(res, order);
    } catch (error) {
      next(error);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const user = (req as any).user;

      const order = await salesOrdersService.cancel(id, user.id);
      successResponse(res, order);
    } catch (error) {
      next(error);
    }
  }
}
