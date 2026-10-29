import { executeQuery, isUsingFallback, getMemoryStore } from '../../database/db.js';
import { normalizePhone } from '../../utils/phone.js';

export async function listContacts(businessId, { page = 1, limit = 20, search = '', tag = '', status = '', optedIn = '' }) {
  const offset = (Number(page) - 1) * Number(limit);

  if (isUsingFallback()) {
    const store = getMemoryStore();
    let contacts = store.contacts.filter(c => c.business_id === Number(businessId));

    if (search) {
      const q = search.toLowerCase();
      contacts = contacts.filter(c => (c.name && c.name.toLowerCase().includes(q)) || c.phone.includes(q) || (c.email && c.email.toLowerCase().includes(q)));
    }
    if (status) {
      contacts = contacts.filter(c => c.status === status);
    }
    if (optedIn !== '') {
      const boolVal = optedIn === 'true' || optedIn === '1' ? 1 : 0;
      contacts = contacts.filter(c => Number(c.is_opted_in) === boolVal);
    }

    const total = contacts.length;
    const paginated = contacts.slice(offset, offset + Number(limit)).map(c => {
      // Find associated tags
      const contactTagIds = store.contact_tags.filter(ct => ct.contact_id === c.id).map(ct => ct.tag_id);
      const tags = store.tags.filter(t => contactTagIds.includes(t.id));
      return { ...c, tags };
    });

    return { contacts: paginated, pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } };
  }

  // Real MySQL execution with strict tenant scoping
  let whereClauses = ['c.business_id = ?'];
  let params = [businessId];

  if (search) {
    whereClauses.push('(c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)');
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  if (status) {
    whereClauses.push('c.status = ?');
    params.push(status);
  }

  if (optedIn !== '') {
    whereClauses.push('c.is_opted_in = ?');
    params.push(optedIn === 'true' || optedIn === '1' ? 1 : 0);
  }

  if (tag) {
    whereClauses.push('EXISTS (SELECT 1 FROM contact_tags ct JOIN tags t ON ct.tag_id = t.id WHERE ct.contact_id = c.id AND t.name = ?)');
    params.push(tag);
  }

  const whereSql = whereClauses.join(' AND ');

  const countResult = await executeQuery(`SELECT COUNT(*) as total FROM contacts c WHERE ${whereSql}`, params);
  const total = countResult[0]?.total || 0;

  const dataSql = `
    SELECT c.*, 
      COALESCE(
        (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', t.id, 'name', t.name, 'color', t.color))
         FROM contact_tags ct
         JOIN tags t ON ct.tag_id = t.id
         WHERE ct.contact_id = c.id),
        JSON_ARRAY()
      ) as tags
    FROM contacts c
    WHERE ${whereSql}
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `;
  params.push(Number(limit), offset);

  const contacts = await executeQuery(dataSql, params);

  return {
    contacts: contacts.map(c => ({
      ...c,
      tags: typeof c.tags === 'string' ? JSON.parse(c.tags) : (c.tags || [])
    })),
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit))
    }
  };
}

