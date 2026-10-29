import bcrypt from 'bcryptjs';
import { executeQuery, isUsingFallback, getMemoryStore } from '../../database/db.js';

export async function listTeamMembers(businessId) {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    return store.users
      .filter(u => u.business_id === Number(businessId))
      .map(({ password_hash, ...u }) => u);
  }

  return executeQuery(
    'SELECT id, name, email, role, is_email_verified, status, created_at FROM users WHERE business_id = ? ORDER BY created_at ASC',
    [businessId]
  );
}

export async function inviteMember(businessId, { name, email, role, password = 'TempPassword123!' }) {
  if (!['admin', 'marketer', 'agent'].includes(role)) {
    const error = new Error('Invalid role specified. Permitted roles: admin, marketer, agent');
    error.statusCode = 400;
    throw error;
  }

  const existing = await executeQuery('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
  if (existing.length > 0) {
    const error = new Error('A user with this email address already exists');
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const newUser = {
      id: store.users.length + 1,
      business_id: Number(businessId),
      name,
      email,
      password_hash: passwordHash,
      role,
      is_email_verified: 1,
      status: 'active',
      created_at: new Date()
    };
    store.users.push(newUser);
    return { id: newUser.id, name, email, role, status: 'active' };
  }

  const result = await executeQuery(
    `INSERT INTO users (business_id, name, email, password_hash, role, is_email_verified, status)
     VALUES (?, ?, ?, ?, ?, TRUE, 'active')`,
    [businessId, name, email, passwordHash, role]
  );

  return { id: result.insertId, name, email, role, status: 'active' };
}

export async function updateMemberRole(businessId, targetUserId, newRole) {
  if (!['admin', 'marketer', 'agent'].includes(newRole)) {
    const error = new Error('Invalid role specified');
    error.statusCode = 400;
    throw error;
  }

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const user = store.users.find(u => u.id === Number(targetUserId) && u.business_id === Number(businessId));
    if (!user) throw new Error('User not found');
    if (user.role === 'owner') throw new Error('Cannot change role of workspace Owner');
    user.role = newRole;
    return { id: user.id, role: newRole };
  }

  await executeQuery(
    'UPDATE users SET role = ? WHERE id = ? AND business_id = ? AND role != "owner"',
    [newRole, targetUserId, businessId]
  );

  return { id: targetUserId, role: newRole };
}

export async function removeMember(businessId, targetUserId) {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    const idx = store.users.findIndex(u => u.id === Number(targetUserId) && u.business_id === Number(businessId));
    if (idx !== -1) {
      if (store.users[idx].role === 'owner') throw new Error('Cannot remove workspace Owner');
      store.users.splice(idx, 1);
    }
    return { success: true };
  }

  await executeQuery('DELETE FROM users WHERE id = ? AND business_id = ? AND role != "owner"', [targetUserId, businessId]);
  return { success: true };
}

export default {
  listTeamMembers,
  inviteMember,
  updateMemberRole,
  removeMember
};
