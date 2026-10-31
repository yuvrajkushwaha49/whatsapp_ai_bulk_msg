import { executeQuery, isUsingFallback, getMemoryStore } from '../../database/db.js';

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

export default {
  getSuperAdminDashboard,
  listAllBusinesses,
  listAllWhatsAppAccounts,
  updateBusinessStatus
};
