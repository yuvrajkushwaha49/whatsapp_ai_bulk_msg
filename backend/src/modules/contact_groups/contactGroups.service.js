import { executeQuery, isUsingFallback, getMemoryStore } from '../../database/db.js';

export async function listGroups(businessId) {
  const numBizId = Number(businessId);
  if (isUsingFallback()) {
    const store = getMemoryStore();
    if (!store.contact_groups) store.contact_groups = [];
    if (!store.contact_group_members) store.contact_group_members = [];
    return store.contact_groups
      .filter(g => g.business_id === numBizId)
      .map(g => {
        const count = store.contact_group_members.filter(m => m.group_id === g.id).length;
        return { ...g, member_count: count };
      })
      .sort((a, b) => b.id - a.id);
  }

  const rows = await executeQuery(
    `SELECT g.*, COUNT(m.id) as member_count
     FROM contact_groups g
     LEFT JOIN contact_group_members m ON g.id = m.group_id
     WHERE g.business_id = ?
     GROUP BY g.id
     ORDER BY g.created_at DESC`,
    [numBizId]
  );
  return rows.map(r => ({ ...r, member_count: Number(r.member_count || 0) }));
}

export async function getGroup(businessId, groupId) {
  const numBizId = Number(businessId);
  const numGroupId = Number(groupId);

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const group = (store.contact_groups || []).find(g => g.id === numGroupId && g.business_id === numBizId);
    if (!group) {
      const err = new Error('Contact Group not found');
      err.statusCode = 404;
      throw err;
    }
    const memberIds = (store.contact_group_members || []).filter(m => m.group_id === numGroupId).map(m => m.contact_id);
    const members = (store.contacts || []).filter(c => memberIds.includes(c.id));
    return { group: { ...group, member_count: members.length }, members };
  }

  const groups = await executeQuery(
    `SELECT g.*, COUNT(m.id) as member_count
     FROM contact_groups g
     LEFT JOIN contact_group_members m ON g.id = m.group_id
     WHERE g.id = ? AND g.business_id = ?
     GROUP BY g.id LIMIT 1`,
    [numGroupId, numBizId]
  );

  if (groups.length === 0) {
    const err = new Error('Contact Group not found');
    err.statusCode = 404;
    throw err;
  }

  const members = await executeQuery(
    `SELECT c.id, c.name, c.phone, c.email, c.status, c.is_opted_in, m.created_at as joined_at
     FROM contact_group_members m
     JOIN contacts c ON m.contact_id = c.id
     WHERE m.group_id = ? AND m.business_id = ?
     ORDER BY m.created_at DESC`,
    [numGroupId, numBizId]
  );

  return { group: { ...groups[0], member_count: Number(groups[0].member_count || 0) }, members };
}

export async function createGroup(businessId, { name, description = '', color = '#0d6efd', contactIds = [] }) {
  const numBizId = Number(businessId);
  if (!name || !name.trim()) {
    const err = new Error('Group name is required');
    err.statusCode = 400;
    throw err;
  }

  if (isUsingFallback()) {
    const store = getMemoryStore();
    if (!store.contact_groups) store.contact_groups = [];
    if (!store.contact_group_members) store.contact_group_members = [];
    const newGroup = {
      id: (store.contact_groups.length ? Math.max(...store.contact_groups.map(g => g.id)) : 0) + 1,
      business_id: numBizId,
      name: name.trim(),
      description: description?.trim() || '',
      color: color || '#0d6efd',
      created_at: new Date()
    };
    store.contact_groups.push(newGroup);

    if (Array.isArray(contactIds) && contactIds.length > 0) {
      contactIds.forEach(cid => {
        store.contact_group_members.push({
          id: (store.contact_group_members.length ? Math.max(...store.contact_group_members.map(m => m.id)) : 0) + 1,
          business_id: numBizId,
          group_id: newGroup.id,
          contact_id: Number(cid),
          created_at: new Date()
        });
      });
    }
    return getGroup(numBizId, newGroup.id);
  }

  const result = await executeQuery(
    `INSERT INTO contact_groups (business_id, name, description, color, created_at)
     VALUES (?, ?, ?, ?, NOW())`,
    [numBizId, name.trim(), description?.trim() || null, color || '#0d6efd']
  );
  const groupId = result.insertId;

  if (Array.isArray(contactIds) && contactIds.length > 0) {
    for (const cid of contactIds) {
      await executeQuery(
        `INSERT IGNORE INTO contact_group_members (business_id, group_id, contact_id, created_at)
         VALUES (?, ?, ?, NOW())`,
        [numBizId, groupId, Number(cid)]
      );
    }
  }

  return getGroup(numBizId, groupId);
}

