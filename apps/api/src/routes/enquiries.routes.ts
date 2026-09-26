import { Router } from 'express';
import { EnquiriesController } from '../modules/enquiries/enquiries.controller';
import { authenticate, requireSalesOrAdmin } from '../middleware';

const router = Router();
const enquiriesController = new EnquiriesController();

router.use(authenticate);

router.get('/', requireSalesOrAdmin(), enquiriesController.list.bind(enquiriesController));
router.get('/:id', requireSalesOrAdmin(), enquiriesController.getById.bind(enquiriesController));
router.post('/', requireSalesOrAdmin(), enquiriesController.create.bind(enquiriesController));
router.patch('/:id/status', requireSalesOrAdmin(), enquiriesController.updateStatus.bind(enquiriesController));

export default router;
