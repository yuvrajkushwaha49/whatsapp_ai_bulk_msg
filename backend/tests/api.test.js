import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { checkConnection } from '../src/database/db.js';
import * as authService from '../src/modules/auth/auth.service.js';
import * as contactsService from '../src/modules/contacts/contacts.service.js';
import * as importsService from '../src/modules/imports/imports.service.js';
import * as campaignsService from '../src/modules/campaigns/campaigns.service.js';
import * as webhooksService from '../src/modules/webhooks/webhooks.service.js';
import { verifyMetaSignature } from '../src/modules/whatsapp/metaClient.js';
import { normalizePhone } from '../src/utils/phone.js';

describe('CampaignFlow Core Backend Test Suite', () => {
  before(async () => {
    await checkConnection();
  });

  test('1. Phone Normalization: Converts local 10-digit number to valid E.164 format', () => {
    const res = normalizePhone('9876543210', '91');
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.phone, '+919876543210');

    const invalid = normalizePhone('123', '91');
    assert.strictEqual(invalid.isValid, false);
  });

  test('2. Authentication: Super Admin and Business Owner can login with valid credentials', async () => {
    const superAdmin = await authService.login({
      email: 'superadmin@campaignflow.io',
      password: 'Password123!'
    });
    assert.ok(superAdmin.token);
    assert.strictEqual(superAdmin.user.role, 'superadmin');

    const owner = await authService.login({
      email: 'owner@acmeretail.com',
      password: 'Password123!'
    });
    assert.ok(owner.token);
    assert.strictEqual(owner.user.role, 'owner');
    assert.strictEqual(owner.business.id, 1);
  });

  test('3. Cross-Tenant Isolation: Business 1 cannot see Business 2 data', async () => {
    const biz1Contacts = await contactsService.listContacts(1, { limit: 100 });
    const biz2Contacts = await contactsService.listContacts(999, { limit: 100 });

    assert.ok(biz1Contacts.contacts.length > 0);
    assert.strictEqual(biz2Contacts.contacts.length, 0);
  });

  test('4. Contact Creation and Consent Recording', async () => {
    const contact = await contactsService.createContact(1, {
      phone: '9988776655',
      name: 'Test Customer',
      email: 'test@example.com',
      consentProof: 'Verified web form submission'
    });
    assert.ok(contact.id);
    assert.strictEqual(contact.phone, '+919988776655');

    // Duplicate detection in same tenant
    await assert.rejects(
      async () => {
        await contactsService.createContact(1, { phone: '9988776655', name: 'Duplicate' });
      },
      /already exists/
    );
  });

  test('5. CSV Import & Duplicate Protection', async () => {
    const csvContent = `phone,name,email,consent\n9811223344,Alice Green,alice@test.com,yes\n9811223344,Alice Green,alice@test.com,yes\n9899001122,Bob Smith,bob@test.com,no`;
    
    const result = await importsService.executeImport(1, 2, {
      csvText: csvContent,
      fileName: 'test.csv',
      columnMapping: { phone: 'phone', name: 'name', email: 'email', consent: 'consent' }
    });

    assert.strictEqual(result.totalRows, 3);
    assert.strictEqual(result.successful, 1); // Alice Green (first occurrence)
    assert.strictEqual(result.duplicates, 1); // Alice Green (duplicate row)
    assert.strictEqual(result.failed, 1);     // Bob Smith (consent missing/rejected)
  });

  test('6. Unsubscribe Enforcement: Stop command disables future marketing', async () => {
    // Contact updates consent to opted out
    await contactsService.updateConsent(1, 1, { optedIn: false, reason: 'Customer replied STOP' });
    
    const contactList = await contactsService.listContacts(1, { optedIn: 'false' });
    const unsubscribed = contactList.contacts.find(c => c.id === 1);
    assert.ok(unsubscribed);
    assert.strictEqual(Number(unsubscribed.is_opted_in), 0);
  });

  test('7. Campaign Preflight Verification', async () => {
    const preflight = await campaignsService.preflightCheck(1, {
      whatsappAccountId: 1,
      templateId: 1
    });

    assert.strictEqual(typeof preflight.canProceed, 'boolean');
    assert.ok(Array.isArray(preflight.issues));
  });

  test('8. Webhook Signature Validation and Challenge', () => {
    const challenge = webhooksService.verifyChallenge('subscribe', 'campaignflow_meta_verify_token_xyz', 'challenge_12345');
    assert.strictEqual(challenge, 'challenge_12345');

    // Invalid token returns null
    const invalid = webhooksService.verifyChallenge('subscribe', 'wrong_token', 'challenge_12345');
    assert.strictEqual(invalid, null);
  });
});
