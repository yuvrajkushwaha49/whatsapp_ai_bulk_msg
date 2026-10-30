import { executeQuery, isUsingFallback, getMemoryStore, saveMemoryStore } from '../../database/db.js';
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

/**
 * List templates with search, filtering, pagination, and real aggregated status stats
 */
export async function listTemplates(businessId, query = {}) {
  const {
    category,
    status,
    language,
    search,
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

  // 4. Get connected WhatsApp Account
  const accounts = await listAccounts(businessId);
  if (!accounts || accounts.length === 0) {
    throw new Error('No connected WhatsApp Account found for this business. Please connect an account first.');
  }

  let selectedAccount = accounts[0];
  if (accountId) {
    const matched = accounts.find(a => a.id === Number(accountId));
    if (matched) selectedAccount = matched;
  }

  const token = selectedAccount.access_token_encrypted || process.env.META_ACCESS_TOKEN;
  const client = new MetaCloudApiClient(token, selectedAccount.phone_number_id, selectedAccount.waba_id);

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
      whatsapp_account_id: selectedAccount.id,
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
    selectedAccount.id,
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
    whatsapp_account_id: selectedAccount.id,
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
  const accounts = await listAccounts(businessId);
  if (!accounts || accounts.length === 0) {
    throw new Error('No WhatsApp accounts connected to synchronize.');
  }

  const targetAccounts = accountId ? accounts.filter(a => a.id === Number(accountId)) : accounts;
  let totalSynced = 0;

  for (const account of targetAccounts) {
    const token = account.access_token_encrypted || process.env.META_ACCESS_TOKEN;
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
  const accounts = await listAccounts(businessId);
  const account = accounts.find(a => a.id === tpl.whatsapp_account_id) || accounts[0];

  const token = account?.access_token_encrypted || process.env.META_ACCESS_TOKEN;
  const client = new MetaCloudApiClient(token, account?.phone_number_id, account?.waba_id);

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
  const accounts = await listAccounts(businessId);
  const account = accounts.find(a => a.id === tpl.whatsapp_account_id) || accounts[0];

  const token = account?.access_token_encrypted || process.env.META_ACCESS_TOKEN;
  const client = new MetaCloudApiClient(token, account?.phone_number_id, account?.waba_id);

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
  deleteTemplate
};
