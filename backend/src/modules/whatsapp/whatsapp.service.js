import { executeQuery, isUsingFallback, getMemoryStore } from '../../database/db.js';
import { MetaCloudApiClient } from './metaClient.js';
import logger from '../../utils/logger.js';

export async function connectAccount(businessId, { wabaId, phoneNumberId, phoneNumber, displayName, accessToken }) {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    let account = store.whatsapp_accounts.find(a => a.business_id === Number(businessId) && a.phone_number_id === phoneNumberId);
    if (!account) {
      account = {
        id: store.whatsapp_accounts.length + 1,
        business_id: Number(businessId),
        waba_id: wabaId,
        phone_number_id: phoneNumberId,
        phone_number: phoneNumber,
        display_name: displayName,
        quality_rating: 'GREEN',
        messaging_limit_tier: 'TIER_10K',
        status: 'connected',
        created_at: new Date()
      };
      store.whatsapp_accounts.push(account);
    } else {
      account.display_name = displayName;
      account.phone_number = phoneNumber;
      account.status = 'connected';
    }
    return account;
  }

  const existing = await executeQuery(
    'SELECT id FROM whatsapp_accounts WHERE business_id = ? AND phone_number_id = ? LIMIT 1',
    [businessId, phoneNumberId]
  );

  if (existing.length > 0) {
    await executeQuery(
      `UPDATE whatsapp_accounts 
       SET waba_id = ?, phone_number = ?, display_name = ?, status = 'connected', access_token_encrypted = ?
       WHERE id = ?`,
      [wabaId, phoneNumber, displayName, accessToken, existing[0].id]
    );
    return { id: existing[0].id, wabaId, phoneNumberId, phoneNumber, displayName, status: 'connected' };
  }

  const result = await executeQuery(
    `INSERT INTO whatsapp_accounts (business_id, waba_id, phone_number_id, phone_number, display_name, status, access_token_encrypted)
     VALUES (?, ?, ?, ?, ?, 'connected', ?)`,
    [businessId, wabaId, phoneNumberId, phoneNumber, displayName, accessToken]
  );

  return { id: result.insertId, wabaId, phoneNumberId, phoneNumber, displayName, status: 'connected' };
}

export async function listAccounts(businessId) {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    return store.whatsapp_accounts.filter(a => a.business_id === Number(businessId));
  }
  return executeQuery(
    'SELECT id, business_id, waba_id, phone_number_id, phone_number, display_name, quality_rating, messaging_limit_tier, status, created_at FROM whatsapp_accounts WHERE business_id = ?',
    [businessId]
  );
}

export async function syncTemplates(businessId, accountId) {
  const accounts = await listAccounts(businessId);
  const account = accounts.find(a => a.id === Number(accountId));
  if (!account) {
    const error = new Error('WhatsApp Account not found in this business');
    error.statusCode = 404;
    throw error;
  }

  const token = account.access_token_encrypted || process.env.META_ACCESS_TOKEN;
  const client = new MetaCloudApiClient(token, account.phone_number_id, account.waba_id);
  const metaTemplates = await client.getTemplates();

  let syncedCount = 0;

  if (isUsingFallback()) {
    const store = getMemoryStore();
    for (const mt of metaTemplates) {
      let tpl = store.templates.find(t => t.business_id === Number(businessId) && t.meta_template_id === mt.id);
      if (!tpl) {
        tpl = {
          id: store.templates.length + 1,
          business_id: Number(businessId),
          whatsapp_account_id: Number(accountId),
          meta_template_id: mt.id,
          name: mt.name,
          language: mt.language,
          category: mt.category,
          status: mt.status,
          components: mt.components,
          created_at: new Date()
        };
        store.templates.push(tpl);
      } else {
        tpl.status = mt.status;
        tpl.components = mt.components;
      }
      syncedCount++;
    }
  } else {
    for (const mt of metaTemplates) {
      await executeQuery(
        `INSERT INTO templates (business_id, whatsapp_account_id, meta_template_id, name, language, category, status, components)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status), components = VALUES(components), updated_at = NOW()`,
        [businessId, accountId, mt.id, mt.name, mt.language, mt.category, mt.status, JSON.stringify(mt.components)]
      );
      syncedCount++;
    }
  }

  logger.info(`[WhatsApp] Synced ${syncedCount} templates for business ${businessId}`);
  return { syncedCount, templates: await listTemplates(businessId) };
}

export async function listTemplates(businessId, { category, status } = {}) {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    let templates = store.templates.filter(t => t.business_id === Number(businessId));
    if (category) templates = templates.filter(t => t.category === category);
    if (status) templates = templates.filter(t => t.status === status);
    return templates;
  }

  let sql = 'SELECT * FROM templates WHERE business_id = ?';
  const params = [businessId];

  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }

  sql += ' ORDER BY name ASC';
  const templates = await executeQuery(sql, params);

  return templates.map(t => ({
    ...t,
    components: typeof t.components === 'string' ? JSON.parse(t.components) : t.components
  }));
}

export default {
  connectAccount,
  listAccounts,
  syncTemplates,
  listTemplates
};
