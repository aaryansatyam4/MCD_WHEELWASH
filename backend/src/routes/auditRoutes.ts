import { Router } from 'express';
import { AuditController } from '../controllers/auditController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

// Master Admin only
router.use(authenticateToken);
router.use(requireRole('admin'));

router.get('/', AuditController.getLogs);

export default router;
