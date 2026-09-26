import { Router } from 'express';
import { SalesOrdersController } from '../modules/sales-orders/sales-orders.controller';
import { authenticate, requireAdmin, requireSalesOrAdmin } from '../middleware';
import { z } from 'zod';

const router = Router();
const salesOrdersController = new SalesOrdersController();

router.use(authenticate);

router.get('/', requireSalesOrAdmin(), salesOrdersController.list.bind(salesOrdersController));
router.get('/:id', requireSalesOrAdmin(), salesOrdersController.getById.bind(salesOrdersController));
router.post('/from-quotation', requireSalesOrAdmin(), salesOrdersController.convertQuotation.bind(salesOrdersController));
router.post('/:id/confirm', requireAdmin(), salesOrdersController.confirm.bind(salesOrdersController));
router.post('/:id/cancel', requireSalesOrAdmin(), salesOrdersController.cancel.bind(salesOrdersController));

export default router;
