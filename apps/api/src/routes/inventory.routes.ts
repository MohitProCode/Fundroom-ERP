import { Router } from 'express';
import { InventoryController } from '../modules/inventory/inventory.controller';
import { authenticate, requireAdmin, requireSalesOrAdmin } from '../middleware';

const router = Router();
const inventoryController = new InventoryController();

router.use(authenticate);

router.get('/', requireSalesOrAdmin(), inventoryController.list.bind(inventoryController));
router.get('/:productId', requireSalesOrAdmin(), inventoryController.getByProductId.bind(inventoryController));
router.post('/:productId/adjust', requireAdmin(), inventoryController.adjust.bind(inventoryController));

export default router;
