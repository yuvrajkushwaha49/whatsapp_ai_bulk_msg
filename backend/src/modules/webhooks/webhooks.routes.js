import { Router } from 'express';
import * as webhooksController from './webhooks.controller.js';

const router = Router();

// Public endpoints called by Meta webhook servers (supports both / and /whatsapp)
router.get('/', webhooksController.getVerification);
router.post('/', webhooksController.handleWebhookEvent);
router.get('/whatsapp', webhooksController.getVerification);
router.post('/whatsapp', webhooksController.handleWebhookEvent);

export default router;
