process.env.NODE_ENV = 'test';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { checkConnection, getMemoryStore, executeQuery, isUsingFallback } from '../src/database/db.js';
import * as platformMetaService from '../src/modules/admin/platformMeta.service.js';
import * as metaSetupService from '../src/modules/whatsapp/metaSetup.service.js';
import * as whatsappService from '../src/modules/whatsapp/whatsapp.service.js';
import { encryptToken, decryptToken } from '../src/utils/crypto.js';

describe('AiSensy-Style WhatsApp SaaS Onboarding & Platform Architecture Suite', () => {
  let initialSecret = null;

  before(async () => {
    await checkConnection();
    if (!isUsingFallback()) {
      try {
        const rows = await executeQuery('SELECT encrypted_meta_app_secret FROM platform_meta_configs WHERE id = 1');
        if (rows?.[0]?.encrypted_meta_app_secret) initialSecret = rows[0].encrypted_meta_app_secret;

        await executeQuery(`
          INSERT INTO businesses (id, name, slug, timezone, status, created_at, updated_at)
          VALUES 
            (1, 'Acme Retail Tenant 1', 'acme-retail-1', 'UTC', 'active', NOW(), NOW()),
            (2, 'Client B Healthcare Tenant 2', 'client-b-healthcare-2', 'UTC', 'active', NOW(), NOW())
          ON DUPLICATE KEY UPDATE name = VALUES(name)
        `);
      } catch (e) {
        // Continue if already exists or constraint handles it
      }
    }
  });

  test('1. Super Admin: Save & Encrypt Platform Meta Developer App Configuration', async () => {
    const platformConfig = {
      metaAppId: '1165054629187576',
      metaAppSecret: 'sec_test_platform_secret_1234567890abcdef',
      embeddedSignupConfigId: '887766554433221',
      graphApiVersion: 'v21.0',
      webhookVerifyToken: 'campaignflow_secure_webhook_token_2026',
      isEnabled: true
    };

    const saved = await platformMetaService.savePlatformMetaConfig(platformConfig, 1);
    assert.strictEqual(saved.metaAppId, '1165054629187576', 'Platform Meta App ID must match');
    assert.strictEqual(saved.embeddedSignupConfigId, '887766554433221');
    assert.strictEqual(saved.graphApiVersion, 'v21.0');
    assert.strictEqual(saved.readinessStatus, 'ready');

    // SECURITY CHECK: Secret must NEVER be returned in plaintext
    assert.strictEqual(saved.metaAppSecret, undefined, 'Plaintext secret must not be returned');
    assert.ok(saved.appSecretMasked.includes('••••'), 'Secret must be masked');
  });

  test('2. Super Admin: Test Platform Meta Connection', async () => {
    const testResult = await platformMetaService.testPlatformMetaConfig();
    assert.strictEqual(testResult.success, true);
    assert.strictEqual(testResult.isValid, true);
    assert.ok(testResult.message.includes('verified'), 'Verification message must confirm connection');
  });

  test('3. Client Experience: Client-Safe Readiness Check (No Secrets Leaked)', async () => {
    const clientReadiness = await metaSetupService.checkClientReadiness(1);
    assert.strictEqual(clientReadiness.isReady, true);
    assert.ok(clientReadiness.appId, 'App ID should be provided for Facebook Login SDK');
    // Ensure sensitive platform credentials are not exposed
    assert.strictEqual(clientReadiness.appSecret, undefined);
    assert.strictEqual(clientReadiness.encrypted_meta_app_secret, undefined);
  });

  test('4. CSRF Protection: Generate and Track Onboarding Session State', async () => {
    const initData = await metaSetupService.initiateSignup(1, 'https://whatsapp.bhaktisong.fun');
    assert.ok(initData.appId, 'Platform App ID must be present');
    assert.ok(initData.state, 'CSRF state token must be generated');
    assert.strictEqual(initData.state.length, 48, 'State token must be 24-byte hex string');
    assert.ok(initData.mode, 'Integration mode must be returned');

    // Verify session was recorded in database / memory store
    const isValid = await metaSetupService.validateOnboardingSession(1, initData.state);
    assert.strictEqual(isValid, true, 'State token must be validated successfully');

    // Tampered state or wrong tenant must fail
    await assert.rejects(
      async () => {
        await metaSetupService.validateOnboardingSession(2, initData.state);
      },
      /Invalid or expired Meta onboarding session/
    );
  });

  test('5. Multi-Tenant Onboarding: Client A Connects WABA A & Number A', async () => {
    const tenantAId = 1;
    const mockCodeA = `mock_oauth_code_tenantA_${Date.now()}`;
    const accountA = await whatsappService.completeEmbeddedSignup(tenantAId, {
      code: mockCodeA,
      wabaId: '100000000000001',
      phoneNumberId: '200000000000001',
      businessName: 'Client A Retail'
    });

    assert.ok(accountA.id);
    assert.strictEqual(accountA.business_id, tenantAId);
    assert.strictEqual(accountA.waba_id, '100000000000001');
    assert.strictEqual(accountA.phone_number_id, '200000000000001');
    assert.strictEqual(accountA.status, 'connected');
    assert.strictEqual(accountA.access_token_encrypted, undefined, 'Access token must not be leaked');
  });

  test('6. Multi-Tenant Onboarding: Client B Connects Independent WABA B & Number B', async () => {
    const tenantBId = 2;
    const mockCodeB = `mock_oauth_code_tenantB_${Date.now()}`;
    const accountB = await whatsappService.completeEmbeddedSignup(tenantBId, {
      code: mockCodeB,
      wabaId: '100000000000002',
      phoneNumberId: '200000000000002',
      businessName: 'Client B Healthcare'
    });

    assert.ok(accountB.id);
    assert.strictEqual(accountB.business_id, tenantBId);
    assert.strictEqual(accountB.waba_id, '100000000000002');
    assert.strictEqual(accountB.phone_number_id, '200000000000002');
    assert.strictEqual(accountB.status, 'connected');

    // WABA and Phone must be independent
    assert.notStrictEqual(accountB.waba_id, '100000000000001', 'Client B must have independent WABA');
    assert.notStrictEqual(accountB.phone_number_id, '200000000000001', 'Client B must have independent Phone Number');
  });

  test('7. Strict Tenant Isolation: Client A Cannot See or Manage Client B Assets', async () => {
    const tenantAAccounts = await whatsappService.listAccounts(1);
    const tenantBAccounts = await whatsappService.listAccounts(2);

    // Verify account lists only contain respective tenant assets
    const hasTenantBAccountInA = tenantAAccounts.some(a => a.waba_id === '100000000000002');
    const hasTenantAAccountInB = tenantBAccounts.some(a => a.waba_id === '100000000000001');

    assert.strictEqual(hasTenantBAccountInA, false, 'Tenant A must NOT see Tenant B accounts');
    assert.strictEqual(hasTenantAAccountInB, false, 'Tenant B must NOT see Tenant A accounts');
  });

  test('8. Monitoring: Aggregated Platform Metrics for Super Admin', async () => {
    const monitoring = await platformMetaService.getMetaIntegrationMonitoring();
    assert.strictEqual(monitoring.platformAppId, '1165054629187576');
    assert.strictEqual(monitoring.readinessStatus, 'ready');
    assert.ok(monitoring.totalConnectedPhoneNumbers >= 2, 'Should reflect connected phone numbers');
    assert.ok(monitoring.totalConnectedWABAs >= 2, 'Should reflect unique client WABAs');
  });

  after(async () => {
    try {
      if (!isUsingFallback()) {
        await executeQuery(
          'UPDATE platform_meta_configs SET embedded_signup_config_id = NULL, encrypted_meta_app_secret = COALESCE(?, encrypted_meta_app_secret) WHERE id = 1',
          [initialSecret]
        );
      }
    } catch (_) {}
  });
});
