import type { Request, Response } from 'express';
import { getDB } from '../db/database.js';

const userIdOf = (req: Request) => (req as any).user?.id;

export const getCategories = async (_req: Request, res: Response) => {
    const rows = await getDB().all('SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order ASC, id ASC');
    res.json(rows);
};

export const saveCategory = async (req: Request, res: Response) => {
    const db = getDB();
    const { id, parent_id = 0, name, icon, sort_order = 0, is_active = 1 } = req.body;
    if (id) {
        await db.run('UPDATE categories SET parent_id=?, name=?, icon=?, sort_order=?, is_active=? WHERE id=?', [parent_id, name, icon, sort_order, is_active, id]);
        return res.json({ message: '类目已更新' });
    }
    const result = await db.run('INSERT INTO categories (parent_id, name, icon, sort_order, is_active) VALUES (?, ?, ?, ?, ?)', [parent_id, name, icon, sort_order, is_active]);
    res.status(201).json({ id: result.lastID, message: '类目已创建' });
};

export const getActivities = async (req: Request, res: Response) => {
    const scope = req.query.scope;
    const rows = await getDB().all(
        `SELECT * FROM activities ${scope === 'all' ? '' : "WHERE status = 'APPROVED'"} ORDER BY sort_order ASC, created_at DESC`
    );
    res.json(rows);
};

export const saveActivity = async (req: Request, res: Response) => {
    const db = getDB();
    const { id, name, type, banner, rule_text, starts_at, ends_at, status = 'PENDING', sort_order = 0 } = req.body;
    if (id) {
        await db.run(
            'UPDATE activities SET name=?, type=?, banner=?, rule_text=?, starts_at=?, ends_at=?, status=?, sort_order=? WHERE id=?',
            [name, type, banner, rule_text, starts_at, ends_at, status, sort_order, id]
        );
        return res.json({ message: '活动已更新' });
    }
    const result = await db.run(
        'INSERT INTO activities (name, type, banner, rule_text, starts_at, ends_at, status, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [name, type, banner, rule_text, starts_at, ends_at, status, sort_order]
    );
    res.status(201).json({ id: result.lastID, message: '活动已创建' });
};

export const applyMerchant = async (req: Request, res: Response) => {
    const db = getDB();
    const userId = userIdOf(req);
    const { shop_name, logo, intro, contact_phone, license_image, legal_person } = req.body;
    await db.run(
        `INSERT INTO merchant_profiles (user_id, shop_name, logo, intro, contact_phone, license_image, legal_person, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')
         ON CONFLICT(user_id) DO UPDATE SET shop_name=excluded.shop_name, logo=excluded.logo, intro=excluded.intro,
         contact_phone=excluded.contact_phone, license_image=excluded.license_image, legal_person=excluded.legal_person, status='PENDING'`,
        [userId, shop_name, logo, intro, contact_phone, license_image, legal_person]
    );
    await db.run('UPDATE users SET role = "MERCHANT" WHERE id = ?', [userId]);
    res.json({ message: '商家入驻申请已提交' });
};

export const listMerchants = async (_req: Request, res: Response) => {
    const rows = await getDB().all(
        `SELECT mp.*, u.phone, u.nickname FROM merchant_profiles mp
         JOIN users u ON mp.user_id = u.id
         ORDER BY mp.created_at DESC`
    );
    res.json(rows);
};

export const auditMerchant = async (req: Request, res: Response) => {
    const db = getDB();
    const { id, status, reject_reason } = req.body;
    const merchant = await db.get('SELECT * FROM merchant_profiles WHERE id = ?', [id]);
    if (!merchant) return res.status(404).json({ error: '商家申请不存在' });
    await db.run('UPDATE merchant_profiles SET status = ?, reject_reason = ? WHERE id = ?', [status, reject_reason || '', id]);
    await db.run('INSERT INTO messages (user_id, title, content, type) VALUES (?, ?, ?, ?)', [
        merchant.user_id,
        '商家审核结果',
        status === 'APPROVED' ? '您的商家入驻申请已通过。' : `您的商家入驻申请被驳回：${reject_reason || '资料需补充'}`,
        'AUDIT'
    ]);
    res.json({ message: '商家审核已更新' });
};

export const createAfterSale = async (req: Request, res: Response) => {
    const db = getDB();
    const userId = userIdOf(req);
    const { order_id, type, reason, evidence } = req.body;
    const order = await db.get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [order_id, userId]);
    if (!order) return res.status(404).json({ error: '订单不存在' });
    const result = await db.run(
        'INSERT INTO aftersales (order_id, user_id, type, reason, evidence) VALUES (?, ?, ?, ?, ?)',
        [order_id, userId, type, reason, evidence]
    );
    await db.run('UPDATE orders SET status = "AFTERSALE" WHERE id = ?', [order_id]);
    res.status(201).json({ id: result.lastID, message: '售后申请已提交' });
};

