import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDB } from './db/database.js';

import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import enterpriseRoutes from './routes/enterpriseRoutes.js';
import addressRoutes from './routes/addressRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import platformRoutes from './routes/platformRoutes.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/enterprise', enterpriseRoutes);
app.use('/api/address', addressRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/platform', platformRoutes);

// Routes will be added here
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Diquan E-commerce API is running' });
});

export default app;