export async function createContact(businessId, { phone, name, email, countryCode = '91', tags = [], customFields = {}, consentProof = 'Manual creation by staff' }) {
  const norm = normalizePhone(phone, countryCode);
  if (!norm.isValid) {
    const error = new Error(`Invalid phone number format: ${norm.error}`);
    error.statusCode = 400;
    throw error;
  }

  const cleanPhone = norm.phone;

  // Check duplicate inside tenant
  const existing = await executeQuery('SELECT id, status, is_opted_in FROM contacts WHERE business_id = ? AND phone = ? LIMIT 1', [businessId, cleanPhone]);
  if (existing.length > 0) {
    const error = new Error(`Contact with phone ${cleanPhone} already exists in this workspace`);
    error.statusCode = 409;
    error.code = 'CONTACT_EXISTS';
    throw error;
  }

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const newId = store.contacts.length + 1;
    const newContact = {
      id: newId,
      business_id: Number(businessId),
      phone: cleanPhone,
      country_code: countryCode,
      name: name || null,
      email: email || null,
      is_opted_in: 1,
      status: 'active',
      custom_fields: customFields,
      created_at: new Date()
    };
    store.contacts.push(newContact);

    // Record consent
    store.contact_consents.push({
      id: store.contact_consents.length + 1,
      business_id: Number(businessId),
      contact_id: newId,
      consent_status: 'opted_in',
      consent_source: 'manual_entry',
      consent_category: 'promotional',
      proof_notes: consentProof,
      created_at: new Date()
    });

    return newContact;
  }

  const result = await executeQuery(
    `INSERT INTO contacts (business_id, phone, country_code, name, email, is_opted_in, status, custom_fields)
     VALUES (?, ?, ?, ?, ?, TRUE, 'active', ?)`,
    [businessId, cleanPhone, countryCode, name || null, email || null, JSON.stringify(customFields)]
  );
  const contactId = result.insertId;

  // Add auditable consent record
  await executeQuery(
    `INSERT INTO contact_consents (business_id, contact_id, consent_status, consent_source, consent_category, proof_notes)
     VALUES (?, ?, 'opted_in', 'manual_entry', 'promotional', ?)`,
    [businessId, contactId, consentProof]
  );

  return { id: contactId, phone: cleanPhone, name, email };
}

export async function updateConsent(businessId, contactId, { optedIn, reason = 'User request' }) {
  const contacts = await executeQuery('SELECT id, phone, is_opted_in FROM contacts WHERE business_id = ? AND id = ? LIMIT 1', [businessId, contactId]);
  if (contacts.length === 0) {
    const error = new Error('Contact not found');
    error.statusCode = 404;
    throw error;
  }

  const newStatus = optedIn ? 'active' : 'unsubscribed';

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const contact = store.contacts.find(c => c.id === Number(contactId) && c.business_id === Number(businessId));
    if (contact) {
      contact.is_opted_in = optedIn ? 1 : 0;
      contact.status = newStatus;
    }
    store.contact_consents.push({
      id: store.contact_consents.length + 1,
      business_id: Number(businessId),
      contact_id: Number(contactId),
      consent_status: optedIn ? 'opted_in' : 'opted_out',
      consent_source: 'dashboard_override',
      proof_notes: reason,
      withdrawn_at: optedIn ? null : new Date(),
      created_at: new Date()
    });
    return { contactId, is_opted_in: contact.is_opted_in, status: newStatus };
  }

  await executeQuery(
    'UPDATE contacts SET is_opted_in = ?, status = ? WHERE business_id = ? AND id = ?',
    [optedIn ? 1 : 0, newStatus, businessId, contactId]
  );

  await executeQuery(
    `INSERT INTO contact_consents (business_id, contact_id, consent_status, consent_source, consent_category, proof_notes, withdrawn_at)
     VALUES (?, ?, ?, 'dashboard_override', 'promotional', ?, ?)`,
    [businessId, contactId, optedIn ? 'opted_in' : 'opted_out', reason, optedIn ? null : new Date()]
  );

  return { contactId, is_opted_in: optedIn, status: newStatus };
}

export async function deleteContact(businessId, contactId) {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    store.contacts = store.contacts.filter(c => !(c.id === Number(contactId) && c.business_id === Number(businessId)));
    return { success: true };
  }

  await executeQuery('DELETE FROM contacts WHERE business_id = ? AND id = ?', [businessId, contactId]);
  return { success: true };
}

export async function listTags(businessId) {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    return store.tags.filter(t => t.business_id === Number(businessId));
  }
  return executeQuery('SELECT * FROM tags WHERE business_id = ? ORDER BY name ASC', [businessId]);
}

export default {
  listContacts,
  createContact,
  updateConsent,
  deleteContact,
  listTags
};
