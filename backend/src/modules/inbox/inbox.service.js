import { executeQuery, isUsingFallback, getMemoryStore, saveMemoryStore } from '../../database/db.js';
import { MetaCloudApiClient } from '../whatsapp/metaClient.js';
import { getAccountWithCredentials } from '../whatsapp/whatsapp.service.js';
import logger from '../../utils/logger.js';
import { emitToTenant, emitToConversation } from '../../socket.js';

/**
 * Helper to get Meta API client for a business tenant with strict credential isolation
 */
async function getClientForBusiness(businessId, accountId = null) {
  const authAccount = await getAccountWithCredentials(businessId, accountId);
  if (authAccount && authAccount.decryptedToken) {
    return new MetaCloudApiClient(authAccount.decryptedToken, authAccount.phone_number_id, authAccount.waba_id);
  }
  return new MetaCloudApiClient(
    '',
    authAccount?.phone_number_id || '',
    authAccount?.waba_id || ''
  );
}

/**
 * 1. List conversations with search, filtering, and role-based access
 */
export async function listConversations(businessId, user, options = {}) {
  const { filter = 'all', search = '', accountId, page = 1, limit = 50 } = options;
  const numBusinessId = Number(businessId);
  const now = new Date();

  if (isUsingFallback()) {
    const store = getMemoryStore();
    if (!store.whatsapp_conversations) store.whatsapp_conversations = [];

    let conversations = store.whatsapp_conversations.filter(c => c.business_id === numBusinessId);

    // Multi-account filtering
    if (accountId && accountId !== 'all') {
      conversations = conversations.filter(c => c.whatsapp_account_id === Number(accountId));
    }

    // Filter logic
    if (filter === 'unread') {
      conversations = conversations.filter(c => (c.unread_count || 0) > 0 && c.status !== 'closed');
    } else if (filter === 'assigned_to_me') {
      conversations = conversations.filter(c => c.assigned_user_id === user.id && c.status !== 'closed');
    } else if (filter === 'unassigned') {
      conversations = conversations.filter(c => !c.assigned_user_id && c.status !== 'closed');
    } else if (filter === 'closed') {
      conversations = conversations.filter(c => c.status === 'closed');
    } else {
      // 'all' includes all open conversations by default
      conversations = conversations.filter(c => c.status !== 'closed');
    }

    // Role-based visibility: Agent only sees assigned conversations unless admin/owner
    if (user.role === 'agent' && filter !== 'assigned_to_me') {
      conversations = conversations.filter(c => c.assigned_user_id === user.id || !c.assigned_user_id);
    }

    // Search by name or phone
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      conversations = conversations.filter(c => {
        const contact = store.contacts?.find(ct => ct.id === c.contact_id);
        const contactName = contact ? `${contact.first_name || ''} ${contact.last_name || ''}`.toLowerCase() : '';
        const phone = (c.customer_phone || '').toLowerCase();
        return contactName.includes(q) || phone.includes(q);
      });
    }

    // Sort by latest message
    conversations.sort((a, b) => new Date(b.last_message_at || b.updated_at) - new Date(a.last_message_at || a.updated_at));

    // Hydrate contacts and assigned users
    const items = conversations.map(c => {
      const contact = store.contacts?.find(ct => ct.id === c.contact_id);
      const assignedUser = store.users?.find(u => u.id === c.assigned_user_id);
      const acc = store.whatsapp_accounts?.find(a => a.id === c.whatsapp_account_id);
      const windowExpiry = c.service_window_expires_at ? new Date(c.service_window_expires_at) : null;
      const isWindowOpen = windowExpiry ? now < windowExpiry : false;

      return {
        ...c,
        whatsapp_account: acc ? {
          id: acc.id,
          display_name: acc.display_name,
          phone_number: acc.phone_number
        } : null,
        contact: contact ? {
          id: contact.id,
          name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || c.customer_phone,
          first_name: contact.first_name,
          last_name: contact.last_name,
          phone: contact.phone,
          email: contact.email,
          tags: contact.tags || [],
          is_opted_in: contact.is_opted_in,
          status: contact.status
        } : {
          id: null,
          name: c.customer_phone,
          phone: c.customer_phone,
          tags: []
        },
        assigned_user: assignedUser ? {
          id: assignedUser.id,
          name: assignedUser.name,
          email: assignedUser.email,
          role: assignedUser.role
        } : null,
        is_window_open: isWindowOpen,
        window_remaining_ms: isWindowOpen ? (windowExpiry.getTime() - now.getTime()) : 0
      };
    });

    return {
      items,
      total: items.length,
      page: Number(page),
      limit: Number(limit)
    };
  }

  // MySQL Implementation
  let query = `
    SELECT 
      c.*,
      ct.first_name AS contact_first_name,
      ct.last_name AS contact_last_name,
      ct.email AS contact_email,
      ct.phone AS contact_phone,
      ct.tags AS contact_tags,
      ct.is_opted_in AS contact_opted_in,
      u.name AS assigned_user_name,
      u.email AS assigned_user_email,
      u.role AS assigned_user_role,
      wa.display_name AS account_display_name,
      wa.phone_number AS account_phone_number
    FROM whatsapp_conversations c
    LEFT JOIN contacts ct ON c.contact_id = ct.id
    LEFT JOIN users u ON c.assigned_user_id = u.id
    LEFT JOIN whatsapp_accounts wa ON c.whatsapp_account_id = wa.id
    WHERE c.business_id = ?
  `;
  const params = [numBusinessId];

  if (accountId && accountId !== 'all') {
    query += ' AND c.whatsapp_account_id = ?';
    params.push(Number(accountId));
  }

  if (filter === 'unread') {
    query += ' AND c.unread_count > 0 AND c.status != "closed"';
  } else if (filter === 'assigned_to_me') {
    query += ' AND c.assigned_user_id = ? AND c.status != "closed"';
    params.push(user.id);
  } else if (filter === 'unassigned') {
    query += ' AND c.assigned_user_id IS NULL AND c.status != "closed"';
  } else if (filter === 'closed') {
    query += ' AND c.status = "closed"';
  } else {
    query += ' AND c.status != "closed"';
  }

  if (user.role === 'agent' && filter !== 'assigned_to_me') {
    query += ' AND (c.assigned_user_id = ? OR c.assigned_user_id IS NULL)';
    params.push(user.id);
  }

  if (search && search.trim()) {
    query += ' AND (c.customer_phone LIKE ? OR CONCAT(COALESCE(ct.first_name,""), " ", COALESCE(ct.last_name,"")) LIKE ?)';
    const qWildcard = `%${search.trim()}%`;
    params.push(qWildcard, qWildcard);
  }

  query += ' ORDER BY COALESCE(c.last_message_at, c.updated_at) DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), (Number(page) - 1) * Number(limit));

  const rows = await executeQuery(query, params);

  const items = rows.map(r => {
    let parsedTags = [];
    try {
      parsedTags = typeof r.contact_tags === 'string' ? JSON.parse(r.contact_tags) : (r.contact_tags || []);
    } catch (e) {
      parsedTags = [];
    }

    const windowExpiry = r.service_window_expires_at ? new Date(r.service_window_expires_at) : null;
    const isWindowOpen = windowExpiry ? now < windowExpiry : false;

    return {
      id: r.id,
      business_id: r.business_id,
      whatsapp_account_id: r.whatsapp_account_id,
      whatsapp_account: r.whatsapp_account_id ? {
        id: r.whatsapp_account_id,
        display_name: r.account_display_name,
        phone_number: r.account_phone_number
      } : null,
      contact_id: r.contact_id,
      customer_phone: r.customer_phone,
      assigned_user_id: r.assigned_user_id,
      status: r.status,
      unread_count: r.unread_count,
      last_message_id: r.last_message_id,
      last_message_text: r.last_message_text,
      last_message_at: r.last_message_at,
      last_incoming_message_at: r.last_incoming_message_at,
      service_window_expires_at: r.service_window_expires_at,
      created_at: r.created_at,
      updated_at: r.updated_at,
      contact: {
        id: r.contact_id,
        name: `${r.contact_first_name || ''} ${r.contact_last_name || ''}`.trim() || r.customer_phone,
        first_name: r.contact_first_name,
        last_name: r.contact_last_name,
        phone: r.contact_phone || r.customer_phone,
        email: r.contact_email,
        tags: parsedTags,
        is_opted_in: r.contact_opted_in
      },
      assigned_user: r.assigned_user_id ? {
        id: r.assigned_user_id,
        name: r.assigned_user_name,
        email: r.assigned_user_email,
        role: r.assigned_user_role
      } : null,
      is_window_open: isWindowOpen,
      window_remaining_ms: isWindowOpen ? (windowExpiry.getTime() - now.getTime()) : 0
    };
  });

  return { items, total: items.length, page: Number(page), limit: Number(limit) };
}

