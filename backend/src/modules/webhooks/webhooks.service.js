import { executeQuery, isUsingFallback, getMemoryStore } from '../../database/db.js';
import logger from '../../utils/logger.js';

export function verifyChallenge(mode, token, challenge) {
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || 'campaignflow_meta_verify_token_xyz';
  if (mode === 'subscribe' && token === verifyToken) {
    logger.info('[Webhook] Meta Webhook verified challenge successfully');
    return challenge;
  }
  return null;
}

export async function processWebhookPayload(payload) {
  if (!payload || !payload.entry) {
    return { processed: false, reason: 'Invalid payload structure' };
  }

  for (const entry of payload.entry) {
    for (const change of entry.changes || []) {
      const value = change.value;
      if (!value) continue;

      // 1. Process Message Status Updates (sent, delivered, read, failed)
      if (value.statuses && Array.isArray(value.statuses)) {
        for (const statusObj of value.statuses) {
          const providerMsgId = statusObj.id;
          const status = statusObj.status; // 'sent', 'delivered', 'read', 'failed'
          const timestamp = statusObj.timestamp ? new Date(Number(statusObj.timestamp) * 1000) : new Date();

          logger.info(`[Webhook] Status update: ${providerMsgId} -> ${status}`);

          if (isUsingFallback()) {
            const store = getMemoryStore();
            const recipient = store.campaign_recipients.find(r => r.provider_message_id === providerMsgId);
            if (recipient) {
              recipient.status = status;
              if (status === 'delivered') recipient.delivered_at = timestamp;
              if (status === 'read') recipient.read_at = timestamp;

              const campaign = store.campaigns.find(c => c.id === recipient.campaign_id);
              if (campaign) {
                if (status === 'delivered') campaign.delivered_count = (campaign.delivered_count || 0) + 1;
                if (status === 'read') campaign.read_count = (campaign.read_count || 0) + 1;
              }
            }
          } else {
            // Update recipient status
            let updateSql = 'UPDATE campaign_recipients SET status = ?';
            const params = [status];

            if (status === 'delivered') {
              updateSql += ', delivered_at = NOW()';
            } else if (status === 'read') {
              updateSql += ', read_at = NOW()';
            } else if (status === 'failed') {
              const errMsg = statusObj.errors?.[0]?.message || 'Meta delivery error';
              updateSql += ', error_message = ?';
              params.push(errMsg);
            }

            updateSql += ' WHERE provider_message_id = ?';
            params.push(providerMsgId);

            await executeQuery(updateSql, params);

            // Also update messages table
            await executeQuery(
              'UPDATE messages SET status = ?, updated_at = NOW() WHERE provider_message_id = ?',
              [status, providerMsgId]
            );

            // Update aggregated campaign counts
            if (status === 'delivered') {
              await executeQuery(
                `UPDATE campaigns c 
                 JOIN campaign_recipients cr ON c.id = cr.campaign_id 
                 SET c.delivered_count = c.delivered_count + 1 
                 WHERE cr.provider_message_id = ?`,
                [providerMsgId]
              );
            } else if (status === 'read') {
              await executeQuery(
                `UPDATE campaigns c 
                 JOIN campaign_recipients cr ON c.id = cr.campaign_id 
                 SET c.read_count = c.read_count + 1 
                 WHERE cr.provider_message_id = ?`,
                [providerMsgId]
              );
            }
          }
        }
      }

      // 2. Process Inbound Customer Messages & Opt-Out Commands
      if (value.messages && Array.isArray(value.messages)) {
        for (const msg of value.messages) {
          const from = `+${msg.from}`;
          const textBody = msg.text?.body?.trim() || '';
          const upperText = textBody.toUpperCase();

          logger.info(`[Webhook] Inbound message from ${from}: "${textBody}"`);

          // Check if opt-out command
          const isOptOut = ['STOP', 'UNSUBSCRIBE', 'STOPALL', 'CANCEL', 'OPT OUT', 'OPTOUT'].includes(upperText);

          if (isOptOut) {
            logger.warn(`🛑 [Webhook] Opt-out command received from ${from}. Marking contact unsubscribed immediately.`);

            if (isUsingFallback()) {
              const store = getMemoryStore();
              const contact = store.contacts.find(c => c.phone === from);
              if (contact) {
                contact.is_opted_in = 0;
                contact.status = 'unsubscribed';

                store.contact_consents.push({
                  id: store.contact_consents.length + 1,
                  business_id: contact.business_id,
                  contact_id: contact.id,
                  consent_status: 'opted_out',
                  consent_source: 'whatsapp_inbound_stop',
                  proof_notes: `Customer replied "${textBody}" to WhatsApp message`,
                  withdrawn_at: new Date(),
                  created_at: new Date()
                });
              }
            } else {
              // Mark all contacts matching this phone number across relevant business as opted-out
              const contacts = await executeQuery('SELECT id, business_id FROM contacts WHERE phone = ?', [from]);
              for (const c of contacts) {
                await executeQuery(
                  "UPDATE contacts SET is_opted_in = FALSE, status = 'unsubscribed' WHERE id = ?",
                  [c.id]
                );

                await executeQuery(
                  `INSERT INTO contact_consents (business_id, contact_id, consent_status, consent_source, consent_category, proof_notes, withdrawn_at)
                   VALUES (?, ?, 'opted_out', 'whatsapp_inbound_stop', 'promotional', ?, NOW())`,
                  [c.business_id, c.id, `Inbound STOP command: "${textBody}"`]
                );
              }
            }
          }

          // Record conversation
          if (isUsingFallback()) {
            const store = getMemoryStore();
            const contact = store.contacts.find(c => c.phone === from);
            if (contact) {
              let conv = store.inbound_conversations.find(ic => ic.contact_id === contact.id);
              if (!conv) {
                store.inbound_conversations.push({
                  id: store.inbound_conversations.length + 1,
                  business_id: contact.business_id,
                  contact_id: contact.id,
                  whatsapp_account_id: 1,
                  last_message_text: textBody,
                  last_message_at: new Date(),
                  is_resolved: 0
                });
              } else {
                conv.last_message_text = textBody;
                conv.last_message_at = new Date();
              }
            }
          }
        }
      }
    }
  }

  return { processed: true };
}

export default {
  verifyChallenge,
  processWebhookPayload
};
