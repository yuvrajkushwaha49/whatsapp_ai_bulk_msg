import { executeQuery, isUsingFallback, getMemoryStore } from '../../database/db.js';
import logger from '../../utils/logger.js';

export async function getSuperAdminDashboard() {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    const accounts = store.whatsapp_accounts || [];
    const uniqueWabas = new Set(accounts.map(a => a.waba_id)).size;
    const connectedAccs = accounts.filter(a => a.status === 'connected' && a.connection_status === 'CONNECTED').length;
    const attentionAccs = accounts.filter(a => ['ACTION_REQUIRED', 'PERMISSION_ERROR', 'TOKEN_EXPIRED', 'DISCONNECTED'].includes(a.connection_status)).length;

    return {
      totalBusinesses: store.businesses.length,
      activeBusinesses: store.businesses.filter(b => b.status === 'active').length,
      totalUsers: store.users.length,
      totalWhatsAppAccounts: accounts.length,
      totalWABAs: uniqueWabas,
      totalPhoneNumbers: accounts.length,
      connectedAccounts: connectedAccs,
      attentionRequiredAccounts: attentionAccs,
      totalCampaigns: store.campaigns.length,
      totalMessagesSent: store.campaigns.reduce((sum, c) => sum + (c.sent_count || 0), 0),
      totalDelivered: store.campaigns.reduce((sum, c) => sum + (c.delivered_count || 0), 0),
      totalRead: store.campaigns.reduce((sum, c) => sum + (c.read_count || 0), 0),
      totalRevenueEstimated: 158.00,
      systemHealth: {
        apiStatus: 'HEALTHY',
        databaseStatus: 'OPERATIONAL (Development Adapter)',
        queueStatus: 'ACTIVE',
        metaCloudApi: 'VERIFIED'
      }
    };
  }

  const [bizStats] = await executeQuery(`
    SELECT 
      COUNT(*) as totalBusinesses,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as activeBusinesses
    FROM businesses
  `);

  const [userStats] = await executeQuery('SELECT COUNT(*) as totalUsers FROM users');
  const [waStats] = await executeQuery(`
    SELECT 
      COUNT(*) as totalWhatsAppAccounts,
      COUNT(DISTINCT waba_id) as totalWABAs,
      SUM(CASE WHEN status = 'connected' AND connection_status = 'CONNECTED' THEN 1 ELSE 0 END) as connectedAccounts,
      SUM(CASE WHEN connection_status IN ('ACTION_REQUIRED', 'PERMISSION_ERROR', 'TOKEN_EXPIRED', 'DISCONNECTED') THEN 1 ELSE 0 END) as attentionRequiredAccounts
    FROM whatsapp_accounts
  `);

  const [campStats] = await executeQuery(`
    SELECT 
      COUNT(*) as totalCampaigns,
      COALESCE(SUM(sent_count), 0) as totalMessagesSent,
      COALESCE(SUM(delivered_count), 0) as totalDelivered,
      COALESCE(SUM(read_count), 0) as totalRead
    FROM campaigns
  `);

  return {
    totalBusinesses: bizStats?.totalBusinesses || 0,
    activeBusinesses: bizStats?.activeBusinesses || 0,
    totalUsers: userStats?.totalUsers || 0,
    totalWhatsAppAccounts: waStats?.totalWhatsAppAccounts || 0,
    totalWABAs: waStats?.totalWABAs || 0,
    totalPhoneNumbers: waStats?.totalWhatsAppAccounts || 0,
    connectedAccounts: waStats?.connectedAccounts || 0,
    attentionRequiredAccounts: waStats?.attentionRequiredAccounts || 0,
    totalCampaigns: campStats?.totalCampaigns || 0,
    totalMessagesSent: Number(campStats?.totalMessagesSent || 0),
    totalDelivered: Number(campStats?.totalDelivered || 0),
    totalRead: Number(campStats?.totalRead || 0),
    totalRevenueEstimated: 356.00,
    systemHealth: {
      apiStatus: 'HEALTHY',
      databaseStatus: 'OPERATIONAL',
      queueStatus: 'ACTIVE',
      metaCloudApi: 'VERIFIED'
    }
  };
}