/**
 * 2. Get Single Conversation with details
 */
export async function getConversation(businessId, conversationId) {
  const numBusinessId = Number(businessId);
  const numConvId = Number(conversationId);
  const now = new Date();

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const conv = store.whatsapp_conversations?.find(c => c.id === numConvId && c.business_id === numBusinessId);
    if (!conv) return null;

    const contact = store.contacts?.find(ct => ct.id === conv.contact_id);
    const assignedUser = store.users?.find(u => u.id === conv.assigned_user_id);
    const notes = store.whatsapp_conversation_notes?.filter(n => n.conversation_id === numConvId) || [];
    const windowExpiry = conv.service_window_expires_at ? new Date(conv.service_window_expires_at) : null;
    const isWindowOpen = windowExpiry ? now < windowExpiry : false;

    return {
      ...conv,
      contact: contact ? {
        ...contact,
        name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || conv.customer_phone
      } : null,
      assigned_user: assignedUser ? { id: assignedUser.id, name: assignedUser.name, email: assignedUser.email, role: assignedUser.role } : null,
      notes,
      is_window_open: isWindowOpen,
      window_remaining_ms: isWindowOpen ? (windowExpiry.getTime() - now.getTime()) : 0
    };
  }

  const rows = await executeQuery(
    `SELECT 
      c.*,
      ct.first_name AS contact_first_name,
      ct.last_name AS contact_last_name,
      ct.email AS contact_email,
      ct.phone AS contact_phone,
      ct.tags AS contact_tags,
      ct.is_opted_in AS contact_opted_in,
      u.name AS assigned_user_name,
      u.email AS assigned_user_email,
      u.role AS assigned_user_role
    FROM whatsapp_conversations c
    LEFT JOIN contacts ct ON c.contact_id = ct.id
    LEFT JOIN users u ON c.assigned_user_id = u.id
    WHERE c.id = ? AND c.business_id = ? LIMIT 1`,
    [numConvId, numBusinessId]
  );

  if (!rows || rows.length === 0) return null;
  const r = rows[0];

  let parsedTags = [];
  try {
    parsedTags = typeof r.contact_tags === 'string' ? JSON.parse(r.contact_tags) : (r.contact_tags || []);
  } catch (e) {
    parsedTags = [];
  }

  const notes = await executeQuery(
    `SELECT n.*, u.name as user_name 
     FROM whatsapp_conversation_notes n 
     LEFT JOIN users u ON n.user_id = u.id 
     WHERE n.conversation_id = ? AND n.business_id = ? 
     ORDER BY n.created_at DESC`,
    [numConvId, numBusinessId]
  );

  const windowExpiry = r.service_window_expires_at ? new Date(r.service_window_expires_at) : null;
  const isWindowOpen = windowExpiry ? now < windowExpiry : false;

  return {
    ...r,
    contact: {
      id: r.contact_id,
      name: `${r.contact_first_name || ''} ${r.contact_last_name || ''}`.trim() || r.customer_phone,
      first_name: r.contact_first_name,
      last_name: r.contact_last_name,
      phone: r.contact_phone || r.customer_phone,
      email: r.contact_email,
      tags: parsedTags,
      is_opted_in: r.contact_opted_in
    },
    assigned_user: r.assigned_user_id ? {
      id: r.assigned_user_id,
      name: r.assigned_user_name,
      email: r.assigned_user_email,
      role: r.assigned_user_role
    } : null,
    notes: notes || [],
    is_window_open: isWindowOpen,
    window_remaining_ms: isWindowOpen ? (windowExpiry.getTime() - now.getTime()) : 0
  };
}

