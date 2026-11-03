import React, { useState, useEffect, useRef } from 'react';
import inboxApi from '../services/inbox.service';
import api from '../services/api';
import { initSocket, getSocket } from '../services/socket';
import { useAuth } from '../hooks/useAuth';
import '../styles/inbox.css';

export default function Inbox() {
  const { user } = useAuth();

  // Multi-Account Selection State
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('all');

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
  const [copiedPhone, setCopiedPhone] = useState(false);

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

  // 1. Initial Load: Accounts, Conversations, Stats, Team Members, Approved Templates
  useEffect(() => {
    loadAccounts();
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
  }, [filter, searchQuery, selectedAccountId]);

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

  // Auto-resize composer textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [inputText]);

  // 2. Fetch Handlers
  const loadAccounts = async () => {
    try {
      const res = await api.get('/whatsapp/accounts');
      if (res.data?.success) {
        setAccounts(res.data.data || []);
      }
    } catch (err) {
      console.warn('[Inbox] Failed to load WhatsApp accounts:', err);
    }
  };

  useEffect(() => {
    loadConversations();
  }, [filter, searchQuery, selectedAccountId]);

  const loadConversations = async (showLoading = true) => {
    if (showLoading) setLoadingConversations(true);
    try {
      const res = await inboxApi.getConversations({
        filter,
        search: searchQuery,
        accountId: selectedAccountId
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
      console.error('[Inbox] Send error response data:', err.response?.data);
      const isExpired = err.response?.data?.code === 'SERVICE_WINDOW_EXPIRED';
      setAlertMsg({
        type: 'danger',
        text: err.response?.data?.error?.message || err.response?.data?.message || 'Failed to send message. Please try again.'
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
  const initTemplateVars = (tpl) => {
    if (!tpl) return {};
    const comps = Array.isArray(tpl.components)
      ? tpl.components
      : (typeof tpl.components === 'string' ? JSON.parse(tpl.components || '[]') : []);
    const bodyComp = comps.find(c => (c.type || '').toUpperCase() === 'BODY');
    const text = tpl.body_text || bodyComp?.text || '';
    const placeholders = Array.from(new Set((text.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) || []).map(p => p.replace(/[{}]/g, ''))));
    if (placeholders.length === 0 && tpl.name === 'welcome_msg') {
      placeholders.push('customer_name');
    }
    const initial = {};
    const custName = selectedConversation?.contact?.first_name || 
                     selectedConversation?.contact?.name || 
                     selectedConversation?.customer_name || 
                     'Customer';
    placeholders.forEach(ph => {
      if (ph === 'customer_name' || ph === '1') {
        initial[ph] = custName;
      } else {
        initial[ph] = '';
      }
    });
    return initial;
  };

  const handleOpenTemplateModal = () => {
    const defaultTpl = templates.find(t => t.name === 'welcome_msg') || templates[0] || null;
    setSelectedTemplate(defaultTpl);
    setTemplateVariables(initTemplateVars(defaultTpl));
    setShowTemplateModal(true);
  };

  const handleSendTemplate = async () => {
    if (!selectedTemplate || !selectedConversation || sendingTemplate) return;

    setSendingTemplate(true);
    setAlertMsg(null);

    try {
      const varsToSend = { ...templateVariables };
      const custName = selectedConversation?.contact?.first_name || 
                       selectedConversation?.contact?.name || 
                       selectedConversation?.customer_name || 
                       'Customer';
      if (!varsToSend.customer_name && selectedTemplate.name === 'welcome_msg') {
        varsToSend.customer_name = custName;
      }

      const payload = {
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        language: selectedTemplate.language || 'en',
        variableMappings: varsToSend
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
        text: err.response?.data?.error?.message || err.response?.data?.message || 'Failed to send template message.'
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
        text: err.response?.data?.error?.message || err.response?.data?.message || 'Failed to send media message.'
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
    const isThisYear = d.getFullYear() === now.getFullYear();
    if (isThisYear) {
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    return d.toLocaleDateString([], { month: '2-digit', day: '2-digit', year: '2-digit' });
  };

  const formatWindowRemaining = (ms) => {
    if (!ms || ms <= 0) return 'Expired';
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m left`;
  };

  const copyPhoneNumber = (phone) => {
    if (!phone) return;
    navigator.clipboard?.writeText(phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  return (
    <div className="inbox-page-container">
      {/* Top Notification Toast */}
      {alertMsg && (
        <div
          className={`alert alert-${alertMsg.type} alert-dismissible fade show m-2 py-2 px-3 shadow-sm border-0`}
          role="alert"
          style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 1050, minWidth: '320px' }}
        >
          <div className="d-flex align-items-center justify-content-between">
            <span className="small fw-medium">{alertMsg.text}</span>
            <button type="button" className="btn-close py-2" onClick={() => setAlertMsg(null)}></button>
          </div>
        </div>
      )}

      {/* Main 3-Column Authentic WhatsApp Web Layout */}
      <div className="inbox-wrapper">
        {/* ==================================================================
            LEFT COLUMN: Conversations List & Filters
            ================================================================== */}
        <div className="inbox-sidebar">
          {/* Header & Account Selection */}
          <div className="inbox-sidebar-header">
            <div className="inbox-sidebar-toprow">
              <div className="inbox-brand-badge">
                <div className="inbox-brand-icon">
                  <i className="bi bi-whatsapp"></i>
                </div>
                <div>
                  <div className="inbox-brand-title">WhatsApp Inbox</div>
                  <div className="inbox-brand-subtitle">
                    {stats ? `${stats.open} Open • ${stats.unread} Unread` : 'Two-way live chat'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-light border-0 rounded-circle d-flex align-items-center justify-content-center text-secondary"
                style={{ width: '32px', height: '32px' }}
                onClick={() => {
                  loadConversations(true);
                  loadStats();
                }}
                title="Refresh Conversations"
              >
                <i className={`bi bi-arrow-clockwise ${loadingConversations ? 'spin' : ''}`}></i>
              </button>
            </div>

            {/* Multi-Account Selection Pill */}
            {accounts.length > 0 && (
              <div className="inbox-account-pill">
                <i className="bi bi-phone text-success"></i>
                <select
                  className="inbox-account-select"
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                >
                  <option value="all">All WhatsApp Numbers ({accounts.length})</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.phone_number} {acc.is_primary ? '★ Primary' : ''} — {acc.display_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Search Input */}
            <div className="inbox-search-box">
              <i className="bi bi-search search-icon"></i>
              <input
                type="text"
                className="inbox-search-input"
                placeholder="Search or start new chat..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="inbox-search-clear"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                >
                  <i className="bi bi-x-circle-fill"></i>
                </button>
              )}
            </div>
          </div>

          {/* Filter Chips Bar */}
          <div className="inbox-filters-bar">
            {[
              { id: 'all', label: 'All', count: stats?.open },
              { id: 'unread', label: 'Unread', count: stats?.unread },
              { id: 'assigned_to_me', label: 'Mine' },
              { id: 'unassigned', label: 'Unassigned', count: stats?.unassigned },
              { id: 'closed', label: 'Closed', count: stats?.closed }
            ].map((f) => (
              <span
                key={f.id}
                className={`filter-chip ${filter === f.id ? 'active' : ''}`}
                onClick={() => setFilter(f.id)}
              >
                <span>{f.label}</span>
                {f.count !== undefined && f.count > 0 && (
                  <span className="filter-chip-count">{f.count}</span>
                )}
              </span>
            ))}
          </div>

          {/* Conversations Scrollable List */}
          <div className="conversation-list">
            {loadingConversations ? (
              <div className="p-4 text-center text-muted">
                <div className="spinner-border spinner-border-sm text-success me-2" role="status"></div>
                <span className="small">Loading chats...</span>
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-5 text-center text-muted">
                <div className="mb-2">
                  <i className="bi bi-chat-square-text text-secondary opacity-50" style={{ fontSize: '2.4rem' }}></i>
                </div>
                <div className="fw-semibold text-dark small">No conversations found</div>
                <div className="text-secondary small mt-1" style={{ fontSize: '0.76rem' }}>
                  Customer messages received via WhatsApp will automatically sync here.
                </div>
              </div>
            ) : (
              conversations.map((c) => {
                const isActive = selectedConversation?.id === c.id;
                const contactName = c.contact?.name || c.customer_phone;
                const initials = (contactName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2) || 'WA').toUpperCase();

                return (
                  <div
                    key={c.id}
                    className={`conversation-item ${isActive ? 'active' : ''}`}
                    onClick={() => setSelectedConversation(c)}
                  >
                    {/* Avatar with 24h Window Indicator */}
                    <div className="conversation-avatar-wrapper">
                      <div className="conversation-avatar">
                        {initials}
                      </div>
                      <span
                        className={`window-indicator-dot ${c.is_window_open ? 'active' : 'expired'}`}
                        title={c.is_window_open ? '24h Service Window Active' : '24h Window Expired'}
                      ></span>
                    </div>

                    {/* Metadata & Preview */}
                    <div className="conversation-info">
                      <div className="conversation-header-row">
                        <span className="conversation-name">{contactName}</span>
                        <span className="conversation-time">{formatTime(c.last_message_at || c.updated_at)}</span>
                      </div>
                      <div className="conversation-preview-row">
                        <div className="conversation-snippet-wrapper">
                          {c.whatsapp_account && (
                            <span className="badge bg-light text-secondary border me-1 py-0 px-1" style={{ fontSize: '0.62rem' }}>
                              {c.whatsapp_account.phone_number}
                            </span>
                          )}
                          <span className="conversation-snippet">
                            {c.last_message_text || 'No message preview'}
                          </span>
                        </div>
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
                <div className="d-flex align-items-center min-w-0">
                  {/* Mobile Back Button */}
                  <button
                    type="button"
                    className="btn btn-sm btn-light border-0 d-md-none me-2 p-1"
                    onClick={() => setSelectedConversation(null)}
                  >
                    <i className="bi bi-arrow-left fs-5"></i>
                  </button>

                  <div className="chat-header-user" onClick={() => setShowCrmPanel(!showCrmPanel)} title="Click to toggle customer details">
                    <div className="chat-header-avatar">
                      {((selectedConversation.contact?.name || selectedConversation.customer_phone).replace(/[^a-zA-Z0-9]/g, '').slice(0, 2) || 'WA').toUpperCase()}
                    </div>
                    <div className="chat-header-info">
                      <div className="chat-header-title">
                        {selectedConversation.contact?.name || selectedConversation.customer_phone}
                      </div>
                      <div className="chat-header-subtitle">
                        <span>{selectedConversation.customer_phone}</span>
                        {selectedConversation.whatsapp_account && (
                          <>
                            <span>•</span>
                            <span className="text-success fw-medium">
                              <i className="bi bi-whatsapp me-1"></i>
                              Via {selectedConversation.whatsapp_account.phone_number}
                            </span>
                          </>
                        )}
                        <span>•</span>
                        {selectedConversation.assigned_user ? (
                          <span className="text-secondary">Agent: {selectedConversation.assigned_user.name}</span>
                        ) : (
                          <span className="text-warning">Unassigned</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Header Action Buttons */}
                <div className="chat-header-actions">
                  {/* Service Window Badge */}
                  <span
                    className={`service-window-badge ${selectedConversation.is_window_open ? 'open' : 'expired'}`}
                    title={selectedConversation.is_window_open ? '24h Service Window is currently open for direct two-way messaging' : '24h Window is closed. Meta policy requires approved templates.'}
                  >
                    <i className={`bi ${selectedConversation.is_window_open ? 'bi-clock-fill text-success' : 'bi-lock-fill text-warning'}`}></i>
                    {selectedConversation.is_window_open
                      ? `24h Window: ${formatWindowRemaining(selectedConversation.window_remaining_ms)}`
                      : 'Window Closed'}
                  </span>

                  {/* Send Template Button */}
                  <button
                    className="btn btn-sm btn-success d-flex align-items-center gap-1 shadow-sm px-2 py-1"
                    onClick={handleOpenTemplateModal}
                    title="Send Meta-Approved WhatsApp Template"
                  >
                    <i className="bi bi-lightning-charge-fill"></i>
                    <span className="d-none d-sm-inline fw-semibold">Template</span>
                  </button>

                  {/* Toggle CRM Details Sidebar */}
                  <button
                    className={`btn btn-sm ${showCrmPanel ? 'btn-outline-success active' : 'btn-outline-secondary'} d-flex align-items-center gap-1 px-2 py-1`}
                    onClick={() => setShowCrmPanel(!showCrmPanel)}
                    title="Toggle Customer Information Panel"
                  >
                    <i className="bi bi-person-lines-fill"></i>
                    <span className="d-none d-lg-inline">Contact Info</span>
                  </button>
                </div>
              </div>

              {/* Expired Window Alert Banner (Sticky right above messages) */}
              {!selectedConversation.is_window_open && (
                <div className="service-window-banner">
                  <div className="d-flex align-items-center gap-2">
                    <i className="bi bi-shield-lock-fill text-warning fs-5"></i>
                    <div>
                      <strong>24-Hour Customer Care Window Closed.</strong> Under Meta WhatsApp policies, free-form text messages cannot be sent. You can re-open the conversation by sending an approved WhatsApp Template.
                    </div>
                  </div>
                  <button
                    className="btn btn-sm btn-warning fw-semibold ms-3 text-dark shadow-sm px-3"
                    onClick={handleOpenTemplateModal}
                  >
                    Choose Template
                  </button>
                </div>
              )}

              {/* Message History Feed */}
              <div className="chat-messages-container">
                <div className="date-divider">
                  <span className="date-pill">
                    <i className="bi bi-lock-fill text-muted me-1"></i>
                    End-to-End Meta Cloud API Integration
                  </span>
                </div>

                {loadingMessages ? (
                  <div className="text-center py-5 text-muted">
                    <div className="spinner-border spinner-border-sm text-success me-2" role="status"></div>
                    <span className="small">Loading conversation history...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-5 text-muted my-auto">
                    <div className="mb-2">
                      <i className="bi bi-chat-dots text-success opacity-75" style={{ fontSize: '2.5rem' }}></i>
                    </div>
                    <div className="fw-semibold text-dark">No messages in this chat yet</div>
                    <div className="small text-secondary mt-1">Send a message or template below to initiate communication.</div>
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
                            <div className="template-badge">
                              <i className="bi bi-patch-check-fill text-success"></i>
                              Official Template
                            </div>
                          )}

                          {/* Media Preview if attached */}
                          {m.media_url && (
                            <div className="bubble-media-wrapper">
                              {m.message_type === 'image' ? (
                                <img
                                  src={m.media_url}
                                  alt="media"
                                  className="bubble-image-preview"
                                  onClick={() => window.open(m.media_url, '_blank')}
                                  title="Click to view full image"
                                />
                              ) : (
                                <div className="bubble-doc-card">
                                  <i className="bi bi-file-earmark-pdf-fill fs-3 text-danger"></i>
                                  <div className="min-w-0 flex-1">
                                    <div className="small fw-semibold text-truncate">
                                      Attached {m.message_type?.toUpperCase()}
                                    </div>
                                    <a
                                      href={m.media_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="small text-primary text-decoration-none"
                                    >
                                      <i className="bi bi-download me-1"></i>Download Document
                                    </a>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Message Body Content */}
                          <div className="message-text">{m.message_body}</div>

                          {/* Template Mockup Action Buttons */}
                          {isTemplate && (
                            <div className="template-button-mockup">
                              <i className="bi bi-arrow-up-right-square"></i>
                              <span>Interactive Template</span>
                            </div>
                          )}

                          {/* Meta timestamp & status ticks */}
                          <div className="message-meta">
                            <span>{formatTime(m.created_at)}</span>
                            {!isInbound && (
                              <span className="ms-1">
                                {m.message_status === 'read' ? (
                                  <i className="bi bi-check2-all tick-icon read" title="Read (Blue Ticks)"></i>
                                ) : m.message_status === 'delivered' ? (
                                  <i className="bi bi-check2-all tick-icon delivered" title="Delivered (Double Ticks)"></i>
                                ) : m.message_status === 'failed' ? (
                                  <i className="bi bi-exclamation-circle-fill tick-icon failed" title={m.failure_reason || 'Failed to deliver'}></i>
                                ) : (
                                  <i className="bi bi-check tick-icon sent" title="Sent to WhatsApp"></i>
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

              {/* Bottom Message Composer (WhatsApp Web Style) */}
              <div className="chat-composer">
                {/* Media Attachment Button */}
                <button
                  type="button"
                  className="composer-action-btn"
                  onClick={() => setShowMediaModal(true)}
                  disabled={!selectedConversation.is_window_open}
                  title={selectedConversation.is_window_open ? 'Attach Media / Document' : '24h Window closed'}
                >
                  <i className="bi bi-paperclip"></i>
                </button>

                {/* Quick Template Picker Shortcut */}
                <button
                  type="button"
                  className="composer-action-btn text-success"
                  onClick={handleOpenTemplateModal}
                  title="Choose & Send WhatsApp Template"
                >
                  <i className="bi bi-lightning-charge"></i>
                </button>

                {/* Input Textarea */}
                <div className="composer-input-wrapper">
                  <textarea
                    ref={textareaRef}
                    rows="1"
                    placeholder={
                      selectedConversation.is_window_open
                        ? 'Type a message... (Enter to send, Shift+Enter for newline)'
                        : '24-hour service window closed. Click Template icon to reply.'
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
                  title="Send Message"
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
              <div
                className="rounded-circle d-flex align-items-center justify-content-center shadow-sm mb-3"
                style={{ width: '80px', height: '80px', backgroundColor: '#dcfce7', color: '#16a34a' }}
              >
                <i className="bi bi-whatsapp" style={{ fontSize: '2.8rem' }}></i>
              </div>
              <h5 className="fw-bold text-dark mb-1">CampaignFlow WhatsApp Live Chat</h5>
              <p className="text-secondary small max-w-sm" style={{ maxWidth: '440px', lineHeight: 1.5 }}>
                Select a conversation on the left to begin live two-way customer messaging, review previous chat histories, and dispatch official Meta-approved templates.
              </p>
              <div className="d-flex align-items-center gap-2 mt-2">
                <span className="badge bg-light text-secondary border px-3 py-2 small">
                  <i className="bi bi-shield-check text-success me-1"></i>
                  Meta Cloud API Powered
                </span>
                <span className="badge bg-light text-secondary border px-3 py-2 small">
                  <i className="bi bi-clock-history text-primary me-1"></i>
                  24h Window Tracking
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ==================================================================
            RIGHT COLUMN: Customer Details CRM Panel
            ================================================================== */}
        {selectedConversation && showCrmPanel && (
          <div className="inbox-crm">
            <div className="crm-header">
              <h6>Contact Details</h6>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowCrmPanel(false)}
                title="Close panel"
              ></button>
            </div>

            {/* Profile Summary Card */}
            <div className="crm-profile-card">
              <div className="crm-avatar">
                {((selectedConversation.contact?.name || selectedConversation.customer_phone).replace(/[^a-zA-Z0-9]/g, '').slice(0, 2) || 'WA').toUpperCase()}
                <span className="crm-verified-badge" title="WhatsApp Verified Contact">
                  <i className="bi bi-whatsapp"></i>
                </span>
              </div>
              <div className="crm-contact-name">
                {selectedConversation.contact?.name || selectedConversation.customer_phone}
              </div>
              <div
                className="crm-phone-chip cursor-pointer"
                onClick={() => copyPhoneNumber(selectedConversation.customer_phone)}
                title="Click to copy phone number"
                style={{ cursor: 'pointer' }}
              >
                <i className="bi bi-telephone"></i>
                <span>{selectedConversation.customer_phone}</span>
                <i className={`bi ${copiedPhone ? 'bi-check-lg text-success' : 'bi-copy'} ms-1`}></i>
              </div>

              {selectedConversation.contact?.email && (
                <div className="text-secondary small mt-1">
                  <i className="bi bi-envelope me-1"></i>
                  {selectedConversation.contact.email}
                </div>
              )}

              {/* Quick Actions (Call, Web Link) */}
              <div className="crm-quick-actions">
                <a
                  href={`https://wa.me/${selectedConversation.customer_phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="crm-action-btn-circle text-decoration-none"
                  title="Open in WhatsApp Web"
                >
                  <i className="bi bi-whatsapp"></i>
                </a>
                <a
                  href={`tel:${selectedConversation.customer_phone}`}
                  className="crm-action-btn-circle text-decoration-none"
                  title="Call Phone"
                >
                  <i className="bi bi-telephone-fill"></i>
                </a>
                {selectedConversation.contact?.email && (
                  <a
                    href={`mailto:${selectedConversation.contact.email}`}
                    className="crm-action-btn-circle text-decoration-none"
                    title="Send Email"
                  >
                    <i className="bi bi-envelope-fill"></i>
                  </a>
                )}
              </div>
            </div>

            {/* Quick Actions (Close/Reopen, Mark Unread) */}
            <div className="crm-section">
              <div className="crm-section-title">
                <span>Conversation Status</span>
                <span className={`badge ${selectedConversation.status === 'closed' ? 'bg-secondary' : 'bg-success'}`}>
                  {selectedConversation.status === 'closed' ? 'CLOSED' : 'OPEN'}
                </span>
              </div>
              <div className="d-grid gap-2">
                <button
                  className={`btn btn-sm ${selectedConversation.status === 'closed' ? 'btn-success' : 'btn-outline-danger'} d-flex align-items-center justify-content-center gap-1`}
                  onClick={handleToggleStatus}
                >
                  <i className={`bi ${selectedConversation.status === 'closed' ? 'bi-arrow-counterclockwise' : 'bi-check2-circle'}`}></i>
                  <span>{selectedConversation.status === 'closed' ? 'Reopen Conversation' : 'Close Conversation'}</span>
                </button>
                <button
                  className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center gap-1"
                  onClick={handleMarkUnread}
                >
                  <i className="bi bi-envelope-badge"></i>
                  <span>Mark as Unread</span>
                </button>
              </div>
            </div>

            {/* Agent Assignment */}
            <div className="crm-section">
              <div className="crm-section-title">
                <span>Assigned Agent</span>
                <i className="bi bi-person-badge text-muted"></i>
              </div>
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
              <div className="crm-section-title">
                <span>Customer Tags</span>
                <i className="bi bi-tags text-muted"></i>
              </div>
              <div className="d-flex flex-wrap gap-1 mb-2">
                {(selectedConversation.contact?.tags || []).length === 0 ? (
                  <span className="small text-muted fst-italic">No tags added yet</span>
                ) : (
                  (selectedConversation.contact?.tags || []).map((tag, idx) => (
                    <span
                      key={idx}
                      className="badge bg-light text-dark border d-flex align-items-center gap-1 py-1 px-2"
                      style={{ fontSize: '0.74rem' }}
                    >
                      <i className="bi bi-tag-fill text-success" style={{ fontSize: '0.65rem' }}></i>
                      <span>{tag}</span>
                      <i
                        className="bi bi-x text-muted"
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleRemoveTag(tag)}
                        title="Remove tag"
                      ></i>
                    </span>
                  ))
                )}
              </div>
              <div className="input-group input-group-sm">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Add tag and press Enter..."
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
              <div className="crm-section-title">
                <span>Internal Notes ({notes.length})</span>
                <i className="bi bi-journal-text text-muted"></i>
              </div>
              <form onSubmit={handleAddNote} className="mb-2">
                <textarea
                  className="form-control form-control-sm mb-1"
                  rows="2"
                  placeholder="Write an internal note for team..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                ></textarea>
                <button
                  type="submit"
                  className="btn btn-sm btn-outline-success w-100"
                  disabled={!newNote.trim()}
                >
                  <i className="bi bi-plus-lg me-1"></i>Save Note
                </button>
              </form>

              <div className="notes-feed">
                {notes.length === 0 ? (
                  <div className="text-center py-3 text-muted small fst-italic">
                    No notes recorded for this customer.
                  </div>
                ) : (
                  notes.map((n) => (
                    <div key={n.id} className="note-card">
                      <div className="note-meta">
                        <span className="fw-semibold text-dark">{n.user_name || 'Agent'}</span>
                        <span>{formatTime(n.created_at)}</span>
                      </div>
                      <div className="text-secondary small">{n.note}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ==================================================================
          TEMPLATE SELECTOR MODAL (With Live Smartphone Mockup)
          ================================================================== */}
      {showTemplateModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px', overflow: 'hidden' }}>
              <div className="modal-header bg-light border-bottom py-3">
                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2 mb-0 fs-6">
                  <div className="rounded-circle bg-success text-white d-flex align-items-center justify-content-center" style={{ width: '28px', height: '28px' }}>
                    <i className="bi bi-lightning-charge-fill" style={{ fontSize: '0.9rem' }}></i>
                  </div>
                  <span>Send Approved WhatsApp Template</span>
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowTemplateModal(false)}
                ></button>
              </div>

              <div className="modal-body p-4 bg-white">
                <div className="alert alert-info border-info-subtle py-2 small mb-3 d-flex align-items-center gap-2">
                  <i className="bi bi-info-circle-fill text-info fs-5"></i>
                  <div>
                    Approved WhatsApp templates can be dispatched at any time, even after the 24-hour customer service window has expired.
                  </div>
                </div>

                <div className="row g-3">
                  {/* Template Picker */}
                  <div className="col-md-5">
                    <label className="form-label fw-semibold small text-dark mb-1">Choose Template</label>
                    <div className="list-group rounded-3 border" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      {templates.length === 0 ? (
                        <div className="p-4 text-center text-muted small">
                          <i className="bi bi-card-text fs-3 d-block mb-1 text-secondary opacity-50"></i>
                          No approved templates found.
                        </div>
                      ) : (
                        templates.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            className={`list-group-item list-group-item-action py-2 ${selectedTemplate?.id === t.id ? 'active' : ''}`}
                            onClick={() => {
                              setSelectedTemplate(t);
                              setTemplateVariables(initTemplateVars(t));
                            }}
                          >
                            <div className="fw-bold small">{t.name}</div>
                            <div className="d-flex justify-content-between align-items-center small mt-1">
                              <span className="opacity-75">{t.category}</span>
                              <span className={`badge ${selectedTemplate?.id === t.id ? 'bg-white text-dark' : 'bg-success-subtle text-success'}`}>
                                Approved
                              </span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Template Live Preview & Dynamic Variables */}
                  <div className="col-md-7">
                    {selectedTemplate ? (
                      <div>
                        <label className="form-label fw-semibold small text-dark mb-1">WhatsApp Message Preview</label>
                        <div className="template-modal-preview mb-3">
                          <div className="template-smartphone-card">
                            <div className="d-flex align-items-center justify-content-between mb-1">
                              <span className="badge bg-success text-white small" style={{ fontSize: '0.65rem' }}>
                                <i className="bi bi-whatsapp me-1"></i>Official Template
                              </span>
                              <span className="small text-muted" style={{ fontSize: '0.7rem' }}>
                                {selectedTemplate.language}
                              </span>
                            </div>
                            <div className="small text-dark font-monospace" style={{ whiteSpace: 'pre-wrap', fontSize: '0.86rem' }}>
                              {(() => {
                                let rendered = selectedTemplate.body_text || selectedTemplate.components_json || 'Template content';
                                Object.entries(templateVariables).forEach(([key, val]) => {
                                  if (val) {
                                    rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
                                  }
                                });
                                return rendered;
                              })()}
                            </div>
                          </div>
                        </div>

                        {/* Dynamic Variable Inputs */}
                        {(() => {
                          const comps = Array.isArray(selectedTemplate.components)
                            ? selectedTemplate.components
                            : (typeof selectedTemplate.components === 'string' ? JSON.parse(selectedTemplate.components || '[]') : []);
                          const bodyComp = comps.find(c => (c.type || '').toUpperCase() === 'BODY');
                          const text = selectedTemplate.body_text || bodyComp?.text || '';
                          const placeholders = Array.from(new Set((text.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) || []).map(p => p.replace(/[{}]/g, ''))));

                          if (placeholders.length === 0 && selectedTemplate.name === 'welcome_msg') {
                            placeholders.push('customer_name');
                          }

                          if (placeholders.length === 0) {
                            return (
                              <div className="bg-light p-2 rounded border small text-muted">
                                <i className="bi bi-info-circle me-1"></i> No dynamic variables required for this template.
                              </div>
                            );
                          }

                          return (
                            <div className="bg-light p-3 rounded-3 border">
                              <div className="small fw-bold text-dark mb-2">Dynamic Template Variables:</div>
                              <div className="row g-2">
                                {placeholders.map((ph) => (
                                  <div key={ph} className="col-12 col-md-6">
                                    <label className="form-label mb-1 small text-muted" style={{ fontSize: '0.74rem' }}>
                                      <code>{`{{${ph}}}`}</code>
                                    </label>
                                    <input
                                      type="text"
                                      className="form-control form-control-sm"
                                      placeholder={ph === 'customer_name' ? (selectedConversation?.contact?.first_name || 'Customer Name') : `Value for ${ph}`}
                                      value={templateVariables[ph] !== undefined ? templateVariables[ph] : ''}
                                      onChange={(e) => setTemplateVariables({ ...templateVariables, [ph]: e.target.value })}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="text-center py-5 text-muted small">
                        Select a template on the left to customize variables.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-footer bg-light border-top py-2 px-3">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setShowTemplateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-success fw-semibold px-3"
                  onClick={handleSendTemplate}
                  disabled={!selectedTemplate || sendingTemplate}
                >
                  {sendingTemplate ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1"></span>
                      Dispatching...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-send-fill me-1"></i>
                      Send WhatsApp Template
                    </>
                  )}
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
        <div className="modal show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px', overflow: 'hidden' }}>
              <div className="modal-header bg-light border-bottom py-3">
                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2 mb-0 fs-6">
                  <div className="rounded-circle bg-success text-white d-flex align-items-center justify-content-center" style={{ width: '28px', height: '28px' }}>
                    <i className="bi bi-paperclip" style={{ fontSize: '0.9rem' }}></i>
                  </div>
                  <span>Send Media Attachment</span>
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowMediaModal(false)}></button>
              </div>
              <div className="modal-body p-4 bg-white">
                <div className="mb-3">
                  <label className="form-label small fw-semibold text-dark">Media Type</label>
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
                  <label className="form-label small fw-semibold text-dark">Public Media URL / S3 Link</label>
                  <input
                    type="url"
                    className="form-control form-control-sm"
                    placeholder="https://example.com/assets/catalogue.pdf"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                  />
                  <div className="form-text small">Ensure the URL is publicly reachable by Meta servers.</div>
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-semibold text-dark">Caption (Optional)</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="e.g. Here is our festive catalogue"
                    value={mediaCaption}
                    onChange={(e) => setMediaCaption(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer bg-light border-top py-2 px-3">
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShowMediaModal(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-success fw-semibold px-3"
                  onClick={handleSendMedia}
                  disabled={!mediaUrl.trim() || sendingMedia}
                >
                  {sendingMedia ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1"></span>
                      Sending Media...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-send-fill me-1"></i>
                      Send Media
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
