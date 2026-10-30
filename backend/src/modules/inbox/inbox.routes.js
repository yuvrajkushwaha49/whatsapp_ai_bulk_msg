import { Router } from 'express';
import * as inboxController from './inbox.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requireTenant, requireRole } from '../../middleware/tenant.js';

const router = Router();

// Apply authentication and tenant isolation to all inbox routes
router.use(authenticate, requireTenant);

// Inbox Analytics Stats
router.get('/inbox/stats', inboxController.getStats);

// Conversations Routes
router.get('/conversations', inboxController.getConversations);
router.get('/conversations/:id', inboxController.getConversation);

// Conversation Actions
router.post('/conversations/:id/assign', requireRole(['owner', 'admin', 'team_lead', 'agent']), inboxController.assign);
router.post('/conversations/:id/close', inboxController.closeConversation);
router.post('/conversations/:id/reopen', inboxController.reopenConversation);
router.post('/conversations/:id/read', inboxController.markRead);
router.post('/conversations/:id/unread', inboxController.markUnread);

// Messages Routes
router.get('/conversations/:id/messages', inboxController.getMessages);
router.post('/conversations/:id/messages', inboxController.sendMessage);
router.post('/conversations/:id/template', inboxController.sendTemplate);
router.post('/conversations/:id/media', inboxController.sendMedia);

// Customer CRM Panel Routes
router.get('/conversations/:id/contact', inboxController.getConversation);
router.patch('/conversations/:id/contact', inboxController.updateContact);
router.post('/conversations/:id/notes', inboxController.addNote);
router.get('/conversations/:id/notes', inboxController.getNotes);

export default router;
