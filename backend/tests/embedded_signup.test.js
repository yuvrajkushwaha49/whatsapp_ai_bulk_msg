process.env.NODE_ENV = 'test';
import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { checkConnection, getMemoryStore } from '../src/database/db.js';
import * as whatsappService from '../src/modules/whatsapp/whatsapp.service.js';
import { encryptToken, decryptToken } from '../src/utils/crypto.js';

describe('Meta WhatsApp Embedded Signup Test Suite', () => {
  before(async () => {
    await checkConnection();
  });

  test('1. Security: AES-256-GCM token encryption and decryption', () => {
    const rawToken = 'EAAB_sample_access_token_super_secret_12345';
    const encrypted = encryptToken(rawToken);

    assert.notStrictEqual(encrypted, rawToken, 'Encrypted token must not match plaintext');
    assert.match(encrypted, /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/i, 'Encrypted token must format as iv:tag:cipher');

    const decrypted = decryptToken(encrypted);
    assert.strictEqual(decrypted, rawToken, 'Decrypted token must exactly match original token');
  });

  test('2. Connect Config: Returns Meta App ID and Embedded Signup Version', async () => {
    const config = await whatsappService.getConnectConfig(1);
    assert.ok(config.appId, 'App ID must be returned');
    assert.strictEqual(config.version, 'v21.0');
    assert.strictEqual(typeof config.hasConfigId, 'boolean');
  });

  test('3. Embedded Signup Completion: Rejects when OAuth code is missing', async () => {
    await assert.rejects(
      async () => {
        await whatsappService.completeEmbeddedSignup(1, { code: '' });
      },
      /Authorization code is required/
    );
  });

  test('4. Embedded Signup Completion: Exchanges code, subscribes webhook, registers phone & encrypts token', async () => {
    const mockCode = `mock_oauth_code_${Date.now()}`;
    const account = await whatsappService.completeEmbeddedSignup(1, {
      code: mockCode,
      wabaId: '28532933229644434',
      phoneNumberId: '1341070215765610',
      businessName: 'Acme Mega Retail'
    });

    assert.ok(account.id, 'Account ID must be assigned');
    assert.strictEqual(account.status, 'connected');
    assert.strictEqual(account.connection_status, 'CONNECTED');
    assert.strictEqual(account.waba_id, '28532933229644434');
    assert.strictEqual(account.phone_number_id, '1341070215765610');
    assert.ok(account.hasToken, 'hasToken must be true');

    // CRITICAL SECURITY CHECK: Access token must NEVER be exposed in API output
    assert.strictEqual(account.access_token_encrypted, undefined, 'Access token must not be leaked to output');

    // Verify token was stored encrypted in memory store / database
    const store = getMemoryStore();
    const storedRecord = store.whatsapp_accounts.find(a => a.id === account.id);
    assert.ok(storedRecord.access_token_encrypted, 'Token must be saved in database');
    assert.match(storedRecord.access_token_encrypted, /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/i, 'Token in DB must be AES-256-GCM encrypted');
  });

  test('5. Account Live Verification: Checks connection status and updates last_verified_at', async () => {
    const store = getMemoryStore();
    const targetAccount = store.whatsapp_accounts.find(a => a.business_id === 1);
    assert.ok(targetAccount, 'Account for business 1 must exist');

    const result = await whatsappService.verifyAccount(1, targetAccount.id);
    assert.strictEqual(result.isConnected, true);
    assert.strictEqual(result.status, 'CONNECTED');
    assert.ok(result.verifiedAt);
    assert.strictEqual(result.account.access_token_encrypted, undefined, 'Sanitized response must not leak token');
  });

  test('6. Tenant Isolation: Business 2 cannot view or verify Business 1 WhatsApp account', async () => {
    const store = getMemoryStore();
    const b1Account = store.whatsapp_accounts.find(a => a.business_id === 1);

    // Business 2 tries to get Business 1's account
    const b2View = await whatsappService.getAccount(2, b1Account.id);
    assert.strictEqual(b2View, null, 'Business 2 should not have access to Business 1 account');

    // Business 2 tries to verify Business 1's account
    await assert.rejects(
      async () => {
        await whatsappService.verifyAccount(2, b1Account.id);
      },
      /WhatsApp Account not found/
    );
  });

  test('7. Disconnect Account: Marks connection_status as DISCONNECTED', async () => {
    const store = getMemoryStore();
    const account = store.whatsapp_accounts.find(a => a.business_id === 1);

    const disconnectRes = await whatsappService.disconnectAccount(1, account.id);
    assert.strictEqual(disconnectRes.success, true);

    const updated = await whatsappService.getAccount(1, account.id);
    assert.strictEqual(updated.connection_status, 'DISCONNECTED');
  });

  test('8. Multi-Account Support: Connecting multiple phone numbers creates distinct accounts', async () => {
    // Connect First Account
    const acc1 = await whatsappService.completeEmbeddedSignup(1, {
      code: 'mock_code_num1',
      wabaId: '28532933229644434',
      phoneNumberId: 'phone_id_111',
      businessName: 'Store Main Number'
    });

    // Connect Second Account under SAME WABA (or new WABA) with different phone_number_id
    const acc2 = await whatsappService.completeEmbeddedSignup(1, {
      code: 'mock_code_num2',
      wabaId: '28532933229644434',
      phoneNumberId: 'phone_id_222',
      businessName: 'Store Support Number'
    });

    assert.notStrictEqual(acc1.id, acc2.id, 'Accounts must have separate distinct IDs');
    assert.strictEqual(acc1.phone_number_id, 'phone_id_111');
    assert.strictEqual(acc2.phone_number_id, 'phone_id_222');

    const accounts = await whatsappService.listAccounts(1);
    const hasAcc1 = accounts.some(a => a.id === acc1.id && a.phone_number_id === 'phone_id_111');
    const hasAcc2 = accounts.some(a => a.id === acc2.id && a.phone_number_id === 'phone_id_222');
    assert.ok(hasAcc1, 'Account 1 must remain present');
    assert.ok(hasAcc2, 'Account 2 must be present simultaneously');
  });

  test('9. Primary Account Switching: Allows setting default primary sender across multiple accounts', async () => {
    const accounts = await whatsappService.listAccounts(1);
    assert.ok(accounts.length >= 2, 'Should have at least 2 accounts');

    const targetAccount = accounts[1];
    const updated = await whatsappService.setPrimaryAccount(1, targetAccount.id);
    assert.strictEqual(updated.id, targetAccount.id);
    assert.strictEqual(updated.is_primary, true);

    const refreshedAccounts = await whatsappService.listAccounts(1);
    const primaryAccount = refreshedAccounts.find(a => a.is_primary === true);
    assert.strictEqual(primaryAccount.id, targetAccount.id, 'Target account must be primary');

    // All other accounts must not be primary
    const nonPrimary = refreshedAccounts.filter(a => a.id !== targetAccount.id);
    assert.ok(nonPrimary.every(a => a.is_primary === false), 'All other accounts must have is_primary === false');
  });
});
