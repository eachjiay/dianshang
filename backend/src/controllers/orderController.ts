import type { Request, Response } from 'express';
import { getDB } from '../db/database.js';

export const createOrder = async (req: Request, res: Response) => {
    const db = getDB();
    const userId = (req as any).user.id;
    const { items, shipping_address_id, invoice_title, discount_amount = 0, freight_amount = 0 } = req.body;

    try {
        if (!items?.length) return res.status(400).json({ error: '订单商品不能为空' });
        await db.run('BEGIN TRANSACTION');

        let totalAmount = Number(freight_amount) - Number(discount_amount);
        const normalizedItems = [];
        for (const item of items) {
            const product = await db.get('SELECT id, price, stock, status FROM products WHERE id = ?', [item.product_id]);
            if (!product || product.status !== 'APPROVED') throw new Error('商品不可购买');
            if (product.stock < item.quantity) throw new Error('库存不足');
            totalAmount += product.price * item.quantity;
            normalizedItems.push({ product_id: product.id, quantity: item.quantity, price: product.price });
        }

        const result = await db.run(
            `INSERT INTO orders (user_id, total_amount, discount_amount, freight_amount, shipping_address_id, invoice_title, status)
             VALUES (?, ?, ?, ?, ?, ?, "UNPAID")`,
            [userId, totalAmount, discount_amount, freight_amount, shipping_address_id, invoice_title || '']
        );
        const orderId = result.lastID;

        for (const item of normalizedItems) {
            await db.run(
                'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
                [orderId, item.product_id, item.quantity, item.price]
            );
            await db.run('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.product_id]);
        }

        const productIds = items.map((i: any) => i.product_id);
        await db.run(
            `DELETE FROM cart WHERE user_id = ? AND product_id IN (${productIds.map(() => '?').join(',')})`,
            [userId, ...productIds]
        );
        await db.run('INSERT INTO audit_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)', [userId, 'CREATE_ORDER', 'orders', orderId, `创建订单 ${totalAmount}`]);

        await db.run('COMMIT');
        res.json({ orderId, total_amount: totalAmount, message: '订单创建成功' });
    } catch (error: any) {
        await db.run('ROLLBACK');
        res.status(400).json({ error: error.message || '订单创建失败' });
    }
};

export const getOrders = async (req: Request, res: Response) => {
    const db = getDB();
    const userId = (req as any).user.id;
    const role = (req as any).user.role;

    try {
        let orders;
        if (role === 'ADMIN') {
            orders = await db.all('SELECT * FROM orders ORDER BY created_at DESC');
        } else if (role === 'MERCHANT') {
            // Complex query to get orders containing merchant's products
            orders = await db.all(
                `SELECT DISTINCT o.* FROM orders o 
                 JOIN order_items oi ON o.id = oi.order_id 
                 JOIN products p ON oi.product_id = p.id 
                 WHERE p.merchant_id = ? 
                 ORDER BY o.created_at DESC`,
                [userId]
            );
        } else {
            orders = await db.all('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [userId]);
        }

        // Add items to each order
        for (const order of orders) {
            order.items = await db.all(
                `SELECT oi.*, p.name, p.main_image 
                 FROM order_items oi 
                 JOIN products p ON oi.product_id = p.id 
                 WHERE oi.order_id = ?`,
                [order.id]
            );
        }

        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get orders' });
    }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
    const db = getDB();
    const { orderId, status } = req.body;

    try {
        const { logistics_company, logistics_no } = req.body;
        await db.run('UPDATE orders SET status = ?, logistics_company = COALESCE(?, logistics_company), logistics_no = COALESCE(?, logistics_no) WHERE id = ?', [status, logistics_company, logistics_no, orderId]);
        await db.run('INSERT INTO audit_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)', [(req as any).user.id, 'UPDATE_ORDER_STATUS', 'orders', orderId, status]);
        res.json({ message: '订单状态已更新' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update order' });
    }
};

export const payOrder = async (req: Request, res: Response) => {
    const db = getDB();
    const { orderId, method = 'WECHAT', trade_no } = req.body;

    try {
        const order = await db.get('SELECT * FROM orders WHERE id = ?', [orderId]);
        if (!order) return res.status(404).json({ error: '订单不存在' });
        if (order.status !== 'UNPAID') return res.json({ message: '支付回调已处理', status: order.status });
        const finalTradeNo = trade_no || `MOCK${Date.now()}${orderId}`;
        await db.run('BEGIN TRANSACTION');
        await db.run('INSERT OR IGNORE INTO payment_logs (order_id, trade_no, method, amount, status, raw_payload) VALUES (?, ?, ?, ?, ?, ?)', [orderId, finalTradeNo, method, order.total_amount, 'SUCCESS', JSON.stringify(req.body)]);
        await db.run('UPDATE orders SET status = "PAID", payment_method = ? WHERE id = ?', [method, orderId]);
        await db.run('INSERT INTO messages (user_id, title, content, type) VALUES (?, ?, ?, ?)', [order.user_id, '订单支付成功', `订单 #${orderId} 已支付，等待商家发货。`, 'ORDER']);
        await db.run('INSERT INTO audit_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)', [(req as any).user.id, 'PAY_ORDER', 'orders', orderId, method]);
        await db.run('COMMIT');
        res.json({ message: '支付成功' });
    } catch (error) {
        await db.run('ROLLBACK');
        res.status(500).json({ error: '支付失败' });
    }
};
