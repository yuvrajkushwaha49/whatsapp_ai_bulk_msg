process.env.NODE_ENV = 'test';
import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { checkConnection, getMemoryStore } from '../src/database/db.js';
import * as metaSetupService from '../src/modules/whatsapp/metaSetup.service.js';
import * as whatsappService from '../src/modules/whatsapp/whatsapp.service.js';
import { decryptToken } from '../src/utils/crypto.js';

describe('Meta Developer Setup Wizard & Multi-Mode Integration Suite', () => {
  const TEST_TENANT = 7000 + Math.floor(Math.random() * 1000);

  before(async () => {
    await checkConnection();
  });

  test('1. Wizard Status: Returns default Mode A (platform_managed) and prerequisites checklist', async () => {
    const status = await metaSetupService.getSetupStatus(TEST_TENANT);

    assert.strictEqual(status.integrationMode, 'platform_managed');
    assert.strictEqual(status.setupStep, 1);
    assert.ok(Array.isArray(status.prerequisites));
    assert.strictEqual(status.prerequisites.length, 4);

    const checklistIds = status.prerequisites.map(p => p.id);
    assert.ok(checklistIds.includes('facebook_account'));
    assert.ok(checklistIds.includes('meta_business_portfolio'));
    assert.ok(checklistIds.includes('waba'));
    assert.ok(checklistIds.includes('phone_number'));

    for (const item of status.prerequisites) {
      assert.ok(item.title, 'Prerequisite must have title');
      assert.ok(item.whyRequired, 'Prerequisite must explain why it is required');
      assert.ok(item.howToCheck, 'Prerequisite must explain how to check');
      assert.ok(item.docsUrl.startsWith('https://'), 'Prerequisite must provide official Meta link');
    }
  });

  test('2. Mode Selection: Switches between Mode A and Mode B cleanly', async () => {
    // Select Mode B: Client Owned
    const resB = await metaSetupService.saveSetupMode(TEST_TENANT, 'client_owned', 2);
    assert.strictEqual(resB.success, true);
    assert.strictEqual(resB.mode, 'client_owned');

    let status = await metaSetupService.getSetupStatus(TEST_TENANT);
    assert.strictEqual(status.integrationMode, 'client_owned');

    // Switch back to Mode A: Platform Managed
    const resA = await metaSetupService.saveSetupMode(TEST_TENANT, 'platform_managed', 1);
    assert.strictEqual(resA.success, true);
    assert.strictEqual(resA.mode, 'platform_managed');

    status = await metaSetupService.getSetupStatus(TEST_TENANT);
    assert.strictEqual(status.integrationMode, 'platform_managed');
  });

  test('3. Advanced Configuration: Rejects invalid App IDs and securely encrypts secret at rest', async () => {
    // Invalid App ID check
    await assert.rejects(
      async () => {
        await metaSetupService.saveAdvancedConfig(TEST_TENANT, {
          appId: 'invalid_alpha_id',
          appSecret: 'test_secret_123'
        });
      },
      /A valid numeric Meta App ID is required/
    );

    // Valid save
    const validConfig = await metaSetupService.saveAdvancedConfig(TEST_TENANT, {
      appId: '987654321098765',
      appSecret: 'meta_secret_abcdef1234567890',
      configId: 'config_embedded_999'
    });

    assert.strictEqual(validConfig.success, true);
    assert.strictEqual(validConfig.appId, '987654321098765');
    assert.strictEqual(validConfig.hasSecret, true);

    // Verify stored integration record
    const status = await metaSetupService.getSetupStatus(TEST_TENANT);
    assert.strictEqual(status.clientApp.appId, '987654321098765');
    assert.strictEqual(status.clientApp.configId, 'config_embedded_999');
    assert.strictEqual(status.clientApp.hasSecret, true);
    // CRITICAL: Stored secret must not be exposed in status payload
    assert.strictEqual(status.clientApp.appSecret, undefined);

    // Verify encryption at rest in store
    const store = getMemoryStore();
    const record = store.tenant_meta_integrations.find(i => i.business_id === TEST_TENANT);
    assert.ok(record.encrypted_meta_app_secret);
    assert.notStrictEqual(record.encrypted_meta_app_secret, 'meta_secret_abcdef1234567890');
    assert.strictEqual(decryptToken(record.encrypted_meta_app_secret), 'meta_secret_abcdef1234567890');
  });

  test('4. Setup Validation: Validates Platform mode and Client-owned configuration', async () => {
    // Mode A validation
    await metaSetupService.saveSetupMode(TEST_TENANT, 'platform_managed', 1);
    const platformVal = await metaSetupService.validateSetup(TEST_TENANT);
    assert.strictEqual(platformVal.success, true);
    assert.strictEqual(platformVal.mode, 'platform_managed');
    assert.strictEqual(platformVal.isValid, true);

    // Switch to client_owned
    await metaSetupService.saveSetupMode(TEST_TENANT, 'client_owned', 5);
    const clientVal = await metaSetupService.validateSetup(TEST_TENANT);
    assert.strictEqual(clientVal.mode, 'client_owned');
    assert.strictEqual(typeof clientVal.isValid, 'boolean');
  });

  test('5. Initiate Signup: Formats official OAuth URL without unauthorized scopes', async () => {
    const signup = await metaSetupService.initiateSignup(TEST_TENANT, 'http://localhost:5173');
    assert.strictEqual(signup.success, true);
    assert.ok(signup.oauthUrl);
    assert.ok(signup.oauthUrl.includes('response_type=code'));
    // Ensure scopes only request allowed Cloud API scopes and never unauthorized scopes
    const scopeList = signup.scopes.split(',');
    assert.ok(scopeList.includes('whatsapp_business_management'));
    assert.ok(scopeList.includes('whatsapp_business_messaging'));
    assert.strictEqual(scopeList.includes('business_management'), false);
    assert.ok(!signup.oauthUrl.includes('scope=business_management,'));
  });

  test('6. Embedded Signup Completion via Multi-Step flow saves account with accurate statuses', async () => {
    const mockCode = `mock_wizard_code_${Date.now()}`;
    const account = await whatsappService.completeEmbeddedSignup(TEST_TENANT, {
      code: mockCode,
      wabaId: 'waba_wizard_505',
      phoneNumberId: 'phone_wizard_505',
      businessName: 'Wizard Tested Business Ltd'
    });

    assert.ok(account.id);
    assert.strictEqual(account.connection_status, 'CONNECTED');
    assert.strictEqual(account.status, 'connected');
    assert.strictEqual(account.waba_id, 'waba_wizard_505');
    assert.strictEqual(account.phone_number_id, 'phone_wizard_505');

    const statusAfter = await metaSetupService.getSetupStatus(TEST_TENANT);
    assert.strictEqual(statusAfter.hasConnectedAccount, true);
    assert.strictEqual(statusAfter.primaryAccount.waba_id, 'waba_wizard_505');
  });

  test('7. In-Software Meta Test Messenger: Dispatches test WhatsApp message and returns Meta message ID', async () => {
    const accounts = await whatsappService.listAccounts(TEST_TENANT);
    assert.ok(accounts.length > 0, 'Should have at least one connected account');
    const primaryAcc = accounts[0];

    const testRes = await whatsappService.sendTestMessage(TEST_TENANT, primaryAcc.id, {
      recipientPhone: '918601467210',
      messageType: 'template',
      templateName: 'hello_world'
    });

    assert.strictEqual(testRes.success, true);
    assert.ok(testRes.messageId);
    assert.strictEqual(testRes.recipientPhone, '918601467210');
    assert.strictEqual(testRes.messageType, 'template');
  });

  test('8. Webhook Health & Readiness Ping: Returns active webhook config and token', async () => {
    const ping = await whatsappService.testWebhookPing(TEST_TENANT);
    assert.strictEqual(ping.success, true);
    assert.strictEqual(ping.status, 'ACTIVE');
    assert.ok(ping.webhookUrl.includes('/api/webhooks/whatsapp'));
    assert.ok(ping.verifyToken);
  });
});
