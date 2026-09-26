import { Router } from 'express';
import { CustomersController } from '../modules/customers/customers.controller';
import { authenticate, requireSalesOrAdmin } from '../middleware';

const router = Router();
const customersController = new CustomersController();

// All routes require authentication
router.use(authenticate);

router.get('/', requireSalesOrAdmin(), customersController.list.bind(customersController));
router.get('/:id', requireSalesOrAdmin(), customersController.getById.bind(customersController));
router.post('/', requireSalesOrAdmin(), customersController.create.bind(customersController));
router.patch('/:id', requireSalesOrAdmin(), customersController.update.bind(customersController));
router.delete('/:id', requireSalesOrAdmin(), customersController.delete.bind(customersController));

export default router;
