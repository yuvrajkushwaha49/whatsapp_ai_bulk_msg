import { Router } from 'express';
import * as whatsappController from './whatsapp.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requireTenant, requireRole } from '../../middleware/tenant.js';

const router = Router();

router.use(authenticate, requireTenant);

router.post('/connect', requireRole(['owner', 'admin']), whatsappController.connect);
router.get('/accounts', whatsappController.listAccounts);
router.post('/accounts/:accountId/sync-templates', requireRole(['owner', 'admin', 'marketer']), whatsappController.syncTemplates);
router.get('/templates', whatsappController.listTemplates);

export default router;
