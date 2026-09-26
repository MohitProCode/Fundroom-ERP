import { Router } from 'express';
import { DispatchesController } from '../modules/dispatches/dispatches.controller';
import { authenticate, requireAdmin, requireSalesOrAdmin } from '../middleware';

const router = Router();
const dispatchesController = new DispatchesController();

router.use(authenticate);

router.get('/', requireSalesOrAdmin(), dispatchesController.list.bind(dispatchesController));
router.get('/:id', requireSalesOrAdmin(), dispatchesController.getById.bind(dispatchesController));
router.post('/', requireAdmin(), dispatchesController.create.bind(dispatchesController));

export default router;
