process.env.NODE_ENV = 'test';
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { checkConnection } from '../src/database/db.js';
import * as whatsappService from '../src/modules/whatsapp/whatsapp.service.js';
import * as webhooksService from '../src/modules/webhooks/webhooks.service.js';
import * as inboxService from '../src/modules/inbox/inbox.service.js';
import * as adminService from '../src/modules/admin/admin.service.js';
import { decryptToken } from '../src/utils/crypto.js';

describe('Multi-Tenant WhatsApp SaaS Architecture Test Suite', () => {
  const TENANT_A = 101;
  const TENANT_B = 102;

  let tenantA_Account1 = null;
  let tenantA_Account2 = null;
  let tenantB_Account1 = null;

  before(async () => {
    await checkConnection();
  });

  it('1. Tenant A Onboarding: Connects primary official WABA and Phone Number', async () => {
    const account = await whatsappService.completeEmbeddedSignup(TENANT_A, {
      code: `mock_oauth_code_tenant_a_1_${Date.now()}`,
      wabaId: 'waba_tenant_a_primary',
      phoneNumberId: 'phone_id_tenant_a_1',
      businessName: 'Tenant A Enterprise'
    });

    assert.ok(account.id);
    assert.equal(account.waba_id, 'waba_tenant_a_primary');
    assert.equal(account.phone_number_id, 'phone_id_tenant_a_1');
    assert.equal(account.business_id, TENANT_A);
    // Token must be stripped in public return
    assert.equal(account.access_token_encrypted, undefined);

    tenantA_Account1 = account;
  });

  it('2. Tenant B Onboarding: Connects independent WABA and Phone Number under separate tenant', async () => {
    const account = await whatsappService.completeEmbeddedSignup(TENANT_B, {
      code: `mock_oauth_code_tenant_b_1_${Date.now()}`,
      wabaId: 'waba_tenant_b_independent',
      phoneNumberId: 'phone_id_tenant_b_1',
      businessName: 'Tenant B Logistics'
    });

    assert.ok(account.id);
    assert.equal(account.waba_id, 'waba_tenant_b_independent');
    assert.equal(account.phone_number_id, 'phone_id_tenant_b_1');
    assert.equal(account.business_id, TENANT_B);
    assert.notEqual(account.waba_id, tenantA_Account1.waba_id);

    tenantB_Account1 = account;
  });

  it('3. Multiple WhatsApp Accounts Per Tenant: Tenant A connects second phone number', async () => {
    const account = await whatsappService.completeEmbeddedSignup(TENANT_A, {
      code: `mock_oauth_code_tenant_a_2_${Date.now()}`,
      wabaId: 'waba_tenant_a_primary',
      phoneNumberId: 'phone_id_tenant_a_2',
      businessName: 'Tenant A Support Desk'
    });

    assert.ok(account.id);
    assert.equal(account.phone_number_id, 'phone_id_tenant_a_2');
    tenantA_Account2 = account;

    // Fetch accounts for Tenant A
    const accountsA = await whatsappService.listAccounts(TENANT_A);
    assert.ok(accountsA.length >= 2, 'Tenant A should have at least 2 connected accounts');
    const ids = accountsA.map(a => a.phone_number_id);
    assert.ok(ids.includes('phone_id_tenant_a_1'));
    assert.ok(ids.includes('phone_id_tenant_a_2'));

    // Tenant B must not see Tenant A accounts
    const accountsB = await whatsappService.listAccounts(TENANT_B);
    const idsB = accountsB.map(a => a.phone_number_id);
    assert.ok(!idsB.includes('phone_id_tenant_a_1'));
    assert.ok(!idsB.includes('phone_id_tenant_a_2'));
  });

  it('4. Credential Isolation: Token decryption and tenant credential validation', async () => {
    // Tenant A retrieving internal credential
    const internalA = await whatsappService.getAccountWithCredentials(TENANT_A, tenantA_Account1.id);
    assert.ok(internalA.decryptedToken, 'Must decrypt token internally for outbound sending');
    assert.ok(internalA.decryptedToken.startsWith('mock_token_') || internalA.decryptedToken.startsWith('EAAMockToken_') || internalA.decryptedToken.length > 10);

    // Tenant B attempting to retrieve Tenant A account must fail with 404
    await assert.rejects(
      async () => {
        await whatsappService.getAccountWithCredentials(TENANT_B, tenantA_Account1.id);
      },
      (err) => {
        assert.equal(err.statusCode, 404);
        return true;
      }
    );
  });

  it('5. Account-Aware Webhook Routing: Routes inbound message to correct tenant by Phone Number ID', async () => {
    const inboundMessagePayload = {
      object: 'whatsapp_business_account',
      entry: [{
        id: tenantB_Account1.waba_id,
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '+919876543210',
              phone_number_id: tenantB_Account1.phone_number_id
            },
            contacts: [{ profile: { name: 'Tenant B Customer' }, wa_id: '919111222333' }],
            messages: [{
              from: '919111222333',
              id: `wamid_multitenant_${Date.now()}`,
              timestamp: `${Math.floor(Date.now() / 1000)}`,
              text: { body: 'Hello Tenant B specific business' },
              type: 'text'
            }]
          },
          field: 'messages'
        }]
      }]
    };

    const processRes = await webhooksService.processWebhookPayload(inboundMessagePayload);
    assert.equal(processRes.processed, true);

    // Verify conversation was stored under Tenant B, NOT Tenant A
    const listResB = await inboxService.listConversations(TENANT_B, { id: 1, role: 'admin' }, {});
    const matchB = listResB.items.find(c => c.customer_phone === '+919111222333' || c.customer_phone === '919111222333');
    assert.ok(matchB, 'Conversation must be assigned to Tenant B');
    assert.equal(matchB.business_id, TENANT_B);
    assert.equal(matchB.whatsapp_account_id, tenantB_Account1.id);

    const listResA = await inboxService.listConversations(TENANT_A, { id: 1, role: 'admin' }, {});
    const matchA = listResA.items.find(c => c.customer_phone === '+919111222333' || c.customer_phone === '919111222333');
    assert.equal(matchA, undefined, 'Tenant A must NOT see Tenant B customer conversations');
  });

  it('6. Inbox Multi-Account Filtering: Filters conversations by specific WhatsApp account ID', async () => {
    const listAll = await inboxService.listConversations(TENANT_B, { id: 1, role: 'admin' }, { accountId: 'all' });
    const listSpecific = await inboxService.listConversations(TENANT_B, { id: 1, role: 'admin' }, { accountId: tenantB_Account1.id });
    const listWrong = await inboxService.listConversations(TENANT_B, { id: 1, role: 'admin' }, { accountId: 99999 });

    assert.ok(listAll.items.length > 0);
    assert.ok(listSpecific.items.length > 0);
    assert.equal(listWrong.items.length, 0);
  });

  it('7. Template Multi-Tenant Isolation: Templates are isolated per tenant and WABA', async () => {
    // Create template under Tenant A's account
    const tplA = await whatsappService.createTemplate(TENANT_A, 1, {
      name: `tenant_a_tpl_${Date.now()}`,
      category: 'MARKETING',
      language: 'en_US',
      accountId: tenantA_Account1.id,
      body: { text: 'Exclusive message from Tenant A' }
    });

    assert.equal(tplA.business_id, TENANT_A);
    assert.equal(tplA.whatsapp_account_id, tenantA_Account1.id);

    // Tenant B cannot see Tenant A templates
    const listB = await whatsappService.listTemplates(TENANT_B);
    const foundInB = listB.templates.find(t => t.id === tplA.id);
    assert.equal(foundInB, undefined, 'Tenant B must not see Tenant A template');

    // Tenant B cannot delete Tenant A template
    await assert.rejects(
      async () => {
        await whatsappService.deleteTemplate(TENANT_B, tplA.id);
      },
      (err) => {
        assert.equal(err.statusCode, 404);
        return true;
      }
    );
  });

  it('8. Super Admin WhatsApp Overview: Lists all tenant accounts without leaking tokens', async () => {
    const dashboardMetrics = await adminService.getSuperAdminDashboard();
    assert.ok(dashboardMetrics.totalWABAs >= 1, 'Metrics must track total WABAs across tenants');
    assert.ok(dashboardMetrics.totalPhoneNumbers >= 1, 'Metrics must track total phone numbers');

    const accountsList = await adminService.listAllWhatsAppAccounts();
    assert.ok(accountsList.length >= 1);

    // Verify token isolation in Super Admin output
    accountsList.forEach(acc => {
      assert.equal(acc.access_token_encrypted, undefined, 'Super Admin API must never expose access tokens');
      assert.ok(acc.id);
      assert.ok(acc.business_id);
    });
  });
});
