import { Router } from 'express';
import * as webhooksController from './webhooks.controller.js';

const router = Router();

// Public endpoints called by Meta webhook servers
router.get('/whatsapp', webhooksController.getVerification);
router.post('/whatsapp', webhooksController.handleWebhookEvent);

export default router;
