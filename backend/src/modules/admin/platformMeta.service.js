import { executeQuery, isUsingFallback, getMemoryStore, saveMemoryStore } from '../../database/db.js';
import { encryptToken, decryptToken } from '../../utils/crypto.js';
import logger from '../../utils/logger.js';
import axios from 'axios';

const DEFAULT_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v21.0';

/**
 * Retrieve Platform Meta Developer App Configuration (SuperAdmin only)
 * Secrets are ALWAYS masked before returning to the caller.
 */
export async function getPlatformMetaConfig() {
  let record = null;

  if (isUsingFallback()) {
    const store = getMemoryStore();
    record = store.platform_meta_configs?.[0] || null;
  } else {
    try {
      const rows = await executeQuery('SELECT * FROM platform_meta_configs ORDER BY id ASC LIMIT 1');
      record = rows?.[0] || null;
    } catch (e) {
      logger.warn('[PlatformMeta] DB query fallback:', e.message);
    }
  }

  // Fallback to environment variables if no DB record exists
  const appId = record?.meta_app_id || process.env.META_APP_ID || '1165054629187576';
  const envSecret = process.env.META_APP_SECRET || '';
  const isEnvValid = Boolean(
    envSecret && 
    !envSecret.includes('yahan_') && 
    !envSecret.includes('paste_karein') && 
    envSecret !== 'your_meta_app_secret' && 
    envSecret.length >= 16
  );

  let rawSecret = '';
  if (record?.encrypted_meta_app_secret) {
    const dbDecrypted = decryptToken(record.encrypted_meta_app_secret);
    if (dbDecrypted && !dbDecrypted.startsWith('sec_test_')) {
      rawSecret = dbDecrypted;
    }
  }
  if (!rawSecret && isEnvValid) {
    rawSecret = envSecret;
  }

  const hasSecret = Boolean(rawSecret && rawSecret.length >= 10);
  const configId = record?.embedded_signup_config_id || process.env.META_EMBEDDED_SIGNUP_CONFIG_ID || '';
  const apiVersion = record?.graph_api_version || process.env.WHATSAPP_API_VERSION || DEFAULT_API_VERSION;
  const verifyToken = record?.webhook_verify_token || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'campaignflow_secure_webhook_token_2026';
  const isEnabled = record?.is_enabled !== undefined ? Boolean(record.is_enabled) : true;

  // Evaluate missing fields
  const missingFields = [];
  if (!appId || !/^\d{10,24}$/.test(String(appId).trim())) missingFields.push('Meta App ID');
  if (!hasSecret) missingFields.push('Meta App Secret');
  if (!configId) missingFields.push('Embedded Signup Configuration ID (Recommended for Custom Onboarding)');

  let readinessStatus = 'ready';
  if (missingFields.includes('Meta App ID') || missingFields.includes('Meta App Secret')) {
    readinessStatus = 'missing_credentials';
  } else if (!isEnabled) {
    readinessStatus = 'disabled';
  }

  const backendUrl = process.env.BACKEND_URL || 'https://whatsapp.bhaktisong.fun';
  const webhookCallbackUrl = `${backendUrl}/api/webhooks/whatsapp`;

  return {
    metaAppId: appId,
    appSecretConfigured: hasSecret,
    appSecretMasked: hasSecret ? '••••••••••••••••••••••••' : '',
    embeddedSignupConfigId: configId,
    graphApiVersion: apiVersion,
    webhookVerifyToken: verifyToken,
    webhookCallbackUrl,
    isEnabled,
    readinessStatus,
    missingFields,
    lastTestedAt: record?.last_tested_at || null,
    requiredPermissions: [
      'whatsapp_business_management',
      'whatsapp_business_messaging'
    ],
    supportedIntegration: 'Official Meta Embedded Signup (Facebook Login for Business Tech Provider)'
  };
}

/**
 * Save and encrypt Platform-Level Meta Configuration (SuperAdmin only)
 */
