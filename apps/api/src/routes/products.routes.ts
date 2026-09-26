import { Router } from 'express';
import { ProductsController } from '../modules/products/products.controller';
import { authenticate, requireSalesOrAdmin, requireAdmin } from '../middleware';

const router = Router();
const productsController = new ProductsController();

router.use(authenticate);

router.get('/', requireSalesOrAdmin(), productsController.list.bind(productsController));
router.get('/:id', requireSalesOrAdmin(), productsController.getById.bind(productsController));
router.post('/', requireAdmin(), productsController.create.bind(productsController));
router.patch('/:id', requireAdmin(), productsController.update.bind(productsController));
router.delete('/:id', requireAdmin(), productsController.delete.bind(productsController));

export default router;
