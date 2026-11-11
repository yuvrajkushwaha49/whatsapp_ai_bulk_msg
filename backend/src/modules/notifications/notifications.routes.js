import { Router } from 'express';
import notificationsController from './notifications.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

// Secure all notification endpoints with JWT auth
router.use(authenticate);

router.get('/', notificationsController.getNotifications);
router.post('/read-all', notificationsController.markAllAsRead);
router.delete('/', notificationsController.clearAll);
router.patch('/:id/read', notificationsController.markAsRead);
router.delete('/:id', notificationsController.deleteNotification);

export default router;