/**
 * 3. Get Messages for a Conversation
 */
export async function getMessages(businessId, conversationId, options = {}) {
  const numBusinessId = Number(businessId);
  const numConvId = Number(conversationId);
  const limit = Number(options.limit || 100);

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const messages = (store.whatsapp_messages || [])
      .filter(m => m.conversation_id === numConvId && m.business_id === numBusinessId)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    // Auto-mark conversation as read
    const conv = store.whatsapp_conversations?.find(c => c.id === numConvId);
    if (conv && conv.unread_count > 0) {
      conv.unread_count = 0;
      saveMemoryStore();
      emitToTenant(numBusinessId, 'inbox:conversation_updated', { conversation: conv });
    }

    return messages;
  }

  const messages = await executeQuery(
    `SELECT m.*, u.name as sender_name 
     FROM whatsapp_messages m 
     LEFT JOIN users u ON m.sender_user_id = u.id 
     WHERE m.conversation_id = ? AND m.business_id = ? 
     ORDER BY m.created_at ASC LIMIT ?`,
    [numConvId, numBusinessId, limit]
  );

  // Mark conversation read
  await executeQuery(
    'UPDATE whatsapp_conversations SET unread_count = 0, updated_at = NOW() WHERE id = ? AND business_id = ?',
    [numConvId, numBusinessId]
  );

  return messages;
}

/**
 * 4. Send Free-Form Text Message (Enforces 24-Hour Customer Service Window)
 */