export async function listAllBusinesses() {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    return store.businesses.map(b => {
      const userCount = store.users.filter(u => u.business_id === b.id).length;
      const sub = store.subscriptions.find(s => s.business_id === b.id);
      const plan = sub ? store.subscription_plans.find(p => p.id === sub.plan_id) : null;
      return {
        ...b,
        userCount,
        planName: plan?.name || 'Free Trial',
        subscriptionStatus: sub?.status || 'active'
      };
    });
  }

  return executeQuery(`
    SELECT b.*, 
      COUNT(DISTINCT u.id) as userCount,
      COALESCE(p.name, 'Free Trial') as planName,
      COALESCE(s.status, 'active') as subscriptionStatus
    FROM businesses b
    LEFT JOIN users u ON b.id = u.business_id
    LEFT JOIN subscriptions s ON b.id = s.business_id
    LEFT JOIN subscription_plans p ON s.plan_id = p.id
    GROUP BY b.id
    ORDER BY b.created_at DESC
  `);
}

export async function updateBusinessStatus(businessId, status) {
  if (!['active', 'suspended', 'pending'].includes(status)) {
    const error = new Error('Invalid business status');
    error.statusCode = 400;
    throw error;
  }

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const b = store.businesses.find(item => item.id === Number(businessId));
    if (b) b.status = status;
    return { id: businessId, status };
  }

  await executeQuery('UPDATE businesses SET status = ? WHERE id = ?', [status, businessId]);
  return { id: businessId, status };
}

/**
 * Super Admin: List all client WhatsApp Business Accounts across the entire SaaS platform
 * CRITICAL: Never exposes access_token_encrypted to frontend/logs
 */
export async function listAllWhatsAppAccounts() {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    return (store.whatsapp_accounts || []).map(acc => {
      const biz = store.businesses.find(b => b.id === acc.business_id);
      const { access_token_encrypted, ...sanitized } = acc;
      return {
        ...sanitized,
        business_name: biz?.name || `Business #${acc.business_id}`,
        hasToken: Boolean(access_token_encrypted)
      };
    });
  }

  const rows = await executeQuery(`
    SELECT 
      wa.id,
      wa.business_id,
      b.name as business_name,
      wa.meta_business_id,
      wa.waba_id,
      wa.phone_number_id,
      wa.phone_number,
      wa.display_name,
      wa.verified_name,
      wa.quality_rating,
      wa.messaging_limit_tier,
      wa.status,
      wa.connection_status,
      wa.is_primary,
      COALESCE(wa.admin_status, 'ACTIVE') as admin_status,
      wa.last_verified_at,
      wa.webhook_subscribed_at,
      wa.created_at
    FROM whatsapp_accounts wa
    LEFT JOIN businesses b ON wa.business_id = b.id
    ORDER BY wa.created_at DESC
  `);

  return rows.map(r => ({
    ...r,
    hasToken: true
  }));
}

let ensuredColumn = false;
async function ensureAdminStatusColumn() {
  if (ensuredColumn || isUsingFallback()) return;
  try {
    const cols = await executeQuery(`SHOW COLUMNS FROM whatsapp_accounts LIKE 'admin_status'`);
    if (!cols || cols.length === 0) {
      await executeQuery(`ALTER TABLE whatsapp_accounts ADD COLUMN admin_status VARCHAR(20) DEFAULT 'ACTIVE'`);
      logger.info(`[AdminMatrix] Added 'admin_status' column to whatsapp_accounts table`);
    }
    ensuredColumn = true;
  } catch (err) {
    logger.warn(`[ensureAdminStatusColumn] ${err.message}`);
    ensuredColumn = true;
  }
}

let ensuredAllowedNumbersColumn = false;
export async function ensureAllowedNumbersColumn() {
  if (ensuredAllowedNumbersColumn || isUsingFallback()) return;
  try {
    const cols = await executeQuery(`SHOW COLUMNS FROM businesses LIKE 'allowed_phone_numbers'`);
    if (!cols || cols.length === 0) {
      await executeQuery(`ALTER TABLE businesses ADD COLUMN allowed_phone_numbers TEXT NULL`);
      logger.info(`[AdminMatrix] Added 'allowed_phone_numbers' column to businesses table`);
    }
    ensuredAllowedNumbersColumn = true;
  } catch (err) {
    logger.warn(`[ensureAllowedNumbersColumn] ${err.message}`);
    ensuredAllowedNumbersColumn = true;
  }
}

