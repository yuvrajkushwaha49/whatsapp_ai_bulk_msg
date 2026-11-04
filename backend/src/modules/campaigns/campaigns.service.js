import { executeQuery, isUsingFallback, getMemoryStore } from '../../database/db.js';
import { enqueueCampaign } from '../../queues/campaignQueue.js';
import logger from '../../utils/logger.js';

export async function listCampaigns(businessId) {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    return store.campaigns.filter(c => c.business_id === Number(businessId)).sort((a, b) => b.id - a.id);
  }

  return executeQuery(
    `SELECT c.*, t.name as template_name, wa.display_name as account_name 
     FROM campaigns c
     LEFT JOIN templates t ON c.template_id = t.id
     LEFT JOIN whatsapp_accounts wa ON c.whatsapp_account_id = wa.id
     WHERE c.business_id = ?
     ORDER BY c.created_at DESC`,
    [businessId]
  );
}

export async function getCampaignDetails(businessId, campaignId) {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    const campaign = store.campaigns.find(c => c.id === Number(campaignId) && c.business_id === Number(businessId));
    if (!campaign) {
      const error = new Error('Campaign not found');
      error.statusCode = 404;
      throw error;
    }
    const template = store.templates.find(t => t.id === campaign.template_id);
    const account = store.whatsapp_accounts.find(a => a.id === campaign.whatsapp_account_id);
    const recipients = store.campaign_recipients.filter(r => r.campaign_id === Number(campaignId));
    return {
      campaign: {
        ...campaign,
        template_name: template?.name || 'welcome_msg',
        template_components: template?.components || [],
        account_name: account?.display_name || account?.phone_number || 'Primary WhatsApp Account',
        account_phone: account?.phone_number || ''
      },
      recipients
    };
  }

  const campaigns = await executeQuery(
    `SELECT c.*, t.name as template_name, t.components as template_components, wa.display_name as account_name, wa.phone_number as account_phone
     FROM campaigns c
     LEFT JOIN templates t ON c.template_id = t.id
     LEFT JOIN whatsapp_accounts wa ON c.whatsapp_account_id = wa.id
     WHERE c.business_id = ? AND c.id = ? LIMIT 1`,
    [businessId, campaignId]
  );

  if (campaigns.length === 0) {
    const error = new Error('Campaign not found');
    error.statusCode = 404;
    throw error;
  }

  const recipients = await executeQuery(
    `SELECT cr.*, c.name as contact_name
     FROM campaign_recipients cr
     LEFT JOIN contacts c ON cr.contact_id = c.id
     WHERE cr.business_id = ? AND cr.campaign_id = ?
     ORDER BY cr.id ASC LIMIT 100`,
    [businessId, campaignId]
  );

  return { campaign: campaigns[0], recipients };
}

export async function previewAudience(businessId, { tagIds = [], contactIds = [], groupIds = [], excludeTagIds = [] } = {}) {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    let eligible = (store.contacts || []).filter(c => c.business_id === Number(businessId) && (c.status === 'active' || !c.status));

    if (Array.isArray(contactIds) && contactIds.length > 0) {
      const cIdNums = contactIds.map(Number);
      eligible = eligible.filter(c => cIdNums.includes(c.id));
    } else if (Array.isArray(groupIds) && groupIds.length > 0) {
      const gIdNums = groupIds.map(Number);
      const matchContactIds = (store.contact_group_members || []).filter(m => gIdNums.includes(m.group_id)).map(m => m.contact_id);
      eligible = eligible.filter(c => matchContactIds.includes(c.id));
    } else if (Array.isArray(tagIds) && tagIds.length > 0) {
      const matchContactIds = (store.contact_tags || []).filter(ct => tagIds.includes(ct.tag_id)).map(ct => ct.contact_id);
      eligible = eligible.filter(c => matchContactIds.includes(c.id));
    }

    return {
      estimatedCount: eligible.length,
      sampleContacts: eligible.slice(0, 5)
    };
  }

  let sql = `
    SELECT c.id, c.name, c.phone, c.email, c.is_opted_in
    FROM contacts c
    WHERE c.business_id = ? AND (c.status = 'active' OR c.status IS NULL)
  `;
  const params = [businessId];

  if (Array.isArray(contactIds) && contactIds.length > 0) {
    const cPlaceholders = contactIds.map(() => '?').join(',');
    sql += ` AND c.id IN (${cPlaceholders})`;
    params.push(...contactIds.map(Number));
  } else if (Array.isArray(groupIds) && groupIds.length > 0) {
    const gPlaceholders = groupIds.map(() => '?').join(',');
    sql += ` AND EXISTS (SELECT 1 FROM contact_group_members gm WHERE gm.contact_id = c.id AND gm.group_id IN (${gPlaceholders}))`;
    params.push(...groupIds.map(Number));
  } else if (Array.isArray(tagIds) && tagIds.length > 0) {
    const tPlaceholders = tagIds.map(() => '?').join(',');
    sql += ` AND EXISTS (SELECT 1 FROM contact_tags ct WHERE ct.contact_id = c.id AND ct.tag_id IN (${tPlaceholders}))`;
    params.push(...tagIds.map(Number));
  }

  const rows = await executeQuery(sql, params);
  return {
    estimatedCount: rows.length,
    sampleContacts: rows.slice(0, 5)
  };
}