export async function sendTextMessage(businessId, user, conversationId, textBody) {
  const numBusinessId = Number(businessId);
  const numConvId = Number(conversationId);
  const cleanText = (textBody || '').trim();

  if (!cleanText) {
    const err = new Error('Message text cannot be empty');
    err.statusCode = 400;
    throw err;
  }

  const conversation = await getConversation(numBusinessId, numConvId);
  if (!conversation) {
    const err = new Error('Conversation not found');
    err.statusCode = 404;
    throw err;
  }

  // 🛑 Strict 24-Hour WhatsApp Messaging Window Enforcement
  const now = new Date();
  const windowExpiry = conversation.service_window_expires_at ? new Date(conversation.service_window_expires_at) : null;
  const isWindowOpen = windowExpiry ? now < windowExpiry : false;

  if (!isWindowOpen) {
    const err = new Error(
      'WhatsApp 24-hour customer service window has expired. Standard free-form messages cannot be sent. Please send an approved WhatsApp Template to re-engage this customer.'
    );
    err.statusCode = 403;
    err.code = 'SERVICE_WINDOW_EXPIRED';
    throw err;
  }

  // Dispatch via Meta API Client with Conversation-Specific WhatsApp Account
  const client = await getClientForBusiness(numBusinessId, conversation.whatsapp_account_id);
  let metaResult;
  try {
    metaResult = await client.sendTextMessage({
      recipientPhone: conversation.customer_phone,
      textBody: cleanText
    });
  } catch (apiErr) {
    logger.error(`[InboxService] Meta API sendTextMessage error: ${apiErr.message}`);
    const err = new Error(apiErr.response?.data?.error?.message || apiErr.message || 'Failed to send message via Meta API');
    err.statusCode = apiErr.response?.status || 500;
    throw err;
  }

  const metaMessageId = metaResult.meta_message_id || `wamid.out_${Date.now()}`;

  let createdMessage;

  if (isUsingFallback()) {
    const store = getMemoryStore();
    createdMessage = {
      id: (store.whatsapp_messages?.length || 0) + 1,
      business_id: numBusinessId,
      conversation_id: numConvId,
      contact_id: conversation.contact_id,
      whatsapp_account_id: conversation.whatsapp_account_id || 1,
      meta_message_id: metaMessageId,
      direction: 'OUTBOUND',
      message_type: 'text',
      message_body: cleanText,
      message_status: 'sent',
      sender_user_id: user.id,
      sent_at: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    };

    if (!store.whatsapp_messages) store.whatsapp_messages = [];
    store.whatsapp_messages.push(createdMessage);

    // Update conversation
    const conv = store.whatsapp_conversations.find(c => c.id === numConvId);
    if (conv) {
      conv.last_message_id = createdMessage.id;
      conv.last_message_text = cleanText;
      conv.last_message_at = new Date();
      conv.updated_at = new Date();
    }
    saveMemoryStore();
  } else {
    const insertRes = await executeQuery(
      `INSERT INTO whatsapp_messages 
       (business_id, conversation_id, contact_id, whatsapp_account_id, meta_message_id, 
        direction, message_type, message_body, message_status, sender_user_id, sent_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'OUTBOUND', 'text', ?, 'sent', ?, NOW(), NOW(), NOW())`,
      [
        numBusinessId,
        numConvId,
        conversation.contact_id,
        conversation.whatsapp_account_id || 1,
        metaMessageId,
        cleanText,
        user.id
      ]
    );

    createdMessage = {
      id: insertRes.insertId,
      business_id: numBusinessId,
      conversation_id: numConvId,
      contact_id: conversation.contact_id,
      meta_message_id: metaMessageId,
      direction: 'OUTBOUND',
      message_type: 'text',
      message_body: cleanText,
      message_status: 'sent',
      sender_user_id: user.id,
      sent_at: new Date(),
      created_at: new Date()
    };

    await executeQuery(
      'UPDATE whatsapp_conversations SET last_message_id = ?, last_message_text = ?, last_message_at = NOW(), updated_at = NOW() WHERE id = ?',
      [insertRes.insertId, cleanText, numConvId]
    );
  }

  // Socket.IO Real-time broadcast to conversation and tenant
  const socketData = {
    conversationId: numConvId,
    message: {
      ...createdMessage,
      sender_name: user.name || 'Agent'
    }
  };

  emitToConversation(numConvId, 'inbox:new_message', socketData);
  emitToTenant(numBusinessId, 'inbox:new_message', socketData);

  return createdMessage;
}

/**
 * 5. Send Approved WhatsApp Template (Allowed Even When 24h Window is Closed)
 */
