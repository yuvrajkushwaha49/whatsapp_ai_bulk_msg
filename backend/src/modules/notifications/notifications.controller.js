import notificationsService from './notifications.service.js';

export async function getNotifications(req, res, next) {
  try {
    const businessId = req.user?.business_id || req.headers['x-tenant-id'] || 1;
    const userId = req.user?.id || null;

    const data = await notificationsService.getNotifications({ businessId, userId });
    res.json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

export async function markAsRead(req, res, next) {
  try {
    const { id } = req.params;
    const businessId = req.user?.business_id || req.headers['x-tenant-id'] || 1;
    const userId = req.user?.id || null;

    const data = await notificationsService.markNotificationAsRead({ id, businessId, userId });
    res.json({
      success: true,
      message: 'Notification marked as read',
      data
    });
  } catch (error) {
    next(error);
  }
}

export async function markAllAsRead(req, res, next) {
  try {
    const businessId = req.user?.business_id || req.headers['x-tenant-id'] || 1;
    const userId = req.user?.id || null;

    await notificationsService.markAllNotificationsAsRead({ businessId, userId });
    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteNotification(req, res, next) {
  try {
    const { id } = req.params;
    const businessId = req.user?.business_id || req.headers['x-tenant-id'] || 1;

    await notificationsService.deleteNotification({ id, businessId });
    res.json({
      success: true,
      message: 'Notification removed'
    });
  } catch (error) {
    next(error);
  }
}

export async function clearAll(req, res, next) {
  try {
    const businessId = req.user?.business_id || req.headers['x-tenant-id'] || 1;

    await notificationsService.clearAllNotifications({ businessId });
    res.json({
      success: true,
      message: 'All notifications cleared'
    });
  } catch (error) {
    next(error);
  }
}

export default {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAll
};