export async function preflightCheck(businessId, { campaignId, whatsappAccountId, whatsappAccountIds = [], templateId, tagIds = [], contactIds = [], groupIds = [] } = {}) {
  const issues = [];

  if (campaignId) {
    let camp;
    if (isUsingFallback()) {
      const store = getMemoryStore();
      camp = store.campaigns.find(c => c.id === Number(campaignId) && c.business_id === Number(businessId));
    } else {
      const cRows = await executeQuery('SELECT * FROM campaigns WHERE id = ? AND business_id = ?', [campaignId, businessId]);
      camp = cRows[0];
    }
    if (camp) {
      if (!whatsappAccountId && whatsappAccountIds.length === 0) {
        whatsappAccountId = camp.whatsapp_account_id;
        const rawMappings = typeof camp.variable_mappings === 'string'
          ? JSON.parse(camp.variable_mappings || '{}')
          : (camp.variable_mappings || {});
        if (Array.isArray(rawMappings.sender_account_ids) && rawMappings.sender_account_ids.length > 0) {
          whatsappAccountIds = rawMappings.sender_account_ids;
        }
      }
      if (!templateId) {
        templateId = camp.template_id;
      }
    }
  }

  const accountIdsList = Array.isArray(whatsappAccountIds) && whatsappAccountIds.length > 0
    ? whatsappAccountIds.map(Number)
    : (whatsappAccountId ? [Number(whatsappAccountId)] : []);

  // 1. Verify WhatsApp Account(s)
  let accounts = [];
  if (isUsingFallback()) {
    const store = getMemoryStore();
    accounts = (store.whatsapp_accounts || []).filter(a => accountIdsList.includes(a.id) && a.business_id === Number(businessId));
    if (accounts.length === 0 && whatsappAccountId) {
      const single = (store.whatsapp_accounts || []).find(a => a.id === Number(whatsappAccountId) && a.business_id === Number(businessId));
      if (single) accounts = [single];
    }
  } else {
    if (accountIdsList.length > 0) {
      const placeholders = accountIdsList.map(() => '?').join(',');
      accounts = await executeQuery(
        `SELECT * FROM whatsapp_accounts 
         WHERE id IN (${placeholders}) 
           AND business_id = ? 
           AND (admin_status IS NULL OR admin_status != 'DEACTIVE')`,
        [...accountIdsList, businessId]
      );
    }
  }

  const primaryAccount = accounts[0];

  if (!primaryAccount) {
    issues.push('WhatsApp Account is not connected or has been deactivated by SuperAdmin.');
  } else if (accounts.some(a => a.status === 'disconnected' || a.status === 'restricted')) {
    issues.push('One or more selected WhatsApp Accounts are disconnected or require reauthorization.');
  }

  // 2. Verify Template Approval
  let template;
  if (isUsingFallback()) {
    const store = getMemoryStore();
    template = store.templates.find(t => t.id === Number(templateId) && t.business_id === Number(businessId));
  } else {
    const tRows = await executeQuery('SELECT * FROM templates WHERE id = ? AND business_id = ?', [templateId, businessId]);
    template = tRows[0];
  }

  if (!template) {
    issues.push('Selected template was not found.');
  } else if (template.status !== 'APPROVED') {
    issues.push(`Selected template status is "${template.status}". Only Meta-APPROVED templates can be sent.`);
  } else if (template.name === 'hello_world' && accounts.some(a => a.phone_number?.includes('+91') || a.display_name?.includes('Indian'))) {
    issues.push("Meta Policy Restriction (#131058): The 'hello_world' sample template can only be sent from Meta Public Test Numbers (+1 555-199-9056). Real Indian registered numbers require custom approved templates (e.g. welcome_msg).");
  }

  // 3. Audience Count
  let audienceCount = 0;
  if (campaignId) {
    if (isUsingFallback()) {
      const store = getMemoryStore();
      audienceCount = store.campaign_recipients.filter(cr => cr.campaign_id === Number(campaignId)).length;
    } else {
      const recRows = await executeQuery('SELECT COUNT(*) as count FROM campaign_recipients WHERE campaign_id = ?', [campaignId]);
      audienceCount = recRows[0]?.count || 0;
    }
  } else {
    const audience = await previewAudience(businessId, { tagIds, contactIds, groupIds });
    audienceCount = audience.estimatedCount;
  }

  if (audienceCount === 0) {
    issues.push('No eligible opted-in contacts found matching selected audience filters.');
  }

  return {
    canProceed: issues.length === 0,
    issues,
    audienceCount,
    estimatedCost: 'Rate card estimates apply based on Meta promotional rates per country.'
  };
}

