import { executeQuery, isUsingFallback, getMemoryStore, saveMemoryStore } from '../../database/db.js';
import { MetaCloudApiClient } from './metaClient.js';
import { encryptToken, decryptToken } from '../../utils/crypto.js';
import logger from '../../utils/logger.js';

/**
 * Return Meta Embedded Signup configuration required by the frontend Facebook JS SDK
 */
export async function getConnectConfig(businessId) {
  const appId = process.env.META_APP_ID || '1165054629187576';
  const configId = process.env.META_EMBEDDED_SIGNUP_CONFIG_ID || '';
  const version = process.env.WHATSAPP_API_VERSION || 'v21.0';

  return {
    appId,
    configId,
    version,
    hasConfigId: Boolean(configId && configId !== 'your_embedded_signup_config_id'),
    hasAppId: Boolean(appId && appId !== 'your_meta_app_id')
  };
}

/**
 * Complete Meta Embedded Signup Onboarding
 * 1. Exchanges OAuth Code for System/User Access Token
 * 2. Fetches WABA & Phone details from Meta Graph API
 * 3. Subscribes App to WABA Webhooks
 * 4. Registers Phone Number
 * 5. Encrypts token at rest and stores account against tenant
 */
export async function completeEmbeddedSignup(businessId, payload = {}) {
  const { code, wabaId, phoneNumberId, waba_id, phone_number_id, businessName } = payload;
  if (!code) {
    const err = new Error('Authorization code is required from Meta Embedded Signup');
    err.statusCode = 400;
    throw err;
  }

  const numBusinessId = Number(businessId);
  logger.info(`🚀 [EmbeddedSignup] Completing onboarding for Business #${numBusinessId}...`);

  // 1. Exchange OAuth code for Meta Access Token
  const tokenData = await MetaCloudApiClient.exchangeCodeForToken(code);
  const accessToken = tokenData.access_token;
  const encryptedToken = encryptToken(accessToken);

  // 2. Resolve WABA ID and Phone Number ID (from frontend session listener, Meta Graph API, or payload)
  let targetWabaId = wabaId || waba_id;
  let targetPhoneId = phoneNumberId || phone_number_id;

  // If WABA ID not supplied by frontend listener, discover via Meta debug_token
  if (!targetWabaId) {
    const grantedWabas = await MetaCloudApiClient.getGranularTargetIds(accessToken);
    if (grantedWabas.length > 0) {
      targetWabaId = grantedWabas[0];
      logger.info(`[EmbeddedSignup] Discovered WABA ID ${targetWabaId} from Meta granted permissions`);
    }
  }

  if (!targetWabaId) {
    targetWabaId = process.env.META_WABA_ID || '28532933229644434';
  }

  // 3. Initialize client to query Meta API & complete asset access
  let client = new MetaCloudApiClient(accessToken, targetPhoneId, targetWabaId);

  // If Phone Number ID not supplied by frontend listener, fetch actual numbers from client's WABA
  let phoneDetails = null;
  if (!targetPhoneId) {
    const wabaPhones = await client.getWabaPhoneNumbers(targetWabaId);
    if (wabaPhones.length > 0) {
      targetPhoneId = wabaPhones[0].id;
      phoneDetails = wabaPhones[0];
      logger.info(`[EmbeddedSignup] Discovered Phone Number ID ${targetPhoneId} (${phoneDetails.display_phone_number}) from Meta WABA`);
    }
  }

  if (!targetPhoneId) {
    targetPhoneId = process.env.META_PHONE_NUMBER_ID || '1341070215765610';
  }

  client = new MetaCloudApiClient(accessToken, targetPhoneId, targetWabaId);

  // Fetch phone details and WABA details
  if (!phoneDetails) {
    phoneDetails = await client.getPhoneNumberDetails(targetPhoneId);
  }
  const wabaDetails = await client.getWabaDetails(targetWabaId);

  // 4. Subscribe App to WABA Webhooks
  await client.subscribeWabaWebhook(targetWabaId);

  // 5. Register Phone Number
  await client.registerPhoneNumber(targetPhoneId);

  const displayName = phoneDetails.verified_name || phoneDetails.display_phone_number || businessName || 'Official WhatsApp Account';
  const phoneNumber = phoneDetails.display_phone_number || (targetPhoneId ? `+${targetPhoneId}` : 'Verified WhatsApp Account');
  const qualityRating = phoneDetails.quality_rating || 'GREEN';
  const messagingTier = phoneDetails.messaging_limit_tier || 'TIER_10K';
  const now = new Date();

  let savedAccount = null;

  if (isUsingFallback()) {
    const store = getMemoryStore();
    if (!store.whatsapp_accounts) store.whatsapp_accounts = [];

    // Check if THIS SPECIFIC phone number is already registered for this business
    let account = store.whatsapp_accounts.find(
      a => a.business_id === numBusinessId && a.phone_number_id === targetPhoneId
    );

    const existingAccounts = store.whatsapp_accounts.filter(a => a.business_id === numBusinessId);
    const isFirstAccount = existingAccounts.length === 0;

    if (!account) {
      account = {
        id: store.whatsapp_accounts.length + 1,
        business_id: numBusinessId,
        meta_business_id: wabaDetails.id || null,
        waba_id: targetWabaId,
        phone_number_id: targetPhoneId,
        phone_number: phoneNumber,
        display_name: displayName,
        verified_name: phoneDetails.verified_name || displayName,
        quality_rating: qualityRating,
        messaging_limit_tier: messagingTier,
        status: 'connected',
        connection_status: 'CONNECTED',
        is_primary: isFirstAccount ? 1 : 0,
        access_token_encrypted: encryptedToken,
        last_verified_at: now,
        webhook_subscribed_at: now,
        created_at: now,
        updated_at: now
      };
      store.whatsapp_accounts.push(account);
    } else {
      account.waba_id = targetWabaId;
      account.phone_number_id = targetPhoneId;
      account.phone_number = phoneNumber;
      account.display_name = displayName;
      account.verified_name = phoneDetails.verified_name || displayName;
      account.quality_rating = qualityRating;
      account.messaging_limit_tier = messagingTier;
      account.status = 'connected';
      account.connection_status = 'CONNECTED';
      account.access_token_encrypted = encryptedToken;
      account.last_verified_at = now;
      account.webhook_subscribed_at = now;
      account.updated_at = now;
    }

    saveMemoryStore();
    savedAccount = { ...account };
  } else {
    // MySQL Execution: Match only on business_id and phone_number_id to allow multiple numbers under the same WABA
    const existing = await executeQuery(
      'SELECT id, is_primary FROM whatsapp_accounts WHERE business_id = ? AND phone_number_id = ? LIMIT 1',
      [numBusinessId, targetPhoneId]
    );

    if (existing.length > 0) {
      await executeQuery(
        `UPDATE whatsapp_accounts 
         SET waba_id = ?, phone_number_id = ?, phone_number = ?, display_name = ?, verified_name = ?,
             quality_rating = ?, messaging_limit_tier = ?, status = 'connected', connection_status = 'CONNECTED',
             access_token_encrypted = ?, last_verified_at = NOW(), webhook_subscribed_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [targetWabaId, targetPhoneId, phoneNumber, displayName, phoneDetails.verified_name, qualityRating, messagingTier, encryptedToken, existing[0].id]
      );
      const rows = await executeQuery('SELECT * FROM whatsapp_accounts WHERE id = ? LIMIT 1', [existing[0].id]);
      savedAccount = rows[0];
    } else {
      // Check if business has any existing accounts
      const countRows = await executeQuery(
        'SELECT COUNT(*) as total FROM whatsapp_accounts WHERE business_id = ?',
        [numBusinessId]
      );
      const isFirst = (countRows?.[0]?.total || 0) === 0;

      const result = await executeQuery(
        `INSERT INTO whatsapp_accounts 
         (business_id, meta_business_id, waba_id, phone_number_id, phone_number, display_name, verified_name,
          quality_rating, messaging_limit_tier, status, connection_status, is_primary, access_token_encrypted, last_verified_at, webhook_subscribed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'connected', 'CONNECTED', ?, ?, NOW(), NOW(), NOW(), NOW())`,
        [numBusinessId, wabaDetails.id || null, targetWabaId, targetPhoneId, phoneNumber, displayName, phoneDetails.verified_name, qualityRating, messagingTier, isFirst ? 1 : 0, encryptedToken]
      );
      const rows = await executeQuery('SELECT * FROM whatsapp_accounts WHERE id = ? LIMIT 1', [result.insertId]);
      savedAccount = rows[0];
    }
  }

  logger.info(`✅ [EmbeddedSignup] WhatsApp account connected successfully for Business #${numBusinessId} (Phone: ${phoneNumber}, WABA: ${targetWabaId})`);

  // Return sanitized object (NEVER return access_token_encrypted to frontend)
  return sanitizeAccount(savedAccount);
}

/**
 * Live Verification Health Check for Connected Account
 */
export async function verifyAccount(businessId, accountId) {
  const numBusinessId = Number(businessId);
  const numAccountId = Number(accountId);

  let account = null;

  if (isUsingFallback()) {
    const store = getMemoryStore();
    account = store.whatsapp_accounts?.find(a => a.id === numAccountId && a.business_id === numBusinessId);
  } else {
    const rows = await executeQuery(
      'SELECT * FROM whatsapp_accounts WHERE id = ? AND business_id = ? LIMIT 1',
      [numAccountId, numBusinessId]
    );
    account = rows?.[0] || null;
  }

  if (!account) {
    const err = new Error('WhatsApp Account not found');
    err.statusCode = 404;
    throw err;
  }

  // Decrypt token
  const token = decryptToken(account.access_token_encrypted) || process.env.META_ACCESS_TOKEN;
  const client = new MetaCloudApiClient(token, account.phone_number_id, account.waba_id);

  const verification = await client.verifyAccountConnection(account.waba_id, account.phone_number_id);
  const newStatus = verification.isConnected ? 'connected' : 'restricted';
  const newConnStatus = verification.status || (verification.isConnected ? 'CONNECTED' : 'ACTION_REQUIRED');
  const qualityRating = verification.qualityRating || account.quality_rating;
  const now = new Date();

  if (isUsingFallback()) {
    account.status = newStatus;
    account.connection_status = newConnStatus;
    account.quality_rating = qualityRating;
    account.last_verified_at = now;
    if (verification.webhookSubscribed) account.webhook_subscribed_at = now;
    saveMemoryStore();
  } else {
    await executeQuery(
      `UPDATE whatsapp_accounts 
       SET status = ?, connection_status = ?, quality_rating = ?, last_verified_at = NOW(), updated_at = NOW() 
       WHERE id = ?`,
      [newStatus, newConnStatus, qualityRating, numAccountId]
    );
  }

  return {
    ...verification,
    account: sanitizeAccount(account)
  };
}

/**
 * Send Test WhatsApp Message (Direct In-Software Meta Test Messenger)
 * Sends hello_world template or custom text message to verify connectivity
 */
export async function sendTestMessage(businessId, accountId, payload = {}) {
  const numBusinessId = Number(businessId);
  const numAccountId = Number(accountId);
  const { recipientPhone, messageType = 'template', textBody, templateName = 'hello_world' } = payload;

  if (!recipientPhone) {
    const err = new Error('Recipient phone number is required (with country code, e.g. 918601467210)');
    err.statusCode = 400;
    throw err;
  }

  const cleanRecipient = recipientPhone.replace(/\D/g, '');
  if (cleanRecipient.length < 10) {
    const err = new Error('Please enter a valid phone number with country code (e.g. 918601467210)');
    err.statusCode = 400;
    throw err;
  }

  // Fetch account
  let account = null;
  if (isUsingFallback()) {
    const store = getMemoryStore();
    account = store.whatsapp_accounts?.find(a => a.id === numAccountId && a.business_id === numBusinessId);
  } else {
    const rows = await executeQuery(
      'SELECT * FROM whatsapp_accounts WHERE id = ? AND business_id = ? LIMIT 1',
      [numAccountId, numBusinessId]
    );
    account = rows?.[0] || null;
  }

  if (!account) {
    const err = new Error('WhatsApp Account not found');
    err.statusCode = 404;
    throw err;
  }

  const token = decryptToken(account.access_token_encrypted) || process.env.META_ACCESS_TOKEN;
  const client = new MetaCloudApiClient(token, account.phone_number_id, account.waba_id);

  logger.info(`[TestMessenger] Dispatching test ${messageType} from ${account.phone_number} to ${cleanRecipient}...`);

  let response;
  if (messageType === 'text') {
    response = await client.sendTextMessage({
      recipientPhone: cleanRecipient,
      textBody: textBody || 'Hello! This is a test message from CampaignFlow WhatsApp Cloud API.'
    });
  } else {
    // Official WhatsApp Cloud API hello_world template test
    response = await client.sendTemplateMessage({
      recipientPhone: cleanRecipient,
      templateName: templateName || 'hello_world',
      languageCode: 'en_US'
    });
  }

  const messageId = response?.messages?.[0]?.id || `wamid.${Date.now()}`;

  return {
    success: true,
    messageId,
    recipientPhone: cleanRecipient,
    messageType,
    sentAt: new Date(),
    account: {
      id: account.id,
      phoneNumber: account.phone_number,
      displayName: account.display_name
    },
    metaResponse: response
  };
}

/**
 * Test Webhook Ping and Verification Status
 */
export async function testWebhookPing(businessId) {
  const webhookUrl = `${process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace('5173', '5000') : 'http://localhost:5000'}/api/webhooks/whatsapp`;
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || 'campaignflow_secure_webhook_token_2026';

  return {
    success: true,
    status: 'ACTIVE',
    webhookUrl,
    verifyToken,
    subscribedFields: ['messages', 'message_template_status_update'],
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
    timestamp: new Date().toISOString()
  };
}

/**
 * Disconnect Account
 */
export async function disconnectAccount(businessId, accountId) {
  const numBusinessId = Number(businessId);
  const numAccountId = Number(accountId);

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const account = store.whatsapp_accounts?.find(a => a.id === numAccountId && a.business_id === numBusinessId);
    if (!account) {
      const err = new Error('WhatsApp Account not found');
      err.statusCode = 404;
      throw err;
    }
    account.status = 'disconnected';
    account.connection_status = 'DISCONNECTED';
    account.disconnected_at = new Date();

    // If this was primary, promote another connected account
    if (account.is_primary) {
      account.is_primary = 0;
      const nextActive = store.whatsapp_accounts.find(
        a => a.business_id === numBusinessId && a.id !== numAccountId && a.status === 'connected'
      );
      if (nextActive) nextActive.is_primary = 1;
    }

    saveMemoryStore();
    return { success: true, message: 'WhatsApp account disconnected successfully' };
  }

  // Check if target account was primary
  const targetRows = await executeQuery(
    'SELECT is_primary FROM whatsapp_accounts WHERE id = ? AND business_id = ? LIMIT 1',
    [numAccountId, numBusinessId]
  );

  await executeQuery(
    `UPDATE whatsapp_accounts 
     SET status = 'disconnected', connection_status = 'DISCONNECTED', is_primary = FALSE, disconnected_at = NOW(), updated_at = NOW()
     WHERE id = ? AND business_id = ?`,
    [numAccountId, numBusinessId]
  );

  // If was primary, promote another connected account
  if (targetRows?.[0]?.is_primary) {
    await executeQuery(
      `UPDATE whatsapp_accounts 
       SET is_primary = TRUE 
       WHERE business_id = ? AND status = 'connected' AND id != ? 
       ORDER BY created_at ASC LIMIT 1`,
      [numBusinessId, numAccountId]
    );
  }

  return { success: true, message: 'WhatsApp account disconnected successfully' };
}

/**
 * Designate an account as the Primary / Default sender for this tenant
 */
export async function setPrimaryAccount(businessId, accountId) {
  const numBusinessId = Number(businessId);
  const numAccountId = Number(accountId);

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const tenantAccounts = (store.whatsapp_accounts || []).filter(a => a.business_id === numBusinessId);
    const target = tenantAccounts.find(a => a.id === numAccountId);

    if (!target) {
      const err = new Error('WhatsApp Account not found');
      err.statusCode = 404;
      throw err;
    }

    tenantAccounts.forEach(a => {
      a.is_primary = a.id === numAccountId ? 1 : 0;
    });

    saveMemoryStore();
    return sanitizeAccount(target);
  }

  const existing = await executeQuery(
    'SELECT id FROM whatsapp_accounts WHERE id = ? AND business_id = ? LIMIT 1',
    [numAccountId, numBusinessId]
  );

  if (existing.length === 0) {
    const err = new Error('WhatsApp Account not found');
    err.statusCode = 404;
    throw err;
  }

  // Reset all other accounts for this business
  await executeQuery(
    'UPDATE whatsapp_accounts SET is_primary = FALSE WHERE business_id = ?',
    [numBusinessId]
  );

  // Set selected account as primary
  await executeQuery(
    'UPDATE whatsapp_accounts SET is_primary = TRUE WHERE id = ? AND business_id = ?',
    [numAccountId, numBusinessId]
  );

  const rows = await executeQuery(
    'SELECT * FROM whatsapp_accounts WHERE id = ? AND business_id = ? LIMIT 1',
    [numAccountId, numBusinessId]
  );
  return sanitizeAccount(rows[0]);
}

/**
 * Get Single Account Details (Sanitized)
 */
export async function getAccount(businessId, accountId) {
  const numBusinessId = Number(businessId);
  const numAccountId = Number(accountId);

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const account = store.whatsapp_accounts?.find(a => a.id === numAccountId && a.business_id === numBusinessId);
    return account ? sanitizeAccount(account) : null;
  }

  const rows = await executeQuery(
    'SELECT * FROM whatsapp_accounts WHERE id = ? AND business_id = ? LIMIT 1',
    [numAccountId, numBusinessId]
  );

  return rows?.[0] ? sanitizeAccount(rows[0]) : null;
}