export const listAfterSales = async (req: Request, res: Response) => {
    const user = (req as any).user;
    const rows = user.role === 'ADMIN'
        ? await getDB().all('SELECT a.*, u.nickname FROM aftersales a LEFT JOIN users u ON a.user_id = u.id ORDER BY a.created_at DESC')
        : await getDB().all('SELECT * FROM aftersales WHERE user_id = ? ORDER BY created_at DESC', [user.id]);
    res.json(rows);
};

export const auditAfterSale = async (req: Request, res: Response) => {
    const db = getDB();
    const { id, status, handler_note } = req.body;
    const aftersale = await db.get('SELECT * FROM aftersales WHERE id = ?', [id]);
    if (!aftersale) return res.status(404).json({ error: '售后单不存在' });
    await db.run('UPDATE aftersales SET status = ?, handler_note = ? WHERE id = ?', [status, handler_note || '', id]);
    if (status === 'APPROVED') {
        await db.run('UPDATE orders SET status = "REFUNDED" WHERE id = ?', [aftersale.order_id]);
    }
    await db.run('INSERT INTO messages (user_id, title, content, type) VALUES (?, ?, ?, ?)', [aftersale.user_id, '售后处理结果', `售后单 #${id} 状态更新为 ${status}`, 'AFTERSALE']);
    res.json({ message: '售后状态已更新' });
};

export const addComment = async (req: Request, res: Response) => {
    const db = getDB();
    const { product_id, order_id, rating = 5, content } = req.body;
    const result = await db.run(
        'INSERT INTO comments (user_id, product_id, order_id, rating, content, status) VALUES (?, ?, ?, ?, ?, "APPROVED")',
        [userIdOf(req), product_id, order_id, rating, content]
    );
    res.status(201).json({ id: result.lastID, message: '评价已发布' });
};

export const getCoupons = async (_req: Request, res: Response) => {
    const rows = await getDB().all('SELECT * FROM coupons WHERE status = "ACTIVE" ORDER BY id DESC');
    res.json(rows);
};

export const saveCoupon = async (req: Request, res: Response) => {
    const db = getDB();
    const { id, title, threshold_amount = 0, discount_amount = 0, total_count = 0, status = 'ACTIVE' } = req.body;
    if (id) {
        await db.run('UPDATE coupons SET title=?, threshold_amount=?, discount_amount=?, total_count=?, status=? WHERE id=?', [title, threshold_amount, discount_amount, total_count, status, id]);
        return res.json({ message: '优惠券已更新' });
    }
    const result = await db.run('INSERT INTO coupons (title, threshold_amount, discount_amount, total_count, status) VALUES (?, ?, ?, ?, ?)', [title, threshold_amount, discount_amount, total_count, status]);
    res.status(201).json({ id: result.lastID, message: '优惠券已创建' });
};

export const claimCoupon = async (req: Request, res: Response) => {
    const db = getDB();
    const userId = userIdOf(req);
    const { coupon_id } = req.body;
    const coupon = await db.get('SELECT * FROM coupons WHERE id = ? AND status = "ACTIVE"', [coupon_id]);
    if (!coupon) return res.status(404).json({ error: '优惠券不存在' });
    if (coupon.total_count > 0 && coupon.received_count >= coupon.total_count) return res.status(400).json({ error: '优惠券已领完' });
    await db.run('INSERT OR IGNORE INTO user_coupons (user_id, coupon_id) VALUES (?, ?)', [userId, coupon_id]);
    await db.run('UPDATE coupons SET received_count = received_count + 1 WHERE id = ? AND received_count < total_count', [coupon_id]);
    res.json({ message: '优惠券领取成功' });
};

export const myCoupons = async (req: Request, res: Response) => {
    const rows = await getDB().all(
        `SELECT uc.*, c.title, c.threshold_amount, c.discount_amount
         FROM user_coupons uc JOIN coupons c ON uc.coupon_id = c.id
         WHERE uc.user_id = ? ORDER BY uc.created_at DESC`,
        [userIdOf(req)]
    );
    res.json(rows);
};

export const toggleFavorite = async (req: Request, res: Response) => {
    const db = getDB();
    const { product_id } = req.body;
    await db.run('INSERT OR IGNORE INTO favorites (user_id, product_id) VALUES (?, ?)', [userIdOf(req), product_id]);
    res.json({ message: '商品已收藏' });
};

export const myFavorites = async (req: Request, res: Response) => {
    const rows = await getDB().all(
        `SELECT f.*, p.name, p.price, p.main_image
         FROM favorites f JOIN products p ON f.product_id = p.id
         WHERE f.user_id = ? ORDER BY f.created_at DESC`,
        [userIdOf(req)]
    );
    res.json(rows);
};

