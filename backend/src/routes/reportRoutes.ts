import { Router } from 'express';
import { ReportController } from '../controllers/reportController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

router.get('/daily', ReportController.getDaily);
router.get('/weekly', ReportController.getWeekly);
router.get('/monthly', ReportController.getMonthly);
router.get('/yearly', ReportController.getYearly);
router.get('/export', ReportController.exportReport);

export default router;
