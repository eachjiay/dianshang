import type { Request, Response } from 'express';
import { getDB } from '../db/database.js';

export const getAddresses = async (req: Request, res: Response) => {
    const db = getDB();
    const userId = (req as any).user.id;

    try {
        const addresses = await db.all('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC', [userId]);
        res.json(addresses);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get addresses' });
    }
};

export const addAddress = async (req: Request, res: Response) => {
    const db = getDB();
    const userId = (req as any).user.id;
    const { receiver_name, receiver_phone, province, city, district, detail_address, is_default } = req.body;

    try {
        if (is_default) {
            await db.run('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [userId]);
        }

        await db.run(
            `INSERT INTO addresses (user_id, receiver_name, receiver_phone, province, city, district, detail_address, is_default) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, receiver_name, receiver_phone, province, city, district, detail_address, is_default ? 1 : 0]
        );

        res.json({ message: 'Address added successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to add address' });
    }
};

export const updateAddress = async (req: Request, res: Response) => {
    const db = getDB();
    const userId = (req as any).user.id;
    const { id, receiver_name, receiver_phone, province, city, district, detail_address, is_default } = req.body;

    try {
        if (is_default) {
            await db.run('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [userId]);
        }

        await db.run(
            `UPDATE addresses SET receiver_name=?, receiver_phone=?, province=?, city=?, district=?, detail_address=?, is_default=?
             WHERE id = ? AND user_id = ?`,
            [receiver_name, receiver_phone, province, city, district, detail_address, is_default ? 1 : 0, id, userId]
        );

        res.json({ message: 'Address updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update address' });
    }
};

export const deleteAddress = async (req: Request, res: Response) => {
    const db = getDB();
    const userId = (req as any).user.id;
    const { id } = req.params;

    try {
        await db.run('DELETE FROM addresses WHERE id = ? AND user_id = ?', [id, userId]);
        res.json({ message: 'Address deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete address' });
    }
};
