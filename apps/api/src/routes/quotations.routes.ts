import { Router } from 'express';
import { QuotationsController } from '../modules/quotations/quotations.controller';
import { authenticate, requireSalesOrAdmin } from '../middleware';

const router = Router();
const quotationsController = new QuotationsController();

router.use(authenticate);

router.get('/', requireSalesOrAdmin(), quotationsController.list.bind(quotationsController));
router.get('/:id', requireSalesOrAdmin(), quotationsController.getById.bind(quotationsController));
router.post('/', requireSalesOrAdmin(), quotationsController.create.bind(quotationsController));
router.patch('/:id/status', requireSalesOrAdmin(), quotationsController.updateStatus.bind(quotationsController));

export default router;
