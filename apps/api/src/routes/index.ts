import { Router } from 'express';
import authRoutes from './auth.routes';
import customerRoutes from './customers.routes';
import productRoutes from './products.routes';
import inventoryRoutes from './inventory.routes';
import enquiryRoutes from './enquiries.routes';
import quotationRoutes from './quotations.routes';
import salesOrderRoutes from './sales-orders.routes';
import dispatchRoutes from './dispatches.routes';

const router = Router();

// Authentication (public)
router.use('/auth', authRoutes);

// Protected routes
router.use('/customers', customerRoutes);
router.use('/products', productRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/enquiries', enquiryRoutes);
router.use('/quotations', quotationRoutes);
router.use('/sales-orders', salesOrderRoutes);
router.use('/dispatches', dispatchRoutes);

export default router;