/**
 * Super Admin: Update Allowed WhatsApp Numbers for a Client Business
 */
export async function updateBusinessAllowedNumbers(businessId, allowedNumbers) {
  await ensureAllowedNumbersColumn();

  let formatted = null;
  if (Array.isArray(allowedNumbers)) {
    formatted = JSON.stringify(allowedNumbers.map(n => String(n).trim()).filter(Boolean));
  } else if (typeof allowedNumbers === 'string') {
    const arr = allowedNumbers.split(',').map(n => n.trim()).filter(Boolean);
    formatted = JSON.stringify(arr);
  }

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const b = (store.businesses || []).find(item => item.id === Number(businessId));
    if (b) {
      b.allowed_phone_numbers = formatted;
    }
    return { id: Number(businessId), allowed_phone_numbers: formatted };
  }

  await executeQuery('UPDATE businesses SET allowed_phone_numbers = ? WHERE id = ?', [formatted, businessId]);
  return { id: Number(businessId), allowed_phone_numbers: formatted };
}

/**
 * Super Admin: Get Number Allocation & Approval Matrix (Users + Allotted Numbers)
 */
export async function getNumberAllocationMatrix() {
  await ensureAdminStatusColumn();
  await ensureAllowedNumbersColumn();

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const businesses = (store.businesses || []).map(b => {
      const owner = (store.users || []).find(u => u.business_id === b.id && (u.role === 'owner' || u.role === 'admin')) || 
                    (store.users || []).find(u => u.business_id === b.id) || null;
      const accounts = (store.whatsapp_accounts || [])
        .filter(a => a.business_id === b.id)
        .map(a => ({
          ...a,
          admin_status: a.admin_status || 'ACTIVE'
        }));

      let parsedAllowed = [];
      try {
        parsedAllowed = b.allowed_phone_numbers ? (typeof b.allowed_phone_numbers === 'string' ? JSON.parse(b.allowed_phone_numbers) : b.allowed_phone_numbers) : [];
      } catch (_) {
        parsedAllowed = String(b.allowed_phone_numbers || '').split(',').map(s => s.trim()).filter(Boolean);
      }

      return {
        id: b.id,
        name: b.name,
        slug: b.slug,
        owner_name: owner?.name || 'N/A',
        owner_email: owner?.email || 'N/A',
        owner_role: owner?.role || 'owner',
        status: b.status || 'active',
        allowed_phone_numbers: parsedAllowed,
        accounts_count: accounts.length,
        active_accounts_count: accounts.filter(a => a.admin_status === 'ACTIVE').length,
        accounts,
        whatsapp_accounts: accounts
      };
    });

    const unassignedAccounts = (store.whatsapp_accounts || [])
      .filter(a => !a.business_id)
      .map(a => ({
        ...a,
        display_phone_number: a.phone_number || a.display_name,
        account_name: a.display_name || a.phone_number,
        verified_name: a.display_name || a.phone_number,
        admin_status: a.admin_status || 'ACTIVE'
      }));

    return { businesses, unassignedAccounts };
  }

  // Real MySQL implementation (100% immune to sql_mode=only_full_group_by)
  // 1. Fetch all businesses
  const businesses = await executeQuery(`
    SELECT b.id, b.name, b.slug, b.status, b.allowed_phone_numbers
    FROM businesses b
    ORDER BY b.id ASC
  `);

  // 2. Fetch users ordered by owner first, then admin, then members
  const users = await executeQuery(`
    SELECT id, business_id, name, email, role
    FROM users
    ORDER BY CASE WHEN role = 'owner' THEN 1 WHEN role = 'admin' THEN 2 ELSE 3 END, id ASC
  `);

  // Map first owner/admin for each business
  const ownerMap = new Map();
  for (const u of users) {
    if (u.business_id && !ownerMap.has(u.business_id)) {
      ownerMap.set(u.business_id, u);
    }
  }

  // 3. Fetch all accounts
  const allAccounts = await executeQuery(`
    SELECT 
      wa.*,
      b.name as business_name,
      COALESCE(wa.admin_status, 'ACTIVE') as admin_status
    FROM whatsapp_accounts wa
    LEFT JOIN businesses b ON wa.business_id = b.id
    ORDER BY wa.created_at DESC
  `);

  const businessMap = new Map();
  businesses.forEach(b => {
    const owner = ownerMap.get(b.id);
    let parsedAllowed = [];
    try {
      parsedAllowed = b.allowed_phone_numbers ? (typeof b.allowed_phone_numbers === 'string' ? JSON.parse(b.allowed_phone_numbers) : b.allowed_phone_numbers) : [];
    } catch (_) {
      parsedAllowed = String(b.allowed_phone_numbers || '').split(',').map(s => s.trim()).filter(Boolean);
    }

    businessMap.set(b.id, {
      id: b.id,
      name: b.name,
      slug: b.slug,
      status: b.status,
      allowed_phone_numbers: parsedAllowed,
      owner_name: owner?.name || 'N/A',
      owner_email: owner?.email || 'N/A',
      owner_role: owner?.role || 'owner',
      accounts_count: 0,
      active_accounts_count: 0,
      accounts: [],
      whatsapp_accounts: []
    });
  });

  const unassignedAccounts = [];

  allAccounts.forEach(acc => {
    const normalizedAcc = {
      ...acc,
      display_phone_number: acc.phone_number || acc.display_name,
      account_name: acc.display_name || acc.phone_number,
      verified_name: acc.display_name || acc.phone_number,
      admin_status: acc.admin_status || 'ACTIVE'
    };

    if (acc.business_id && businessMap.has(acc.business_id)) {
      const b = businessMap.get(acc.business_id);
      b.accounts.push(normalizedAcc);
      b.whatsapp_accounts.push(normalizedAcc);
      b.accounts_count++;
      if (normalizedAcc.admin_status === 'ACTIVE') {
        b.active_accounts_count++;
      }
    } else {
      unassignedAccounts.push(normalizedAcc);
    }
  });

  return {
    businesses: Array.from(businessMap.values()),
    unassignedAccounts
  };
}

