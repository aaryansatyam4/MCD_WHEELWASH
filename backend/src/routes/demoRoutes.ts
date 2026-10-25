import { Router } from 'express';
import { DemoController } from '../controllers/demoController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

// In demo mode, authenticated users can trigger simulation for authorized locations
router.post('/trigger-passage', authenticateToken, DemoController.triggerPassage);
router.post('/trigger-human-walk', authenticateToken, DemoController.triggerHumanWalk);

// Admin only: reload database from Excel file on disk
router.post('/reload-database', authenticateToken, requireRole('admin'), DemoController.reloadDatabase);

export default router;