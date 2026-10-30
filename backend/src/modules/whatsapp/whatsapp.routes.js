import { Router } from 'express';
import * as whatsappController from './whatsapp.controller.js';
import inboxRouter from '../inbox/inbox.routes.js';
import { authenticate } from '../../middleware/auth.js';
import { requireTenant, requireRole } from '../../middleware/tenant.js';

const router = Router();

router.use(authenticate, requireTenant);

// WhatsApp Accounts
router.post('/connect', requireRole(['owner', 'admin']), whatsappController.connect);
router.get('/accounts', whatsappController.listAccounts);
router.post('/accounts/:accountId/sync-templates', requireRole(['owner', 'admin', 'marketer']), whatsappController.syncTemplates);

// WhatsApp Templates Management
router.get('/templates', whatsappController.listTemplates);
router.post('/templates', requireRole(['owner', 'admin', 'marketer']), whatsappController.createTemplate);
router.post('/templates/sync', requireRole(['owner', 'admin', 'marketer']), whatsappController.syncTemplates);
router.get('/templates/:id', whatsappController.getTemplate);
router.get('/templates/:id/status', whatsappController.checkTemplateStatus);
router.delete('/templates/:id', requireRole(['owner', 'admin']), whatsappController.deleteTemplate);

// WhatsApp Inbox & Two-Way Conversations
router.use('/', inboxRouter);

export default router;
