import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDB } from '../db/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'diquan_secret_key';

export const register = async (req: Request, res: Response) => {
    const { phone, password, nickname, role } = req.body;
    const db = getDB();

    try {
        if (!phone || !password) {
            return res.status(400).json({ error: '手机号和密码不能为空' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const safeRole = role === 'MERCHANT' ? 'MERCHANT' : 'USER';
        await db.run(
            'INSERT INTO users (phone, password, nickname, role) VALUES (?, ?, ?, ?)',
            [phone, hashedPassword, nickname || phone, safeRole]
        );
        res.status(201).json({ message: '注册成功' });
    } catch (error: any) {
        if (error.message.includes('UNIQUE constraint failed')) {
            res.status(400).json({ error: '手机号已注册' });
        } else {
            res.status(500).json({ error: '注册失败' });
        }
    }
};

export const login = async (req: Request, res: Response) => {
    const { phone, password } = req.body;
    const db = getDB();

    try {
        const user = await db.get('SELECT * FROM users WHERE phone = ?', [phone]);
        if (!user || user.status === 'DISABLED' || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: '手机号或密码错误' });
        }

        const token = jwt.sign({ id: user.id, role: user.role, phone: user.phone }, JWT_SECRET, { expiresIn: '7d' });
        await db.run('INSERT INTO audit_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)', [user.id, 'LOGIN', 'users', user.id, '用户登录']);
        res.json({
            token,
            user: {
                id: user.id,
                phone: user.phone,
                nickname: user.nickname,
                role: user.role,
                avatar: user.avatar,
                enterprise_status: user.enterprise_status
            }
        });
    } catch (error) {
        res.status(500).json({ error: '登录失败' });
    }
};
