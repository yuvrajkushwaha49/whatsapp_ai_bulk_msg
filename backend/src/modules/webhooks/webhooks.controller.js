import * as webhooksService from './webhooks.service.js';
import { verifyMetaSignature } from '../whatsapp/metaClient.js';
import logger from '../../utils/logger.js';

export function getVerification(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifiedChallenge = webhooksService.verifyChallenge(mode, token, challenge);
  if (verifiedChallenge) {
    return res.status(200).send(verifiedChallenge);
  }

  logger.warn('[Webhook] Verification failed with invalid token');
  return res.sendStatus(403);
}

export async function handleWebhookEvent(req, res, next) {
  try {
    // 1. Signature validation (HMAC SHA-256)
    const signature = req.headers['x-hub-signature-256'];
    const rawBody = req.rawBody || JSON.stringify(req.body);

    if (signature && !verifyMetaSignature(rawBody, signature)) {
      logger.error('[Webhook] Meta signature verification failed');
      return res.status(401).json({ success: false, error: 'Invalid HMAC signature' });
    }

    // 2. Acknowledge Meta immediately with 200
    res.status(200).json({ status: 'EVENT_RECEIVED' });

    // 3. Process payload asynchronously
    setImmediate(async () => {
      try {
        await webhooksService.processWebhookPayload(req.body);
      } catch (err) {
        logger.error('[Webhook] Async processing error', err);
      }
    });
  } catch (error) {
    next(error);
  }
}

export default {
  getVerification,
  handleWebhookEvent
};
