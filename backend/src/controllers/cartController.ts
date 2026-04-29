import type { Request, Response } from 'express';
import { getDB } from '../db/database.js';

export const getCart = async (req: Request, res: Response) => {
    const db = getDB();
    const userId = (req as any).user.id;

    try {
        const items = await db.all(
            `SELECT c.*, p.name, p.price, p.main_image, p.stock 
             FROM cart c 
             JOIN products p ON c.product_id = p.id 
             WHERE c.user_id = ?`,
            [userId]
        );
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get cart' });
    }
};

export const addToCart = async (req: Request, res: Response) => {
    const db = getDB();
    const userId = (req as any).user.id;
    const { product_id, quantity } = req.body;

    try {
        const existing = await db.get('SELECT id, quantity FROM cart WHERE user_id = ? AND product_id = ?', [userId, product_id]);
        if (existing) {
            await db.run('UPDATE cart SET quantity = ? WHERE id = ?', [existing.quantity + quantity, existing.id]);
        } else {
            await db.run('INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)', [userId, product_id, quantity]);
        }
        res.json({ message: 'Added to cart' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to add to cart' });
    }
};

export const updateCartItem = async (req: Request, res: Response) => {
    const db = getDB();
    const userId = (req as any).user.id;
    const { id, quantity } = req.body;

    try {
        if (quantity <= 0) {
            await db.run('DELETE FROM cart WHERE id = ? AND user_id = ?', [id, userId]);
        } else {
            await db.run('UPDATE cart SET quantity = ? WHERE id = ? AND user_id = ?', [quantity, id, userId]);
        }
        res.json({ message: 'Cart updated' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update cart' });
    }
};

export const removeCartItem = async (req: Request, res: Response) => {
    const db = getDB();
    const userId = (req as any).user.id;
    const { id } = req.params;

    try {
        await db.run('DELETE FROM cart WHERE id = ? AND user_id = ?', [id, userId]);
        res.json({ message: 'Removed from cart' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to remove from cart' });
    }
};
