import { Router } from 'express';
import * as campaignsController from './campaigns.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requireTenant, requireRole } from '../../middleware/tenant.js';

const router = Router();

router.use(authenticate, requireTenant);

router.get('/', campaignsController.list);
router.post('/', requireRole(['owner', 'admin', 'marketer']), campaignsController.create);
router.post('/preview', campaignsController.preview);
router.post('/preflight', campaignsController.preflight);
router.get('/:id', campaignsController.details);
router.post('/:id/start', requireRole(['owner', 'admin', 'marketer']), campaignsController.start);
router.post('/:id/pause', requireRole(['owner', 'admin', 'marketer']), campaignsController.pause);
router.post('/:id/cancel', requireRole(['owner', 'admin']), campaignsController.cancel);

export default router;
