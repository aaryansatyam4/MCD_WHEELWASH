import { Router } from 'express';
import { CountController } from '../controllers/countController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
const router = Router();
router.use(authenticateToken);
router.get('/today', CountController.getToday);
router.get('/adjustments', CountController.getAdjustments);
router.get('/:locationId', CountController.getByLocation);
// Master Admin only: Manual truck count adjustment
router.post('/adjust', requireRole('admin'), CountController.adjust);
export default router;
