import api from './api';

export const inboxApi = {
  // Conversations
  getConversations: (params = {}) => api.get('/whatsapp/conversations', { params }),
  getConversation: (id) => api.get(`/whatsapp/conversations/${id}`),
  
  // Messages
  getMessages: (id, params = {}) => api.get(`/whatsapp/conversations/${id}/messages`, { params }),
  sendTextMessage: (id, message) => api.post(`/whatsapp/conversations/${id}/messages`, { message }),
  sendTemplateMessage: (id, templatePayload) => api.post(`/whatsapp/conversations/${id}/template`, templatePayload),
  sendMediaMessage: (id, mediaPayload) => api.post(`/whatsapp/conversations/${id}/media`, mediaPayload),

  // Actions
  assignConversation: (id, userId) => api.post(`/whatsapp/conversations/${id}/assign`, { userId }),
  closeConversation: (id) => api.post(`/whatsapp/conversations/${id}/close`),
  reopenConversation: (id) => api.post(`/whatsapp/conversations/${id}/reopen`),
  markRead: (id) => api.post(`/whatsapp/conversations/${id}/read`),
  markUnread: (id) => api.post(`/whatsapp/conversations/${id}/unread`),

  // CRM & Notes
  addNote: (id, note) => api.post(`/whatsapp/conversations/${id}/notes`, { note }),
  getNotes: (id) => api.get(`/whatsapp/conversations/${id}/notes`),
  updateContact: (id, data) => api.patch(`/whatsapp/conversations/${id}/contact`, data),

  // Analytics & Reference Data
  getStats: () => api.get('/whatsapp/inbox/stats'),
  getApprovedTemplates: () => api.get('/whatsapp/templates'),
  getTeamMembers: () => api.get('/users')
};

export default inboxApi;
