import type { Request, Response } from 'express';
import { getDB } from '../db/database.js';

export const submitCertification = async (req: Request, res: Response) => {
    const db = getDB();
    const { company_name, license_no, license_image, contact_name, contact_phone } = req.body;
    const userId = (req as any).user.id;

    try {
        await db.run(
            `INSERT INTO enterprise_info (user_id, company_name, license_no, license_image, contact_name, contact_phone) 
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(user_id) DO UPDATE SET
             company_name=excluded.company_name,
             license_no=excluded.license_no,
             license_image=excluded.license_image,
             contact_name=excluded.contact_name,
             contact_phone=excluded.contact_phone,
             status='PENDING'`,
            [userId, company_name, license_no, license_image, contact_name, contact_phone]
        );

        await db.run('UPDATE users SET enterprise_status = "PENDING" WHERE id = ?', [userId]);

        res.json({ message: 'Certification submitted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to submit certification' });
    }
};

export const getCertificationStatus = async (req: Request, res: Response) => {
    const db = getDB();
    const userId = (req as any).user.id;

    try {
        const info = await db.get('SELECT * FROM enterprise_info WHERE user_id = ?', [userId]);
        res.json(info || { status: 'NONE' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get certification status' });
    }
};

export const listCertifications = async (_req: Request, res: Response) => {
    const db = getDB();

    try {
        const rows = await db.all(
            `SELECT e.*, u.phone, u.nickname
             FROM enterprise_info e
             JOIN users u ON e.user_id = u.id
             ORDER BY e.created_at DESC`
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to list certifications' });
    }
};

// Admin only
export const auditCertification = async (req: Request, res: Response) => {
    const db = getDB();
    const { id, status, reject_reason } = req.body;

    try {
        const cert = await db.get('SELECT user_id FROM enterprise_info WHERE id = ?', [id]);
        if (!cert) return res.status(404).json({ error: 'Certification not found' });

        await db.run(
            'UPDATE enterprise_info SET status = ?, reject_reason = ? WHERE id = ?',
            [status, reject_reason, id]
        );

        const userRole = status === 'APPROVED' ? 'ENTERPRISE' : 'USER';
        await db.run(
            'UPDATE users SET enterprise_status = ?, role = ? WHERE id = ?',
            [status, userRole, cert.user_id]
        );

        res.json({ message: 'Certification audited successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to audit certification' });
    }
};