export async function savePlatformMetaConfig(payload = {}, adminUserId = 1) {
  const {
    metaAppId,
    metaAppSecret,
    embeddedSignupConfigId,
    graphApiVersion = DEFAULT_API_VERSION,
    webhookVerifyToken,
    isEnabled = true
  } = payload;

  if (!metaAppId || !/^\d{10,24}$/.test(String(metaAppId).trim())) {
    const err = new Error('A valid numeric Meta App ID is required (10-24 digits).');
    err.statusCode = 400;
    throw err;
  }

  const cleanAppId = String(metaAppId).trim();
  const cleanConfigId = embeddedSignupConfigId ? String(embeddedSignupConfigId).trim() : null;
  const cleanVersion = graphApiVersion ? String(graphApiVersion).trim() : DEFAULT_API_VERSION;
  const cleanVerifyToken = webhookVerifyToken ? String(webhookVerifyToken).trim() : 'campaignflow_secure_webhook_token_2026';

  let encryptedSecret = null;
  if (metaAppSecret && metaAppSecret.trim() && !metaAppSecret.includes('••••')) {
    encryptedSecret = encryptToken(metaAppSecret.trim());
  }

  const now = new Date();

  if (isUsingFallback()) {
    const store = getMemoryStore();
    if (!store.platform_meta_configs) store.platform_meta_configs = [];
    let current = store.platform_meta_configs[0];

    if (!encryptedSecret && current?.encrypted_meta_app_secret) {
      encryptedSecret = current.encrypted_meta_app_secret;
    }

    const readinessStatus = (cleanAppId && encryptedSecret) ? 'ready' : 'incomplete';

    if (current) {
      current.meta_app_id = cleanAppId;
      if (encryptedSecret) current.encrypted_meta_app_secret = encryptedSecret;
      current.embedded_signup_config_id = cleanConfigId;
      current.graph_api_version = cleanVersion;
      current.webhook_verify_token = cleanVerifyToken;
      current.is_enabled = isEnabled ? 1 : 0;
      current.readiness_status = readinessStatus;
      current.updated_at = now;
    } else {
      current = {
        id: 1,
        meta_app_id: cleanAppId,
        encrypted_meta_app_secret: encryptedSecret || '',
        embedded_signup_config_id: cleanConfigId,
        graph_api_version: cleanVersion,
        webhook_verify_token: cleanVerifyToken,
        is_enabled: isEnabled ? 1 : 0,
        readiness_status: readinessStatus,
        created_at: now,
        updated_at: now
      };
      store.platform_meta_configs.push(current);
    }
    saveMemoryStore();
  } else {
    // MySQL persistent update
    const [existing] = await executeQuery('SELECT id, encrypted_meta_app_secret FROM platform_meta_configs LIMIT 1');
    if (!encryptedSecret && existing?.encrypted_meta_app_secret) {
      encryptedSecret = existing.encrypted_meta_app_secret;
    }

    const readinessStatus = (cleanAppId && encryptedSecret) ? 'ready' : 'incomplete';

    if (existing) {
      await executeQuery(
        `UPDATE platform_meta_configs 
         SET meta_app_id = ?, 
             encrypted_meta_app_secret = COALESCE(?, encrypted_meta_app_secret), 
             embedded_signup_config_id = ?, 
             graph_api_version = ?, 
             webhook_verify_token = ?, 
             is_enabled = ?, 
             readiness_status = ?, 
             updated_at = NOW() 
         WHERE id = ?`,
        [cleanAppId, encryptedSecret, cleanConfigId, cleanVersion, cleanVerifyToken, isEnabled ? 1 : 0, readinessStatus, existing.id]
      );
    } else {
      await executeQuery(
        `INSERT INTO platform_meta_configs 
         (meta_app_id, encrypted_meta_app_secret, embedded_signup_config_id, graph_api_version, webhook_verify_token, is_enabled, readiness_status, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [cleanAppId, encryptedSecret || '', cleanConfigId, cleanVersion, cleanVerifyToken, isEnabled ? 1 : 0, readinessStatus]
      );
    }
  }

  // Audit log entry
  try {
    await executeQuery(
      `INSERT INTO audit_logs (user_id, business_id, action, entity_type, entity_id, new_values, created_at)
       VALUES (?, NULL, 'UPDATE_PLATFORM_META_CONFIG', 'platform_meta_configs', 1, ?, NOW())`,
      [adminUserId || 1, JSON.stringify({ appId: cleanAppId, isEnabled })]
    );
  } catch (_) {}

  logger.info(`[PlatformMeta] Platform Meta Developer App (${cleanAppId}) updated by SuperAdmin.`);
  return getPlatformMetaConfig();
}

/**
 * Test Platform Meta Credentials against Meta Graph API
 */
export async function testPlatformMetaConfig() {
  const config = await getPlatformMetaConfig();
  const rawSecret = await getDecryptedPlatformSecret();

  if (!config.metaAppId || !rawSecret) {
    return {
      success: false,
      isValid: false,
      status: 'INCOMPLETE',
      message: 'Both Meta App ID and Meta App Secret must be configured to run verification.'
    };
  }

  // If in mock or placeholder mode
  if (rawSecret.includes('yahan_') || rawSecret === 'your_meta_app_secret' || process.env.NODE_ENV === 'test') {
    return {
      success: true,
      isValid: true,
      status: 'VERIFIED_MOCK',
      appId: config.metaAppId,
      appName: 'CampaignFlow WhatsApp SaaS Platform (Development)',
      message: 'Platform Meta App credentials verified in test/development mode.'
    };
  }

  try {
    const version = config.graphApiVersion || DEFAULT_API_VERSION;
    const response = await axios.get(`https://graph.facebook.com/${version}/${config.metaAppId}`, {
      params: {
        access_token: `${config.metaAppId}|${rawSecret}`,
        fields: 'id,name,link'
      },
      timeout: 8000
    });

    const now = new Date();
    // Update last_tested_at
    if (isUsingFallback()) {
      const store = getMemoryStore();
      if (store.platform_meta_configs?.[0]) store.platform_meta_configs[0].last_tested_at = now;
      saveMemoryStore();
    } else {
      await executeQuery('UPDATE platform_meta_configs SET last_tested_at = NOW(), readiness_status = "ready" WHERE id = 1');
    }

    return {
      success: true,
      isValid: true,
      status: 'LIVE_VERIFIED',
      appId: response.data.id,
      appName: response.data.name || 'Verified SaaS Meta App',
      message: `Meta Graph API connection verified! Connected as "${response.data.name}".`
    };
  } catch (error) {
    const errData = error.response?.data?.error || null;
    logger.warn('[PlatformMeta] Meta App validation failed:', errData || error.message);

    return {
      success: false,
      isValid: false,
      status: 'INVALID_CREDENTIALS',
      message: errData?.message || error.message || 'Meta App ID or Secret rejected by Meta API.'
    };
  }
}