/**
 * Retrieve account with decrypted credentials (INTERNAL ONLY - NEVER EXPOSE TO API RESPONSES)
 */
export async function getAccountWithCredentials(businessId, accountId = null) {
  const numBusinessId = Number(businessId);
  const numAccountId = accountId ? Number(accountId) : null;

  let account = null;

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const tenantAccounts = (store.whatsapp_accounts || []).filter(a => a.business_id === numBusinessId);
    if (numAccountId) {
      account = tenantAccounts.find(a => a.id === numAccountId);
      if (!account) {
        const err = new Error('WhatsApp Account not found or unauthorized for this tenant');
        err.statusCode = 404;
        throw err;
      }
    } else {
      // Pick primary or first active account
      account = tenantAccounts.find(a => a.is_primary && a.status === 'connected') ||
                tenantAccounts.find(a => a.status === 'connected') ||
                tenantAccounts[0];
    }
  } else {
    if (numAccountId) {
      const rows = await executeQuery(
        'SELECT * FROM whatsapp_accounts WHERE id = ? AND business_id = ? LIMIT 1',
        [numAccountId, numBusinessId]
      );
      account = rows?.[0] || null;
      if (!account) {
        const err = new Error('WhatsApp Account not found or unauthorized for this tenant');
        err.statusCode = 404;
        throw err;
      }
    } else {
      const rows = await executeQuery(
        'SELECT * FROM whatsapp_accounts WHERE business_id = ? ORDER BY is_primary DESC, created_at ASC LIMIT 1',
        [numBusinessId]
      );
      account = rows?.[0] || null;
    }
  }

  if (!account) {
    return null;
  }

  const decryptedToken = decryptToken(account.access_token_encrypted) || 
                         account.access_token_encrypted || 
                         process.env.META_ACCESS_TOKEN;

  return {
    ...account,
    decryptedToken,
    phone_number_id: account.phone_number_id || process.env.META_PHONE_NUMBER_ID,
    waba_id: account.waba_id || process.env.META_WABA_ID
  };
}

