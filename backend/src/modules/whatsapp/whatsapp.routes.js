import { Router } from 'express';
import * as whatsappController from './whatsapp.controller.js';
import inboxRouter from '../inbox/inbox.routes.js';
import { authenticate } from '../../middleware/auth.js';
import { requireTenant, requireRole } from '../../middleware/tenant.js';

const router = Router();

router.use(authenticate, requireTenant);

// WhatsApp Accounts & Embedded Signup
router.get('/accounts/connect/start', whatsappController.getConnectConfig);
router.get('/detect-meta', whatsappController.detectMetaAccount);
router.get('/accounts/detect-meta', whatsappController.detectMetaAccount);
router.post('/auto-connect', requireRole(['owner', 'admin', 'marketer']), whatsappController.autoConnectMetaAccount);
router.post('/accounts/auto-connect', requireRole(['owner', 'admin', 'marketer']), whatsappController.autoConnectMetaAccount);
router.post('/accounts/connect/complete', requireRole(['owner', 'admin', 'marketer']), whatsappController.completeEmbeddedSignup);
router.post('/connect', requireRole(['owner', 'admin', 'marketer']), whatsappController.connect);
router.get('/accounts', whatsappController.listAccounts);
router.get('/accounts/:id', whatsappController.getAccount);
router.post('/accounts/:id/verify', requireRole(['owner', 'admin', 'marketer']), whatsappController.verifyAccount);
router.post('/accounts/:id/reconnect', requireRole(['owner', 'admin', 'marketer']), whatsappController.verifyAccount);
router.post('/accounts/:id/primary', requireRole(['owner', 'admin', 'marketer']), whatsappController.setPrimaryAccount);
router.post('/accounts/:id/test-message', requireRole(['owner', 'admin', 'marketer']), whatsappController.sendTestMessage);
router.delete('/accounts/:id/permanent', requireRole(['owner', 'admin']), whatsappController.deleteAccount);
router.delete('/accounts/:id', requireRole(['owner', 'admin', 'marketer']), (req, res, next) => {
  if (req.query.permanent === 'true') {
    return whatsappController.deleteAccount(req, res, next);
  }
  return whatsappController.disconnectAccount(req, res, next);
});
router.post('/accounts/:accountId/sync-templates', requireRole(['owner', 'admin', 'marketer']), whatsappController.syncTemplates);
router.get('/webhook/ping', whatsappController.testWebhookPing);
router.post('/webhook/ping', whatsappController.testWebhookPing);

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