/**
 * Check Platform Readiness for Client Onboarding
 * Called by client before launching "Continue with Facebook".
 * Never exposes secrets or internal errors to client tenants.
 */
export async function checkClientPlatformReadiness() {
  const config = await getPlatformMetaConfig();
  const rawSecret = await getDecryptedPlatformSecret();

  const isConfigured = Boolean(
    config.metaAppId && 
    rawSecret && 
    config.isEnabled && 
    config.readinessStatus !== 'disabled'
  );

  return {
    isReady: isConfigured,
    appId: isConfigured ? config.metaAppId : null,
    platformAppId: isConfigured ? config.metaAppId : null,
    hasConfigId: Boolean(config.embeddedSignupConfigId),
    configId: config.embeddedSignupConfigId || null,
    clientMessage: isConfigured
      ? 'Platform Meta integration is ready. You can connect your official WhatsApp Business Account.'
      : 'WhatsApp connection is currently being configured by our platform administrator. Please try again later.'
  };
}

/**
 * Internal helper: Get decrypted platform secret for server-side operations
 */
export async function getDecryptedPlatformSecret() {
  const envSecret = process.env.META_APP_SECRET || '';
  const isEnvValid = Boolean(
    envSecret && 
    !envSecret.includes('yahan_') && 
    !envSecret.includes('paste_karein') && 
    envSecret !== 'your_meta_app_secret' && 
    envSecret.length >= 16
  );

  let dbSecret = null;
  if (isUsingFallback()) {
    const store = getMemoryStore();
    const rec = store.platform_meta_configs?.[0];
    if (rec?.encrypted_meta_app_secret) {
      dbSecret = decryptToken(rec.encrypted_meta_app_secret);
    }
  } else {
    try {
      const [row] = await executeQuery('SELECT encrypted_meta_app_secret FROM platform_meta_configs LIMIT 1');
      if (row?.encrypted_meta_app_secret) {
        dbSecret = decryptToken(row.encrypted_meta_app_secret);
      }
    } catch (_) {}
  }

  // If DB secret is valid and not a dummy test secret, use it
  if (dbSecret && !dbSecret.startsWith('sec_test_') && !dbSecret.includes('placeholder')) {
    return dbSecret;
  }

  // Otherwise, if .env has a real secret, use .env!
  if (isEnvValid) {
    return envSecret;
  }

  return dbSecret || '';
}

