import { Router } from 'express';
import { submitCertification, getCertificationStatus, auditCertification, listCertifications } from '../controllers/enterpriseController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.post('/submit', authenticate, submitCertification);
router.get('/status', authenticate, getCertificationStatus);
router.get('/applications', authenticate, authorize(['ADMIN']), listCertifications);
router.post('/audit', authenticate, authorize(['ADMIN']), auditCertification);

export default router;
