import { Router } from 'express';
import * as contactsController from './contacts.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requireTenant, requireRole } from '../../middleware/tenant.js';

const router = Router();

router.use(authenticate, requireTenant);

router.get('/', contactsController.list);
router.get('/tags', contactsController.tags);
router.get('/:id', contactsController.details);
router.put('/:id', requireRole(['owner', 'admin', 'marketer']), contactsController.update);
router.post('/', requireRole(['owner', 'admin', 'marketer']), contactsController.create);
router.patch('/:id/consent', requireRole(['owner', 'admin', 'marketer']), contactsController.updateConsent);
router.delete('/:id', requireRole(['owner', 'admin']), contactsController.remove);

export default router;