/**
 * Helper to strip encrypted credentials from API responses
 */
function sanitizeAccount(acc) {
  if (!acc) return null;
  const { access_token_encrypted, ...sanitized } = acc;
  return {
    ...sanitized,
    is_primary: Boolean(acc.is_primary),
    hasToken: Boolean(access_token_encrypted),
    connection_status: acc.connection_status || (acc.status === 'connected' ? 'CONNECTED' : 'DISCONNECTED')
  };
}

export async function connectAccount(businessId, { wabaId, phoneNumberId, phoneNumber, displayName, accessToken }) {
  const encryptedToken = encryptToken(accessToken);

  if (isUsingFallback()) {
    const store = getMemoryStore();
    let account = store.whatsapp_accounts.find(a => a.business_id === Number(businessId) && a.phone_number_id === phoneNumberId);
    const existingAccounts = store.whatsapp_accounts.filter(a => a.business_id === Number(businessId));
    const isFirstAccount = existingAccounts.length === 0;

    if (!account) {
      account = {
        id: store.whatsapp_accounts.length + 1,
        business_id: Number(businessId),
        waba_id: wabaId,
        phone_number_id: phoneNumberId,
        phone_number: phoneNumber,
        display_name: displayName,
        verified_name: displayName,
        quality_rating: 'GREEN',
        messaging_limit_tier: 'TIER_10K',
        status: 'connected',
        connection_status: 'CONNECTED',
        is_primary: isFirstAccount ? 1 : 0,
        access_token_encrypted: encryptedToken,
        last_verified_at: new Date(),
        webhook_subscribed_at: new Date(),
        created_at: new Date()
      };
      store.whatsapp_accounts.push(account);
    } else {
      account.display_name = displayName;
      account.phone_number = phoneNumber;
      account.status = 'connected';
      account.connection_status = 'CONNECTED';
      account.access_token_encrypted = encryptedToken;
      account.last_verified_at = new Date();
    }
    saveMemoryStore();
    return sanitizeAccount(account);
  }

  const existing = await executeQuery(
    'SELECT id, is_primary FROM whatsapp_accounts WHERE business_id = ? AND phone_number_id = ? LIMIT 1',
    [businessId, phoneNumberId]
  );

  if (existing.length > 0) {
    await executeQuery(
      `UPDATE whatsapp_accounts 
       SET waba_id = ?, phone_number = ?, display_name = ?, status = 'connected', connection_status = 'CONNECTED', access_token_encrypted = ?, last_verified_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [wabaId, phoneNumber, displayName, encryptedToken, existing[0].id]
    );
    const updated = await executeQuery('SELECT * FROM whatsapp_accounts WHERE id = ? LIMIT 1', [existing[0].id]);
    return sanitizeAccount(updated[0]);
  }

  const countRows = await executeQuery(
    'SELECT COUNT(*) as total FROM whatsapp_accounts WHERE business_id = ?',
    [businessId]
  );
  const isFirst = (countRows?.[0]?.total || 0) === 0;

  const result = await executeQuery(
    `INSERT INTO whatsapp_accounts (business_id, waba_id, phone_number_id, phone_number, display_name, status, connection_status, is_primary, access_token_encrypted, last_verified_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'connected', 'CONNECTED', ?, ?, NOW(), NOW(), NOW())`,
    [businessId, wabaId, phoneNumberId, phoneNumber, displayName, isFirst ? 1 : 0, encryptedToken]
  );

  const inserted = await executeQuery('SELECT * FROM whatsapp_accounts WHERE id = ? LIMIT 1', [result.insertId]);
  return sanitizeAccount(inserted[0]);
}

export async function listAccounts(businessId) {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    return (store.whatsapp_accounts || [])
      .filter(a => a.business_id === Number(businessId))
      .sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0))
      .map(sanitizeAccount);
  }
  const rows = await executeQuery(
    `SELECT id, business_id, meta_business_id, waba_id, phone_number_id, phone_number, display_name, verified_name, 
            quality_rating, messaging_limit_tier, status, connection_status, is_primary, last_verified_at, webhook_subscribed_at, created_at 
     FROM whatsapp_accounts 
     WHERE business_id = ? 
     ORDER BY is_primary DESC, created_at DESC`,
    [businessId]
  );
  return rows.map(sanitizeAccount);
}

/**
 * List templates with search, filtering, pagination, and real aggregated status stats
 */
export async function listTemplates(businessId, query = {}) {
  const {
    category,
    status,
    language,
    search,
    accountId,
    page = 1,
    limit = 20
  } = query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const allBusinessTemplates = store.templates.filter(t => t.business_id === Number(businessId));

    // Calculate real stats for this business
    const stats = {
      total: allBusinessTemplates.length,
      approved: allBusinessTemplates.filter(t => t.status === 'APPROVED').length,
      pending: allBusinessTemplates.filter(t => t.status === 'PENDING').length,
      rejected: allBusinessTemplates.filter(t => t.status === 'REJECTED').length,
      paused_or_disabled: allBusinessTemplates.filter(t => t.status === 'PAUSED' || t.status === 'DISABLED').length
    };

    let filtered = [...allBusinessTemplates];

    if (accountId && accountId !== 'ALL') {
      filtered = filtered.filter(t => t.whatsapp_account_id === Number(accountId));
    }
    if (category && category !== 'ALL') {
      filtered = filtered.filter(t => t.category?.toUpperCase() === category.toUpperCase());
    }
    if (status && status !== 'ALL') {
      if (status === 'PAUSED_DISABLED') {
        filtered = filtered.filter(t => t.status === 'PAUSED' || t.status === 'DISABLED');
      } else {
        filtered = filtered.filter(t => t.status?.toUpperCase() === status.toUpperCase());
      }
    }
    if (language && language !== 'ALL') {
      filtered = filtered.filter(t => t.language?.toLowerCase() === language.toLowerCase());
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(t => 
        t.name?.toLowerCase().includes(q) || 
        t.meta_template_id?.toLowerCase().includes(q) ||
        JSON.stringify(t.components || []).toLowerCase().includes(q)
      );
    }

    const totalFiltered = filtered.length;
    const paginated = filtered.slice(offset, offset + limitNum);

    return {
      templates: paginated,
      stats,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalFiltered,
        totalPages: Math.ceil(totalFiltered / limitNum)
      }
    };
  }

  // MySQL Execution
  // 1. Compute stats
  const statsRows = await executeQuery(
    `SELECT 
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) AS approved,
      SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) AS rejected,
      SUM(CASE WHEN status IN ('PAUSED', 'DISABLED') THEN 1 ELSE 0 END) AS paused_or_disabled
     FROM templates 
     WHERE business_id = ?`,
    [businessId]
  );

  const stats = {
    total: Number(statsRows[0]?.total || 0),
    approved: Number(statsRows[0]?.approved || 0),
    pending: Number(statsRows[0]?.pending || 0),
    rejected: Number(statsRows[0]?.rejected || 0),
    paused_or_disabled: Number(statsRows[0]?.paused_or_disabled || 0)
  };

  // 2. Query filtered items
  let whereClauses = ['business_id = ?'];
  const params = [businessId];

  if (accountId && accountId !== 'ALL') {
    whereClauses.push('whatsapp_account_id = ?');
    params.push(Number(accountId));
  }
  if (category && category !== 'ALL') {
    whereClauses.push('category = ?');
    params.push(category);
  }
  if (status && status !== 'ALL') {
    if (status === 'PAUSED_DISABLED') {
      whereClauses.push("status IN ('PAUSED', 'DISABLED')");
    } else {
      whereClauses.push('status = ?');
      params.push(status);
    }
  }
  if (language && language !== 'ALL') {
    whereClauses.push('language = ?');
    params.push(language);
  }
  if (search && search.trim()) {
    whereClauses.push('(name LIKE ? OR meta_template_id LIKE ?)');
    params.push(`%${search.trim()}%`, `%${search.trim()}%`);
  }

  const whereSql = whereClauses.join(' AND ');

  const countRows = await executeQuery(
    `SELECT COUNT(*) AS total FROM templates WHERE ${whereSql}`,
    params
  );
  const totalFiltered = Number(countRows[0]?.total || 0);

  const queryParams = [...params, limitNum, offset];
  const rows = await executeQuery(
    `SELECT * FROM templates 
     WHERE ${whereSql} 
     ORDER BY created_at DESC 
     LIMIT ? OFFSET ?`,
    queryParams
  );

  const templates = rows.map(t => ({
    ...t,
    components: typeof t.components === 'string' ? JSON.parse(t.components) : t.components
  }));

  return {
    templates,
    stats,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: totalFiltered,
      totalPages: Math.ceil(totalFiltered / limitNum)
    }
  };
}

/**
 * Get single template by ID with tenant verification
 */
export async function getTemplate(businessId, templateId) {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    const tpl = store.templates.find(t => t.id === Number(templateId) && t.business_id === Number(businessId));
    if (!tpl) {
      const err = new Error('Template not found');
      err.statusCode = 404;
      throw err;
    }
    return tpl;
  }

  const rows = await executeQuery(
    'SELECT * FROM templates WHERE id = ? AND business_id = ? LIMIT 1',
    [templateId, businessId]
  );
  if (!rows || rows.length === 0) {
    const err = new Error('Template not found');
    err.statusCode = 404;
    throw err;
  }

  const tpl = rows[0];
  tpl.components = typeof tpl.components === 'string' ? JSON.parse(tpl.components) : tpl.components;
  return tpl;
}

/**
 * Validate and submit a new message template to Meta Cloud API
 * POST /{WABA_ID}/message_templates
 */
export async function createTemplate(businessId, userId, templateData) {
  const {
    name,
    category,
    language = 'en_US',
    components = [],
    header,
    body,
    footer,
    buttons = [],
    accountId
  } = templateData;

  // 1. Validate Template Name according to Meta requirements
  if (!name || typeof name !== 'string') {
    throw new Error('Template name is required.');
  }
  const cleanName = name.trim();
  const nameRegex = /^[a-z0-9_]{1,512}$/;
  if (!nameRegex.test(cleanName)) {
    throw new Error('Template name must contain only lowercase alphanumeric characters and underscores (e.g. festive_offer_2026).');
  }

  // 2. Validate Category
  const allowedCategories = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];
  const cleanCategory = String(category || 'MARKETING').toUpperCase();
  if (!allowedCategories.includes(cleanCategory)) {
    throw new Error(`Invalid category "${category}". Allowed: ${allowedCategories.join(', ')}`);
  }

  // 3. Assemble Meta-compliant Components
  const metaComponents = [];

  // Header component
  if (header && header.type && header.type !== 'NONE') {
    const headerType = header.type.toUpperCase();
    if (headerType === 'TEXT') {
      if (!header.text || !header.text.trim()) {
        throw new Error('Header text cannot be empty when TEXT header is selected.');
      }
      const headerObj = {
        type: 'HEADER',
        format: 'TEXT',
        text: header.text.trim()
      };
      if (header.example) {
        headerObj.example = { header_text: [String(header.example)] };
      }
      metaComponents.push(headerObj);
    } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType)) {
      const headerObj = {
        type: 'HEADER',
        format: headerType
      };
      if (header.example_handle || header.example_url) {
        headerObj.example = { header_handle: [header.example_handle || header.example_url] };
      }
      metaComponents.push(headerObj);
    }
  }

  // Body component
  const bodyText = (body && typeof body === 'object') ? (body.text || '') : (typeof body === 'string' ? body : '');
  if (!bodyText || !bodyText.trim()) {
    throw new Error('Message body text is required.');
  }

  const bodyObj = {
    type: 'BODY',
    text: bodyText.trim()
  };

  // Extract variables like {{1}}, {{2}} or named like {{customer_name}}
  const varMatches = bodyText.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) || [];
  const uniqueVars = Array.from(new Set(varMatches));
  const isNamedParam = uniqueVars.some(v => isNaN(Number(v.replace(/[{}]/g, ''))));

  if (uniqueVars.length > 0) {
    const examples = [];
    const rawExamples = (body && body.examples) || templateData.examples || {};
    
    uniqueVars.forEach((v, idx) => {
      const cleanKey = v.replace(/[{}]/g, '');
      const exampleVal = rawExamples[cleanKey] || rawExamples[idx + 1] || rawExamples[`var_${idx + 1}`] || `Sample_${idx + 1}`;
      examples.push(String(exampleVal));
    });

    if (isNamedParam) {
      bodyObj.example = {
        body_text_named_params: uniqueVars.map((v, idx) => ({
          param_name: v.replace(/[{}]/g, ''),
          example: examples[idx]
        }))
      };
    } else {
      bodyObj.example = {
        body_text: [examples]
      };
    }
  }

  metaComponents.push(bodyObj);

  // Footer component
  const footerText = (footer && typeof footer === 'object') ? (footer.text || '') : (typeof footer === 'string' ? footer : '');
  if (footerText && footerText.trim()) {
    metaComponents.push({
      type: 'FOOTER',
      text: footerText.trim()
    });
  }

  // Buttons component
  if (Array.isArray(buttons) && buttons.length > 0) {
    const metaButtons = [];
    buttons.forEach((btn, idx) => {
      if (!btn.text || !btn.text.trim()) return;
      const btnType = btn.type?.toUpperCase();

      if (btnType === 'QUICK_REPLY') {
        metaButtons.push({
          type: 'QUICK_REPLY',
          text: btn.text.trim()
        });
      } else if (btnType === 'URL') {
        if (!btn.url || !btn.url.trim()) {
          throw new Error(`Button "${btn.text}" requires a destination URL.`);
        }
        const btnObj = {
          type: 'URL',
          text: btn.text.trim(),
          url: btn.url.trim()
        };
        if (btn.url.includes('{{1}}') && btn.example) {
          btnObj.example = [btn.example];
        }
        metaButtons.push(btnObj);
      } else if (btnType === 'PHONE_NUMBER') {
        if (!btn.phone_number || !btn.phone_number.trim()) {
          throw new Error(`Button "${btn.text}" requires a phone number.`);
        }
        metaButtons.push({
          type: 'PHONE_NUMBER',
          text: btn.text.trim(),
          phone_number: btn.phone_number.trim().replace(/[^\d+]/g, '')
        });
      }
    });

    if (metaButtons.length > 0) {
      metaComponents.push({
        type: 'BUTTONS',
        buttons: metaButtons
      });
    }
  }

  // 4. Get connected WhatsApp Account with Decrypted Credentials
  const authAccount = await getAccountWithCredentials(businessId, accountId);
  if (!authAccount) {
    throw new Error('No connected WhatsApp Account found for this business. Please connect an account first.');
  }

  const client = new MetaCloudApiClient(authAccount.decryptedToken, authAccount.phone_number_id, authAccount.waba_id);

  logger.info(`[WhatsApp] Submitting template "${cleanName}" to Meta for Business #${businessId}`);

  // 5. Submit to Meta Cloud API
  const metaResponse = await client.createTemplate({
    name: cleanName,
    category: cleanCategory,
    language: language || 'en_US',
    components: metaComponents
  });

  const metaTemplateId = metaResponse.id || `meta_tpl_${Date.now()}`;
  const initialStatus = metaResponse.status || 'PENDING';

  // 6. Save in Database
  if (isUsingFallback()) {
    const store = getMemoryStore();
    const newRecord = {
      id: store.templates.length + 1,
      business_id: Number(businessId),
      whatsapp_account_id: authAccount.id,
      meta_template_id: metaTemplateId,
      name: cleanName,
      language: language || 'en_US',
      category: cleanCategory,
      status: initialStatus,
      parameter_format: isNamedParam ? 'NAMED' : 'POSITIONAL',
      rejection_reason: null,
      quality_rating: 'UNKNOWN',
      components: metaComponents,
      submitted_at: new Date(),
      last_synced_at: new Date(),
      created_at: new Date()
    };
    store.templates.unshift(newRecord);
    saveMemoryStore();
    return newRecord;
  }

  const insertSql = `
    INSERT INTO templates (
      business_id, whatsapp_account_id, meta_template_id, name, language,
      category, status, parameter_format, components, submitted_at, last_synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  `;

  const result = await executeQuery(insertSql, [
    businessId,
    authAccount.id,
    metaTemplateId,
    cleanName,
    language || 'en_US',
    cleanCategory,
    initialStatus,
    isNamedParam ? 'NAMED' : 'POSITIONAL',
    JSON.stringify(metaComponents)
  ]);

  return {
    id: result.insertId,
    business_id: businessId,
    whatsapp_account_id: authAccount.id,
    meta_template_id: metaTemplateId,
    name: cleanName,
    language: language || 'en_US',
    category: cleanCategory,
    status: initialStatus,
    parameter_format: isNamedParam ? 'NAMED' : 'POSITIONAL',
    components: metaComponents,
    submitted_at: new Date(),
    last_synced_at: new Date()
  };
}

