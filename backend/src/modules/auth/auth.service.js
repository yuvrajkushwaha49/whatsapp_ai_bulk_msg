import bcrypt from 'bcryptjs';
import { executeQuery, isUsingFallback, getMemoryStore } from '../../database/db.js';
import { signAccessToken, signRefreshToken } from '../../utils/jwt.js';

export async function register({ businessName, name, email, password, timezone = 'UTC' }) {
  // Check if email already exists
  const existing = await executeQuery('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
  if (existing.length > 0) {
    const error = new Error('A user with this email address already exists');
    error.statusCode = 409;
    error.code = 'EMAIL_ALREADY_EXISTS';
    throw error;
  }

  const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);
  const passwordHash = await bcrypt.hash(password, 10);

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const businessId = store.businesses.length + 1;
    const business = { id: businessId, name: businessName, slug, timezone, status: 'active', created_at: new Date() };
    store.businesses.push(business);

    const userId = store.users.length + 1;
    const user = { id: userId, business_id: businessId, name, email, password_hash: passwordHash, role: 'owner', is_email_verified: 1, status: 'active', created_at: new Date() };
    store.users.push(user);

    // Free tier subscription
    store.subscriptions.push({ id: store.subscriptions.length + 1, business_id: businessId, plan_id: 1, status: 'active', current_period_start: new Date() });

    const token = signAccessToken({ userId: user.id, businessId: user.business_id, role: user.role });
    const refreshToken = signRefreshToken({ userId: user.id });

    return { user: { id: user.id, name: user.name, email: user.email, role: user.role }, business, token, refreshToken };
  }

  // Real MySQL execution
  const businessResult = await executeQuery(
    'INSERT INTO businesses (name, slug, timezone, status) VALUES (?, ?, ?, "active")',
    [businessName, slug, timezone]
  );
  const businessId = businessResult.insertId;

  const userResult = await executeQuery(
    'INSERT INTO users (business_id, name, email, password_hash, role, is_email_verified, status) VALUES (?, ?, ?, ?, "owner", TRUE, "active")',
    [businessId, name, email, passwordHash]
  );
  const userId = userResult.insertId;

  // Assign Free Trial subscription (plan id 1)
  await executeQuery(
    'INSERT INTO subscriptions (business_id, plan_id, status, current_period_start) VALUES (?, 1, "active", NOW())',
    [businessId]
  );

  const token = signAccessToken({ userId, businessId, role: 'owner' });
  const refreshToken = signRefreshToken({ userId });

  return {
    user: { id: userId, name, email, role: 'owner' },
    business: { id: businessId, name: businessName, slug, timezone },
    token,
    refreshToken
  };
}

export async function login({ email, password }) {
  const users = await executeQuery('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
  if (!users || users.length === 0) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }

  const user = users[0];
  let isMatch = await bcrypt.compare(password, user.password_hash);

  // In development mock mode, permit common variations (Password123, password, admin)
  if (!isMatch && isUsingFallback()) {
    const pTrim = password.trim();
    const pLower = pTrim.toLowerCase();
    if (pTrim === 'Password123!' || pTrim === 'Password123' || pLower === 'password123!' || pLower === 'password123' || pLower === 'password' || pLower === 'admin') {
      isMatch = true;
    }
  }

  if (!isMatch) {
    const error = new Error('Invalid email or password. Default demo password is: Password123!');
    error.statusCode = 401;
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }

  if (user.status === 'suspended') {
    const error = new Error('Your account is currently suspended. Please contact support.');
    error.statusCode = 403;
    error.code = 'ACCOUNT_SUSPENDED';
    throw error;
  }

  let business = null;
  if (user.business_id) {
    const businesses = await executeQuery('SELECT id, name, slug, timezone, status FROM businesses WHERE id = ? LIMIT 1', [user.business_id]);
    business = businesses[0] || null;
  }

  const token = signAccessToken({ userId: user.id, businessId: user.business_id, role: user.role });
  const refreshToken = signRefreshToken({ userId: user.id });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      business_id: user.business_id
    },
    business,
    token,
    refreshToken
  };
}

export async function getCurrentUser(userId) {
  const users = await executeQuery(
    'SELECT id, business_id, name, email, role, is_email_verified, status, created_at FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  if (!users || users.length === 0) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const user = users[0];
  let business = null;
  let subscription = null;

  if (user.business_id) {
    const businesses = await executeQuery('SELECT * FROM businesses WHERE id = ? LIMIT 1', [user.business_id]);
    business = businesses[0] || null;

    const subs = await executeQuery(`
      SELECT s.*, p.name as plan_name, p.slug as plan_slug, p.max_contacts, p.max_campaigns_per_month, p.max_messages_per_month, p.features
      FROM subscriptions s
      JOIN subscription_plans p ON s.plan_id = p.id
      WHERE s.business_id = ? LIMIT 1
    `, [user.business_id]);
    subscription = subs[0] || null;
  }

  return { user, business, subscription };
}

export default {
  register,
  login,
  getCurrentUser
};
