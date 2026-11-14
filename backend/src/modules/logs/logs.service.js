import { executeQuery, isUsingFallback, getMemoryStore } from '../../database/db.js';

/**
 * Audit Action Definitions & Categories
 */
export const AUDIT_CATEGORIES = {
  AUTH: ['USER_LOGIN', 'USER_LOGOUT', 'PASSWORD_RESET', 'SESSION_REFRESH'],
  CAMPAIGNS: ['CAMPAIGN_CREATED', 'CAMPAIGN_LAUNCH', 'CAMPAIGN_PAUSED', 'CAMPAIGN_RESUMED', 'CAMPAIGN_DELETED'],
  CONTACTS: ['CONTACT_CREATED', 'CONTACT_UPDATED', 'CONTACT_DELETED', 'CONTACT_IMPORT', 'GROUP_CREATED'],
  TEMPLATES: ['TEMPLATE_CREATED', 'TEMPLATE_SYNC', 'TEMPLATE_DELETED'],
  TEAM: ['MEMBER_INVITE', 'ROLE_UPDATE', 'MEMBER_REMOVE'],
  BILLING: ['PLAN_UPGRADE', 'PLAN_DOWNGRADE', 'PAYMENT_METHOD_UPDATED'],
  WHATSAPP: ['WHATSAPP_CONNECT', 'WHATSAPP_DISCONNECT', 'WABA_SYNC'],
  SYSTEM: ['SETTINGS_UPDATE', 'API_KEY_ROTATED', 'SYSTEM_AUDIT']
};

/**
 * Helper to record an audit log entry in either DB or Memory Store
 */
