import { executeQuery, isUsingFallback, getMemoryStore, saveMemoryStore } from '../../database/db.js';
import logger from '../../utils/logger.js';
import { emitToTenant, emitToConversation } from '../../socket.js';

export function verifyChallenge(mode, token, challenge) {
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || 'campaignflow_meta_verify_token_xyz';
  if (mode === 'subscribe' && (token === verifyToken || token === 'campaignflow_meta_verify_token_xyz')) {
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

      // Identify WhatsApp Account & Business Tenant from metadata.phone_number_id
      const metaPhoneId = value.metadata?.phone_number_id;
      let matchedBusinessId = 1;
      let matchedAccountId = 1;

      if (isUsingFallback()) {
        const store = getMemoryStore();
        if (metaPhoneId && store.whatsapp_accounts) {
          const acc = store.whatsapp_accounts.find(a => a.phone_number_id === metaPhoneId);
          if (acc) {
            matchedBusinessId = acc.business_id;
            matchedAccountId = acc.id;
          }
        }
      } else if (metaPhoneId) {
        try {
          const accs = await executeQuery(
            'SELECT id, business_id FROM whatsapp_accounts WHERE phone_number_id = ? LIMIT 1',
            [metaPhoneId]
          );
          if (accs && accs.length > 0) {
            matchedBusinessId = accs[0].business_id;
            matchedAccountId = accs[0].id;
          }
        } catch (err) {
          logger.warn('[Webhook] Error matching whatsapp account by phone_number_id:', err.message);
        }
      }

      // 1. Process Message Status Updates (sent, delivered, read, failed)
      if (value.statuses && Array.isArray(value.statuses)) {
        for (const statusObj of value.statuses) {
          const providerMsgId = statusObj.id;
          const status = statusObj.status; // 'sent', 'delivered', 'read', 'failed'
          const timestamp = statusObj.timestamp ? new Date(Number(statusObj.timestamp) * 1000) : new Date();

          logger.info(`[Webhook] Status update: ${providerMsgId} -> ${status}`);

          if (isUsingFallback()) {
            const store = getMemoryStore();

            // Update campaign recipients
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

            // Update WhatsApp Inbox messages
            if (store.whatsapp_messages) {
              const inboxMsg = store.whatsapp_messages.find(m => m.meta_message_id === providerMsgId);
              if (inboxMsg) {
                inboxMsg.message_status = status;
                if (status === 'delivered') inboxMsg.delivered_at = timestamp;
                if (status === 'read') inboxMsg.read_at = timestamp;
                if (status === 'failed') {
                  inboxMsg.failed_at = timestamp;
                  inboxMsg.failure_reason = statusObj.errors?.[0]?.message || 'Delivery error';
                }
                inboxMsg.updated_at = new Date();

                // Real-time broadcast
                emitToTenant(inboxMsg.business_id, 'inbox:message_status', {
                  messageId: inboxMsg.id,
                  metaMessageId: providerMsgId,
                  status,
                  conversationId: inboxMsg.conversation_id
                });
                emitToConversation(inboxMsg.conversation_id, 'inbox:message_status', {
                  messageId: inboxMsg.id,
                  metaMessageId: providerMsgId,
                  status,
                  conversationId: inboxMsg.conversation_id
                });
              }
            }
            saveMemoryStore();
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

            // Update inbox whatsapp_messages table
            let inboxUpdateSql = 'UPDATE whatsapp_messages SET message_status = ?, updated_at = NOW()';
            const inboxParams = [status];
            if (status === 'delivered') inboxUpdateSql += ', delivered_at = NOW()';
            else if (status === 'read') inboxUpdateSql += ', read_at = NOW()';
            else if (status === 'failed') {
              inboxUpdateSql += ', failed_at = NOW(), failure_reason = ?';
              inboxParams.push(statusObj.errors?.[0]?.message || 'Delivery error');
            }
            inboxUpdateSql += ' WHERE meta_message_id = ?';
            inboxParams.push(providerMsgId);

            await executeQuery(inboxUpdateSql, inboxParams);

            // Find message details for socket emission
            const updatedRows = await executeQuery(
              'SELECT id, business_id, conversation_id FROM whatsapp_messages WHERE meta_message_id = ? LIMIT 1',
              [providerMsgId]
            );
            if (updatedRows && updatedRows.length > 0) {
              const row = updatedRows[0];
              emitToTenant(row.business_id, 'inbox:message_status', {
                messageId: row.id,
                metaMessageId: providerMsgId,
                status,
                conversationId: row.conversation_id
              });
              emitToConversation(row.conversation_id, 'inbox:message_status', {
                messageId: row.id,
                metaMessageId: providerMsgId,
                status,
                conversationId: row.conversation_id
              });
            }

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

      // 2. Process Inbound Customer Messages & Inbox Updates
      if (value.messages && Array.isArray(value.messages)) {
        for (const msg of value.messages) {
          const rawFrom = String(msg.from).replace(/[^\d]/g, '');
          const from = `+${rawFrom}`;
          const profileName = value.contacts?.[0]?.profile?.name || '';
          const msgType = msg.type || 'text';
          const metaMsgId = msg.id;
          const msgTimestamp = msg.timestamp ? new Date(Number(msg.timestamp) * 1000) : new Date();

          let textBody = '';
          let mediaId = null;
          let mediaMime = null;
          let mediaFilename = null;

          if (msgType === 'text') {
            textBody = msg.text?.body?.trim() || '';
          } else if (msgType === 'image') {
            mediaId = msg.image?.id;
            mediaMime = msg.image?.mime_type;
            textBody = msg.image?.caption || '📷 Photo';
          } else if (msgType === 'video') {
            mediaId = msg.video?.id;
            mediaMime = msg.video?.mime_type;
            textBody = msg.video?.caption || '🎥 Video';
          } else if (msgType === 'audio') {
            mediaId = msg.audio?.id;
            mediaMime = msg.audio?.mime_type;
            textBody = '🎵 Voice message';
          } else if (msgType === 'document') {
            mediaId = msg.document?.id;
            mediaMime = msg.document?.mime_type;
            mediaFilename = msg.document?.filename || 'Document';
            textBody = msg.document?.caption || mediaFilename;
          } else if (msgType === 'sticker') {
            mediaId = msg.sticker?.id;
            mediaMime = msg.sticker?.mime_type;
            textBody = 'Sticker';
          } else if (msgType === 'location') {
            textBody = `📍 Location: ${msg.location?.name || ''} (${msg.location?.latitude}, ${msg.location?.longitude})`.trim();
          } else if (msgType === 'interactive') {
            textBody = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || 'Interactive response';
          } else if (msgType === 'button') {
            textBody = msg.button?.text || 'Button response';
          } else {
            textBody = `[${msgType} message]`;
          }

          logger.info(`[Webhook] Inbound ${msgType} message from ${from}: "${textBody}"`);

          const upperText = textBody.toUpperCase();
          const isOptOut = ['STOP', 'UNSUBSCRIBE', 'STOPALL', 'CANCEL', 'OPT OUT', 'OPTOUT'].includes(upperText);

          // 24-hour service window expiry = message arrival + 24 hours
          const windowExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

          if (isUsingFallback()) {
            const store = getMemoryStore();

            // Match or create contact
            let contact = store.contacts.find(c => c.phone === from && c.business_id === matchedBusinessId);
            if (!contact) {
              const nameParts = (profileName || 'WhatsApp Customer').split(' ');
              contact = {
                id: store.contacts.length + 1,
                business_id: matchedBusinessId,
                first_name: nameParts[0] || 'Customer',
                last_name: nameParts.slice(1).join(' ') || '',
                phone: from,
                status: 'active',
                is_opted_in: 1,
                tags: ['inbox', 'whatsapp'],
                created_at: new Date(),
                updated_at: new Date()
              };
              store.contacts.push(contact);
            }

            if (isOptOut) {
              logger.warn(`🛑 [Webhook] Opt-out command received from ${from}. Marking contact unsubscribed.`);
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

            // Match or create conversation in whatsapp_conversations
            if (!store.whatsapp_conversations) store.whatsapp_conversations = [];
            let conversation = store.whatsapp_conversations.find(
              c => c.business_id === matchedBusinessId && (c.customer_phone === from || c.contact_id === contact.id)
            );

            const isNewConversation = !conversation;
            if (!conversation) {
              conversation = {
                id: store.whatsapp_conversations.length + 1,
                business_id: matchedBusinessId,
                whatsapp_account_id: matchedAccountId,
                contact_id: contact.id,
                customer_phone: from,
                assigned_user_id: null,
                status: 'open',
                unread_count: 1,
                last_message_id: null,
                last_message_text: textBody,
                last_message_at: msgTimestamp,
                last_incoming_message_at: msgTimestamp,
                service_window_expires_at: windowExpiresAt,
                created_at: msgTimestamp,
                updated_at: new Date()
              };
              store.whatsapp_conversations.push(conversation);
            } else {
              if (conversation.status === 'closed') {
                conversation.status = 'open';
              }
              conversation.unread_count = (conversation.unread_count || 0) + 1;
              conversation.last_message_text = textBody;
              conversation.last_message_at = msgTimestamp;
              conversation.last_incoming_message_at = msgTimestamp;
              conversation.service_window_expires_at = windowExpiresAt;
              conversation.updated_at = new Date();
            }

            // Check duplicate message
            if (!store.whatsapp_messages) store.whatsapp_messages = [];
            const duplicate = store.whatsapp_messages.find(m => m.meta_message_id === metaMsgId);
            if (!duplicate) {
              const newMsg = {
                id: store.whatsapp_messages.length + 1,
                business_id: matchedBusinessId,
                conversation_id: conversation.id,
                contact_id: contact.id,
                whatsapp_account_id: matchedAccountId,
                meta_message_id: metaMsgId,
                direction: 'INBOUND',
                message_type: msgType,
                message_body: textBody,
                media_id: mediaId,
                media_url: null,
                message_status: 'delivered',
                delivered_at: msgTimestamp,
                created_at: msgTimestamp,
                updated_at: msgTimestamp
              };
              store.whatsapp_messages.push(newMsg);
              conversation.last_message_id = newMsg.id;

              if (mediaId && store.whatsapp_message_media) {
                store.whatsapp_message_media.push({
                  id: store.whatsapp_message_media.length + 1,
                  business_id: matchedBusinessId,
                  message_id: newMsg.id,
                  meta_media_id: mediaId,
                  mime_type: mediaMime,
                  file_name: mediaFilename,
                  created_at: msgTimestamp
                });
              }

              // Socket real-time broadcast
              const payloadData = {
                conversation: {
                  ...conversation,
                  contact: {
                    id: contact.id,
                    name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || from,
                    phone: contact.phone,
                    tags: contact.tags
                  }
                },
                message: newMsg
              };

              emitToTenant(matchedBusinessId, 'inbox:new_message', payloadData);
              emitToConversation(conversation.id, 'inbox:new_message', payloadData);
              emitToTenant(matchedBusinessId, 'inbox:conversation_updated', { conversation: payloadData.conversation });
            }

            saveMemoryStore();
          } else {
            // MySQL Database Execution
            try {
              // 1. Find or create contact
              let contactRows = await executeQuery(
                'SELECT id, first_name, last_name, phone, tags FROM contacts WHERE business_id = ? AND phone = ? LIMIT 1',
                [matchedBusinessId, from]
              );

              let contactId = null;
              let contactObj = null;

              if (!contactRows || contactRows.length === 0) {
                const nameParts = (profileName || 'WhatsApp Customer').split(' ');
                const firstName = nameParts[0] || 'Customer';
                const lastName = nameParts.slice(1).join(' ') || '';

                const insertContact = await executeQuery(
                  `INSERT INTO contacts (business_id, first_name, last_name, phone, status, is_opted_in, tags, created_at, updated_at)
                   VALUES (?, ?, ?, ?, 'active', 1, '["inbox","whatsapp"]', NOW(), NOW())`,
                  [matchedBusinessId, firstName, lastName, from]
                );
                contactId = insertContact.insertId;
                contactObj = { id: contactId, first_name: firstName, last_name: lastName, phone: from, tags: ['inbox', 'whatsapp'] };
              } else {
                contactId = contactRows[0].id;
                contactObj = contactRows[0];
                await executeQuery('UPDATE contacts SET last_contacted_at = NOW() WHERE id = ?', [contactId]);
              }

              // Handle Opt-Out command
              if (isOptOut) {
                logger.warn(`🛑 [Webhook] Opt-out command from ${from}. Marking contact unsubscribed.`);
                await executeQuery("UPDATE contacts SET is_opted_in = FALSE, status = 'unsubscribed' WHERE id = ?", [contactId]);
                await executeQuery(
                  `INSERT INTO contact_consents (business_id, contact_id, consent_status, consent_source, consent_category, proof_notes, withdrawn_at)
                   VALUES (?, ?, 'opted_out', 'whatsapp_inbound_stop', 'promotional', ?, NOW())`,
                  [matchedBusinessId, contactId, `Inbound STOP command: "${textBody}"`]
                );
              }

              // 2. Find or create conversation
              let convRows = await executeQuery(
                'SELECT * FROM whatsapp_conversations WHERE business_id = ? AND (customer_phone = ? OR contact_id = ?) LIMIT 1',
                [matchedBusinessId, from, contactId]
              );

              let conversationId = null;
              let conversation = null;

              if (!convRows || convRows.length === 0) {
                const insertConv = await executeQuery(
                  `INSERT INTO whatsapp_conversations 
                   (business_id, whatsapp_account_id, contact_id, customer_phone, status, unread_count, 
                    last_message_text, last_message_at, last_incoming_message_at, service_window_expires_at, created_at, updated_at)
                   VALUES (?, ?, ?, ?, 'open', 1, ?, NOW(), NOW(), ?, NOW(), NOW())`,
                  [matchedBusinessId, matchedAccountId, contactId, from, textBody, windowExpiresAt]
                );
                conversationId = insertConv.insertId;
              } else {
                conversationId = convRows[0].id;
                await executeQuery(
                  `UPDATE whatsapp_conversations 
                   SET status = 'open', unread_count = unread_count + 1, last_message_text = ?, 
                       last_message_at = NOW(), last_incoming_message_at = NOW(), service_window_expires_at = ?, updated_at = NOW()
                   WHERE id = ?`,
                  [textBody, windowExpiresAt, conversationId]
                );
              }

              // 3. Idempotent check and insert message
              const existingMsg = await executeQuery(
                'SELECT id FROM whatsapp_messages WHERE meta_message_id = ? LIMIT 1',
                [metaMsgId]
              );

              if (!existingMsg || existingMsg.length === 0) {
                const insertMsg = await executeQuery(
                  `INSERT INTO whatsapp_messages 
                   (business_id, conversation_id, contact_id, whatsapp_account_id, meta_message_id, 
                    direction, message_type, message_body, media_id, message_status, delivered_at, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, 'INBOUND', ?, ?, ?, 'delivered', NOW(), NOW(), NOW())`,
                  [matchedBusinessId, conversationId, contactId, matchedAccountId, metaMsgId, msgType, textBody, mediaId]
                );

                const newMsgId = insertMsg.insertId;

                await executeQuery('UPDATE whatsapp_conversations SET last_message_id = ? WHERE id = ?', [newMsgId, conversationId]);

                if (mediaId) {
                  await executeQuery(
                    `INSERT INTO whatsapp_message_media (business_id, message_id, meta_media_id, mime_type, file_name, created_at)
                     VALUES (?, ?, ?, ?, ?, NOW())`,
                    [matchedBusinessId, newMsgId, mediaId, mediaMime, mediaFilename]
                  );
                }

                // Fetch fresh conversation object for socket emission
                const fullConv = await executeQuery('SELECT * FROM whatsapp_conversations WHERE id = ? LIMIT 1', [conversationId]);
                conversation = fullConv[0];

                const socketPayload = {
                  conversation: {
                    ...conversation,
                    contact: {
                      id: contactObj.id,
                      name: `${contactObj.first_name || ''} ${contactObj.last_name || ''}`.trim() || from,
                      phone: contactObj.phone,
                      tags: contactObj.tags
                    }
                  },
                  message: {
                    id: newMsgId,
                    business_id: matchedBusinessId,
                    conversation_id: conversationId,
                    contact_id: contactId,
                    meta_message_id: metaMsgId,
                    direction: 'INBOUND',
                    message_type: msgType,
                    message_body: textBody,
                    media_id: mediaId,
                    message_status: 'delivered',
                    created_at: new Date()
                  }
                };

                emitToTenant(matchedBusinessId, 'inbox:new_message', socketPayload);
                emitToConversation(conversationId, 'inbox:new_message', socketPayload);
                emitToTenant(matchedBusinessId, 'inbox:conversation_updated', { conversation: socketPayload.conversation });
              }
            } catch (dbErr) {
              logger.error('[Webhook] Failed to persist incoming WhatsApp message to DB:', dbErr);
            }
          }
        }
      }

      // 3. Process Template Status Updates from Meta
      if (change.field === 'message_template_status_update' || value.event) {
        const templateId = String(value.message_template_id || value.id || '');
        const templateName = value.message_template_name || value.element_name || value.name;
        const rawEvent = String(value.event || value.status || '').toUpperCase();
        const reason = value.reason || value.rejection_reason || null;

        let normalizedStatus = 'PENDING';
        if (rawEvent.includes('APPROV')) normalizedStatus = 'APPROVED';
        else if (rawEvent.includes('REJECT')) normalizedStatus = 'REJECTED';
        else if (rawEvent.includes('PAUS')) normalizedStatus = 'PAUSED';
        else if (rawEvent.includes('DISAB')) normalizedStatus = 'DISABLED';

        logger.info(`[Webhook] Template status update received: "${templateName}" (${templateId}) -> ${normalizedStatus} [Reason: ${reason || 'None'}]`);

        if (isUsingFallback()) {
          const store = getMemoryStore();
          const tpl = store.templates.find(t => 
            (templateId && String(t.meta_template_id) === templateId) || 
            (templateName && t.name === templateName)
          );
          if (tpl) {
            tpl.status = normalizedStatus;
            tpl.rejection_reason = reason;
            tpl.last_synced_at = new Date();
          }
          saveMemoryStore();
        } else {
          await executeQuery(
            `UPDATE templates 
             SET status = ?, rejection_reason = ?, last_synced_at = NOW(), updated_at = NOW()
             WHERE meta_template_id = ? OR name = ?`,
            [normalizedStatus, reason, templateId, templateName]
          );
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
