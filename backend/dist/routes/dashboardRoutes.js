import { Router } from 'express';
import { DashboardController } from '../controllers/dashboardController.js';
import { authenticateToken } from '../middleware/auth.js';
const router = Router();
router.use(authenticateToken);
router.get('/summary', DashboardController.getSummary);
router.get('/hourly', DashboardController.getHourly);
router.get('/locations', DashboardController.getLocations);
export default router;