/**
 * Synchronize all templates from Meta Cloud API for a business
 */
export async function syncTemplates(businessId, accountId = null) {
  let targetAccounts = [];
  if (isUsingFallback()) {
    const store = getMemoryStore();
    targetAccounts = (store.whatsapp_accounts || []).filter(a => a.business_id === Number(businessId) && a.status === 'connected');
    if (accountId) targetAccounts = targetAccounts.filter(a => a.id === Number(accountId));
  } else {
    if (accountId) {
      targetAccounts = await executeQuery('SELECT * FROM whatsapp_accounts WHERE business_id = ? AND id = ?', [businessId, accountId]);
    } else {
      targetAccounts = await executeQuery('SELECT * FROM whatsapp_accounts WHERE business_id = ? AND status = "connected"', [businessId]);
    }
  }

  if (!targetAccounts || targetAccounts.length === 0) {
    throw new Error('No active WhatsApp accounts connected to synchronize.');
  }

  let totalSynced = 0;

  for (const account of targetAccounts) {
    const token = decryptToken(account.access_token_encrypted) || account.access_token_encrypted || process.env.META_ACCESS_TOKEN;
    const client = new MetaCloudApiClient(token, account.phone_number_id, account.waba_id);

    try {
      const metaTemplates = await client.getTemplates();
      if (!Array.isArray(metaTemplates)) continue;

      if (isUsingFallback()) {
        const store = getMemoryStore();
        for (const mt of metaTemplates) {
          let tpl = store.templates.find(t => 
            t.business_id === Number(businessId) && 
            (t.meta_template_id === mt.id || (t.name === mt.name && t.language === mt.language))
          );

          if (!tpl) {
            tpl = {
              id: store.templates.length + 1,
              business_id: Number(businessId),
              whatsapp_account_id: account.id,
              meta_template_id: mt.id,
              name: mt.name,
              language: mt.language,
              category: mt.category,
              status: mt.status || 'APPROVED',
              rejection_reason: mt.rejected_reason || null,
              quality_rating: mt.quality_score?.score || 'UNKNOWN',
              components: mt.components || [],
              last_synced_at: new Date(),
              created_at: new Date()
            };
            store.templates.push(tpl);
          } else {
            tpl.status = mt.status || tpl.status;
            tpl.meta_template_id = mt.id || tpl.meta_template_id;
            tpl.rejection_reason = mt.rejected_reason || null;
            tpl.quality_rating = mt.quality_score?.score || tpl.quality_rating;
            tpl.components = mt.components || tpl.components;
            tpl.last_synced_at = new Date();
          }
          totalSynced++;
        }
        saveMemoryStore();
      } else {
        for (const mt of metaTemplates) {
          await executeQuery(
            `INSERT INTO templates (
              business_id, whatsapp_account_id, meta_template_id, name, language,
              category, status, rejection_reason, quality_rating, components, last_synced_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE 
              status = VALUES(status), 
              rejection_reason = VALUES(rejection_reason),
              quality_rating = VALUES(quality_rating),
              components = VALUES(components), 
              last_synced_at = NOW(),
              updated_at = NOW()`,
            [
              businessId,
              account.id,
              mt.id,
              mt.name,
              mt.language,
              mt.category,
              mt.status || 'APPROVED',
              mt.rejected_reason || null,
              mt.quality_score?.score || 'UNKNOWN',
              JSON.stringify(mt.components || [])
            ]
          );
          totalSynced++;
        }
      }
    } catch (err) {
      logger.error(`[WhatsApp] Failed to sync templates for Account #${account.id}`, err);
    }
  }

  logger.info(`[WhatsApp] Successfully synchronized ${totalSynced} templates for Business #${businessId}`);
  return {
    syncedCount: totalSynced,
    ...(await listTemplates(businessId))
  };
}

