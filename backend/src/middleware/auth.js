import { verifyAccessToken } from '../utils/jwt.js';
import { executeQuery } from '../database/db.js';

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: { message: 'Authentication required. No Bearer token provided.', code: 'UNAUTHORIZED' }
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    if (!decoded || !decoded.userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid or expired authentication token.', code: 'TOKEN_EXPIRED' }
      });
    }

    // Look up user from database
    const users = await executeQuery('SELECT id, business_id, name, email, role, is_email_verified, status FROM users WHERE id = ? LIMIT 1', [decoded.userId]);

    if (!users || users.length === 0) {
      return res.status(401).json({
        success: false,
        error: { message: 'User account not found or deactivated.', code: 'USER_NOT_FOUND' }
      });
    }

    const user = users[0];
    if (user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        error: { message: 'Account is suspended. Please contact administrator.', code: 'ACCOUNT_SUSPENDED' }
      });
    }

    // Attach verified user and tenant
    req.user = user;
    req.businessId = user.business_id ? Number(user.business_id) : null;

    next();
  } catch (error) {
    next(error);
  }
}

export default authenticate;