export async function sendTemplateMessage(businessId, user, conversationId, templatePayload) {
  const numBusinessId = Number(businessId);
  const numConvId = Number(conversationId);
  const { templateId, templateName, language = 'en', components = [], variableMappings = {} } = templatePayload;

  const conversation = await getConversation(numBusinessId, numConvId);
  if (!conversation) {
    const err = new Error('Conversation not found');
    err.statusCode = 404;
    throw err;
  }

  // Re-verify that template is APPROVED
  let targetTemplateName = templateName;
  let targetLanguage = language;

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const tpl = store.templates?.find(t => (templateId && t.id === Number(templateId)) || t.name === templateName);
    if (!tpl) {
      const err = new Error('Selected template not found');
      err.statusCode = 404;
      throw err;
    }
    if (tpl.status !== 'APPROVED') {
      const err = new Error(`Cannot send template with status "${tpl.status}". Only APPROVED templates can be sent.`);
      err.statusCode = 400;
      throw err;
    }
    targetTemplateName = tpl.name;
    targetLanguage = tpl.language || 'en';
  } else {
    const tpls = await executeQuery(
      'SELECT id, name, language, status, components FROM templates WHERE (id = ? OR name = ?) AND business_id = ? LIMIT 1',
      [templateId || 0, templateName || '', numBusinessId]
    );
    if (!tpls || tpls.length === 0) {
      const err = new Error('Selected template not found');
      err.statusCode = 404;
      throw err;
    }
    if (tpls[0].status !== 'APPROVED') {
      const err = new Error(`Cannot send template with status "${tpls[0].status}". Only APPROVED templates can be sent.`);
      err.statusCode = 400;
      throw err;
    }
    targetTemplateName = tpls[0].name;
    targetLanguage = tpls[0].language || 'en';
  }

  // Fetch template components & parameter format to build compliant payload
  let tplObj = null;
  if (isUsingFallback()) {
    const store = getMemoryStore();
    tplObj = store.templates?.find(t => (templateId && t.id === Number(templateId)) || t.name === targetTemplateName);
  } else {
    const rows = await executeQuery('SELECT * FROM templates WHERE (id = ? OR name = ?) AND business_id = ? LIMIT 1', [templateId || 0, targetTemplateName, numBusinessId]);
    tplObj = rows?.[0] || null;
  }

  const comps = Array.isArray(tplObj?.components)
    ? tplObj.components
    : (typeof tplObj?.components === 'string' ? JSON.parse(tplObj.components || '[]') : []);
  const bodyComp = comps.find(c => (c.type || '').toUpperCase() === 'BODY');
  const bodyText = bodyComp?.text || '';
  const placeholders = Array.from(new Set((bodyText.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) || []).map(p => p.replace(/[{}]/g, ''))));

  if (placeholders.length === 0 && targetTemplateName === 'welcome_msg') {
    placeholders.push('customer_name');
  }

  const defaultCustName = conversation.contact?.first_name || 
                          conversation.contact?.name || 
                          conversation.customer_name || 
                          'Customer';

  // Build Meta Components payload from variable mappings
  const metaComponents = [];
  if (components && components.length > 0) {
    metaComponents.push(...components);
  } else if (placeholders.length > 0) {
    const bodyParams = placeholders.map((ph, idx) => {
      const val = variableMappings?.[ph] || 
                  variableMappings?.[String(idx + 1)] || 
                  variableMappings?.[`var_${idx + 1}`] || 
                  defaultCustName;
      const paramObj = {
        type: 'text',
        text: String(val || '')
      };
      if (tplObj?.parameter_format === 'NAMED' || isNaN(Number(ph)) || ph === 'customer_name') {
        paramObj.parameter_name = ph;
      }
      return paramObj;
    });

    metaComponents.push({
      type: 'body',
      parameters: bodyParams
    });
  } else if (targetTemplateName === 'welcome_msg') {
    // welcome_msg always requires customer_name named parameter
    const custName = variableMappings?.customer_name || 
                     variableMappings?.['1'] || 
                     variableMappings?.var_1 || 
                     defaultCustName;
    metaComponents.push({
      type: 'body',
      parameters: [
        {
          type: 'text',
          parameter_name: 'customer_name',
          text: String(custName)
        }
      ]
    });
  } else if (variableMappings && Object.keys(variableMappings).length > 0) {
    const parameters = Object.keys(variableMappings).map(key => {
      const p = {
        type: 'text',
        text: String(variableMappings[key] || '')
      };
      if (isNaN(Number(key))) {
        p.parameter_name = key;
      }
      return p;
    });
    metaComponents.push({
      type: 'body',
      parameters
    });
  }

  // Dispatch via Meta API Client with Conversation-Specific WhatsApp Account
  const client = await getClientForBusiness(numBusinessId, conversation.whatsapp_account_id);
  let metaResult;
  try {
    metaResult = await client.sendTemplateMessage({
      recipientPhone: conversation.customer_phone,
      templateName: targetTemplateName,
      languageCode: targetLanguage,
      components: metaComponents
    });
  } catch (apiErr) {
    logger.error(`[InboxService] Meta API sendTemplateMessage error: ${apiErr.message}`);
    const err = new Error(apiErr.response?.data?.error?.message || apiErr.message || 'Failed to send template via Meta API');
    err.statusCode = apiErr.response?.status || 500;
    throw err;
  }

  const metaMessageId = metaResult.meta_message_id || `wamid.out_tpl_${Date.now()}`;
  const displayBody = `[Template: ${targetTemplateName}]`;

  let createdMessage;

  if (isUsingFallback()) {
    const store = getMemoryStore();
    createdMessage = {
      id: (store.whatsapp_messages?.length || 0) + 1,
      business_id: numBusinessId,
      conversation_id: numConvId,
      contact_id: conversation.contact_id,
      whatsapp_account_id: conversation.whatsapp_account_id || 1,
      meta_message_id: metaMessageId,
      direction: 'OUTBOUND',
      message_type: 'template',
      message_body: displayBody,
      template_name: targetTemplateName,
      template_components_json: JSON.stringify(metaComponents),
      message_status: 'sent',
      sender_user_id: user.id,
      sent_at: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    };

    if (!store.whatsapp_messages) store.whatsapp_messages = [];
    store.whatsapp_messages.push(createdMessage);

    const conv = store.whatsapp_conversations.find(c => c.id === numConvId);
    if (conv) {
      conv.last_message_id = createdMessage.id;
      conv.last_message_text = displayBody;
      conv.last_message_at = new Date();
      conv.updated_at = new Date();
    }
    saveMemoryStore();
  } else {
    const insertRes = await executeQuery(
      `INSERT INTO whatsapp_messages 
       (business_id, conversation_id, contact_id, whatsapp_account_id, meta_message_id, 
        direction, message_type, message_body, template_name, template_components_json, 
        message_status, sender_user_id, sent_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'OUTBOUND', 'template', ?, ?, ?, 'sent', ?, NOW(), NOW(), NOW())`,
      [
        numBusinessId,
        numConvId,
        conversation.contact_id,
        conversation.whatsapp_account_id || 1,
        metaMessageId,
        displayBody,
        targetTemplateName,
        JSON.stringify(metaComponents),
        user.id
      ]
    );

    createdMessage = {
      id: insertRes.insertId,
      business_id: numBusinessId,
      conversation_id: numConvId,
      contact_id: conversation.contact_id,
      meta_message_id: metaMessageId,
      direction: 'OUTBOUND',
      message_type: 'template',
      message_body: displayBody,
      template_name: targetTemplateName,
      message_status: 'sent',
      sender_user_id: user.id,
      sent_at: new Date(),
      created_at: new Date()
    };

    await executeQuery(
      'UPDATE whatsapp_conversations SET last_message_id = ?, last_message_text = ?, last_message_at = NOW(), updated_at = NOW() WHERE id = ?',
      [insertRes.insertId, displayBody, numConvId]
    );
  }

  const socketData = {
    conversationId: numConvId,
    message: {
      ...createdMessage,
      sender_name: user.name || 'Agent'
    }
  };

  emitToConversation(numConvId, 'inbox:new_message', socketData);
  emitToTenant(numBusinessId, 'inbox:new_message', socketData);

  return createdMessage;
}