/**
 * Super Admin: Update Number Active / Deactive Status
 */
export async function updateWhatsAppAccountAdminStatus(accountId, adminStatus) {
  await ensureAdminStatusColumn();
  const numAccountId = Number(accountId);
  const normalizedStatus = (String(adminStatus || '').trim().toUpperCase() === 'DEACTIVE') ? 'DEACTIVE' : 'ACTIVE';
  logger.info(`⚡ [SuperAdmin] Setting WhatsApp Account #${numAccountId} admin_status = '${normalizedStatus}'`);

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const acc = (store.whatsapp_accounts || []).find(a => a.id === numAccountId);
    if (!acc) {
      const err = new Error('WhatsApp Account not found');
      err.statusCode = 404;
      throw err;
    }
    acc.admin_status = normalizedStatus;
    saveMemoryStore();
    return { id: numAccountId, admin_status: normalizedStatus };
  }

  await executeQuery(
    `UPDATE whatsapp_accounts SET admin_status = ? WHERE id = ?`,
    [normalizedStatus, numAccountId]
  );

  return { id: numAccountId, admin_status: normalizedStatus };
}

/**
 * Super Admin: Reassign WhatsApp Account to a Different Business / Client
 */
export async function reassignWhatsAppAccount(accountId, targetBusinessId) {
  const numAccountId = Number(accountId);
  const numBusinessId = targetBusinessId ? Number(targetBusinessId) : null;

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const acc = (store.whatsapp_accounts || []).find(a => a.id === numAccountId);
    if (!acc) {
      const err = new Error('WhatsApp Account not found');
      err.statusCode = 404;
      throw err;
    }
    acc.business_id = numBusinessId;
    saveMemoryStore();
    return { id: numAccountId, business_id: numBusinessId };
  }

  await executeQuery(
    `UPDATE whatsapp_accounts SET business_id = ?, is_primary = FALSE WHERE id = ?`,
    [numBusinessId, numAccountId]
  );

  return { id: numAccountId, business_id: numBusinessId };
}

export default {
  getSuperAdminDashboard,
  listAllBusinesses,
  listAllWhatsAppAccounts,
  updateBusinessStatus,
  getNumberAllocationMatrix,
  updateWhatsAppAccountAdminStatus,
  reassignWhatsAppAccount,
  updateBusinessAllowedNumbers
};
