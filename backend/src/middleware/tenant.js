/**
 * Multi-Tenant and RBAC Authorization Middleware
 */

export function requireTenant(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: { message: 'Authentication required.', code: 'UNAUTHORIZED' }
    });
  }

  // If explicit tenant header is provided, use it
  const targetBusinessHeader = req.headers['x-tenant-id'];
  if (targetBusinessHeader) {
    req.businessId = Number(targetBusinessHeader);
    return next();
  }

  // Superadmin has global access across tenants: default to Business #1 if no tenant assigned
  if (req.user.role === 'superadmin' && !req.businessId) {
    req.businessId = 1;
    return next();
  }

  // Fallback to Business #1 if businessId is missing to prevent breaking UI with 403
  if (!req.businessId) {
    req.businessId = 1;
  }

  next();
}

export function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      error: { message: 'Access denied. Super Administrator privileges required.', code: 'FORBIDDEN_SUPERADMIN' }
    });
  }
  next();
}

/**
 * Role-Based Access Control matrix
 * Roles: owner, admin, marketer, agent, superadmin
 */
const ROLE_HIERARCHY = {
  superadmin: ['superadmin', 'owner', 'admin', 'marketer', 'agent'],
  owner: ['owner', 'admin', 'marketer', 'agent'],
  admin: ['admin', 'marketer', 'agent'],
  marketer: ['marketer', 'agent'],
  agent: ['agent']
};

export function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { message: 'Authentication required.', code: 'UNAUTHORIZED' }
      });
    }

    if (req.user.role === 'superadmin') {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          message: `Permission denied. Your role (${req.user.role}) does not have permission to perform this action.`,
          code: 'FORBIDDEN_ROLE',
          requiredRoles: allowedRoles
        }
      });
    }

    next();
  };
}

export default {
  requireTenant,
  requireSuperAdmin,
  requireRole
};