/**
 * 6. Send Media Message
 */
export async function sendMediaMessage(businessId, user, conversationId, mediaPayload) {
  const numBusinessId = Number(businessId);
  const numConvId = Number(conversationId);
  const { mediaType, mediaUrl, caption = '', filename = '' } = mediaPayload;

  const conversation = await getConversation(numBusinessId, numConvId);
  if (!conversation) {
    const err = new Error('Conversation not found');
    err.statusCode = 404;
    throw err;
  }

  // 24-hr window check
  const now = new Date();
  const windowExpiry = conversation.service_window_expires_at ? new Date(conversation.service_window_expires_at) : null;
  if (!windowExpiry || now >= windowExpiry) {
    const err = new Error('WhatsApp 24-hour service window has expired. Only approved templates can be sent.');
    err.statusCode = 403;
    err.code = 'SERVICE_WINDOW_EXPIRED';
    throw err;
  }

  const client = await getClientForBusiness(numBusinessId);
  const metaResult = await client.sendMediaMessage({
    recipientPhone: conversation.customer_phone,
    mediaType,
    mediaUrl,
    caption,
    filename
  });

  const metaMessageId = metaResult.meta_message_id || `wamid.out_media_${Date.now()}`;
  const displayBody = caption || `[${mediaType} attached]`;

  let createdMessage;

  if (isUsingFallback()) {
    const store = getMemoryStore();
    createdMessage = {
      id: (store.whatsapp_messages?.length || 0) + 1,
      business_id: numBusinessId,
      conversation_id: numConvId,
      contact_id: conversation.contact_id,
      whatsapp_account_id: conversation.whatsapp_account_id || 1,
      meta_message_id: metaMessageId,
      direction: 'OUTBOUND',
      message_type: mediaType,
      message_body: displayBody,
      media_url: mediaUrl,
      message_status: 'sent',
      sender_user_id: user.id,
      sent_at: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    };

    if (!store.whatsapp_messages) store.whatsapp_messages = [];
    store.whatsapp_messages.push(createdMessage);

    const conv = store.whatsapp_conversations.find(c => c.id === numConvId);
    if (conv) {
      conv.last_message_id = createdMessage.id;
      conv.last_message_text = displayBody;
      conv.last_message_at = new Date();
      conv.updated_at = new Date();
    }
    saveMemoryStore();
  } else {
    const insertRes = await executeQuery(
      `INSERT INTO whatsapp_messages 
       (business_id, conversation_id, contact_id, whatsapp_account_id, meta_message_id, 
        direction, message_type, message_body, media_url, message_status, sender_user_id, sent_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'OUTBOUND', ?, ?, ?, 'sent', ?, NOW(), NOW(), NOW())`,
      [
        numBusinessId,
        numConvId,
        conversation.contact_id,
        conversation.whatsapp_account_id || 1,
        metaMessageId,
        mediaType,
        displayBody,
        mediaUrl,
        user.id
      ]
    );

    createdMessage = {
      id: insertRes.insertId,
      business_id: numBusinessId,
      conversation_id: numConvId,
      contact_id: conversation.contact_id,
      meta_message_id: metaMessageId,
      direction: 'OUTBOUND',
      message_type: mediaType,
      message_body: displayBody,
      media_url: mediaUrl,
      message_status: 'sent',
      sender_user_id: user.id,
      sent_at: new Date(),
      created_at: new Date()
    };

    await executeQuery(
      'UPDATE whatsapp_conversations SET last_message_id = ?, last_message_text = ?, last_message_at = NOW(), updated_at = NOW() WHERE id = ?',
      [insertRes.insertId, displayBody, numConvId]
    );
  }

  const socketData = {
    conversationId: numConvId,
    message: {
      ...createdMessage,
      sender_name: user.name || 'Agent'
    }
  };

  emitToConversation(numConvId, 'inbox:new_message', socketData);
  emitToTenant(numBusinessId, 'inbox:new_message', socketData);

  return createdMessage;
}

/**
 * 7. Assign Conversation to Agent
 */
