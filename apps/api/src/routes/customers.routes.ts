import { Router } from 'express';
import { CustomersController } from '../modules/customers/customers.controller';
import { authenticate, requireSalesOrAdmin } from '../middleware';
import { CustomerActivitiesController } from '../modules/customers/customer-activities.controller';

const router = Router();
const customersController = new CustomersController();
const activitiesController = new CustomerActivitiesController();

// All routes require authentication
router.use(authenticate);

router.get('/:id/activities', requireSalesOrAdmin(), activitiesController.list.bind(activitiesController));
router.post('/:id/activities', requireSalesOrAdmin(), activitiesController.create.bind(activitiesController));
router.patch('/:id/activities/:activityId/complete', requireSalesOrAdmin(), activitiesController.complete.bind(activitiesController));

router.get('/', requireSalesOrAdmin(), customersController.list.bind(customersController));
router.get('/:id', requireSalesOrAdmin(), customersController.getById.bind(customersController));
router.post('/', requireSalesOrAdmin(), customersController.create.bind(customersController));
router.patch('/:id', requireSalesOrAdmin(), customersController.update.bind(customersController));
router.delete('/:id', requireSalesOrAdmin(), customersController.delete.bind(customersController));

export default router;
