import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
    addComment,
    applyMerchant,
    auditAfterSale,
    auditMerchant,
    claimCoupon,
    createAfterSale,
    exportOrdersCsv,
    getActivities,
    getAdminStats,
    getAuditLogs,
    getCategories,
    getContentPosts,
    getCoupons,
    getMessages,
    getSystemConfigs,
    followShop,
    interactContent,
    listAfterSales,
    listMerchants,
    listUsers,
    myCoupons,
    myFavorites,
    myFollows,
    saveActivity,
    saveCategory,
    saveCoupon,
    saveSystemConfig,
    toggleFavorite,
    updateUserStatus
} from '../controllers/platformController.js';

const router = Router();

router.get('/categories', getCategories);
router.post('/categories', authenticate, authorize(['ADMIN']), saveCategory);
router.get('/activities', getActivities);
router.post('/activities', authenticate, authorize(['ADMIN']), saveActivity);
router.get('/coupons', getCoupons);
router.post('/coupons', authenticate, authorize(['ADMIN']), saveCoupon);
router.post('/coupons/claim', authenticate, claimCoupon);
router.get('/coupons/my', authenticate, myCoupons);

router.post('/merchant/apply', authenticate, applyMerchant);
router.get('/merchant/applications', authenticate, authorize(['ADMIN']), listMerchants);
router.post('/merchant/audit', authenticate, authorize(['ADMIN']), auditMerchant);

router.post('/aftersales', authenticate, createAfterSale);
router.get('/aftersales', authenticate, listAfterSales);
router.post('/aftersales/audit', authenticate, authorize(['ADMIN', 'MERCHANT']), auditAfterSale);

router.post('/comments', authenticate, addComment);
router.post('/favorites', authenticate, toggleFavorite);
router.get('/favorites', authenticate, myFavorites);
router.post('/follows', authenticate, followShop);
router.get('/follows', authenticate, myFollows);
router.get('/content', getContentPosts);
router.post('/content/interact', authenticate, interactContent);
router.get('/messages', authenticate, getMessages);

router.get('/admin/stats', authenticate, authorize(['ADMIN']), getAdminStats);
router.get('/admin/users', authenticate, authorize(['ADMIN']), listUsers);
router.post('/admin/users/status', authenticate, authorize(['ADMIN']), updateUserStatus);
router.get('/admin/logs', authenticate, authorize(['ADMIN']), getAuditLogs);
router.get('/admin/configs', authenticate, authorize(['ADMIN']), getSystemConfigs);
router.post('/admin/configs', authenticate, authorize(['ADMIN']), saveSystemConfig);
router.get('/admin/reports/orders.csv', authenticate, authorize(['ADMIN']), exportOrdersCsv);

export default router;
