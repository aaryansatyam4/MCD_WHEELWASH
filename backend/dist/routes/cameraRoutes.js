import { Router } from 'express';
import { CameraController } from '../controllers/cameraController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
const router = Router();
router.use(authenticateToken);
router.get('/', CameraController.getCameras);
router.get('/:id/status', CameraController.getCameraStatus);
// Master Admin only routes
router.put('/:id/settings', requireRole('admin'), CameraController.updateSettings);
router.post('/:id/test', requireRole('admin'), CameraController.testConnection);
router.post('/:id/start', requireRole('admin'), CameraController.startStream);
router.post('/:id/stop', requireRole('admin'), CameraController.stopStream);
export default router;
