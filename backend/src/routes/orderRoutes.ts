import { Router } from 'express';
import { createOrder, getOrders, updateOrderStatus, payOrder } from '../controllers/orderController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/create', authenticate, createOrder);
router.get('/', authenticate, getOrders);
router.post('/update-status', authenticate, updateOrderStatus);
router.post('/pay', authenticate, payOrder);

export default router;
