import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import logger from '../utils/logger.js';
import { executeQuery, isUsingFallback, getMemoryStore } from '../database/db.js';
import { MetaCloudApiClient } from '../modules/whatsapp/metaClient.js';
import { decryptToken } from '../utils/crypto.js';

let redisConnection = null;
let campaignQueue = null;
let isRedisAvailable = false;

try {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  redisConnection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: () => null // Don't hang on connection failure
  });

  redisConnection.on('connect', () => {
    isRedisAvailable = true;
    logger.info('[Redis] Connected successfully for BullMQ background workers');
  });

  redisConnection.on('error', (err) => {
    isRedisAvailable = false;
    // Handled gracefully with fallback queue
  });

  campaignQueue = new Queue('campaign-dispatch', { connection: redisConnection });
} catch (err) {
  isRedisAvailable = false;
}

/**
 * Dispatch single campaign batch with pre-flight consent verification
 */
export async function executeCampaignDispatch(campaignId, businessId) {
  logger.info(`🚀 [CampaignWorker] Starting message dispatch for Campaign #${campaignId}`);

  // Fetch campaign details
  let campaign;
  let account;
  let template;

  if (isUsingFallback()) {
    const store = getMemoryStore();
    campaign = store.campaigns.find(c => c.id === Number(campaignId));
    if (!campaign) return;
    account = store.whatsapp_accounts.find(a => a.id === campaign.whatsapp_account_id);
    template = store.templates.find(t => t.id === campaign.template_id);
  } else {
    const cRows = await executeQuery('SELECT * FROM campaigns WHERE id = ? AND business_id = ? LIMIT 1', [campaignId, businessId]);
    if (cRows.length === 0) return;
    campaign = cRows[0];

    const aRows = await executeQuery('SELECT * FROM whatsapp_accounts WHERE id = ? LIMIT 1', [campaign.whatsapp_account_id]);
    account = aRows[0];

    const tRows = await executeQuery('SELECT * FROM templates WHERE id = ? LIMIT 1', [campaign.template_id]);
    template = tRows[0];
  }

  // Fallback: If template not found by ID, look up welcome_msg
  if (!template) {
    if (isUsingFallback()) {
      const store = getMemoryStore();
      template = store.templates.find(t => t.name === 'welcome_msg') || store.templates[0];
    } else {
      const tRows = await executeQuery('SELECT * FROM templates WHERE name = "welcome_msg" LIMIT 1');
      template = tRows?.[0] || null;
    }
  }

  // Extract body component and text for placeholder substitution
  const templateComps = Array.isArray(template?.components)
    ? template.components
    : (typeof template?.components === 'string' ? JSON.parse(template?.components || '[]') : []);
  const bodyComponent = templateComps.find(c => c.type === 'BODY' || c.type === 'body');
  const templateBodyText = bodyComponent?.text || '';

  // Safety check: ensure template is APPROVED by Meta
  if (template?.status !== 'APPROVED') {
    logger.warn(`[CampaignWorker] Campaign #${campaignId} aborted: Template "${template?.name}" is ${template?.status}. Only Meta-APPROVED templates can be sent.`);
    if (isUsingFallback()) {
      campaign.status = 'failed';
      const store = getMemoryStore();
      store.campaign_recipients
        .filter(r => r.campaign_id === Number(campaignId) && r.status === 'pending')
        .forEach(r => {
          r.status = 'failed';
          r.skip_reason = `Template "${template?.name}" is not approved on Meta (Status: ${template?.status}).`;
        });
      saveMemoryStore();
    } else {
      await executeQuery('UPDATE campaigns SET status = "failed" WHERE id = ?', [campaignId]);
      await executeQuery('UPDATE campaign_recipients SET status = "failed", skip_reason = ? WHERE campaign_id = ? AND status = "pending"', [
        `Template "${template?.name}" is not approved on Meta.`,
        campaignId
      ]);
    }
    return;
  }

  // Ensure campaign is not paused or cancelled
  if (['paused', 'cancelled', 'completed'].includes(campaign.status)) {
    logger.info(`[CampaignWorker] Campaign #${campaignId} is ${campaign.status}. Halting dispatch.`);
    return;
  }

  // Update status to running
  if (isUsingFallback()) {
    campaign.status = 'running';
    campaign.started_at = new Date();
  } else {
    await executeQuery('UPDATE campaigns SET status = "running", started_at = NOW() WHERE id = ?', [campaignId]);
  }

  // Fetch pending recipients
  let recipients = [];
  if (isUsingFallback()) {
    const store = getMemoryStore();
    recipients = store.campaign_recipients
      .filter(r => r.campaign_id === Number(campaignId) && r.status === 'pending')
      .map(r => {
        const contact = store.contacts.find(c => c.id === r.contact_id);
        const fullName = contact?.name || (contact?.first_name ? `${contact.first_name} ${contact.last_name || ''}`.trim() : 'Customer');
        return {
          ...r,
          contact_name: fullName,
          is_opted_in: contact ? contact.is_opted_in : 1,
          contact_status: contact ? contact.status : 'active'
        };
      });
  } else {
    recipients = await executeQuery(
      `SELECT cr.*, c.is_opted_in, c.status as contact_status, 
              COALESCE(NULLIF(c.name, ''), CONCAT_WS(' ', c.first_name, c.last_name), 'Customer') as contact_name 
       FROM campaign_recipients cr 
       JOIN contacts c ON cr.contact_id = c.id 
       WHERE cr.campaign_id = ? AND cr.status = "pending"`,
      [campaignId]
    );
  }

  // Load sender accounts (multi-account load balancing)
  let senderAccounts = [];
  const rawMappings = typeof campaign.variable_mappings === 'string' 
    ? JSON.parse(campaign.variable_mappings || '{}') 
    : (campaign.variable_mappings || {});
  const senderIds = rawMappings.sender_account_ids || [campaign.whatsapp_account_id];

  if (isUsingFallback()) {
    const store = getMemoryStore();
    senderAccounts = store.whatsapp_accounts.filter(a => senderIds.includes(a.id));
    if (senderAccounts.length === 0 && account) senderAccounts = [account];
  } else {
    senderAccounts = await executeQuery('SELECT * FROM whatsapp_accounts WHERE id IN (?)', [senderIds]);
  }

  // Guarantee that campaigns always dispatch from real registered accounts (never sandbox +1 555-199-9056 / 1353284594528559)
  const realSenders = senderAccounts.filter(a => !a.phone_number?.includes('555-199') && !a.phone_number?.startsWith('+1 555') && String(a.phone_number_id) !== '1353284594528559');
  if (realSenders.length > 0) {
    senderAccounts = realSenders;
  } else {
    // Look up the live Indian WhatsApp Account
    if (isUsingFallback()) {
      const store = getMemoryStore();
      const live = store.whatsapp_accounts?.find(a => !a.phone_number?.includes('555-199') && String(a.phone_number_id) !== '1353284594528559');
      if (live) senderAccounts = [live];
    } else {
      const liveRows = await executeQuery('SELECT * FROM whatsapp_accounts WHERE phone_number NOT LIKE "%555-199%" AND business_id = ? LIMIT 1', [businessId]);
      if (liveRows?.[0]) senderAccounts = [liveRows[0]];
    }
  }

  logger.info(`[CampaignWorker] Active sending account(s): ${senderAccounts.map(a => `${a.display_name} (${a.phone_number}, PhoneID: ${a.phone_number_id})`).join(', ')}`);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < recipients.length; i++) {
    const rec = recipients[i];

    // Select active sending WhatsApp account with round-robin rotation
    const activeAccount = (senderAccounts && senderAccounts.length > 0)
      ? senderAccounts[i % senderAccounts.length]
      : null;
    const decryptedAccountToken = activeAccount?.access_token_encrypted 
      ? decryptToken(activeAccount.access_token_encrypted) 
      : null;
    const tokenToUse = decryptedAccountToken;
    const phoneIdToUse = activeAccount?.phone_number_id;
    const wabaIdToUse = activeAccount?.waba_id;

    if (!tokenToUse || !phoneIdToUse) {
      logger.warn(`[CampaignWorker] Skipping recipient ${rec.phone}: Missing WhatsApp access token or phone ID in database.`);
      failed++;
      continue;
    }

    const client = new MetaCloudApiClient(tokenToUse, phoneIdToUse, wabaIdToUse);

    // Check if campaign was paused or cancelled during loop
    if (isUsingFallback()) {
      const store = getMemoryStore();
      const currentCamp = store.campaigns.find(c => c.id === Number(campaignId));
      if (currentCamp && ['paused', 'cancelled'].includes(currentCamp.status)) {
        logger.info(`[CampaignWorker] Campaign #${campaignId} was paused/cancelled during execution.`);
        break;
      }
    } else {
      const checkCamp = await executeQuery('SELECT status FROM campaigns WHERE id = ?', [campaignId]);
      if (['paused', 'cancelled'].includes(checkCamp[0]?.status)) {
        logger.info(`[CampaignWorker] Campaign #${campaignId} was paused/cancelled during execution.`);
        break;
      }
    }

    // MANDATORY PRE-SEND CHECK: Recheck consent and opt-out immediately before dispatch
    let isOptedIn = true;
    if (isUsingFallback()) {
      const store = getMemoryStore();
      const contact = store.contacts.find(c => c.id === rec.contact_id);
      if (!contact || !contact.is_opted_in || contact.status !== 'active') {
        isOptedIn = false;
      }
    } else {
      const cCheck = await executeQuery('SELECT is_opted_in, status FROM contacts WHERE id = ?', [rec.contact_id]);
      if (!cCheck[0] || !cCheck[0].is_opted_in || cCheck[0].status !== 'active') {
        isOptedIn = false;
      }
    }

    if (!isOptedIn) {
      skipped++;
      if (isUsingFallback()) {
        rec.status = 'skipped';
        rec.skip_reason = 'Opted out or consent withdrawn prior to send';
      } else {
        await executeQuery(
          'UPDATE campaign_recipients SET status = "skipped", skip_reason = "Opted out or consent withdrawn prior to send" WHERE id = ?',
          [rec.id]
        );
      }
      continue;
    }

    // Extract placeholders (supports both positional {{1}} and named {{customer_name}})
    const placeholderMatches = templateBodyText.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) || [];
    const uniquePlaceholders = Array.from(new Set(placeholderMatches.map(p => p.replace(/[{}]/g, ''))));

    let templateName = template?.name || 'welcome_msg';
    let languageCode = template?.language || (templateName === 'welcome_msg' ? 'en' : 'en_US');

    // Prevent hello_world from being sent to real Indian numbers (+91)
    const isIndianSender = activeAccount?.phone_number?.includes('+91') || account?.phone_number?.includes('+91');
    if (templateName === 'hello_world' && isIndianSender) {
      templateName = 'welcome_msg';
      languageCode = 'en';
    }

    const components = [];
    if (uniquePlaceholders.length > 0) {
      const bodyParams = [];
      uniquePlaceholders.forEach((ph, idx) => {
        let val = rawMappings[ph] || rawMappings[`var_${idx + 1}`];
        if (!val || val === 'contact.name') {
          val = rec.contact_name || 'Customer';
        } else if (val === 'contact.phone') {
          val = rec.phone;
        }

        const paramObj = {
          type: 'text',
          text: String(val || '')
        };
        // If template uses NAMED parameter format (like customer_name)
        if (template?.parameter_format === 'NAMED' || isNaN(Number(ph)) || ph === 'customer_name') {
          paramObj.parameter_name = ph;
        }
        bodyParams.push(paramObj);
      });

      if (bodyParams.length > 0) {
        components.push({
          type: 'body',
          parameters: bodyParams
        });
      }
    } else if (templateName === 'welcome_msg') {
      // welcome_msg always requires customer_name parameter in body
      components.push({
        type: 'body',
        parameters: [
          {
            type: 'text',
            parameter_name: 'customer_name',
            text: String(rec.contact_name || 'Customer')
          }
        ]
      });
    }

    logger.info(`[CampaignWorker] Dispatching to ${rec.phone} via template "${templateName}" (${languageCode}). Components: ${JSON.stringify(components)}`);

    try {
      const response = await client.sendTemplateMessage({
        recipientPhone: rec.phone,
        templateName,
        languageCode,
        components
      });

      const providerMsgId = response?.messages?.[0]?.id || `wamid.mock_${Date.now()}`;
      logger.info(`[CampaignWorker] Meta accepted template message to ${rec.phone} -> Message ID: ${providerMsgId}`);
      sent++;

      if (isUsingFallback()) {
        rec.status = 'sent';
        rec.sent_at = new Date();
        rec.provider_message_id = providerMsgId;

        const store = getMemoryStore();
        const origRec = store.campaign_recipients.find(cr => cr.id === rec.id);
        if (origRec) {
          origRec.status = 'sent';
          origRec.sent_at = rec.sent_at;
          origRec.provider_message_id = providerMsgId;
        }

        store.messages.push({
          id: store.messages.length + 1,
          business_id: Number(businessId),
          campaign_id: Number(campaignId),
          contact_id: rec.contact_id,
          whatsapp_account_id: activeAccount?.id || account?.id || 1,
          direction: 'outbound',
          provider_message_id: providerMsgId,
          phone: rec.phone,
          status: 'sent',
          created_at: new Date()
        });
      } else {
        await executeQuery(
          'UPDATE campaign_recipients SET status = "sent", sent_at = NOW(), provider_message_id = ? WHERE id = ?',
          [providerMsgId, rec.id]
        );

        // Record message in messages table with active rotated account ID
        await executeQuery(
          `INSERT INTO messages (business_id, campaign_id, contact_id, whatsapp_account_id, direction, provider_message_id, phone, status)
           VALUES (?, ?, ?, ?, 'outbound', ?, ?, 'sent')`,
          [businessId, campaignId, rec.contact_id, activeAccount?.id || account?.id || null, providerMsgId, rec.phone]
        );
      }
    } catch (err) {
      failed++;
      logger.error(`[CampaignWorker] Failed sending message to ${rec.phone}: ${err.message}`);
      if (isUsingFallback()) {
        rec.status = 'failed';
        rec.error_message = err.message;
        const store = getMemoryStore();
        const origRec = store.campaign_recipients.find(cr => cr.id === rec.id);
        if (origRec) {
          origRec.status = 'failed';
          origRec.error_message = err.message;
        }
      } else {
        await executeQuery(
          'UPDATE campaign_recipients SET status = "failed", error_message = ? WHERE id = ?',
          [err.message, rec.id]
        );
      }
    }
  }

  // Update final campaign metrics
  if (isUsingFallback()) {
    campaign.sent_count = (campaign.sent_count || 0) + sent;
    campaign.failed_count = (campaign.failed_count || 0) + failed;
    campaign.status = 'completed';
    campaign.completed_at = new Date();
  } else {
    await executeQuery(
      `UPDATE campaigns 
       SET sent_count = sent_count + ?, failed_count = failed_count + ?, status = 'completed', completed_at = NOW()
       WHERE id = ?`,
      [sent, failed, campaignId]
    );

    // Record usage ledger
    if (sent > 0) {
      await executeQuery(
        `INSERT INTO usage_ledger (business_id, metric_type, quantity, period_month)
         VALUES (?, 'messages_sent', ?, DATE_FORMAT(NOW(), '%Y-%m'))`,
        [businessId, sent]
      );
    }
  }

  logger.info(`✅ [CampaignWorker] Completed Campaign #${campaignId}: ${sent} sent, ${skipped} skipped, ${failed} failed`);
}

/**
 * Enqueue campaign for dispatch (BullMQ or in-process fallback)
 */
export async function enqueueCampaign(campaignId, businessId) {
  if (isRedisAvailable && campaignQueue) {
    try {
      await campaignQueue.add('dispatch', { campaignId, businessId }, { attempts: 3, backoff: { type: 'exponential', delay: 1000 } });
      return { enqueued: true, mode: 'bullmq' };
    } catch (err) {
      logger.warn('[Queue] Failed to enqueue to BullMQ. Falling back to background async execution.');
    }
  }

  // In-process fallback execution
  setImmediate(() => {
    executeCampaignDispatch(campaignId, businessId).catch(err => {
      logger.error('[CampaignWorker:Async] Dispatch failed', err);
    });
  });

  return { enqueued: true, mode: 'in_process' };
}

export default {
  enqueueCampaign,
  executeCampaignDispatch
};