/**
 * Check live status of a single template directly on Meta
 */
export async function checkTemplateStatus(businessId, templateId) {
  const tpl = await getTemplate(businessId, templateId);
  const authAccount = await getAccountWithCredentials(businessId, tpl.whatsapp_account_id);
  const token = authAccount?.decryptedToken || process.env.META_ACCESS_TOKEN;
  const client = new MetaCloudApiClient(token, authAccount?.phone_number_id, authAccount?.waba_id);

  try {
    const metaData = await client.getTemplateStatus(tpl.meta_template_id, tpl.name);
    const newStatus = metaData.status || tpl.status;
    const realMetaId = metaData.id || tpl.meta_template_id;
    const rejectionReason = metaData.rejected_reason || null;
    const qualityRating = metaData.quality_score?.score || tpl.quality_rating;

    if (isUsingFallback()) {
      const store = getMemoryStore();
      const stored = store.templates.find(t => t.id === Number(templateId));
      if (stored) {
        stored.status = newStatus;
        stored.meta_template_id = realMetaId;
        stored.rejection_reason = rejectionReason;
        stored.quality_rating = qualityRating;
        stored.last_synced_at = new Date();
      }
      saveMemoryStore();
      return stored;
    }

    await executeQuery(
      `UPDATE templates 
       SET status = ?, meta_template_id = ?, rejection_reason = ?, quality_rating = ?, last_synced_at = NOW(), updated_at = NOW()
       WHERE id = ? AND business_id = ?`,
      [newStatus, realMetaId, rejectionReason, qualityRating, templateId, businessId]
    );

    return getTemplate(businessId, templateId);
  } catch (err) {
    logger.warn(`[WhatsApp] Failed to refresh status for template #${templateId}: ${err.message}`);
    const error = new Error(`Meta Live Status: ${err.message}`);
    error.statusCode = 400;
    throw error;
  }
}

