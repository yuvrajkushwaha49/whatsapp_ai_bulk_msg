import { executeQuery, isUsingFallback, getMemoryStore } from '../../database/db.js';

/**
 * Get all notifications for a business / user
 */
export async function getNotifications({ businessId, userId }) {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    if (!store.notifications) store.notifications = [];
    
    const bId = Number(businessId);
    const uId = userId ? Number(userId) : null;

    const list = store.notifications
      .filter((n) => {
        const matchBusiness = !businessId || n.business_id === bId || n.business_id === null;
        const matchUser = !n.user_id || !uId || n.user_id === uId;
        return matchBusiness && matchUser;
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const unreadCount = list.filter((n) => !n.is_read).length;
    return { notifications: list, unreadCount };
  }

  try {
    let sql = `SELECT id, business_id, user_id, title, message, type, is_read, link, created_at
       FROM notifications
       WHERE (business_id = ? OR business_id IS NULL)`;
    const params = [businessId];
    if (userId) {
      sql += ` AND (user_id = ? OR user_id IS NULL)`;
      params.push(userId);
    }
    sql += ` ORDER BY created_at DESC LIMIT 50`;

    const rows = await executeQuery(sql, params);

    const formatted = rows.map((r) => ({
      ...r,
      is_read: Boolean(r.is_read)
    }));

    const unreadCount = formatted.filter((n) => !n.is_read).length;
    return { notifications: formatted, unreadCount };
  } catch (err) {
    console.error('Error fetching notifications from MySQL:', err.message);
    return { notifications: [], unreadCount: 0 };
  }
}

/**
 * Mark a single notification as read
 */
export async function markNotificationAsRead({ id, businessId, userId }) {
  const notifId = Number(id);

  if (isUsingFallback()) {
    const store = getMemoryStore();
    if (!store.notifications) store.notifications = [];
    const notif = store.notifications.find((n) => n.id === notifId);
    if (notif) {
      notif.is_read = true;
    }
    return { id: notifId, is_read: true };
  }

  try {
    await executeQuery(
      `UPDATE notifications SET is_read = TRUE WHERE id = ? AND (business_id = ? OR business_id IS NULL)`,
      [notifId, businessId]
    );
    return { id: notifId, is_read: true };
  } catch (err) {
    console.error('Error marking notification as read in MySQL:', err.message);
    return { id: notifId, is_read: true };
  }
}

/**
 * Mark all notifications as read for current business/user
 */
export async function markAllNotificationsAsRead({ businessId, userId }) {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    if (!store.notifications) store.notifications = [];
    const bId = Number(businessId);
    store.notifications.forEach((n) => {
      if (n.business_id === bId || n.business_id === null) {
        n.is_read = true;
      }
    });
    return { success: true };
  }

  try {
    await executeQuery(
      `UPDATE notifications SET is_read = TRUE WHERE business_id = ? OR business_id IS NULL`,
      [businessId]
    );
    return { success: true };
  } catch (err) {
    console.error('Error marking all notifications as read in MySQL:', err.message);
    return { success: true };
  }
}

/**
 * Delete a single notification
 */
export async function deleteNotification({ id, businessId }) {
  const notifId = Number(id);

  if (isUsingFallback()) {
    const store = getMemoryStore();
    if (store.notifications) {
      store.notifications = store.notifications.filter((n) => n.id !== notifId);
    }
    return { success: true };
  }

  try {
    await executeQuery(
      `DELETE FROM notifications WHERE id = ? AND (business_id = ? OR business_id IS NULL)`,
      [notifId, businessId]
    );
    return { success: true };
  } catch (err) {
    console.error('Error deleting notification from MySQL:', err.message);
    return { success: true };
  }
}

/**
 * Clear all notifications for business
 */
export async function clearAllNotifications({ businessId }) {
  if (isUsingFallback()) {
    const store = getMemoryStore();
    if (store.notifications) {
      const bId = Number(businessId);
      store.notifications = store.notifications.filter((n) => n.business_id !== bId);
    }
    return { success: true };
  }

  try {
    await executeQuery(`DELETE FROM notifications WHERE business_id = ?`, [businessId]);
    return { success: true };
  } catch (err) {
    console.error('Error clearing notifications in MySQL:', err.message);
    return { success: true };
  }
}

/**
 * Create a new notification
 */
export async function createNotification({
  businessId,
  userId = null,
  title,
  message,
  type = 'info',
  link = null
}) {
  const now = new Date();

  if (isUsingFallback()) {
    const store = getMemoryStore();
    if (!store.notifications) store.notifications = [];
    const newId = (store.notifications.length > 0 ? Math.max(...store.notifications.map((n) => n.id || 0)) : 0) + 1;
    const newNotif = {
      id: newId,
      business_id: businessId ? Number(businessId) : null,
      user_id: userId ? Number(userId) : null,
      title,
      message,
      type,
      is_read: false,
      link,
      created_at: now
    };
    store.notifications.unshift(newNotif);
    return newNotif;
  }

  try {
    const result = await executeQuery(
      `INSERT INTO notifications (business_id, user_id, title, message, type, is_read, link, created_at)
       VALUES (?, ?, ?, ?, ?, FALSE, ?, NOW())`,
      [businessId, userId, title, message, type, link]
    );
    return {
      id: result.insertId,
      business_id: businessId,
      user_id: userId,
      title,
      message,
      type,
      is_read: false,
      link,
      created_at: now
    };
  } catch (err) {
    console.error('Error creating notification in MySQL:', err.message);
    return null;
  }
}

export default {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearAllNotifications,
  createNotification
};
