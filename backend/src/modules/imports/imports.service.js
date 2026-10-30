import { executeQuery, isUsingFallback, getMemoryStore } from '../../database/db.js';
import { normalizePhone } from '../../utils/phone.js';

/**
 * Parse CSV raw text into rows
 */
export function parseCsvText(csvText) {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line) => {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const headers = parseLine(lines[0]).map(h => h.replace(/^"|"$/g, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const rowObj = {};
    headers.forEach((h, idx) => {
      rowObj[h] = values[idx] !== undefined ? values[idx] : '';
    });
    rows.push(rowObj);
  }

  return { headers, rows };
}

/**
 * Preview CSV with header detection & sample rows
 */
export async function previewCsv(csvText) {
  const { headers, rows } = parseCsvText(csvText);
  const sample = rows.slice(0, 5);

  // Suggest mappings
  const mappingSuggestions = {};
  headers.forEach(h => {
    const lower = h.toLowerCase();
    if (lower.includes('phone') || lower.includes('mobile') || lower.includes('whatsapp') || lower.includes('number')) {
      mappingSuggestions.phone = h;
    } else if (lower.includes('name') || lower.includes('full name') || lower.includes('customer')) {
      mappingSuggestions.name = h;
    } else if (lower.includes('email')) {
      mappingSuggestions.email = h;
    } else if (lower.includes('tag')) {
      mappingSuggestions.tag = h;
    } else if (lower.includes('consent') || lower.includes('optin')) {
      mappingSuggestions.consent = h;
    }
  });

  return {
    headers,
    totalRows: rows.length,
    sample,
    mappingSuggestions
  };
}

/**
 * Execute CSV Import Job with row-level validation and consent protection
 */
export async function executeImport(businessId, userId, { csvText, fileName = 'contacts.csv', columnMapping, consentSource = 'csv_verified_records', defaultCountryCode = '91' }) {
  const { headers, rows } = parseCsvText(csvText);

  const phoneCol = columnMapping.phone;
  const nameCol = columnMapping.name;
  const emailCol = columnMapping.email;
  const tagCol = columnMapping.tag;
  const consentCol = columnMapping.consent;

  if (!phoneCol) {
    const error = new Error('Phone column mapping is required');
    error.statusCode = 400;
    throw error;
  }

  // Create Import Job Record
  let jobId = Date.now();
  if (isUsingFallback()) {
    const store = getMemoryStore();
    jobId = store.import_jobs.length + 1;
    store.import_jobs.push({
      id: jobId,
      business_id: Number(businessId),
      user_id: Number(userId),
      file_name: fileName,
      file_size: csvText.length,
      total_rows: rows.length,
      processed_rows: 0,
      successful_rows: 0,
      failed_rows: 0,
      duplicate_rows: 0,
      status: 'processing',
      created_at: new Date()
    });
  } else {
    const jobRes = await executeQuery(
      `INSERT INTO import_jobs (business_id, user_id, file_name, file_size, total_rows, status)
       VALUES (?, ?, ?, ?, ?, 'processing')`,
      [businessId, userId, fileName, csvText.length, rows.length]
    );
    jobId = jobRes.insertId;
  }

  const seenPhonesInFile = new Set();
  let successful = 0;
  let failed = 0;
  let duplicates = 0;
  const contactIds = [];
  const rowReports = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1;
    const row = rows[i];
    const rawPhone = row[phoneCol];
    const name = nameCol ? row[nameCol] : null;
    const email = emailCol ? row[emailCol] : null;
    const tag = tagCol ? row[tagCol] : null;
    const rowConsentRaw = consentCol ? String(row[consentCol]).toLowerCase().trim() : 'yes';

    // 1. Phone validation
    const norm = normalizePhone(rawPhone, defaultCountryCode);
    if (!norm.isValid) {
      failed++;
      rowReports.push({ row_number: rowNum, phone: rawPhone, status: 'failed', error_reason: norm.error });
      continue;
    }

    const phone = norm.phone;

    // 2. Intra-file duplicate check
    if (seenPhonesInFile.has(phone)) {
      duplicates++;
      rowReports.push({ row_number: rowNum, phone, status: 'skipped', error_reason: 'Duplicate phone within the same CSV file' });
      continue;
    }
    seenPhonesInFile.add(phone);

    // 3. Database lookup for tenant
    const existingContacts = await executeQuery(
      'SELECT id, status, is_opted_in FROM contacts WHERE business_id = ? AND phone = ? LIMIT 1',
      [businessId, phone]
    );

    if (existingContacts && existingContacts.length > 0) {
      const existing = existingContacts[0];
      // CRITICAL COMPLIANCE RULE: If previously unsubscribed, NEVER auto-resubscribe
      if (existing.status === 'unsubscribed' || Number(existing.is_opted_in) === 0) {
        duplicates++;
        rowReports.push({
          row_number: rowNum,
          phone,
          status: 'skipped',
          error_reason: 'Contact previously unsubscribed / opted out. Preserving unsubscribe preference.'
        });
        continue;
      }

      // Existing contact active: update name/email if provided
      if (isUsingFallback()) {
        const store = getMemoryStore();
        const c = store.contacts.find(x => x.id === existing.id);
        if (c) {
          if (name) c.name = name;
          if (email) c.email = email;
        }
      } else {
        await executeQuery(
          'UPDATE contacts SET name = COALESCE(?, name), email = COALESCE(?, email) WHERE id = ?',
          [name, email, existing.id]
        );
      }

      successful++;
      contactIds.push(Number(existing.id));
      rowReports.push({ row_number: rowNum, phone, status: 'imported', error_reason: 'Existing contact updated' });
      continue;
    }

    // 4. Verify explicit consent from CSV record
    const hasConsent = rowConsentRaw === 'yes' || rowConsentRaw === 'true' || rowConsentRaw === '1' || rowConsentRaw === 'opted_in';
    if (!hasConsent) {
      // Ineligible contact due to missing consent
      failed++;
      rowReports.push({
        row_number: rowNum,
        phone,
        status: 'failed',
        error_reason: 'Consent record missing or rejected in CSV (must be explicitly opted in).'
      });
      continue;
    }

    // 5. Insert new contact and record verifiable consent
    let insertedContactId;
    if (isUsingFallback()) {
      const store = getMemoryStore();
      const newContactId = store.contacts.length + 1;
      insertedContactId = newContactId;
      store.contacts.push({
        id: newContactId,
        business_id: Number(businessId),
        phone,
        country_code: defaultCountryCode,
        name: name || null,
        email: email || null,
        is_opted_in: 1,
        status: 'active',
        custom_fields: {},
        created_at: new Date()
      });

      store.contact_consents.push({
        id: store.contact_consents.length + 1,
        business_id: Number(businessId),
        contact_id: newContactId,
        consent_status: 'opted_in',
        consent_source: consentSource,
        consent_category: 'promotional',
        proof_notes: `CSV file: ${fileName}, Row #${rowNum}`,
        created_at: new Date()
      });

      // Handle tag
      if (tag) {
        let tagRecord = store.tags.find(t => t.business_id === Number(businessId) && t.name.toLowerCase() === tag.toLowerCase());
        if (!tagRecord) {
          tagRecord = { id: store.tags.length + 1, business_id: Number(businessId), name: tag, color: '#0d6efd', created_at: new Date() };
          store.tags.push(tagRecord);
        }
        store.contact_tags.push({ id: store.contact_tags.length + 1, business_id: Number(businessId), contact_id: newContactId, tag_id: tagRecord.id });
      }
    } else {
      const insertRes = await executeQuery(
        `INSERT INTO contacts (business_id, phone, country_code, name, email, is_opted_in, status)
         VALUES (?, ?, ?, ?, ?, TRUE, 'active')`,
        [businessId, phone, defaultCountryCode, name || null, email || null]
      );
      const contactId = insertRes.insertId;
      insertedContactId = contactId;

      await executeQuery(
        `INSERT INTO contact_consents (business_id, contact_id, consent_status, consent_source, consent_category, proof_notes)
         VALUES (?, ?, 'opted_in', ?, 'promotional', ?)`,
        [businessId, contactId, consentSource, `Import file: ${fileName}, Row ${rowNum}`]
      );

      if (tag) {
        let tagRows = await executeQuery('SELECT id FROM tags WHERE business_id = ? AND name = ? LIMIT 1', [businessId, tag]);
        let tagId;
        if (tagRows.length === 0) {
          const tRes = await executeQuery('INSERT INTO tags (business_id, name) VALUES (?, ?)', [businessId, tag]);
          tagId = tRes.insertId;
        } else {
          tagId = tagRows[0].id;
        }
        await executeQuery('INSERT IGNORE INTO contact_tags (business_id, contact_id, tag_id) VALUES (?, ?, ?)', [businessId, contactId, tagId]);
      }
    }

    successful++;
    contactIds.push(Number(insertedContactId));
    rowReports.push({ row_number: rowNum, phone, status: 'imported', error_reason: null });
  }

  // Update Job Summary
  if (isUsingFallback()) {
    const store = getMemoryStore();
    const job = store.import_jobs.find(j => j.id === jobId);
    if (job) {
      job.processed_rows = rows.length;
      job.successful_rows = successful;
      job.failed_rows = failed;
      job.duplicate_rows = duplicates;
      job.status = 'completed';
      job.error_summary = `${successful} imported, ${duplicates} duplicates skipped, ${failed} failed`;
    }
  } else {
    await executeQuery(
      `UPDATE import_jobs 
       SET processed_rows = ?, successful_rows = ?, failed_rows = ?, duplicate_rows = ?, status = 'completed', error_summary = ?
       WHERE id = ?`,
      [rows.length, successful, failed, duplicates, `${successful} imported, ${duplicates} duplicates skipped, ${failed} failed`, jobId]
    );

    // Save row-level error reports (for failed or skipped)
    for (const rep of rowReports.filter(r => r.status !== 'imported').slice(0, 100)) {
      await executeQuery(
        'INSERT INTO import_rows (job_id, row_number, phone, status, error_reason) VALUES (?, ?, ?, ?, ?)',
        [jobId, rep.row_number, rep.phone || '', rep.status, rep.error_reason]
      );
    }
  }

  return {
    jobId,
    totalRows: rows.length,
    successful,
    failed,
    duplicates,
    status: 'completed',
    contactIds,
    rowReports: rowReports.filter(r => r.status !== 'imported')
  };
}

export async function listImportJobs(businessId) {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    return store.import_jobs.filter(j => j.business_id === Number(businessId)).sort((a, b) => b.id - a.id);
  }
  return executeQuery('SELECT * FROM import_jobs WHERE business_id = ? ORDER BY created_at DESC', [businessId]);
}

export async function getImportErrors(businessId, jobId) {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    return store.import_rows.filter(r => r.job_id === Number(jobId) && r.status !== 'imported');
  }
  return executeQuery(
    `SELECT ir.* FROM import_rows ir
     JOIN import_jobs ij ON ir.job_id = ij.id
     WHERE ij.business_id = ? AND ij.id = ?
     ORDER BY ir.row_number ASC`,
    [businessId, jobId]
  );
}

export default {
  previewCsv,
  executeImport,
  listImportJobs,
  getImportErrors
};
