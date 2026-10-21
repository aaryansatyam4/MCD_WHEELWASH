import { Router } from 'express';
import { UserController } from '../controllers/userController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
const router = Router();
// Master Admin only
router.use(authenticateToken);
router.use(requireRole('admin'));
router.get('/', UserController.getUsers);
router.post('/', UserController.createUser);
router.patch('/:id', UserController.updateUser);
router.post('/:id/reset-password', UserController.resetPassword);
export default router;