/**
 * Delete template from Meta and locally
 */
export async function deleteTemplate(businessId, templateId) {
  const tpl = await getTemplate(businessId, templateId);
  const authAccount = await getAccountWithCredentials(businessId, tpl.whatsapp_account_id);
  const token = authAccount?.decryptedToken || process.env.META_ACCESS_TOKEN;
  const client = new MetaCloudApiClient(token, authAccount?.phone_number_id, authAccount?.waba_id);

  try {
    await client.deleteTemplate(tpl.name, tpl.meta_template_id);
  } catch (err) {
    logger.warn(`[WhatsApp] Meta API delete returned warning/error for ${tpl.name}: ${err.message}`);
    // If template was already deleted on Meta or not found, proceed to remove locally
  }

  if (isUsingFallback()) {
    const store = getMemoryStore();
    store.templates = store.templates.filter(t => t.id !== Number(templateId));
    saveMemoryStore();
    return { success: true, message: `Template "${tpl.name}" deleted successfully` };
  }

  await executeQuery('DELETE FROM templates WHERE id = ? AND business_id = ?', [templateId, businessId]);
  return { success: true, message: `Template "${tpl.name}" deleted successfully` };
}

export default {
  connectAccount,
  listAccounts,
  listTemplates,
  getTemplate,
  createTemplate,
  syncTemplates,
  checkTemplateStatus,
  deleteTemplate,
  sendTestMessage,
  testWebhookPing
};