export async function assignConversation(businessId, user, conversationId, targetUserId) {
  const numBusinessId = Number(businessId);
  const numConvId = Number(conversationId);
  const targetId = targetUserId ? Number(targetUserId) : null;

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const conv = store.whatsapp_conversations?.find(c => c.id === numConvId && c.business_id === numBusinessId);
    if (!conv) {
      const err = new Error('Conversation not found');
      err.statusCode = 404;
      throw err;
    }

    const prevAssigned = conv.assigned_user_id;
    conv.assigned_user_id = targetId;
    conv.updated_at = new Date();

    if (!store.whatsapp_conversation_assignments) store.whatsapp_conversation_assignments = [];
    store.whatsapp_conversation_assignments.push({
      id: store.whatsapp_conversation_assignments.length + 1,
      business_id: numBusinessId,
      conversation_id: numConvId,
      assigned_from: prevAssigned,
      assigned_to: targetId,
      assigned_by: user.id,
      created_at: new Date()
    });

    saveMemoryStore();
    emitToTenant(numBusinessId, 'inbox:conversation_updated', { conversation: conv });
    return conv;
  }

  await executeQuery(
    'UPDATE whatsapp_conversations SET assigned_user_id = ?, updated_at = NOW() WHERE id = ? AND business_id = ?',
    [targetId, numConvId, numBusinessId]
  );

  await executeQuery(
    `INSERT INTO whatsapp_conversation_assignments (business_id, conversation_id, assigned_to, assigned_by, created_at)
     VALUES (?, ?, ?, ?, NOW())`,
    [numBusinessId, numConvId, targetId, user.id]
  );

  const updated = await getConversation(numBusinessId, numConvId);
  emitToTenant(numBusinessId, 'inbox:conversation_updated', { conversation: updated });
  return updated;
}

/**
 * 8. Update Conversation Status (open / closed / pending)
 */
export async function updateStatus(businessId, user, conversationId, status) {
  const numBusinessId = Number(businessId);
  const numConvId = Number(conversationId);

  if (!['open', 'closed', 'pending'].includes(status)) {
    const err = new Error('Invalid conversation status');
    err.statusCode = 400;
    throw err;
  }

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const conv = store.whatsapp_conversations?.find(c => c.id === numConvId && c.business_id === numBusinessId);
    if (!conv) {
      const err = new Error('Conversation not found');
      err.statusCode = 404;
      throw err;
    }

    conv.status = status;
    conv.updated_at = new Date();

    if (!store.whatsapp_conversation_events) store.whatsapp_conversation_events = [];
    store.whatsapp_conversation_events.push({
      id: store.whatsapp_conversation_events.length + 1,
      business_id: numBusinessId,
      conversation_id: numConvId,
      user_id: user.id,
      event_type: 'status_changed',
      event_data_json: JSON.stringify({ old_status: conv.status, new_status: status }),
      created_at: new Date()
    });

    saveMemoryStore();
    emitToTenant(numBusinessId, 'inbox:conversation_updated', { conversation: conv });
    return conv;
  }

  await executeQuery(
    'UPDATE whatsapp_conversations SET status = ?, updated_at = NOW() WHERE id = ? AND business_id = ?',
    [status, numConvId, numBusinessId]
  );

  await executeQuery(
    `INSERT INTO whatsapp_conversation_events (business_id, conversation_id, user_id, event_type, event_data_json, created_at)
     VALUES (?, ?, ?, 'status_changed', ?, NOW())`,
    [numBusinessId, numConvId, user.id, JSON.stringify({ new_status: status })]
  );

  const updated = await getConversation(numBusinessId, numConvId);
  emitToTenant(numBusinessId, 'inbox:conversation_updated', { conversation: updated });
  return updated;
}

/**
 * 9. Mark As Read / Unread
 */
export async function markAsRead(businessId, conversationId) {
  const numBusinessId = Number(businessId);
  const numConvId = Number(conversationId);

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const conv = store.whatsapp_conversations?.find(c => c.id === numConvId && c.business_id === numBusinessId);
    if (conv) {
      conv.unread_count = 0;
      conv.updated_at = new Date();
      saveMemoryStore();
      emitToTenant(numBusinessId, 'inbox:conversation_updated', { conversation: conv });
    }
    return { success: true };
  }

  await executeQuery(
    'UPDATE whatsapp_conversations SET unread_count = 0, updated_at = NOW() WHERE id = ? AND business_id = ?',
    [numConvId, numBusinessId]
  );

  const updated = await getConversation(numBusinessId, numConvId);
  if (updated) {
    emitToTenant(numBusinessId, 'inbox:conversation_updated', { conversation: updated });
  }
  return { success: true };
}

export async function markAsUnread(businessId, conversationId) {
  const numBusinessId = Number(businessId);
  const numConvId = Number(conversationId);

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const conv = store.whatsapp_conversations?.find(c => c.id === numConvId && c.business_id === numBusinessId);
    if (conv) {
      conv.unread_count = (conv.unread_count || 0) + 1;
      conv.updated_at = new Date();
      saveMemoryStore();
      emitToTenant(numBusinessId, 'inbox:conversation_updated', { conversation: conv });
    }
    return { success: true };
  }

  await executeQuery(
    'UPDATE whatsapp_conversations SET unread_count = GREATEST(unread_count + 1, 1), updated_at = NOW() WHERE id = ? AND business_id = ?',
    [numConvId, numBusinessId]
  );

  const updated = await getConversation(numBusinessId, numConvId);
  if (updated) {
    emitToTenant(numBusinessId, 'inbox:conversation_updated', { conversation: updated });
  }
  return { success: true };
}

/**
 * 10. Customer CRM Notes
 */
