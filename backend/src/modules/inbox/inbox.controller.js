import * as inboxService from './inbox.service.js';
import logger from '../../utils/logger.js';

export async function getConversations(req, res, next) {
  try {
    const businessId = req.businessId;
    const user = req.user;
    const { filter, search, page, limit } = req.query;

    const result = await inboxService.listConversations(businessId, user, {
      filter,
      search,
      page,
      limit
    });

    res.json({
      success: true,
      data: result.items,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function getConversation(req, res, next) {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    const conversation = await inboxService.getConversation(businessId, id);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    res.json({ success: true, data: conversation });
  } catch (err) {
    next(err);
  }
}

export async function getMessages(req, res, next) {
  try {
    const businessId = req.businessId;
    const { id } = req.params;
    const { limit, before } = req.query;

    const messages = await inboxService.getMessages(businessId, id, { limit, before });
    res.json({ success: true, data: messages });
  } catch (err) {
    next(err);
  }
}

export async function sendMessage(req, res, next) {
  try {
    const businessId = req.businessId;
    const user = req.user;
    const { id } = req.params;
    const { message } = req.body;

    const created = await inboxService.sendTextMessage(businessId, user, id, message);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    if (err.code === 'SERVICE_WINDOW_EXPIRED') {
      return res.status(403).json({
        success: false,
        code: 'SERVICE_WINDOW_EXPIRED',
        message: err.message
      });
    }
    next(err);
  }
}

export async function sendTemplate(req, res, next) {
  try {
    const businessId = req.businessId;
    const user = req.user;
    const { id } = req.params;
    const templatePayload = req.body;

    const created = await inboxService.sendTemplateMessage(businessId, user, id, templatePayload);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
}

export async function sendMedia(req, res, next) {
  try {
    const businessId = req.businessId;
    const user = req.user;
    const { id } = req.params;
    const mediaPayload = req.body;

    const created = await inboxService.sendMediaMessage(businessId, user, id, mediaPayload);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    if (err.code === 'SERVICE_WINDOW_EXPIRED') {
      return res.status(403).json({
        success: false,
        code: 'SERVICE_WINDOW_EXPIRED',
        message: err.message
      });
    }
    next(err);
  }
}

export async function assign(req, res, next) {
  try {
    const businessId = req.businessId;
    const user = req.user;
    const { id } = req.params;
    const { userId } = req.body;

    const updated = await inboxService.assignConversation(businessId, user, id, userId);
    res.json({ success: true, data: updated, message: 'Conversation assigned successfully' });
  } catch (err) {
    next(err);
  }
}

export async function closeConversation(req, res, next) {
  try {
    const businessId = req.businessId;
    const user = req.user;
    const { id } = req.params;

    const updated = await inboxService.updateStatus(businessId, user, id, 'closed');
    res.json({ success: true, data: updated, message: 'Conversation closed' });
  } catch (err) {
    next(err);
  }
}

export async function reopenConversation(req, res, next) {
  try {
    const businessId = req.businessId;
    const user = req.user;
    const { id } = req.params;

    const updated = await inboxService.updateStatus(businessId, user, id, 'open');
    res.json({ success: true, data: updated, message: 'Conversation reopened' });
  } catch (err) {
    next(err);
  }
}

export async function markRead(req, res, next) {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    await inboxService.markAsRead(businessId, id);
    res.json({ success: true, message: 'Marked as read' });
  } catch (err) {
    next(err);
  }
}

export async function markUnread(req, res, next) {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    await inboxService.markAsUnread(businessId, id);
    res.json({ success: true, message: 'Marked as unread' });
  } catch (err) {
    next(err);
  }
}

export async function addNote(req, res, next) {
  try {
    const businessId = req.businessId;
    const user = req.user;
    const { id } = req.params;
    const { note } = req.body;

    const created = await inboxService.addNote(businessId, user, id, note);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
}

export async function getNotes(req, res, next) {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    const notes = await inboxService.getNotes(businessId, id);
    res.json({ success: true, data: notes });
  } catch (err) {
    next(err);
  }
}

export async function updateContact(req, res, next) {
  try {
    const businessId = req.businessId;
    const { id } = req.params;
    const contactData = req.body;

    const updated = await inboxService.updateContact(businessId, id, contactData);
    res.json({ success: true, data: updated, message: 'Contact updated' });
  } catch (err) {
    next(err);
  }
}

export async function getStats(req, res, next) {
  try {
    const businessId = req.businessId;
    const user = req.user;

    const stats = await inboxService.getInboxStats(businessId, user);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
}

export default {
  getConversations,
  getConversation,
  getMessages,
  sendMessage,
  sendTemplate,
  sendMedia,
  assign,
  closeConversation,
  reopenConversation,
  markRead,
  markUnread,
  addNote,
  getNotes,
  updateContact,
  getStats
};
