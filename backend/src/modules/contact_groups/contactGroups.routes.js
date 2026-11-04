import { Router } from 'express';
import * as contactGroupsController from './contactGroups.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requireTenant, requireRole } from '../../middleware/tenant.js';

const router = Router();

router.use(authenticate, requireTenant);

router.get('/', contactGroupsController.list);
router.post('/', requireRole(['owner', 'admin', 'marketer']), contactGroupsController.create);
router.get('/:id', contactGroupsController.details);
router.put('/:id', requireRole(['owner', 'admin', 'marketer']), contactGroupsController.update);
router.delete('/:id', requireRole(['owner', 'admin']), contactGroupsController.remove);

// Group membership actions
router.post('/:id/members', requireRole(['owner', 'admin', 'marketer']), contactGroupsController.addMembers);
router.delete('/:id/members/:contactId', requireRole(['owner', 'admin', 'marketer']), contactGroupsController.removeMember);

export default router;