export async function updateGroup(businessId, groupId, { name, description, color }) {
  const numBizId = Number(businessId);
  const numGroupId = Number(groupId);

  if (isUsingFallback()) {
    const store = getMemoryStore();
    const group = (store.contact_groups || []).find(g => g.id === numGroupId && g.business_id === numBizId);
    if (!group) {
      const err = new Error('Contact Group not found');
      err.statusCode = 404;
      throw err;
    }
    if (name !== undefined) group.name = name.trim();
    if (description !== undefined) group.description = description?.trim() || '';
    if (color !== undefined) group.color = color;
    return getGroup(numBizId, numGroupId);
  }

  const updates = [];
  const params = [];
  if (name !== undefined) {
    updates.push('name = ?');
    params.push(name.trim());
  }
  if (description !== undefined) {
    updates.push('description = ?');
    params.push(description?.trim() || null);
  }
  if (color !== undefined) {
    updates.push('color = ?');
    params.push(color);
  }

  if (updates.length > 0) {
    params.push(numBizId, numGroupId);
    await executeQuery(
      `UPDATE contact_groups SET ${updates.join(', ')}, updated_at = NOW() WHERE business_id = ? AND id = ?`,
      params
    );
  }

  return getGroup(numBizId, numGroupId);
}

export async function deleteGroup(businessId, groupId) {
  const numBizId = Number(businessId);
  const numGroupId = Number(groupId);

  if (isUsingFallback()) {
    const store = getMemoryStore();
    store.contact_groups = (store.contact_groups || []).filter(g => !(g.id === numGroupId && g.business_id === numBizId));
    store.contact_group_members = (store.contact_group_members || []).filter(m => !(m.group_id === numGroupId && m.business_id === numBizId));
    return { success: true };
  }

  await executeQuery('DELETE FROM contact_group_members WHERE group_id = ? AND business_id = ?', [numGroupId, numBizId]);
  await executeQuery('DELETE FROM contact_groups WHERE id = ? AND business_id = ?', [numGroupId, numBizId]);
  return { success: true };
}

export async function addMembers(businessId, groupId, { contactIds = [] }) {
  const numBizId = Number(businessId);
  const numGroupId = Number(groupId);

  if (!Array.isArray(contactIds) || contactIds.length === 0) {
    return getGroup(numBizId, numGroupId);
  }

  for (const cid of contactIds) {
    await executeQuery(
      `INSERT IGNORE INTO contact_group_members (business_id, group_id, contact_id, created_at)
       VALUES (?, ?, ?, NOW())`,
      [numBizId, numGroupId, Number(cid)]
    );
  }

  return getGroup(numBizId, numGroupId);
}

export async function removeMember(businessId, groupId, contactId) {
  const numBizId = Number(businessId);
  const numGroupId = Number(groupId);
  const numContactId = Number(contactId);

  await executeQuery(
    `DELETE FROM contact_group_members WHERE business_id = ? AND group_id = ? AND contact_id = ?`,
    [numBizId, numGroupId, numContactId]
  );

  return getGroup(numBizId, numGroupId);
}

export default {
  listGroups,
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup,
  addMembers,
  removeMember
};