/**
 * Get Platform Meta Monitoring & Health Metrics
 */
export async function getMetaIntegrationMonitoring() {
  const config = await getPlatformMetaConfig();

  let totalAccounts = 0;
  let uniqueWabas = 0;
  let connectedAccounts = 0;
  let attentionRequired = 0;
  let totalTenantsWithWa = 0;

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const accs = store.whatsapp_accounts || [];
    totalAccounts = accs.length;
    uniqueWabas = new Set(accs.map(a => a.waba_id)).size;
    connectedAccounts = accs.filter(a => a.connection_status === 'CONNECTED').length;
    attentionRequired = accs.filter(a => ['ACTION_REQUIRED', 'PERMISSION_ERROR', 'TOKEN_EXPIRED'].includes(a.connection_status)).length;
    totalTenantsWithWa = new Set(accs.map(a => a.business_id)).size;
  } else {
    try {
      const [waStats] = await executeQuery(`
        SELECT 
          COUNT(*) as totalAccounts,
          COUNT(DISTINCT waba_id) as uniqueWabas,
          COUNT(DISTINCT business_id) as totalTenants,
          SUM(CASE WHEN connection_status = 'CONNECTED' THEN 1 ELSE 0 END) as connectedAccounts,
          SUM(CASE WHEN connection_status IN ('ACTION_REQUIRED', 'PERMISSION_ERROR', 'TOKEN_EXPIRED') THEN 1 ELSE 0 END) as attentionRequired
        FROM whatsapp_accounts
      `);
      totalAccounts = waStats?.totalAccounts || 0;
      uniqueWabas = waStats?.uniqueWabas || 0;
      totalTenantsWithWa = waStats?.totalTenants || 0;
      connectedAccounts = waStats?.connectedAccounts || 0;
      attentionRequired = waStats?.attentionRequired || 0;
    } catch (_) {}
  }

  return {
    platformAppId: config.metaAppId,
    readinessStatus: config.readinessStatus,
    isEnabled: config.isEnabled,
    totalTenantsConnected: totalTenantsWithWa,
    totalConnectedWABAs: uniqueWabas,
    totalConnectedPhoneNumbers: totalAccounts,
    activeConnections: connectedAccounts,
    requiresAttention: attentionRequired,
    lastTestedAt: config.lastTestedAt
  };
}