export async function createCampaign(businessId, { name, purpose, whatsappAccountId, whatsappAccountIds = [], templateId, tagIds = [], contactIds = [], groupIds = [], variableMappings = {} }) {
  const audience = await previewAudience(businessId, { tagIds, contactIds, groupIds });

  // Support single or multiple sending accounts
  const accountIdsList = Array.isArray(whatsappAccountIds) && whatsappAccountIds.length > 0 
    ? whatsappAccountIds.map(Number) 
    : [Number(whatsappAccountId)];
  const primaryAccountId = accountIdsList[0];

  const enrichedMappings = {
    ...variableMappings,
    sender_account_ids: accountIdsList
  };

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const newId = store.campaigns.length + 1;
    const campaign = {
      id: newId,
      business_id: Number(businessId),
      whatsapp_account_id: primaryAccountId,
      template_id: Number(templateId),
      name,
      purpose,
      status: 'draft',
      total_recipients: audience.estimatedCount,
      sent_count: 0,
      delivered_count: 0,
      read_count: 0,
      failed_count: 0,
      variable_mappings: enrichedMappings,
      created_at: new Date()
    };
    store.campaigns.push(campaign);

    // Populate recipients
    let eligibleContacts = (store.contacts || []).filter(c => c.business_id === Number(businessId) && (c.status === 'active' || !c.status) && (c.is_opted_in === null || c.is_opted_in === undefined || c.is_opted_in === true || c.is_opted_in === 1));
    if (Array.isArray(contactIds) && contactIds.length > 0) {
      const cIdNums = contactIds.map(Number);
      eligibleContacts = eligibleContacts.filter(c => cIdNums.includes(c.id));
    } else if (Array.isArray(groupIds) && groupIds.length > 0) {
      const gIdNums = groupIds.map(Number);
      const matchContactIds = (store.contact_group_members || []).filter(m => gIdNums.includes(m.group_id)).map(m => m.contact_id);
      eligibleContacts = eligibleContacts.filter(c => matchContactIds.includes(c.id));
    } else if (Array.isArray(tagIds) && tagIds.length > 0) {
      const tIdNums = tagIds.map(Number);
      const matchContactIds = (store.contact_tags || []).filter(ct => tIdNums.includes(ct.tag_id)).map(ct => ct.contact_id);
      eligibleContacts = eligibleContacts.filter(c => matchContactIds.includes(c.id));
    }

    eligibleContacts.forEach((c) => {
      store.campaign_recipients.push({
        id: store.campaign_recipients.length + 1,
        business_id: Number(businessId),
        campaign_id: newId,
        contact_id: c.id,
        phone: c.phone,
        status: 'pending',
        created_at: new Date()
      });
    });

    campaign.total_recipients = eligibleContacts.length;
    return campaign;
  }

  const result = await executeQuery(
    `INSERT INTO campaigns (business_id, whatsapp_account_id, template_id, name, purpose, status, total_recipients, variable_mappings)
     VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)`,
    [businessId, primaryAccountId, templateId, name, purpose, audience.estimatedCount, JSON.stringify(enrichedMappings)]
  );
  const campaignId = result.insertId;

  // Insert campaign recipients with expanded parameter placeholders
  let contactSelectSql = `
    SELECT c.id, c.phone 
    FROM contacts c 
    WHERE c.business_id = ? 
      AND (c.status = 'active' OR c.status IS NULL)
      AND (c.is_opted_in IS NULL OR c.is_opted_in = TRUE OR c.is_opted_in = 1)
  `;
  const params = [businessId];

  if (Array.isArray(contactIds) && contactIds.length > 0) {
    const cPlaceholders = contactIds.map(() => '?').join(',');
    contactSelectSql += ` AND c.id IN (${cPlaceholders})`;
    params.push(...contactIds.map(Number));
  } else if (Array.isArray(groupIds) && groupIds.length > 0) {
    const gPlaceholders = groupIds.map(() => '?').join(',');
    contactSelectSql += ` AND EXISTS (SELECT 1 FROM contact_group_members gm WHERE gm.contact_id = c.id AND gm.group_id IN (${gPlaceholders}))`;
    params.push(...groupIds.map(Number));
  } else if (Array.isArray(tagIds) && tagIds.length > 0) {
    const tPlaceholders = tagIds.map(() => '?').join(',');
    contactSelectSql += ` AND EXISTS (SELECT 1 FROM contact_tags ct WHERE ct.contact_id = c.id AND ct.tag_id IN (${tPlaceholders}))`;
    params.push(...tagIds.map(Number));
  }

  const contacts = await executeQuery(contactSelectSql, params);

  logger.info(`[CreateCampaign] Found ${contacts.length} recipients for Campaign #${campaignId}`);

  for (const c of contacts) {
    await executeQuery(
      `INSERT INTO campaign_recipients (business_id, campaign_id, contact_id, phone, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [businessId, campaignId, c.id, c.phone]
    );
  }

  // Update total_recipients to exact count of inserted recipients
  await executeQuery(
    `UPDATE campaigns SET total_recipients = ? WHERE id = ?`,
    [contacts.length, campaignId]
  );

  return { id: campaignId, name, total_recipients: contacts.length, status: 'draft' };
}

export async function startCampaign(businessId, campaignId) {
  const preflight = await preflightCheck(businessId, { campaignId });
  await enqueueCampaign(campaignId, businessId);
  return { success: true, message: 'Campaign queued for dispatch' };
}

export async function pauseCampaign(businessId, campaignId) {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    const c = store.campaigns.find(camp => camp.id === Number(campaignId) && camp.business_id === Number(businessId));
    if (c) c.status = 'paused';
    return { success: true, status: 'paused' };
  }

  await executeQuery('UPDATE campaigns SET status = "paused" WHERE id = ? AND business_id = ?', [campaignId, businessId]);
  return { success: true, status: 'paused' };
}

export async function cancelCampaign(businessId, campaignId) {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    const c = store.campaigns.find(camp => camp.id === Number(campaignId) && camp.business_id === Number(businessId));
    if (c) c.status = 'cancelled';
    return { success: true, status: 'cancelled' };
  }

  await executeQuery('UPDATE campaigns SET status = "cancelled" WHERE id = ? AND business_id = ?', [campaignId, businessId]);
  return { success: true, status: 'cancelled' };
}

export default {
  listCampaigns,
  getCampaignDetails,
  previewAudience,
  preflightCheck,
  createCampaign,
  startCampaign,
  pauseCampaign,
  cancelCampaign
};
