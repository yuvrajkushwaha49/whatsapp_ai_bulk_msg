import { Router } from 'express';
import * as usersService from './users.service.js';
import { authenticate } from '../../middleware/auth.js';
import { requireTenant, requireRole } from '../../middleware/tenant.js';

const router = Router();

router.use(authenticate, requireTenant);

router.get('/', async (req, res, next) => {
  try {
    const result = await usersService.listTeamMembers(req.businessId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});
router.post('/invite', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    const result = await usersService.inviteMember(req.businessId, req.body);
    res.status(201).json({ success: true, message: 'Team member invited', data: result });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/role', requireRole(['owner']), async (req, res, next) => {
  try {
    const result = await usersService.updateMemberRole(req.businessId, req.params.id, req.body.role);
    res.json({ success: true, message: 'Member role updated', data: result });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireRole(['owner']), async (req, res, next) => {
  try {
    await usersService.removeMember(req.businessId, req.params.id);
    res.json({ success: true, message: 'Member removed from workspace' });
  } catch (err) {
    next(err);
  }
});

export default router;
