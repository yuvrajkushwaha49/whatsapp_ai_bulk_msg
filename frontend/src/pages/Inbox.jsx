import React, { useState, useEffect, useRef } from 'react';
import inboxApi from '../services/inbox.service';
import { initSocket, getSocket } from '../services/socket';
import { useAuth } from '../hooks/useAuth';
import '../styles/inbox.css';

export default function Inbox() {
  const { user } = useAuth();

  // State
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [filter, setFilter] = useState('all'); // all, unread, assigned_to_me, unassigned, closed
  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [showCrmPanel, setShowCrmPanel] = useState(true);
  const [stats, setStats] = useState(null);

  // CRM details & notes
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [teamMembers, setTeamMembers] = useState([]);
  const [newTagInput, setNewTagInput] = useState('');

  // Template Modal
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateVariables, setTemplateVariables] = useState({});
  const [sendingTemplate, setSendingTemplate] = useState(false);

  // Media Modal
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [mediaType, setMediaType] = useState('image');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaCaption, setMediaCaption] = useState('');
  const [sendingMedia, setSendingMedia] = useState(false);

  // Notification / Alert
  const [alertMsg, setAlertMsg] = useState(null);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // 1. Initial Load: Conversations, Stats, Team Members, Approved Templates
  useEffect(() => {
    loadConversations();
    loadStats();
    loadTeamMembers();
    loadTemplates();

    // Setup Socket.IO
    const socket = initSocket();
    if (socket) {
      socket.on('inbox:new_message', handleIncomingSocketMessage);
      socket.on('inbox:message_status', handleSocketStatusUpdate);
      socket.on('inbox:conversation_updated', handleSocketConversationUpdated);
    }

    // Polling fallback every 8 seconds
    const interval = setInterval(() => {
      loadConversations(false);
      loadStats();
    }, 8000);

    return () => {
      clearInterval(interval);
      if (socket) {
        socket.off('inbox:new_message', handleIncomingSocketMessage);
        socket.off('inbox:message_status', handleSocketStatusUpdate);
        socket.off('inbox:conversation_updated', handleSocketConversationUpdated);
      }
    };
  }, [filter, searchQuery]);

  // Join conversation socket room on selection
  useEffect(() => {
    if (selectedConversation?.id) {
      loadMessages(selectedConversation.id);
      loadNotes(selectedConversation.id);

      const socket = getSocket();
      if (socket) {
        socket.emit('join_conversation', selectedConversation.id);
      }

      return () => {
        if (socket) {
          socket.emit('leave_conversation', selectedConversation.id);
        }
      };
    } else {
      setMessages([]);
      setNotes([]);
    }
  }, [selectedConversation?.id]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 2. Fetch Handlers
  const loadConversations = async (showLoading = true) => {
    if (showLoading) setLoadingConversations(true);
    try {
      const res = await inboxApi.getConversations({
        filter,
        search: searchQuery
      });
      if (res.data?.success) {
        setConversations(res.data.data || []);
        // If selected conversation was updated, sync its metadata
        if (selectedConversation) {
          const updatedSelected = res.data.data.find(c => c.id === selectedConversation.id);
          if (updatedSelected) {
            setSelectedConversation(prev => ({ ...prev, ...updatedSelected }));
          }
        }
      }
    } catch (err) {
      console.error('[Inbox] Error loading conversations:', err);
    } finally {
      if (showLoading) setLoadingConversations(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await inboxApi.getStats();
      if (res.data?.success) {
        setStats(res.data.data);
      }
    } catch (err) {
      console.error('[Inbox] Error loading stats:', err);
    }
  };

  const loadTeamMembers = async () => {
    try {
      const res = await inboxApi.getTeamMembers();
      if (res.data?.success) {
        setTeamMembers(res.data.data || []);
      }
    } catch (err) {
      // Fallback sample team member list
      setTeamMembers([
        { id: 2, name: 'Rahul Sharma (Owner)' },
        { id: 4, name: 'Amit Verma (Agent)' },
        { id: 5, name: 'Pooja Singh (Marketer)' }
      ]);
    }
  };

  const loadTemplates = async () => {
    try {
      const res = await inboxApi.getApprovedTemplates();
      if (res.data?.success) {
        const approvedOnly = (res.data.data || []).filter(t => t.status === 'APPROVED');
        setTemplates(approvedOnly);
      }
    } catch (err) {
      console.error('[Inbox] Error loading templates:', err);
    }
  };

  const loadMessages = async (convId) => {
    setLoadingMessages(true);
    try {
      const res = await inboxApi.getMessages(convId);
      if (res.data?.success) {
        setMessages(res.data.data || []);
        // Decrease unread count locally in list
        setConversations(prev =>
          prev.map(c => (c.id === convId ? { ...c, unread_count: 0 } : c))
        );
      }
    } catch (err) {
      console.error('[Inbox] Error loading messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const loadNotes = async (convId) => {
    try {
      const res = await inboxApi.getNotes(convId);
      if (res.data?.success) {
        setNotes(res.data.data || []);
      }
    } catch (err) {
      console.error('[Inbox] Error loading notes:', err);
    }
  };

  // 3. Socket Handlers
  const handleIncomingSocketMessage = (data) => {
    const { conversation, message } = data;
    if (!message) return;

    // If belongs to currently viewed conversation, append immediately
    if (selectedConversation && (message.conversation_id === selectedConversation.id || data.conversationId === selectedConversation.id)) {
      setMessages(prev => {
        if (prev.some(m => m.id === message.id || (m.meta_message_id && m.meta_message_id === message.meta_message_id))) {
          return prev;
        }
        return [...prev, message];
      });
    }

    // Update conversation in list
    setConversations(prev => {
      const idx = prev.findIndex(c => c.id === (conversation?.id || message.conversation_id));
      if (idx !== -1) {
        const updated = [...prev];
        const existing = updated[idx];
        const isCurrentActive = selectedConversation?.id === existing.id;
        updated[idx] = {
          ...existing,
          last_message_text: message.message_body,
          last_message_at: message.created_at || new Date(),
          unread_count: isCurrentActive ? 0 : (existing.unread_count || 0) + (message.direction === 'INBOUND' ? 1 : 0),
          service_window_expires_at: conversation?.service_window_expires_at || existing.service_window_expires_at,
          is_window_open: true
        };
        // Move to top
        const item = updated.splice(idx, 1)[0];
        return [item, ...updated];
      } else if (conversation) {
        return [conversation, ...prev];
      }
      return prev;
    });
  };

  const handleSocketStatusUpdate = (data) => {
    const { messageId, metaMessageId, status } = data;
    setMessages(prev =>
      prev.map(m => {
        if (m.id === messageId || m.meta_message_id === metaMessageId) {
          return { ...m, message_status: status };
        }
        return m;
      })
    );
  };

  const handleSocketConversationUpdated = (data) => {
    const { conversation } = data;
    if (!conversation) return;
    setConversations(prev =>
      prev.map(c => (c.id === conversation.id ? { ...c, ...conversation } : c))
    );
    if (selectedConversation?.id === conversation.id) {
      setSelectedConversation(prev => ({ ...prev, ...conversation }));
    }
  };

  // 4. Send Message Handler
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || !selectedConversation || sending) return;

    // Pre-check 24h window
    if (!selectedConversation.is_window_open) {
      setAlertMsg({
        type: 'warning',
        text: 'The 24-hour customer service window has expired. You can only send approved WhatsApp Templates.'
      });
      setShowTemplateModal(true);
      return;
    }

    setSending(true);
    setAlertMsg(null);

    try {
      const res = await inboxApi.sendTextMessage(selectedConversation.id, text);
      if (res.data?.success) {
        const newMsg = res.data.data;
        setMessages(prev => [...prev, newMsg]);
        setInputText('');
        // Update list snippet
        setConversations(prev =>
          prev.map(c =>
            c.id === selectedConversation.id
              ? { ...c, last_message_text: text, last_message_at: new Date() }
              : c
          )
        );
      }
    } catch (err) {
      console.error('[Inbox] Send error:', err);
      const isExpired = err.response?.data?.code === 'SERVICE_WINDOW_EXPIRED';
      setAlertMsg({
        type: 'danger',
        text: err.response?.data?.message || 'Failed to send message. Please try again.'
      });
      if (isExpired) {
        setSelectedConversation(prev => ({ ...prev, is_window_open: false }));
        setShowTemplateModal(true);
      }
    } finally {
      setSending(false);
    }
  };

  // 5. Template Message Handler
  const handleOpenTemplateModal = () => {
    setSelectedTemplate(templates[0] || null);
    setTemplateVariables({});
    setShowTemplateModal(true);
  };

  const handleSendTemplate = async () => {
    if (!selectedTemplate || !selectedConversation || sendingTemplate) return;

    setSendingTemplate(true);
    setAlertMsg(null);

    try {
      const payload = {
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        language: selectedTemplate.language || 'en',
        variableMappings: templateVariables
      };

      const res = await inboxApi.sendTemplateMessage(selectedConversation.id, payload);
      if (res.data?.success) {
        const newMsg = res.data.data;
        setMessages(prev => [...prev, newMsg]);
        setShowTemplateModal(false);
        setAlertMsg({
          type: 'success',
          text: `Template "${selectedTemplate.name}" dispatched successfully!`
        });

        // Update conversation in list
        setConversations(prev =>
          prev.map(c =>
            c.id === selectedConversation.id
              ? { ...c, last_message_text: `[Template: ${selectedTemplate.name}]`, last_message_at: new Date() }
              : c
          )
        );
      }
    } catch (err) {
      console.error('[Inbox] Template send error:', err);
      setAlertMsg({
        type: 'danger',
        text: err.response?.data?.message || 'Failed to send template message.'
      });
    } finally {
      setSendingTemplate(false);
    }
  };

  // 6. Media Message Handler
  const handleSendMedia = async () => {
    if (!mediaUrl.trim() || !selectedConversation || sendingMedia) return;

    setSendingMedia(true);
    setAlertMsg(null);

    try {
      const payload = {
        mediaType,
        mediaUrl: mediaUrl.trim(),
        caption: mediaCaption.trim()
      };

      const res = await inboxApi.sendMediaMessage(selectedConversation.id, payload);
      if (res.data?.success) {
        const newMsg = res.data.data;
        setMessages(prev => [...prev, newMsg]);
        setShowMediaModal(false);
        setMediaUrl('');
        setMediaCaption('');
        setAlertMsg({
          type: 'success',
          text: 'Media message sent successfully!'
        });
      }
    } catch (err) {
      console.error('[Inbox] Media send error:', err);
      setAlertMsg({
        type: 'danger',
        text: err.response?.data?.message || 'Failed to send media message.'
      });
    } finally {
      setSendingMedia(false);
    }
  };

  // 7. Conversation Status & Assignment Actions
  const handleAssignAgent = async (targetUserId) => {
    if (!selectedConversation) return;
    try {
      const res = await inboxApi.assignConversation(selectedConversation.id, targetUserId);
      if (res.data?.success) {
        setSelectedConversation(prev => ({
          ...prev,
          assigned_user_id: targetUserId ? Number(targetUserId) : null
        }));
        loadConversations(false);
      }
    } catch (err) {
      console.error('[Inbox] Assign error:', err);
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedConversation) return;
    const isClosed = selectedConversation.status === 'closed';
    try {
      if (isClosed) {
        await inboxApi.reopenConversation(selectedConversation.id);
        setSelectedConversation(prev => ({ ...prev, status: 'open' }));
      } else {
        await inboxApi.closeConversation(selectedConversation.id);
        setSelectedConversation(prev => ({ ...prev, status: 'closed' }));
      }
      loadConversations(false);
    } catch (err) {
      console.error('[Inbox] Status toggle error:', err);
    }
  };

  const handleMarkUnread = async () => {
    if (!selectedConversation) return;
    try {
      await inboxApi.markUnread(selectedConversation.id);
      setSelectedConversation(prev => ({ ...prev, unread_count: 1 }));
      loadConversations(false);
    } catch (err) {
      console.error('[Inbox] Mark unread error:', err);
    }
  };

  // 8. CRM Notes & Tags Actions
  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim() || !selectedConversation) return;

    try {
      const res = await inboxApi.addNote(selectedConversation.id, newNote);
      if (res.data?.success) {
        setNotes(prev => [res.data.data, ...prev]);
        setNewNote('');
      }
    } catch (err) {
      console.error('[Inbox] Note error:', err);
    }
  };

  const handleAddTag = async () => {
    if (!newTagInput.trim() || !selectedConversation?.contact) return;
    const currentTags = selectedConversation.contact.tags || [];
    if (currentTags.includes(newTagInput.trim())) return;

    const updatedTags = [...currentTags, newTagInput.trim()];
    try {
      await inboxApi.updateContact(selectedConversation.id, { tags: updatedTags });
      setSelectedConversation(prev => ({
        ...prev,
        contact: { ...prev.contact, tags: updatedTags }
      }));
      setNewTagInput('');
    } catch (err) {
      console.error('[Inbox] Tag error:', err);
    }
  };

  const handleRemoveTag = async (tagToRemove) => {
    if (!selectedConversation?.contact) return;
    const updatedTags = (selectedConversation.contact.tags || []).filter(t => t !== tagToRemove);
    try {
      await inboxApi.updateContact(selectedConversation.id, { tags: updatedTags });
      setSelectedConversation(prev => ({
        ...prev,
        contact: { ...prev.contact, tags: updatedTags }
      }));
    } catch (err) {
      console.error('[Inbox] Remove tag error:', err);
    }
  };

  // Format Helpers
  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const formatWindowRemaining = (ms) => {
    if (!ms || ms <= 0) return 'Expired';
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m left`;
  };

  return (
    <div className="container-fluid py-2 px-3">
      {/* Top Notification Toast */}
      {alertMsg && (
        <div className={`alert alert-${alertMsg.type} alert-dismissible fade show py-2 mb-2 shadow-sm`} role="alert">
          <div className="d-flex align-items-center justify-content-between">
            <span className="small">{alertMsg.text}</span>
            <button type="button" className="btn-close py-2" onClick={() => setAlertMsg(null)}></button>
          </div>
        </div>
      )}

      {/* Main 3-Column WhatsApp Web Layout */}
      <div className="inbox-wrapper">
        {/* ==================================================================
            LEFT COLUMN: Conversations List & Filters
            ================================================================== */}
        <div className="inbox-sidebar">
          {/* Header & Search */}
          <div className="inbox-sidebar-header">
            <div className="d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-whatsapp text-success fs-5"></i>
                <h5 className="mb-0 fw-bold fs-6">WhatsApp Inbox</h5>
              </div>
              {stats && (
                <span className="badge bg-success-subtle text-success border border-success-subtle">
                  {stats.open} Open • {stats.unread} Unread
                </span>
              )}
            </div>

            {/* Search Input */}
            <div className="inbox-search-box">
              <i className="bi bi-search"></i>
              <input
                type="text"
                className="form-control"
                placeholder="Search name or +91..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Filter Chips Bar */}
          <div className="inbox-filters-bar">
            {[
              { id: 'all', label: 'All' },
              { id: 'unread', label: 'Unread' },
              { id: 'assigned_to_me', label: 'Assigned to Me' },
              { id: 'unassigned', label: 'Unassigned' },
              { id: 'closed', label: 'Closed' }
            ].map((f) => (
              <span
                key={f.id}
                className={`filter-chip ${filter === f.id ? 'active' : ''}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </span>
            ))}
          </div>

          {/* Conversations Scrollable List */}
          <div className="conversation-list">
            {loadingConversations ? (
              <div className="p-4 text-center text-muted">
                <div className="spinner-border spinner-border-sm text-success me-2" role="status"></div>
                <span className="small">Loading conversations...</span>
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-center text-muted">
                <i className="bi bi-chat-square-text fs-3 d-block mb-2 text-secondary"></i>
                <div className="fw-semibold small">No conversations found</div>
                <div className="text-secondary" style={{ fontSize: '0.75rem' }}>
                  Incoming messages from WhatsApp will automatically appear here.
                </div>
              </div>
            ) : (
              conversations.map((c) => {
                const isActive = selectedConversation?.id === c.id;
                const contactName = c.contact?.name || c.customer_phone;
                const initials = contactName.slice(0, 2).toUpperCase();

                return (
                  <div
                    key={c.id}
                    className={`conversation-item ${isActive ? 'active' : ''}`}
                    onClick={() => setSelectedConversation(c)}
                  >
                    {/* Avatar with 24h Window Indicator */}
                    <div className="conversation-avatar">
                      {initials}
                      <span
                        className={`window-indicator-dot ${c.is_window_open ? 'active' : 'expired'}`}
                        title={c.is_window_open ? '24h Service Window Open' : '24h Window Expired'}
                      ></span>
                    </div>

                    {/* Metadata & Preview */}
                    <div className="conversation-info">
                      <div className="conversation-header-row">
                        <span className="conversation-name">{contactName}</span>
                        <span className="conversation-time">{formatTime(c.last_message_at || c.updated_at)}</span>
                      </div>
                      <div className="conversation-preview-row">
                        <span className="conversation-snippet">
                          {c.last_message_text || 'No message preview'}
                        </span>
                        {c.unread_count > 0 && (
                          <span className="unread-badge">{c.unread_count}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ==================================================================
            MIDDLE COLUMN: Chat Window
            ================================================================== */}
        <div className={`inbox-chat ${selectedConversation ? 'mobile-active' : ''}`}>
          {selectedConversation ? (
            <>
              {/* Chat Top Header */}
              <div className="chat-header">
                <div className="chat-header-user">
                  <div className="chat-header-avatar">
                    {(selectedConversation.contact?.name || selectedConversation.customer_phone).slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="fw-bold fs-6 text-dark mb-0">
                      {selectedConversation.contact?.name || selectedConversation.customer_phone}
                    </div>
                    <div className="small text-muted d-flex align-items-center gap-2" style={{ fontSize: '0.75rem' }}>
                      <span>{selectedConversation.customer_phone}</span>
                      <span>•</span>
                      {selectedConversation.assigned_user ? (
                        <span className="text-secondary">Assigned: {selectedConversation.assigned_user.name}</span>
                      ) : (
                        <span className="text-warning">Unassigned</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Header Action Buttons */}
                <div className="d-flex align-items-center gap-2">
                  {/* Service Window Badge */}
                  <span
                    className={`service-window-badge ${selectedConversation.is_window_open ? 'open' : 'expired'}`}
                  >
                    <i className="bi bi-clock"></i>
                    {selectedConversation.is_window_open
                      ? `24h Window: ${formatWindowRemaining(selectedConversation.window_remaining_ms)}`
                      : '24h Window Closed'}
                  </span>

                  {/* Send Template Button */}
                  <button
                    className="btn btn-sm btn-outline-success d-flex align-items-center gap-1"
                    onClick={handleOpenTemplateModal}
                    title="Send Approved WhatsApp Template"
                  >
                    <i className="bi bi-card-text"></i>
                    <span className="d-none d-md-inline">Template</span>
                  </button>

                  {/* Toggle CRM Details Sidebar */}
                  <button
                    className={`btn btn-sm ${showCrmPanel ? 'btn-success' : 'btn-outline-secondary'}`}
                    onClick={() => setShowCrmPanel(!showCrmPanel)}
                    title="Toggle Customer Information Panel"
                  >
                    <i className="bi bi-person-lines-fill"></i>
                  </button>
                </div>
              </div>

              {/* Expired Window Alert Banner */}
              {!selectedConversation.is_window_open && (
                <div className="service-window-banner">
                  <div className="d-flex align-items-center gap-2">
                    <i className="bi bi-exclamation-triangle-fill fs-5"></i>
                    <div>
                      <strong>24-Hour Customer Service Window Closed.</strong> Under Meta WhatsApp policies, free-form messages cannot be sent. You can re-open the conversation by sending an approved WhatsApp Template.
                    </div>
                  </div>
                  <button
                    className="btn btn-sm btn-warning fw-semibold ms-3"
                    onClick={handleOpenTemplateModal}
                  >
                    Choose Template
                  </button>
                </div>
              )}

              {/* Message History Feed */}
              <div className="chat-messages-container">
                <div className="date-divider">
                  <span className="date-pill">Messages Encrypted & Stored via Meta Cloud API</span>
                </div>

                {loadingMessages ? (
                  <div className="text-center py-4 text-muted">
                    <div className="spinner-border spinner-border-sm text-success me-2" role="status"></div>
                    <span>Loading message history...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-5 text-muted">
                    <i className="bi bi-chat-heart fs-1 text-secondary opacity-50 d-block mb-2"></i>
                    <div className="small">No messages yet. Send a message or template to start chatting.</div>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isInbound = m.direction === 'INBOUND';
                    const isTemplate = m.message_type === 'template';

                    return (
                      <div
                        key={m.id || m.meta_message_id}
                        className={`message-row ${isInbound ? 'inbound' : 'outbound'}`}
                      >
                        <div className={`message-bubble ${isInbound ? 'inbound' : 'outbound'}`}>
                          {/* Template Header Badge */}
                          {isTemplate && (
                            <div className="badge bg-secondary-subtle text-secondary border mb-1 d-inline-block small">
                              <i className="bi bi-patch-check-fill text-success me-1"></i>
                              Approved Template
                            </div>
                          )}

                          {/* Media Preview if attached */}
                          {m.media_url && (
                            <div className="mb-2">
                              {m.message_type === 'image' ? (
                                <img
                                  src={m.media_url}
                                  alt="media"
                                  className="img-fluid rounded"
                                  style={{ maxHeight: '200px' }}
                                />
                              ) : (
                                <div className="p-2 bg-light rounded border d-flex align-items-center gap-2">
                                  <i className="bi bi-file-earmark-text fs-4 text-primary"></i>
                                  <a href={m.media_url} target="_blank" rel="noopener noreferrer" className="small">
                                    View Attached {m.message_type}
                                  </a>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Message Body Content */}
                          <div>{m.message_body}</div>

                          {/* Meta timestamp & status ticks */}
                          <div className="message-meta">
                            <span>{formatTime(m.created_at)}</span>
                            {!isInbound && (
                              <span className="ms-1">
                                {m.message_status === 'read' ? (
                                  <i className="bi bi-check2-all tick-icon read" title="Read"></i>
                                ) : m.message_status === 'delivered' ? (
                                  <i className="bi bi-check2-all tick-icon delivered" title="Delivered"></i>
                                ) : m.message_status === 'failed' ? (
                                  <i className="bi bi-exclamation-circle-fill tick-icon failed" title={m.failure_reason || 'Failed'}></i>
                                ) : (
                                  <i className="bi bi-check tick-icon sent" title="Sent"></i>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Bottom Message Composer */}
              <div className="chat-composer">
                {/* Media Attachment Button */}
                <button
                  type="button"
                  className="btn btn-outline-secondary border-0 text-secondary fs-5 p-1"
                  onClick={() => setShowMediaModal(true)}
                  disabled={!selectedConversation.is_window_open}
                  title={selectedConversation.is_window_open ? 'Attach Media' : 'Window closed'}
                >
                  <i className="bi bi-paperclip"></i>
                </button>

                {/* Input Textarea */}
                <div className="composer-input-wrapper">
                  <textarea
                    ref={textareaRef}
                    rows="1"
                    placeholder={
                      selectedConversation.is_window_open
                        ? 'Type a message... (Enter to send, Shift+Enter for newline)'
                        : '24-hour service window expired. Click Template to reply.'
                    }
                    value={inputText}
                    disabled={!selectedConversation.is_window_open || sending}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                </div>

                {/* Send Button */}
                <button
                  type="button"
                  className="btn-send-whatsapp"
                  onClick={handleSendMessage}
                  disabled={!inputText.trim() || sending || !selectedConversation.is_window_open}
                  title="Send message"
                >
                  {sending ? (
                    <div className="spinner-border spinner-border-sm text-white" role="status"></div>
                  ) : (
                    <i className="bi bi-send-fill"></i>
                  )}
                </button>
              </div>
            </>
          ) : (
            /* Empty State when no conversation is selected */
            <div className="d-flex flex-column align-items-center justify-content-center h-100 p-4 text-center text-muted">
              <div className="rounded-circle bg-white p-4 shadow-sm mb-3">
                <i className="bi bi-whatsapp text-success" style={{ fontSize: '3rem' }}></i>
              </div>
              <h5 className="fw-bold text-dark">CampaignFlow WhatsApp Inbox</h5>
              <p className="text-secondary small max-w-sm" style={{ maxWidth: '420px' }}>
                Select a conversation from the left to start live two-way customer communication, review chat history, or dispatch Meta-approved templates.
              </p>
            </div>
          )}
        </div>

        {/* ==================================================================
            RIGHT COLUMN: Customer Details CRM Panel
            ================================================================== */}
        {selectedConversation && showCrmPanel && (
          <div className="inbox-crm">
            <div className="crm-header">
              <h6 className="mb-0 fw-bold fs-6">Customer Details</h6>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowCrmPanel(false)}
              ></button>
            </div>

            {/* Profile Summary Card */}
            <div className="crm-profile-card">
              <div className="crm-avatar">
                {(selectedConversation.contact?.name || selectedConversation.customer_phone).slice(0, 2).toUpperCase()}
              </div>
              <h6 className="fw-bold mb-1 text-dark">
                {selectedConversation.contact?.name || selectedConversation.customer_phone}
              </h6>
              <div className="text-muted small">{selectedConversation.customer_phone}</div>
              {selectedConversation.contact?.email && (
                <div className="text-secondary small">{selectedConversation.contact.email}</div>
              )}
            </div>

            {/* Quick Actions (Close/Reopen, Mark Unread) */}
            <div className="crm-section">
              <div className="crm-section-title">Conversation Actions</div>
              <div className="d-grid gap-2">
                <button
                  className={`btn btn-sm ${selectedConversation.status === 'closed' ? 'btn-success' : 'btn-outline-danger'}`}
                  onClick={handleToggleStatus}
                >
                  <i className={`bi ${selectedConversation.status === 'closed' ? 'bi-arrow-counterclockwise' : 'bi-check2-circle'} me-1`}></i>
                  {selectedConversation.status === 'closed' ? 'Reopen Conversation' : 'Close Conversation'}
                </button>
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={handleMarkUnread}
                >
                  <i className="bi bi-envelope-badge me-1"></i>
                  Mark as Unread
                </button>
              </div>
            </div>

            {/* Agent Assignment */}
            <div className="crm-section">
              <div className="crm-section-title">Assigned Agent</div>
              <select
                className="form-select form-select-sm"
                value={selectedConversation.assigned_user_id || ''}
                onChange={(e) => handleAssignAgent(e.target.value)}
              >
                <option value="">Unassigned</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Customer Tags Manager */}
            <div className="crm-section">
              <div className="crm-section-title">Customer Tags</div>
              <div className="d-flex flex-wrap gap-1 mb-2">
                {(selectedConversation.contact?.tags || []).map((tag, idx) => (
                  <span
                    key={idx}
                    className="badge bg-light text-dark border d-flex align-items-center gap-1"
                  >
                    {tag}
                    <i
                      className="bi bi-x text-muted cursor-pointer"
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleRemoveTag(tag)}
                    ></i>
                  </span>
                ))}
              </div>
              <div className="input-group input-group-sm">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Add tag..."
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                />
                <button className="btn btn-outline-secondary" onClick={handleAddTag}>
                  Add
                </button>
              </div>
            </div>

            {/* Internal CRM Notes */}
            <div className="crm-section">
              <div className="crm-section-title">Customer Notes ({notes.length})</div>
              <form onSubmit={handleAddNote} className="mb-2">
                <textarea
                  className="form-control form-control-sm mb-1"
                  rows="2"
                  placeholder="Add internal note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                ></textarea>
                <button
                  type="submit"
                  className="btn btn-sm btn-outline-success w-100"
                  disabled={!newNote.trim()}
                >
                  Save Note
                </button>
              </form>

              <div className="notes-feed">
                {notes.map((n) => (
                  <div key={n.id} className="note-card">
                    <div className="note-meta">
                      <span className="fw-semibold text-dark">{n.user_name || 'Agent'}</span>
                      <span>{formatTime(n.created_at)}</span>
                    </div>
                    <div>{n.note}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ==================================================================
          TEMPLATE SELECTOR MODAL (Reusing Existing Templates Module)
          ================================================================== */}
      {showTemplateModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-card-text text-success me-2"></i>
                  Send Approved WhatsApp Template
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowTemplateModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="alert alert-info py-2 small mb-3">
                  <i className="bi bi-info-circle me-1"></i>
                  Approved WhatsApp templates can be sent at any time, even after the 24-hour customer service window has expired.
                </div>

                <div className="row g-3">
                  {/* Template Picker */}
                  <div className="col-md-5">
                    <label className="form-label fw-semibold small">Choose Template</label>
                    <div className="list-group" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                      {templates.length === 0 ? (
                        <div className="p-3 text-center text-muted small">
                          No approved templates available in this account.
                        </div>
                      ) : (
                        templates.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            className={`list-group-item list-group-item-action ${selectedTemplate?.id === t.id ? 'active' : ''}`}
                            onClick={() => {
                              setSelectedTemplate(t);
                              setTemplateVariables({});
                            }}
                          >
                            <div className="fw-bold small">{t.name}</div>
                            <div className="d-flex justify-content-between small text-secondary">
                              <span>{t.category}</span>
                              <span className="badge bg-success-subtle text-success">Approved</span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Template Preview & Dynamic Variables */}
                  <div className="col-md-7">
                    {selectedTemplate ? (
                      <div>
                        <label className="form-label fw-semibold small">Template Preview & Variables</label>
                        <div className="template-modal-preview mb-3">
                          <div className="fw-bold small text-success mb-1">
                            {selectedTemplate.name} ({selectedTemplate.language})
                          </div>
                          <div className="small text-dark">
                            {selectedTemplate.body_text || selectedTemplate.components_json || 'Template content'}
                          </div>
                        </div>

                        {/* Dynamic Variable Inputs */}
                        <div className="bg-light p-2 rounded border">
                          <div className="small fw-semibold mb-2">Dynamic Variables:</div>
                          <div className="row g-2">
                            <div className="col-6">
                              <label className="form-label" style={{ fontSize: '0.72rem' }}>{'{{1}}'}</label>
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="Customer Name or Value"
                                value={templateVariables['1'] || ''}
                                onChange={(e) => setTemplateVariables({ ...templateVariables, '1': e.target.value })}
                              />
                            </div>
                            <div className="col-6">
                              <label className="form-label" style={{ fontSize: '0.72rem' }}>{'{{2}}'}</label>
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="Order / Offer / Value"
                                value={templateVariables['2'] || ''}
                                onChange={(e) => setTemplateVariables({ ...templateVariables, '2': e.target.value })}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-5 text-muted small">
                        Select a template on the left to customize variables.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setShowTemplateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-success"
                  onClick={handleSendTemplate}
                  disabled={!selectedTemplate || sendingTemplate}
                >
                  {sendingTemplate ? 'Dispatching...' : 'Send WhatsApp Template'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================
          MEDIA ATTACHMENT MODAL
          ================================================================== */}
      {showMediaModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-paperclip text-success me-2"></i>
                  Send Media Attachment
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowMediaModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label small fw-semibold">Media Type</label>
                  <select
                    className="form-select form-select-sm"
                    value={mediaType}
                    onChange={(e) => setMediaType(e.target.value)}
                  >
                    <option value="image">Image (JPEG, PNG)</option>
                    <option value="document">Document (PDF)</option>
                    <option value="video">Video (MP4)</option>
                    <option value="audio">Audio (MP3, OGG)</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-semibold">Public Media URL / S3 Link</label>
                  <input
                    type="url"
                    className="form-control form-control-sm"
                    placeholder="https://example.com/assets/catalogue.pdf"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-semibold">Caption (Optional)</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="e.g. Here is our festive catalogue"
                    value={mediaCaption}
                    onChange={(e) => setMediaCaption(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShowMediaModal(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-success"
                  onClick={handleSendMedia}
                  disabled={!mediaUrl.trim() || sendingMedia}
                >
                  {sendingMedia ? 'Sending Media...' : 'Send Media'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
