import { Router } from 'express';
import * as importsController from './imports.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requireTenant, requireRole } from '../../middleware/tenant.js';

const router = Router();

router.use(authenticate, requireTenant);

router.post('/preview', requireRole(['owner', 'admin', 'marketer']), importsController.preview);
router.post('/execute', requireRole(['owner', 'admin', 'marketer']), importsController.execute);
router.get('/', importsController.list);
router.get('/:id/errors', importsController.errors);

export default router;