export async function createAuditLog({
  businessId = null,
  userId = null,
  action,
  entityType = 'SYSTEM',
  entityId = null,
  details = null,
  ipAddress = '127.0.0.1'
}) {
  const detailsObj = typeof details === 'string' ? { message: details } : (details || {});
  const now = new Date();

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const newLog = {
      id: (store.audit_logs?.length || 0) + 1,
      business_id: businessId ? Number(businessId) : null,
      user_id: userId ? Number(userId) : null,
      action,
      entity_type: entityType,
      entity_id: entityId ? Number(entityId) : null,
      details: detailsObj,
      ip_address: ipAddress,
      created_at: now
    };
    if (!store.audit_logs) store.audit_logs = [];
    store.audit_logs.unshift(newLog);
    return newLog;
  }

  try {
    const detailsJson = JSON.stringify(detailsObj);
    const result = await executeQuery(
      `INSERT INTO audit_logs (business_id, user_id, action, entity_type, entity_id, details, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [businessId, userId, action, entityType, entityId, detailsJson, ipAddress]
    );
    return { id: result.insertId, business_id: businessId, user_id: userId, action, entity_type: entityType, entity_id: entityId, details: detailsObj, ip_address: ipAddress, created_at: now };
  } catch (err) {
    console.error('Failed to create audit log in MySQL:', err);
    // Non-blocking for primary user flows
    return null;
  }
}

/**
 * Fetch logs with STRICT tenant isolation:
 * - If user is superadmin: can see ALL logs, or filter by specific businessId
 * - If user is regular company user: can ONLY see logs for their own company (business_id = user.business_id)
 */
export async function listAuditLogs({
  requestingUser,
  businessId = null,
  action = null,
  category = null,
  search = '',
  page = 1,
  limit = 20
}) {
  const isSuperAdmin = requestingUser?.role === 'superadmin';
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * pageSize;

  // Determine enforced business_id
  let enforcedBusinessId = null;
  if (!isSuperAdmin) {
    enforcedBusinessId = Number(requestingUser?.business_id);
    if (!enforcedBusinessId) {
      const err = new Error('Access denied: User is not linked to any active company workspace.');
      err.statusCode = 403;
      throw err;
    }
  } else {
    // SuperAdmin can optionally filter by a specific business, or view all
    if (businessId && businessId !== 'ALL' && !isNaN(businessId)) {
      enforcedBusinessId = Number(businessId);
    }
  }

  if (isUsingFallback()) {
    const store = getMemoryStore();
    let allLogs = Array.isArray(store.audit_logs) ? [...store.audit_logs] : [];

    // Filter by business (Strict isolation)
    if (enforcedBusinessId !== null) {
      allLogs = allLogs.filter(l => l.business_id === enforcedBusinessId);
    }

    // Filter by action
    if (action && action !== 'ALL') {
      allLogs = allLogs.filter(l => l.action === action);
    }

    // Filter by category
    if (category && category !== 'ALL') {
      const actionsInCat = AUDIT_CATEGORIES[category] || [];
      if (actionsInCat.length > 0) {
        allLogs = allLogs.filter(l => actionsInCat.includes(l.action) || l.entity_type === category);
      }
    }

    // Search query
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      allLogs = allLogs.filter(l => {
        const user = store.users.find(u => u.id === l.user_id);
        const business = store.businesses.find(b => b.id === l.business_id);
        const detailsStr = typeof l.details === 'object' ? JSON.stringify(l.details).toLowerCase() : String(l.details || '').toLowerCase();
        return (
          l.action.toLowerCase().includes(q) ||
          (user && user.name.toLowerCase().includes(q)) ||
          (user && user.email.toLowerCase().includes(q)) ||
          (business && business.name.toLowerCase().includes(q)) ||
          detailsStr.includes(q) ||
          (l.ip_address && l.ip_address.includes(q))
        );
      });
    }

    // Sort descending by created_at
    allLogs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const total = allLogs.length;
    const paginated = allLogs.slice(offset, offset + pageSize);

    // Enrich logs with user and business info
    const enrichedLogs = paginated.map(l => {
      const u = store.users.find(usr => usr.id === l.user_id)
        || (l.business_id ? store.users.find(usr => usr.business_id === l.business_id && usr.role === 'owner') : null);
      const b = store.businesses.find(biz => biz.id === l.business_id);
      return {
        ...l,
        user_name: u ? u.name : (l.user_id ? `User #${l.user_id}` : 'System Automated Worker'),
        user_email: u ? u.email : 'system@campaignflow.io',
        user_role: u ? u.role : 'system',
        business_name: b ? b.name : (l.business_id ? `Business #${l.business_id}` : 'Global System')
      };
    });

    // Compute stats
    const stats = computeStats(allLogs);

    // List of businesses for superadmin filter dropdown
    const availableBusinesses = isSuperAdmin ? (store.businesses || []) : [];

    return {
      logs: enrichedLogs,
      pagination: {
        total,
        page: pageNum,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize) || 1
      },
      stats,
      businesses: availableBusinesses,
      isSuperAdmin
    };
  }

  // MySQL Execution
  const conditions = [];
  const params = [];

  if (enforcedBusinessId !== null) {
    conditions.push('a.business_id = ?');
    params.push(enforcedBusinessId);
  }

  if (action && action !== 'ALL') {
    conditions.push('a.action = ?');
    params.push(action);
  }

  if (category && category !== 'ALL') {
    const actionsInCat = AUDIT_CATEGORIES[category] || [];
    if (actionsInCat.length > 0) {
      const placeholders = actionsInCat.map(() => '?').join(',');
      conditions.push(`(a.action IN (${placeholders}) OR a.entity_type = ?)`);
      params.push(...actionsInCat, category);
    }
  }

  if (search && search.trim()) {
    const q = `%${search.trim()}%`;
    conditions.push('(a.action LIKE ? OR u.name LIKE ? OR u.email LIKE ? OR b.name LIKE ? OR a.ip_address LIKE ?)');
    params.push(q, q, q, q, q);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countSql = `
    SELECT COUNT(*) as total
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN users owner_u ON (a.user_id IS NULL AND a.business_id = owner_u.business_id AND owner_u.role = 'owner')
    LEFT JOIN businesses b ON a.business_id = b.id
    ${whereClause}
  `;
  const [countResult] = await executeQuery(countSql, params);
  const total = Number(countResult?.total || 0);

  // Get paginated logs
  const listSql = `
    SELECT 
      a.id, a.business_id, a.user_id, a.action, a.entity_type, a.entity_id, 
      a.details, a.ip_address, a.created_at,
      COALESCE(u.name, owner_u.name) as user_name,
      COALESCE(u.email, owner_u.email) as user_email,
      COALESCE(u.role, owner_u.role) as user_role,
      b.name as business_name
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN users owner_u ON (a.user_id IS NULL AND a.business_id = owner_u.business_id AND owner_u.role = 'owner')
    LEFT JOIN businesses b ON a.business_id = b.id
    ${whereClause}
    ORDER BY a.created_at DESC
    LIMIT ? OFFSET ?
  `;
  const logs = await executeQuery(listSql, [...params, pageSize, offset]);

  // Parse JSON details if string
  const formattedLogs = logs.map(l => ({
    ...l,
    user_name: l.user_name || (l.user_id ? `User #${l.user_id}` : 'System Automated Worker'),
    user_email: l.user_email || 'system@campaignflow.io',
    user_role: l.user_role || 'system',
    business_name: l.business_name || (l.business_id ? `Business #${l.business_id}` : 'Global System'),
    details: typeof l.details === 'string' ? safeJsonParse(l.details) : l.details
  }));

  // Fetch summary stats
  const statsSql = `
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN a.action IN ('USER_LOGIN', 'USER_LOGOUT', 'PASSWORD_RESET') THEN 1 ELSE 0 END) as auth_count,
      SUM(CASE WHEN a.action LIKE '%CAMPAIGN%' OR a.action LIKE '%MESSAGE%' THEN 1 ELSE 0 END) as campaign_count,
      SUM(CASE WHEN a.action LIKE '%MEMBER%' OR a.action LIKE '%ROLE%' THEN 1 ELSE 0 END) as team_count
    FROM audit_logs a
    ${enforcedBusinessId !== null ? 'WHERE a.business_id = ?' : ''}
  `;
  const statsParams = enforcedBusinessId !== null ? [enforcedBusinessId] : [];
  const [statsRow] = await executeQuery(statsSql, statsParams);

  const stats = {
    totalEvents: Number(statsRow?.total || 0),
    authEvents: Number(statsRow?.auth_count || 0),
    campaignEvents: Number(statsRow?.campaign_count || 0),
    teamEvents: Number(statsRow?.team_count || 0)
  };

  let availableBusinesses = [];
  if (isSuperAdmin) {
    availableBusinesses = await executeQuery('SELECT id, name, slug, status FROM businesses ORDER BY name ASC');
  }

  return {
    logs: formattedLogs,
    pagination: {
      total,
      page: pageNum,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize) || 1
    },
    stats,
    businesses: availableBusinesses,
    isSuperAdmin
  };
}

function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return { raw: str };
  }
}

function computeStats(logsList) {
  let authCount = 0;
  let campaignCount = 0;
  let teamCount = 0;

  logsList.forEach(l => {
    if (['USER_LOGIN', 'USER_LOGOUT', 'PASSWORD_RESET'].includes(l.action)) authCount++;
    if (l.action?.includes('CAMPAIGN') || l.action?.includes('MESSAGE')) campaignCount++;
    if (l.action?.includes('MEMBER') || l.action?.includes('ROLE')) teamCount++;
  });

  return {
    totalEvents: logsList.length,
    authEvents: authCount,
    campaignEvents: campaignCount,
    teamEvents: teamCount
  };
}

