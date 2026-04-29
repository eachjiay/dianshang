import { Router } from 'express';
import { getCart, addToCart, updateCartItem, removeCartItem } from '../controllers/cartController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, getCart);
router.post('/add', authenticate, addToCart);
router.put('/update', authenticate, updateCartItem);
router.delete('/:id', authenticate, removeCartItem);

export default router;
