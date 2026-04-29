import { Router } from 'express';
import { getProducts, getProductById, createProduct, reviewProduct } from '../controllers/productController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/', getProducts);
router.get('/:id', getProductById);
router.post('/', authenticate, authorize(['MERCHANT']), createProduct);
router.put('/:id/review', authenticate, authorize(['ADMIN']), reviewProduct);
router.post('/review/:id', authenticate, authorize(['ADMIN']), reviewProduct);

export default router;