export async function addNote(businessId, user, conversationId, noteText) {
  const numBusinessId = Number(businessId);
  const numConvId = Number(conversationId);

  if (!noteText || !noteText.trim()) {
    const err = new Error('Note content cannot be empty');
    err.statusCode = 400;
    throw err;
  }

  if (isUsingFallback()) {
    const store = getMemoryStore();
    if (!store.whatsapp_conversation_notes) store.whatsapp_conversation_notes = [];
    const note = {
      id: store.whatsapp_conversation_notes.length + 1,
      business_id: numBusinessId,
      conversation_id: numConvId,
      user_id: user.id,
      user_name: user.name || 'Agent',
      note: noteText.trim(),
      created_at: new Date(),
      updated_at: new Date()
    };
    store.whatsapp_conversation_notes.push(note);
    saveMemoryStore();
    return note;
  }

  const res = await executeQuery(
    `INSERT INTO whatsapp_conversation_notes (business_id, conversation_id, user_id, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, NOW(), NOW())`,
    [numBusinessId, numConvId, user.id, noteText.trim()]
  );

  return {
    id: res.insertId,
    business_id: numBusinessId,
    conversation_id: numConvId,
    user_id: user.id,
    user_name: user.name,
    note: noteText.trim(),
    created_at: new Date()
  };
}

export async function getNotes(businessId, conversationId) {
  const numBusinessId = Number(businessId);
  const numConvId = Number(conversationId);

  if (isUsingFallback()) {
    const store = getMemoryStore();
    return (store.whatsapp_conversation_notes || [])
      .filter(n => n.conversation_id === numConvId && n.business_id === numBusinessId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  return await executeQuery(
    `SELECT n.*, u.name as user_name 
     FROM whatsapp_conversation_notes n 
     LEFT JOIN users u ON n.user_id = u.id 
     WHERE n.conversation_id = ? AND n.business_id = ? 
     ORDER BY n.created_at DESC`,
    [numConvId, numBusinessId]
  );
}

/**
 * 11. Update Contact CRM Details
 */
export async function updateContact(businessId, conversationId, contactData) {
  const numBusinessId = Number(businessId);
  const numConvId = Number(conversationId);
  const { first_name, last_name, email, tags } = contactData;

  const conv = await getConversation(numBusinessId, numConvId);
  if (!conv || !conv.contact_id) {
    const err = new Error('Associated contact not found');
    err.statusCode = 404;
    throw err;
  }

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const contact = store.contacts?.find(c => c.id === conv.contact_id && c.business_id === numBusinessId);
    if (contact) {
      if (first_name !== undefined) contact.first_name = first_name;
      if (last_name !== undefined) contact.last_name = last_name;
      if (email !== undefined) contact.email = email;
      if (tags !== undefined) contact.tags = Array.isArray(tags) ? tags : [];
      contact.updated_at = new Date();
      saveMemoryStore();
    }
    return contact;
  }

  const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : []);
  await executeQuery(
    'UPDATE contacts SET first_name = ?, last_name = ?, email = ?, tags = ?, updated_at = NOW() WHERE id = ? AND business_id = ?',
    [first_name || '', last_name || '', email || null, tagsJson, conv.contact_id, numBusinessId]
  );

  const updatedRows = await executeQuery('SELECT * FROM contacts WHERE id = ? LIMIT 1', [conv.contact_id]);
  return updatedRows[0];
}

/**
 * 12. Inbox Stats
 */
export async function getInboxStats(businessId, user) {
  const numBusinessId = Number(businessId);
  const now = new Date();

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const convs = (store.whatsapp_conversations || []).filter(c => c.business_id === numBusinessId);

    const total = convs.length;
    const open = convs.filter(c => c.status !== 'closed').length;
    const closed = convs.filter(c => c.status === 'closed').length;
    const unread = convs.filter(c => (c.unread_count || 0) > 0 && c.status !== 'closed').length;
    const assignedToMe = convs.filter(c => c.assigned_user_id === user.id && c.status !== 'closed').length;
    const unassigned = convs.filter(c => !c.assigned_user_id && c.status !== 'closed').length;
    const windowActive = convs.filter(c => c.service_window_expires_at && now < new Date(c.service_window_expires_at)).length;

    return {
      total,
      open,
      closed,
      unread,
      assignedToMe,
      unassigned,
      windowActive
    };
  }

  const [stats] = await executeQuery(
    `SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status != 'closed' THEN 1 ELSE 0 END) as open,
      SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed,
      SUM(CASE WHEN unread_count > 0 AND status != 'closed' THEN 1 ELSE 0 END) as unread,
      SUM(CASE WHEN assigned_user_id = ? AND status != 'closed' THEN 1 ELSE 0 END) as assignedToMe,
      SUM(CASE WHEN assigned_user_id IS NULL AND status != 'closed' THEN 1 ELSE 0 END) as unassigned,
      SUM(CASE WHEN service_window_expires_at > NOW() THEN 1 ELSE 0 END) as windowActive
    FROM whatsapp_conversations 
    WHERE business_id = ?`,
    [user.id, numBusinessId]
  );

  return {
    total: Number(stats?.total || 0),
    open: Number(stats?.open || 0),
    closed: Number(stats?.closed || 0),
    unread: Number(stats?.unread || 0),
    assignedToMe: Number(stats?.assignedToMe || 0),
    unassigned: Number(stats?.unassigned || 0),
    windowActive: Number(stats?.windowActive || 0)
  };
}

export default {
  listConversations,
  getConversation,
  getMessages,
  sendTextMessage,
  sendTemplateMessage,
  sendMediaMessage,
  assignConversation,
  updateStatus,
  markAsRead,
  markAsUnread,
  addNote,
  getNotes,
  updateContact,
  getInboxStats
};