export const followShop = async (req: Request, res: Response) => {
    const { merchant_id } = req.body;
    await getDB().run('INSERT OR IGNORE INTO shop_follows (user_id, merchant_id) VALUES (?, ?)', [userIdOf(req), merchant_id]);
    res.json({ message: '店铺已关注' });
};

export const myFollows = async (req: Request, res: Response) => {
    const rows = await getDB().all(
        `SELECT sf.*, mp.shop_name, mp.logo
         FROM shop_follows sf JOIN merchant_profiles mp ON sf.merchant_id = mp.user_id
         WHERE sf.user_id = ? ORDER BY sf.created_at DESC`,
        [userIdOf(req)]
    );
    res.json(rows);
};

export const getContentPosts = async (_req: Request, res: Response) => {
    const rows = await getDB().all('SELECT * FROM content_posts WHERE status = "APPROVED" ORDER BY created_at DESC');
    res.json(rows);
};

export const interactContent = async (req: Request, res: Response) => {
    const db = getDB();
    const { post_id, type, content } = req.body;
    await db.run('INSERT INTO content_interactions (user_id, post_id, type, content) VALUES (?, ?, ?, ?)', [userIdOf(req), post_id, type, content || '']);
    if (type === 'LIKE') await db.run('UPDATE content_posts SET likes = likes + 1 WHERE id = ?', [post_id]);
    if (type === 'SHARE') await db.run('UPDATE content_posts SET shares = shares + 1 WHERE id = ?', [post_id]);
    if (type === 'VIEW') await db.run('UPDATE content_posts SET views = views + 1 WHERE id = ?', [post_id]);
    res.json({ message: '互动已记录' });
};

export const getMessages = async (req: Request, res: Response) => {
    const rows = await getDB().all('SELECT * FROM messages WHERE user_id = ? ORDER BY created_at DESC', [userIdOf(req)]);
    res.json(rows);
};

export const getAuditLogs = async (_req: Request, res: Response) => {
    const rows = await getDB().all(
        `SELECT l.*, u.phone, u.nickname
         FROM audit_logs l LEFT JOIN users u ON l.user_id = u.id
         ORDER BY l.created_at DESC LIMIT 200`
    );
    res.json(rows);
};

export const getSystemConfigs = async (_req: Request, res: Response) => {
    const rows = await getDB().all('SELECT * FROM system_configs ORDER BY config_key ASC');
    res.json(rows);
};

export const saveSystemConfig = async (req: Request, res: Response) => {
    const { config_key, config_value, remark } = req.body;
    await getDB().run(
        `INSERT INTO system_configs (config_key, config_value, remark)
         VALUES (?, ?, ?)
         ON CONFLICT(config_key) DO UPDATE SET config_value=excluded.config_value, remark=excluded.remark, updated_at=CURRENT_TIMESTAMP`,
        [config_key, config_value, remark || '']
    );
    res.json({ message: '系统配置已保存' });
};

export const exportOrdersCsv = async (_req: Request, res: Response) => {
    const rows = await getDB().all('SELECT id, user_id, total_amount, status, payment_method, logistics_company, logistics_no, created_at FROM orders ORDER BY created_at DESC');
    const header = 'id,user_id,total_amount,status,payment_method,logistics_company,logistics_no,created_at';
    const lines = rows.map((row) => [row.id, row.user_id, row.total_amount, row.status, row.payment_method || '', row.logistics_company || '', row.logistics_no || '', row.created_at].join(','));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send([header, ...lines].join('\n'));
};

export const getAdminStats = async (_req: Request, res: Response) => {
    const db = getDB();
    const [users, products, orders, merchants, certs, aftersales] = await Promise.all([
        db.get('SELECT COUNT(*) as count FROM users'),
        db.get('SELECT COUNT(*) as count FROM products'),
        db.get('SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as gmv FROM orders'),
        db.get("SELECT COUNT(*) as count FROM merchant_profiles WHERE status = 'PENDING'"),
        db.get("SELECT COUNT(*) as count FROM enterprise_info WHERE status = 'PENDING'"),
        db.get("SELECT COUNT(*) as count FROM aftersales WHERE status = 'PENDING'")
    ]);
    const hotProducts = await db.all('SELECT name, sales, price FROM products ORDER BY sales DESC LIMIT 5');
    res.json({
        users: users.count,
        products: products.count,
        orders: orders.count,
        gmv: orders.gmv,
        pending_merchants: merchants.count,
        pending_certs: certs.count,
        pending_aftersales: aftersales.count,
        hotProducts
    });
};

export const listUsers = async (_req: Request, res: Response) => {
    const rows = await getDB().all('SELECT id, phone, nickname, role, enterprise_status, status, created_at FROM users ORDER BY created_at DESC');
    res.json(rows);
};

export const updateUserStatus = async (req: Request, res: Response) => {
    const { id, status } = req.body;
    await getDB().run('UPDATE users SET status = ? WHERE id = ?', [status, id]);
    res.json({ message: '用户状态已更新' });
};
