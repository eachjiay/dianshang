import type { Request, Response } from 'express';
import { getDB } from '../db/database.js';

export const getProducts = async (req: Request, res: Response) => {
    const { category, search, minPrice, maxPrice, sort, inStock, scope } = req.query;
    const db = getDB();

    let query = `SELECT p.*, c.name as category_name, m.shop_name
                 FROM products p
                 LEFT JOIN categories c ON p.category_id = c.id
                 LEFT JOIN merchant_profiles m ON p.merchant_id = m.user_id
                 WHERE 1=1`;
    const params: any[] = [];

    if (scope !== 'all') {
        query += ' AND p.status = "APPROVED"';
    }

    if (category) {
        query += ' AND p.category_id = ?';
        params.push(category);
    }

    if (search) {
        query += ' AND (p.name LIKE ? OR p.sub_title LIKE ? OR p.brand LIKE ? OR c.name LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (minPrice) {
        query += ' AND p.price >= ?';
        params.push(minPrice);
    }

    if (maxPrice) {
        query += ' AND p.price <= ?';
        params.push(maxPrice);
    }

    if (inStock === '1') {
        query += ' AND p.stock > 0';
    }

    if (sort === 'price_asc') query += ' ORDER BY p.price ASC';
    else if (sort === 'price_desc') query += ' ORDER BY p.price DESC';
    else if (sort === 'sales') query += ' ORDER BY p.sales DESC';
    else query += ' ORDER BY p.created_at DESC';

    try {
        const products = await db.all(query, params);
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch products' });
    }
};

export const getProductById = async (req: Request, res: Response) => {
    const { id } = req.params;
    const db = getDB();

    try {
        const product = await db.get(
            `SELECT p.*, c.name as category_name, m.shop_name, m.logo as shop_logo
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id
             LEFT JOIN merchant_profiles m ON p.merchant_id = m.user_id
             WHERE p.id = ?`,
            [id]
        );
        if (!product) return res.status(404).json({ error: 'Product not found' });
        product.comments = await db.all(
            `SELECT cm.*, u.nickname FROM comments cm
             LEFT JOIN users u ON cm.user_id = u.id
             WHERE cm.product_id = ? AND cm.status = 'APPROVED'
             ORDER BY cm.created_at DESC LIMIT 10`,
            [id]
        );
        product.recommendations = await db.all(
            'SELECT id, name, price, main_image FROM products WHERE category_id = ? AND id != ? AND status = "APPROVED" LIMIT 4',
            [product.category_id, id]
        );
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch product' });
    }
};

export const createProduct = async (req: Request, res: Response) => {
    const { name, sub_title, brand, unit, price, stock, min_order, category_id, main_image, details } = req.body;
    const merchant_id = (req as any).user.id;
    const db = getDB();

    try {
        await db.run(
            `INSERT INTO products (merchant_id, category_id, name, sub_title, brand, unit, price, stock, min_order, main_image, details, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
            [merchant_id, category_id, name, sub_title, brand, unit || '件', price, stock, min_order || 1, main_image, details]
        );
        res.status(201).json({ message: '商品已提交审核' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create product' });
    }
};

export const reviewProduct = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, reject_reason } = req.body; // APPROVED, REJECTED
    const db = getDB();

    try {
        await db.run('UPDATE products SET status = ?, reject_reason = ? WHERE id = ?', [status, reject_reason || '', id]);
        res.json({ message: '商品审核已更新' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to review product' });
    }
};
