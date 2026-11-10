import React, { useState, useEffect, useMemo } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import api from '../services/api';
import AiwavoHeader from '../components/AiwavoHeader';
import '../styles/templates.css';

const LANGUAGES = [
  { code: 'en_US', label: 'English (US)' },
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi (हिंदी)' },
  { code: 'es', label: 'Spanish' },
  { code: 'pt_BR', label: 'Portuguese (BR)' },
  { code: 'ar', label: 'Arabic' },
  { code: 'id', label: 'Indonesian' }
];

function formatErrorString(err, fallback = 'An unexpected error occurred') {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  const resData = err.response?.data;
  if (resData) {
    if (typeof resData === 'string') return resData;
    if (typeof resData.error === 'string') return resData.error;
    if (resData.error?.message) return String(resData.error.message);
    if (resData.message) return String(resData.message);
  }
  if (err.message) return String(err.message);
  return fallback;
}

export default function Templates() {
  const outletContext = useOutletContext();
  const onToggleSidebar = outletContext?.onToggleSidebar;
  const [templates, setTemplates] = useState([]);
  const [stats, setStats] = useState({ total: 0, approved: 0, pending: 0, rejected: 0, paused_or_disabled: 0 });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

  // Filters
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [languageFilter, setLanguageFilter] = useState('ALL');

  // Multi-Tenant Account State
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('ALL');
  const [formAccountId, setFormAccountId] = useState('');

  // Modals & Feedback
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [detailTemplate, setDetailTemplate] = useState(null);
  const [statusCheckLoading, setStatusCheckLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Quick Test Send Modal State
  const [quickTestTemplate, setQuickTestTemplate] = useState(null);
  const [quickTestPhone, setQuickTestPhone] = useState('');
  const [quickTestVars, setQuickTestVars] = useState({});
  const [quickTestSending, setQuickTestSending] = useState(false);
  const [quickTestResult, setQuickTestResult] = useState(null);

  // Create Form State
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('MARKETING');
  const [formLanguage, setFormLanguage] = useState('en');
  const [headerType, setHeaderType] = useState('NONE'); // NONE, TEXT, IMAGE, VIDEO, DOCUMENT
  const [headerText, setHeaderText] = useState('');
  const [headerExample, setHeaderExample] = useState('');
  const [bodyText, setBodyText] = useState('Hello {{1}}, welcome to our official WhatsApp channel!');
  const [variableExamples, setVariableExamples] = useState({ '1': 'Customer' });
  const [footerText, setFooterText] = useState('');
  const [buttons, setButtons] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [activeFilter, categoryFilter, languageFilter, selectedAccountId]);

  const fetchAccounts = async () => {
    try {
      const res = await api.get('/whatsapp/accounts');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setAccounts(res.data.data);
        if (res.data.data.length > 0) {
          const defaultAcc = res.data.data.find(a => a.is_default) || res.data.data[0];
          setFormAccountId(defaultAcc.id);
        }
      }
    } catch (err) {
      console.error('Failed to load accounts for templates', err);
    }
  };

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const params = {};
      if (activeFilter !== 'ALL') params.status = activeFilter;
      if (categoryFilter !== 'ALL') params.category = categoryFilter;
      if (languageFilter !== 'ALL') params.language = languageFilter;
      if (selectedAccountId !== 'ALL') params.accountId = selectedAccountId;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await api.get('/whatsapp/templates', { params });
      if (res.data?.success) {
        setTemplates(res.data.data || []);
        if (res.data.stats) {
          setStats(res.data.stats);
        }
      }
    } catch (err) {
      console.error('Failed to load templates', err);
      setFeedbackMsg({ type: 'danger', text: formatErrorString(err, 'Failed to load templates') });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncFromMeta = async () => {
    try {
      setSyncing(true);
      setFeedbackMsg(null);
      const res = await api.post('/whatsapp/templates/sync', {
        accountId: selectedAccountId !== 'ALL' ? selectedAccountId : undefined
      });
      if (res.data?.success) {
        setFeedbackMsg({
          type: 'success',
          text: res.data.message || 'Templates successfully synchronized with Meta Cloud API.'
        });
        fetchTemplates();
      }
    } catch (err) {
      console.error('Sync failed', err);
      setFeedbackMsg({
        type: 'danger',
        text: formatErrorString(err, 'Failed to sync templates from Meta.')
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleCheckLiveStatus = async (tpl) => {
    try {
      setStatusCheckLoading(true);
      const res = await api.get(`/whatsapp/templates/${tpl.id}/status`);
      if (res.data?.success) {
        const updated = res.data.data;
        setDetailTemplate(updated);
        setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t));
        setFeedbackMsg({
          type: 'info',
          text: `Meta Live Status for "${updated.name}": ${updated.status}`
        });
      }
    } catch (err) {
      setFeedbackMsg({
        type: 'danger',
        text: formatErrorString(err, 'Failed to verify live Meta status.')
      });
    } finally {
      setStatusCheckLoading(false);
    }
  };

  const handleDeleteTemplate = async (tpl) => {
    if (!window.confirm(`Are you sure you want to delete template "${tpl.name}" from Meta and locally?`)) {
      return;
    }
    try {
      const res = await api.delete(`/whatsapp/templates/${tpl.id}`);
      if (res.data?.success) {
        setFeedbackMsg({ type: 'success', text: `Template "${tpl.name}" deleted.` });
        if (detailTemplate?.id === tpl.id) setDetailTemplate(null);
        fetchTemplates();
      }
    } catch (err) {
      setFeedbackMsg({
        type: 'danger',
        text: formatErrorString(err, 'Failed to delete template from Meta.')
      });
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenQuickTest = (tpl) => {
    setQuickTestTemplate(tpl);
    setQuickTestResult(null);
    setQuickTestPhone('');

    // Parse components to extract variables
    const comps = Array.isArray(tpl.components)
      ? tpl.components
      : (typeof tpl.components === 'string' ? JSON.parse(tpl.components || '[]') : []);
    const bodyComp = comps.find(c => c.type === 'BODY' || c.type === 'body');
    const matches = (bodyComp?.text || '').match(/\{\{([a-zA-Z0-9_]+)\}\}/g) || [];
    const vars = Array.from(new Set(matches.map(m => m.replace(/[{}]/g, ''))));

    const initialVars = {};
    vars.forEach((v, idx) => {
      initialVars[v] = idx === 0 ? 'Rahul Sharma' : `Sample ${idx + 1}`;
    });
    setQuickTestVars(initialVars);
  };

  const handleSendQuickTest = async (e) => {
    e.preventDefault();
    if (!quickTestPhone.trim()) {
      setQuickTestResult({ success: false, message: 'Please enter a valid recipient WhatsApp number.' });
      return;
    }

    try {
      setQuickTestSending(true);
      setQuickTestResult(null);

      const parameters = Object.keys(quickTestVars).map(k => ({
        type: 'text',
        text: quickTestVars[k]
      }));

      const payload = {
        phoneNumber: quickTestPhone.replace(/[^0-9]/g, ''),
        templateName: quickTestTemplate.name,
        language: quickTestTemplate.language || 'en',
        parameters: parameters.length > 0 ? parameters : undefined,
        accountId: quickTestTemplate.whatsapp_account_id || undefined
      };

      const res = await api.post('/whatsapp/send-test', payload);
      if (res.data?.success) {
        setQuickTestResult({
          success: true,
          message: `Test message successfully dispatched to +${quickTestPhone.replace(/[^0-9]/g, '')}! Message ID: ${res.data.data?.messageId || 'Delivered'}`
        });
      } else {
        setQuickTestResult({
          success: false,
          message: res.data?.message || 'Failed to dispatch test message.'
        });
      }
    } catch (err) {
      console.error('Test message send failed', err);
      setQuickTestResult({
        success: false,
        message: err.response?.data?.error?.message || err.message || 'Error sending test message.'
      });
    } finally {
      setQuickTestSending(false);
    }
  };

  // Variable extraction from Body text
  const detectedVariables = useMemo(() => {
    const matches = bodyText.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) || [];
    return Array.from(new Set(matches.map(m => m.replace(/[{}]/g, ''))));
  }, [bodyText]);

  // Ensure every detected variable has an example
  useEffect(() => {
    setVariableExamples(prev => {
      const next = { ...prev };
      detectedVariables.forEach((v, idx) => {
        if (!next[v]) {
          next[v] = idx === 0 ? 'Rahul' : `Sample_${v}`;
        }
      });
      return next;
    });
  }, [detectedVariables]);

  const handleAddButton = (type) => {
    if (buttons.length >= 3) {
      alert('Meta allows maximum 3 buttons per template.');
      return;
    }
    if (type === 'QUICK_REPLY') {
      setButtons([...buttons, { type: 'QUICK_REPLY', text: 'Quick Action' }]);
    } else if (type === 'URL') {
      setButtons([...buttons, { type: 'URL', text: 'Visit Website', url: 'https://example.com' }]);
    } else if (type === 'PHONE_NUMBER') {
      setButtons([...buttons, { type: 'PHONE_NUMBER', text: 'Call Us', phone_number: '+919999999999' }]);
    }
  };

  const handleRemoveButton = (index) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const cleanName = formName.trim().toLowerCase();
    if (!/^[a-z0-9_]{1,512}$/.test(cleanName)) {
      setFormError('Template Name must contain only lowercase letters (a-z), numbers (0-9), and underscores (_).');
      return;
    }
    if (!bodyText.trim()) {
      setFormError('Message body cannot be empty.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        name: cleanName,
        category: formCategory,
        language: formLanguage,
        accountId: formAccountId || undefined,
        header: headerType !== 'NONE' ? {
          type: headerType,
          text: headerText,
          example: headerExample
        } : null,
        body: {
          text: bodyText,
          examples: variableExamples
        },
        footer: footerText.trim() ? { text: footerText.trim() } : null,
        buttons: buttons.length > 0 ? buttons : []
      };

      const res = await api.post('/whatsapp/templates', payload);
      if (res.data?.success) {
        setShowCreateModal(false);
        setFeedbackMsg({
          type: 'success',
          text: `Template "${cleanName}" submitted to Meta! Current Status: PENDING review.`
        });
        setFormName('');
        setBodyText('Hello {{1}}, welcome to our official WhatsApp channel!');
        setFooterText('');
        setButtons([]);
        fetchTemplates();
      }
    } catch (err) {
      console.error('Submit template failed', err);
      setFormError(formatErrorString(err, 'Failed to submit template to Meta.'));
    } finally {
      setSubmitting(false);
    }
  };

  const hasActiveFilters = activeFilter !== 'ALL' || categoryFilter !== 'ALL' || languageFilter !== 'ALL' || selectedAccountId !== 'ALL' || searchQuery.trim() !== '';

  const clearAllFilters = () => {
    setActiveFilter('ALL');
    setCategoryFilter('ALL');
    setLanguageFilter('ALL');
    setSelectedAccountId('ALL');
    setSearchQuery('');
  };

  const renderHighlightedText = (text) => {
    if (!text) return 'No text content available';
    const parts = text.split(/(\{\{[a-zA-Z0-9_]+\}\})/g);
    return parts.map((part, i) => {
      if (part.startsWith('{{') && part.endsWith('}}')) {
        return <span key={i} className="card-var-highlight">{part}</span>;
      }
      return part;
    });
  };

  // Render Simulated WhatsApp Preview Bubble
  const renderSimulatedPreview = (tplOrForm, isForm = false) => {
    let hType = 'NONE';
    let hText = '';
    let bText = '';
    let fText = '';
    let btnList = [];

    if (isForm) {
      hType = headerType;
      hText = headerText;
      bText = bodyText;
      fText = footerText;
      btnList = buttons;

      detectedVariables.forEach(v => {
        const val = variableExamples[v] || `[${v}]`;
        bText = bText.split(`{{${v}}}`).join(val);
      });
    } else if (tplOrForm) {
      const comps = Array.isArray(tplOrForm.components)
        ? tplOrForm.components
        : (typeof tplOrForm.components === 'string' ? JSON.parse(tplOrForm.components || '[]') : []);

      const hComp = comps.find(c => c.type === 'HEADER' || c.type === 'header');
      if (hComp) {
        hType = hComp.format || 'TEXT';
        hText = hComp.text || '';
      }
      const bComp = comps.find(c => c.type === 'BODY' || c.type === 'body');
      bText = bComp?.text || 'No body text';
      const fComp = comps.find(c => c.type === 'FOOTER' || c.type === 'footer');
      fText = fComp?.text || '';
      const btnsComp = comps.find(c => c.type === 'BUTTONS' || c.type === 'buttons');
      btnList = btnsComp?.buttons || [];
    }

    return (
      <div className="wa-phone-mockup">
        <div className="wa-screen">
          <div className="wa-screen-header">
            <div className="wa-screen-avatar">
              <i className="bi bi-whatsapp"></i>
            </div>
            <div className="flex-grow-1 text-start">
              <div className="fw-bold small d-flex align-items-center gap-1 text-white">
                <span>WhatsApp Business</span>
                <i className="bi bi-patch-check-fill text-warning" style={{ fontSize: '0.85rem' }}></i>
              </div>
              <div style={{ fontSize: '0.68rem', color: '#bbf7d0' }}>
                <span className="badge rounded-pill bg-success-subtle text-success py-0 px-1 me-1" style={{ fontSize: '0.6rem' }}>● Online</span>
                Verified Official Channel
              </div>
            </div>
            <i className="bi bi-three-dots-vertical text-white opacity-75"></i>
          </div>

          <div className="wa-screen-body">
            <div className="wa-bubble-preview">
              {hType !== 'NONE' && (
                <>
                  {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(hType) ? (
                    <div className="wa-header-media">
                      <i className={`bi ${hType === 'IMAGE' ? 'bi-image' : hType === 'VIDEO' ? 'bi-play-circle' : 'bi-file-earmark-text'} fs-1 text-secondary mb-1`}></i>
                      <span>WhatsApp {hType} Header</span>
                    </div>
                  ) : (
                    hText && <div className="wa-header-text">{hText}</div>
                  )}
                </>
              )}

              <div className="wa-body-text">{bText}</div>

              {fText && <div className="wa-footer-text">{fText}</div>}

              <div className="wa-timestamp">
                <span>12:45 PM</span>
                <i className="bi bi-check2-all text-primary ms-1"></i>
              </div>
            </div>

            {btnList.length > 0 && (
              <div className="wa-buttons-container">
                {btnList.map((btn, idx) => (
                  <button key={idx} type="button" className="wa-action-button shadow-xs">
                    <i className={`bi ${btn.type === 'URL' ? 'bi-box-arrow-up-right' : btn.type === 'PHONE_NUMBER' ? 'bi-telephone-fill' : 'bi-reply-fill'}`}></i>
                    <span>{btn.text}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <AiwavoHeader
        title="Message Templates"
        subtitle="Create, test, synchronize, and monitor Meta-approved broadcast message templates in real-time."
        onToggleSidebar={onToggleSidebar}
      >
        <button
          onClick={handleSyncFromMeta}
          disabled={syncing}
          className="btn btn-outline-success d-flex align-items-center gap-2 shadow-xs bg-white"
          title="Sync latest template approval statuses directly from Meta Cloud API"
        >
          <i className={`bi bi-arrow-repeat ${syncing ? 'spin-icon' : ''}`}></i>
          <span>{syncing ? 'Syncing...' : 'Sync from Meta'}</span>
        </button>

        <button
          onClick={() => { setShowCreateModal(true); setFormError(''); }}
          className="btn btn-success d-flex align-items-center gap-2 shadow-sm"
        >
          <i className="bi bi-plus-circle-fill"></i>
          <span>+ Create Template</span>
        </button>
      </AiwavoHeader>

      <div className="p-4">

      {/* Feedback Banner */}
      {feedbackMsg && (
        <div className={`alert alert-${feedbackMsg.type} alert-dismissible fade show shadow-xs d-flex align-items-center justify-content-between mb-4`} role="alert">
          <div className="d-flex align-items-center gap-2">
            <i className={`bi ${feedbackMsg.type === 'success' ? 'bi-check-circle-fill text-success' : 'bi-info-circle-fill text-primary'} fs-5`}></i>
            <span className="small">{typeof feedbackMsg?.text === 'string' ? feedbackMsg.text : (feedbackMsg?.text?.message || JSON.stringify(feedbackMsg?.text || ''))}</span>
          </div>
          <button type="button" className="btn-close" onClick={() => setFeedbackMsg(null)}></button>
        </div>
      )}

      {/* Top Stats Dashboard Cards */}
      <div className="template-stats-grid">
        {/* Total */}
        <div
          className={`template-stat-card ${activeFilter === 'ALL' ? 'active-filter' : ''}`}
          onClick={() => setActiveFilter('ALL')}
        >
          <div className="d-flex align-items-center justify-content-between">
            <div>
              <div className="stat-count">{stats.total}</div>
              <div className="stat-label">Total Templates</div>
              <div className="stat-subtitle">All categories & languages</div>
            </div>
            <div className="stat-icon bg-light text-secondary border">
              <i className="bi bi-collection-fill"></i>
            </div>
          </div>
        </div>

        {/* Approved */}
        <div
          className={`template-stat-card ${activeFilter === 'APPROVED' ? 'active-filter' : ''}`}
          onClick={() => setActiveFilter('APPROVED')}
        >
          <div className="d-flex align-items-center justify-content-between">
            <div>
              <div className="stat-count text-success">{stats.approved}</div>
              <div className="stat-label text-success">Meta Approved</div>
              <div className="stat-subtitle text-success opacity-75">
                {stats.total > 0 ? `${Math.round((stats.approved / stats.total) * 100)}% Ready to send` : 'Ready to broadcast'}
              </div>
            </div>
            <div className="stat-icon bg-success-subtle text-success border border-success-subtle">
              <i className="bi bi-check-circle-fill"></i>
            </div>
          </div>
        </div>

        {/* Pending */}
        <div
          className={`template-stat-card ${activeFilter === 'PENDING' ? 'active-filter' : ''}`}
          onClick={() => setActiveFilter('PENDING')}
        >
          <div className="d-flex align-items-center justify-content-between">
            <div>
              <div className="stat-count text-warning">{stats.pending}</div>
              <div className="stat-label text-warning">In Review (Pending)</div>
              <div className="stat-subtitle text-warning opacity-75">Under Meta automated audit</div>
            </div>
            <div className="stat-icon bg-warning-subtle text-warning border border-warning-subtle">
              <i className="bi bi-hourglass-split"></i>
            </div>
          </div>
        </div>

        {/* Rejected */}
        <div
          className={`template-stat-card ${activeFilter === 'REJECTED' ? 'active-filter' : ''}`}
          onClick={() => setActiveFilter('REJECTED')}
        >
          <div className="d-flex align-items-center justify-content-between">
            <div>
              <div className="stat-count text-danger">{stats.rejected}</div>
              <div className="stat-label text-danger">Meta Rejected</div>
              <div className="stat-subtitle text-danger opacity-75">Requires policy correction</div>
            </div>
            <div className="stat-icon bg-danger-subtle text-danger border border-danger-subtle">
              <i className="bi bi-x-octagon-fill"></i>
            </div>
          </div>
        </div>

        {/* Paused / Disabled */}
        <div
          className={`template-stat-card ${activeFilter === 'PAUSED_DISABLED' ? 'active-filter' : ''}`}
          onClick={() => setActiveFilter('PAUSED_DISABLED')}
        >
          <div className="d-flex align-items-center justify-content-between">
            <div>
              <div className="stat-count text-secondary">{stats.paused_or_disabled}</div>
              <div className="stat-label">Paused / Disabled</div>
              <div className="stat-subtitle">Quality score affected</div>
            </div>
            <div className="stat-icon bg-light text-muted border">
              <i className="bi bi-pause-circle-fill"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & View Controller Bar */}
      <div className="templates-filter-card">
        <div className="row g-2 align-items-center">
          {/* Search Input */}
          <div className="col-12 col-md-3">
            <div className="input-group">
              <span className="input-group-text bg-white border-end-0 text-muted">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control border-start-0"
                placeholder="Search by template name or content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchTemplates()}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="btn btn-outline-secondary border-start-0 bg-white"
                  onClick={() => { setSearchQuery(''); fetchTemplates(); }}
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              )}
            </div>
          </div>

          {/* Account / WABA Selector */}
          <div className="col-12 col-md-2">
            <select
              className="form-select"
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
            >
              <option value="ALL">All Accounts & WABAs</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.account_name} ({acc.display_phone_number || `WABA: ${acc.waba_id.slice(-6)}`})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="col-6 col-md-2">
            <select
              className="form-select"
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="APPROVED">Approved Only</option>
              <option value="PENDING">Pending Review</option>
              <option value="REJECTED">Rejected</option>
              <option value="PAUSED_DISABLED">Paused / Disabled</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="col-6 col-md-2">
            <select
              className="form-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="ALL">All Categories</option>
              <option value="MARKETING">Marketing</option>
              <option value="UTILITY">Utility</option>
              <option value="AUTHENTICATION">Authentication</option>
            </select>
          </div>

          {/* Language Filter */}
          <div className="col-6 col-md-2">
            <select
              className="form-select"
              value={languageFilter}
              onChange={(e) => setLanguageFilter(e.target.value)}
            >
              <option value="ALL">All Languages</option>
              {LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>

          {/* View Toggle */}
          <div className="col-6 col-md-1 d-flex justify-content-end">
            <div className="btn-group btn-group-sm w-100" role="group">
              <button
                type="button"
                className={`btn ${viewMode === 'grid' ? 'btn-success' : 'btn-outline-secondary'}`}
                onClick={() => setViewMode('grid')}
                title="Grid Cards View"
              >
                <i className="bi bi-grid-fill"></i>
              </button>
              <button
                type="button"
                className={`btn ${viewMode === 'table' ? 'btn-success' : 'btn-outline-secondary'}`}
                onClick={() => setViewMode('table')}
                title="Table View"
              >
                <i className="bi bi-list-ul"></i>
              </button>
            </div>
          </div>
        </div>

        {/* Active Filters Pill Row */}
        {hasActiveFilters && (
          <div className="d-flex align-items-center flex-wrap gap-2 mt-2 pt-2 border-top">
            <span className="text-muted small fw-semibold">Active filters:</span>
            {activeFilter !== 'ALL' && (
              <span className="badge bg-light text-dark border small d-flex align-items-center gap-1">
                Status: <strong>{activeFilter}</strong>
                <i className="bi bi-x cursor-pointer" onClick={() => setActiveFilter('ALL')}></i>
              </span>
            )}
            {categoryFilter !== 'ALL' && (
              <span className="badge bg-light text-dark border small d-flex align-items-center gap-1">
                Category: <strong>{categoryFilter}</strong>
                <i className="bi bi-x cursor-pointer" onClick={() => setCategoryFilter('ALL')}></i>
              </span>
            )}
            {languageFilter !== 'ALL' && (
              <span className="badge bg-light text-dark border small d-flex align-items-center gap-1">
                Language: <strong>{languageFilter}</strong>
                <i className="bi bi-x cursor-pointer" onClick={() => setLanguageFilter('ALL')}></i>
              </span>
            )}
            {selectedAccountId !== 'ALL' && (
              <span className="badge bg-light text-dark border small d-flex align-items-center gap-1">
                Account #{selectedAccountId}
                <i className="bi bi-x cursor-pointer" onClick={() => setSelectedAccountId('ALL')}></i>
              </span>
            )}
            {searchQuery && (
              <span className="badge bg-light text-dark border small d-flex align-items-center gap-1">
                Search: "{searchQuery}"
                <i className="bi bi-x cursor-pointer" onClick={() => { setSearchQuery(''); fetchTemplates(); }}></i>
              </span>
            )}
            <button
              type="button"
              className="btn btn-link btn-sm text-danger text-decoration-none p-0 ms-auto small"
              onClick={clearAllFilters}
            >
              Reset all filters
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="row g-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="col-12 col-md-6 col-lg-4">
              <div className="card p-4 border-0 shadow-sm skeleton-box" style={{ height: '220px' }}></div>
            </div>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="empty-templates-state">
          <div className="display-4 text-muted mb-3">
            <i className="bi bi-chat-left-dots text-success opacity-50"></i>
          </div>
          <h5 className="fw-bold text-dark">No WhatsApp Templates Found</h5>
          <p className="text-muted mb-4 small" style={{ maxWidth: '480px', margin: '0 auto' }}>
            {hasActiveFilters
              ? 'No templates match your active filters. Try clearing filters or resetting the search query.'
              : 'Sync your pre-approved templates directly from your Meta Business Portfolio or create your first marketing template now.'}
          </p>
          <div className="d-flex justify-content-center gap-2">
            {hasActiveFilters && (
              <button onClick={clearAllFilters} className="btn btn-outline-secondary btn-sm">
                <i className="bi bi-arrow-counterclockwise me-1"></i> Reset Filters
              </button>
            )}
            <button onClick={handleSyncFromMeta} className="btn btn-outline-success btn-sm">
              <i className="bi bi-arrow-repeat me-1"></i> Sync from Meta
            </button>
            <button onClick={() => setShowCreateModal(true)} className="btn btn-success btn-sm">
              <i className="bi bi-plus-circle me-1"></i> Create New Template
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID CARDS VIEW */
        <div className="row g-3">
          {templates.map(tpl => {
            const comps = Array.isArray(tpl.components)
              ? tpl.components
              : (typeof tpl.components === 'string' ? JSON.parse(tpl.components || '[]') : []);
            const headerComp = comps.find(c => c.type === 'HEADER' || c.type === 'header');
            const bodyComp = comps.find(c => c.type === 'BODY' || c.type === 'body');
            const footerComp = comps.find(c => c.type === 'FOOTER' || c.type === 'footer');
            const btnsComp = comps.find(c => c.type === 'BUTTONS' || c.type === 'buttons');
            const buttonsList = btnsComp?.buttons || [];
            const buttonsCount = buttonsList.length;

            const statusClass = tpl.status === 'APPROVED' ? 'badge-approved' :
              tpl.status === 'PENDING' ? 'badge-pending' :
              tpl.status === 'REJECTED' ? 'badge-rejected' : 'badge-paused';

            const catClass = tpl.category === 'MARKETING' ? 'badge-category-marketing' :
              tpl.category === 'UTILITY' ? 'badge-category-utility' : 'badge-category-auth';

            const acc = accounts.find(a => a.id === tpl.whatsapp_account_id);

            return (
              <div key={tpl.id} className="col-12 col-md-6 col-lg-4">
                <div className="template-item-card">
                  <div>
                    {/* Header: Name and Status */}
                    <div className="d-flex align-items-start justify-content-between mb-2">
                      <Link
                        to={`/templates/${tpl.id}`}
                        className="aisensy-tpl-name text-truncate"
                        title={tpl.name}
                      >
                        <i className="bi bi-whatsapp text-success fs-6"></i>
                        <span>{tpl.name}</span>
                      </Link>
                      <span className={`badge-status ${statusClass} flex-shrink-0 ms-2`}>
                        <span className="status-dot"></span>
                        <span>{tpl.status}</span>
                      </span>
                    </div>

                    {/* Metadata Badges */}
                    <div className="d-flex align-items-center flex-wrap gap-1 mb-2">
                      <span className={`badge-category ${catClass}`}>
                        {tpl.category === 'MARKETING' && <i className="bi bi-megaphone-fill"></i>}
                        {tpl.category === 'UTILITY' && <i className="bi bi-gear-fill"></i>}
                        {tpl.category === 'AUTHENTICATION' && <i className="bi bi-shield-lock-fill"></i>}
                        {tpl.category || 'MARKETING'}
                      </span>
                      <span className="badge bg-light text-secondary border small">
                        <i className="bi bi-translate me-1"></i>{tpl.language}
                      </span>
                      {buttonsCount > 0 && (
                        <span className="badge bg-light text-secondary border small">
                          <i className="bi bi-hand-index-thumb me-1"></i>{buttonsCount} {buttonsCount === 1 ? 'Button' : 'Buttons'}
                        </span>
                      )}
                      {acc && (
                        <span className="badge bg-light text-success border small text-truncate" style={{ maxWidth: '140px' }} title={acc.account_name}>
                          <i className="bi bi-person-badge me-1"></i>{acc.account_name}
                        </span>
                      )}
                    </div>

                    {/* Meta Template ID & Copy */}
                    {tpl.meta_template_id && (
                      <div className="d-flex align-items-center justify-content-between text-muted small mb-2 px-1">
                        <span style={{ fontSize: '0.74rem' }}>
                          ID: <code className="text-secondary">{tpl.meta_template_id.substring(0, 14)}...</code>
                        </span>
                        <button
                          type="button"
                          className="btn btn-link btn-sm p-0 text-muted"
                          title="Copy Meta Template ID"
                          onClick={() => copyToClipboard(tpl.meta_template_id, tpl.id)}
                        >
                          <i className={`bi ${copiedId === tpl.id ? 'bi-check2 text-success' : 'bi-clipboard'}`}></i>
                        </button>
                      </div>
                    )}

                    {/* Rejection Alert if Rejected */}
                    {tpl.status === 'REJECTED' && tpl.rejection_reason && (
                      <div className="rejection-banner py-2 px-2 small mb-2">
                        <div className="d-flex align-items-center gap-1 fw-bold text-danger">
                          <i className="bi bi-exclamation-octagon-fill"></i>
                          <span>Meta Moderation Policy Rejection:</span>
                        </div>
                        <div className="text-danger small mt-1">{tpl.rejection_reason}</div>
                      </div>
                    )}

                    {/* Authentic WhatsApp Bubble Preview */}
                    <div className="aisensy-chat-viewport">
                      <div className="aisensy-bubble">
                        <div className="aisensy-bubble-tail"></div>

                        {/* Optional Header */}
                        {headerComp && (
                          <>
                            {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComp.format) ? (
                              <div className="aisensy-bubble-media">
                                <i className={`bi ${headerComp.format === 'IMAGE' ? 'bi-image' : headerComp.format === 'VIDEO' ? 'bi-play-circle' : 'bi-file-earmark-text'} text-primary`}></i>
                                <span>WhatsApp {headerComp.format} Header</span>
                              </div>
                            ) : (
                              headerComp.text && <div className="aisensy-bubble-header">{headerComp.text}</div>
                            )}
                          </>
                        )}

                        {/* Message Body */}
                        <div className="aisensy-bubble-body">
                          {renderHighlightedText(bodyComp?.text)}
                        </div>

                        {/* Optional Footer */}
                        {footerComp?.text && (
                          <div className="aisensy-bubble-footer">{footerComp.text}</div>
                        )}

                        {/* Timestamp & Read Receipts */}
                        <div className="aisensy-bubble-meta">
                          <span>12:45 PM</span>
                          <span className="wa-ticks">✓✓</span>
                        </div>
                      </div>

                      {/* Interactive Buttons Below Bubble */}
                      {buttonsList.length > 0 && (
                        <div className="aisensy-action-buttons">
                          {buttonsList.map((btn, bIdx) => (
                            <div key={bIdx} className="aisensy-action-btn">
                              <i className={`bi ${btn.type === 'URL' ? 'bi-box-arrow-up-right' : btn.type === 'PHONE_NUMBER' ? 'bi-telephone-fill' : 'bi-reply-fill'}`}></i>
                              <span>{btn.text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-2 border-top d-flex align-items-center justify-content-between gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-success d-flex align-items-center justify-content-center gap-1 flex-grow-1 shadow-xs"
                      onClick={() => handleOpenQuickTest(tpl)}
                      title="Send instant test message to your WhatsApp"
                    >
                      <i className="bi bi-send-fill" style={{ fontSize: '0.75rem' }}></i>
                      <span>Quick Test</span>
                    </button>

                    <Link
                      to={`/templates/${tpl.id}`}
                      className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1 shadow-xs"
                      title="Open full template studio & parameters"
                    >
                      <i className="bi bi-sliders"></i>
                      <span>Studio</span>
                    </Link>

                    <div className="dropdown">
                      <button className="btn btn-sm btn-light border px-2" data-bs-toggle="dropdown" title="More options">
                        <i className="bi bi-three-dots-vertical"></i>
                      </button>
                      <ul className="dropdown-menu dropdown-menu-end shadow-sm">
                        <li>
                          <button className="dropdown-item small" onClick={() => handleCheckLiveStatus(tpl)}>
                            <i className="bi bi-arrow-clockwise me-2 text-primary"></i>Check Live Meta Status
                          </button>
                        </li>
                        {tpl.meta_template_id && (
                          <li>
                            <button className="dropdown-item small" onClick={() => copyToClipboard(tpl.meta_template_id, tpl.id)}>
                              <i className="bi bi-clipboard me-2 text-secondary"></i>Copy Meta ID
                            </button>
                          </li>
                        )}
                        <li>
                          <button className="dropdown-item small" onClick={() => copyToClipboard(tpl.name, `name-${tpl.id}`)}>
                            <i className="bi bi-fonts me-2 text-secondary"></i>Copy Template Name
                          </button>
                        </li>
                        <li><hr className="dropdown-divider" /></li>
                        <li>
                          <button className="dropdown-item small text-danger" onClick={() => handleDeleteTemplate(tpl)}>
                            <i className="bi bi-trash me-2"></i>Delete Template
                          </button>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="table-responsive templates-table shadow-xs">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Template Name</th>
                <th>Category</th>
                <th>Language</th>
                <th>Target Account</th>
                <th>Meta Status</th>
                <th>Meta Template ID</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map(tpl => {
                const statusClass = tpl.status === 'APPROVED' ? 'badge-approved' :
                  tpl.status === 'PENDING' ? 'badge-pending' :
                  tpl.status === 'REJECTED' ? 'badge-rejected' : 'badge-paused';

                const catClass = tpl.category === 'MARKETING' ? 'badge-category-marketing' :
                  tpl.category === 'UTILITY' ? 'badge-category-utility' : 'badge-category-auth';

                const acc = accounts.find(a => a.id === tpl.whatsapp_account_id);

                return (
                  <tr key={tpl.id}>
                    <td>
                      <Link to={`/templates/${tpl.id}`} className="fw-bold text-dark text-decoration-none font-monospace">
                        {tpl.name}
                      </Link>
                    </td>
                    <td>
                      <span className={`badge-category ${catClass}`}>
                        {tpl.category || 'MARKETING'}
                      </span>
                    </td>
                    <td>
                      <span className="badge bg-light text-secondary border small">{tpl.language}</span>
                    </td>
                    <td>
                      {acc ? (
                        <span className="small text-muted d-flex align-items-center gap-1">
                          <i className="bi bi-whatsapp text-success"></i>
                          {acc.account_name}
                        </span>
                      ) : (
                        <span className="text-muted small">—</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge-status ${statusClass}`}>
                        <span className="status-dot"></span>
                        <span>{tpl.status}</span>
                      </span>
                    </td>
                    <td>
                      {tpl.meta_template_id ? (
                        <code className="text-muted small">{tpl.meta_template_id}</code>
                      ) : (
                        <span className="text-muted small">—</span>
                      )}
                    </td>
                    <td className="text-end">
                      <div className="d-flex align-items-center justify-content-end gap-1">
                        <button
                          onClick={() => handleOpenQuickTest(tpl)}
                          className="btn btn-sm btn-success py-1 px-2"
                          title="Quick Test Send"
                        >
                          <i className="bi bi-send-fill me-1"></i> Test
                        </button>
                        <Link
                          to={`/templates/${tpl.id}`}
                          className="btn btn-sm btn-outline-secondary py-1 px-2"
                          title="Open Details & Studio"
                        >
                          <i className="bi bi-sliders me-1"></i> Studio
                        </Link>
                        <button
                          onClick={() => handleCheckLiveStatus(tpl)}
                          className="btn btn-sm btn-outline-primary py-1 px-2"
                          title="Check Live Status"
                        >
                          <i className="bi bi-arrow-clockwise"></i>
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(tpl)}
                          className="btn btn-sm btn-outline-danger py-1 px-2"
                          title="Delete Template"
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================================= */}
      {/* CREATE TEMPLATE MODAL */}
      {/* ========================================================= */}
      {showCreateModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15,23,42,0.65)' }}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px' }}>
              <div className="modal-header bg-light border-bottom px-4 py-3">
                <div className="d-flex align-items-center gap-2">
                  <div className="stat-icon bg-success-subtle text-success border border-success-subtle p-2 rounded-3" style={{ width: '36px', height: '36px' }}>
                    <i className="bi bi-plus-circle-fill fs-5"></i>
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold text-dark mb-0">Create & Submit WhatsApp Template</h5>
                    <p className="text-muted small mb-0">Directly syncs to Meta Cloud API approval queue</p>
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setShowCreateModal(false)}></button>
              </div>

              <div className="modal-body p-4">
                {formError && (
                  <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3 rounded-3">
                    <i className="bi bi-exclamation-triangle-fill fs-5 flex-shrink-0"></i>
                    <div>{formError}</div>
                  </div>
                )}

                <div className="row g-4">
                  {/* Left Column: Form Controls */}
                  <div className="col-12 col-lg-7">
                    <form onSubmit={handleCreateSubmit}>
                      {/* Target WhatsApp Account / WABA */}
                      <div className="mb-3">
                        <label className="form-label small fw-bold">
                          Target WhatsApp Business Account / WABA <span className="text-danger">*</span>
                        </label>
                        <select
                          className="form-select"
                          value={formAccountId}
                          onChange={(e) => setFormAccountId(e.target.value)}
                          required
                        >
                          {accounts.length === 0 ? (
                            <option value="">No WhatsApp accounts connected</option>
                          ) : (
                            accounts.map(acc => (
                              <option key={acc.id} value={acc.id}>
                                {acc.account_name} — {acc.display_phone_number || 'No phone'} (WABA: {acc.waba_id})
                              </option>
                            ))
                          )}
                        </select>
                        <div className="form-text small text-muted">
                          This template will be registered under this client's official Meta Business Portfolio.
                        </div>
                      </div>

                      {/* Name & Language */}
                      <div className="row g-3 mb-3">
                        <div className="col-md-7">
                          <label className="form-label small fw-bold">
                            Template Name <span className="text-danger">*</span>
                          </label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="e.g. festive_diwali_offer"
                            value={formName}
                            onChange={(e) => setFormName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                            required
                          />
                          <div className="form-text small text-muted">
                            Lowercase letters, numbers, and underscores only.
                          </div>
                        </div>

                        <div className="col-md-5">
                          <label className="form-label small fw-bold">Language</label>
                          <select
                            className="form-select"
                            value={formLanguage}
                            onChange={(e) => setFormLanguage(e.target.value)}
                          >
                            {LANGUAGES.map(l => (
                              <option key={l.code} value={l.code}>{l.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Category */}
                      <div className="mb-3">
                        <label className="form-label small fw-bold">Category</label>
                        <div className="d-flex gap-2">
                          {[
                            { id: 'MARKETING', label: 'Marketing', icon: 'bi-megaphone-fill' },
                            { id: 'UTILITY', label: 'Utility', icon: 'bi-gear-fill' },
                            { id: 'AUTHENTICATION', label: 'Authentication', icon: 'bi-shield-lock-fill' }
                          ].map(cat => (
                            <button
                              key={cat.id}
                              type="button"
                              className={`btn btn-sm flex-fill d-flex align-items-center justify-content-center gap-1 py-2 ${formCategory === cat.id ? 'btn-success' : 'btn-outline-secondary'}`}
                              onClick={() => setFormCategory(cat.id)}
                            >
                              <i className={`bi ${cat.icon}`}></i>
                              <span>{cat.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Header Selection */}
                      <div className="mb-3">
                        <label className="form-label small fw-bold">Header Format (Optional)</label>
                        <select
                          className="form-select mb-2"
                          value={headerType}
                          onChange={(e) => setHeaderType(e.target.value)}
                        >
                          <option value="NONE">None (No Header)</option>
                          <option value="TEXT">Text Header</option>
                          <option value="IMAGE">Image Header (PNG/JPG)</option>
                          <option value="VIDEO">Video Header (MP4)</option>
                          <option value="DOCUMENT">Document Header (PDF)</option>
                        </select>

                        {headerType === 'TEXT' && (
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Header text (e.g. Exclusive Diwali VIP Offer!)"
                            value={headerText}
                            onChange={(e) => setHeaderText(e.target.value)}
                          />
                        )}
                      </div>

                      {/* Message Body */}
                      <div className="mb-3">
                        <div className="d-flex align-items-center justify-content-between mb-1">
                          <label className="form-label small fw-bold mb-0">
                            Message Body <span className="text-danger">*</span>
                          </label>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-success py-0 px-2"
                            style={{ fontSize: '0.75rem' }}
                            onClick={() => {
                              const nextNum = detectedVariables.length + 1;
                              setBodyText(prev => `${prev} {{${nextNum}}}`);
                            }}
                          >
                            <i className="bi bi-braces me-1"></i>+ Add Variable &#123;&#123;{detectedVariables.length + 1}&#125;&#125;
                          </button>
                        </div>
                        <textarea
                          rows="4"
                          className="form-control"
                          value={bodyText}
                          onChange={(e) => setBodyText(e.target.value)}
                          placeholder="Type your WhatsApp message. Use {{1}}, {{2}} for variables."
                          required
                        ></textarea>
                      </div>

                      {/* Variable Sample Values (Required by Meta) */}
                      {detectedVariables.length > 0 && (
                        <div className="card bg-light border p-3 mb-3 rounded-3">
                          <div className="fw-bold small mb-2 text-dark d-flex align-items-center gap-1">
                            <i className="bi bi-info-circle-fill text-primary"></i>
                            <span>Variable Sample Values (Required by Meta for Review):</span>
                          </div>
                          <div className="row g-2">
                            {detectedVariables.map((v) => (
                              <div key={v} className="col-12 col-md-6">
                                <label className="form-label small text-muted mb-1 d-flex align-items-center gap-1">
                                  <span>Variable</span>
                                  <span className="variable-badge">&#123;&#123;{v}&#125;&#125;</span>
                                </label>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  placeholder={`Sample for {{${v}}}`}
                                  value={variableExamples[v] || ''}
                                  onChange={(e) => setVariableExamples({ ...variableExamples, [v]: e.target.value })}
                                  required
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Footer Text */}
                      <div className="mb-3">
                        <label className="form-label small fw-bold">Footer Text (Optional)</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. Reply STOP to opt out"
                          value={footerText}
                          onChange={(e) => setFooterText(e.target.value)}
                        />
                      </div>

                      {/* Interactive Buttons Builder */}
                      <div className="mb-4">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <label className="form-label small fw-bold mb-0">Call to Action Buttons (Max 3)</label>
                          <div className="btn-group btn-group-sm">
                            <button
                              type="button"
                              className="btn btn-outline-secondary"
                              onClick={() => handleAddButton('QUICK_REPLY')}
                            >
                              + Quick Reply
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-secondary"
                              onClick={() => handleAddButton('URL')}
                            >
                              + Website URL
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-secondary"
                              onClick={() => handleAddButton('PHONE_NUMBER')}
                            >
                              + Phone Number
                            </button>
                          </div>
                        </div>

                        {buttons.map((btn, idx) => (
                          <div key={idx} className="card p-2 mb-2 border bg-light rounded-3">
                            <div className="d-flex align-items-center justify-content-between mb-1">
                              <span className="badge bg-secondary small">{btn.type}</span>
                              <button
                                type="button"
                                className="btn btn-sm btn-link text-danger p-0"
                                onClick={() => handleRemoveButton(idx)}
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </div>
                            <div className="row g-2">
                              <div className="col-5">
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  placeholder="Button Label"
                                  value={btn.text}
                                  onChange={(e) => {
                                    const next = [...buttons];
                                    next[idx].text = e.target.value;
                                    setButtons(next);
                                  }}
                                />
                              </div>
                              <div className="col-7">
                                {btn.type === 'URL' && (
                                  <input
                                    type="url"
                                    className="form-control form-control-sm"
                                    placeholder="https://yourwebsite.com"
                                    value={btn.url || ''}
                                    onChange={(e) => {
                                      const next = [...buttons];
                                      next[idx].url = e.target.value;
                                      setButtons(next);
                                    }}
                                  />
                                )}
                                {btn.type === 'PHONE_NUMBER' && (
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    placeholder="+919876543210"
                                    value={btn.phone_number || ''}
                                    onChange={(e) => {
                                      const next = [...buttons];
                                      next[idx].phone_number = e.target.value;
                                      setButtons(next);
                                    }}
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="d-flex justify-content-end gap-2 pt-3 border-top">
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => setShowCreateModal(false)}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={submitting}
                          className="btn btn-success d-flex align-items-center gap-2"
                        >
                          {submitting ? (
                            <>
                              <div className="spinner-border spinner-border-sm" role="status"></div>
                              <span>Submitting to Meta...</span>
                            </>
                          ) : (
                            <>
                              <i className="bi bi-cloud-arrow-up-fill"></i>
                              <span>Submit Template to Meta</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Right Column: Live WhatsApp Mobile Simulator */}
                  <div className="col-12 col-lg-5 text-center">
                    <div className="small fw-bold text-muted mb-2 text-uppercase d-flex align-items-center justify-content-center gap-1">
                      <i className="bi bi-phone"></i>
                      <span>Live WhatsApp Phone Simulator</span>
                    </div>
                    {renderSimulatedPreview(null, true)}
                    <div className="text-muted small mt-2">
                      <i className="bi bi-shield-check text-success me-1"></i>
                      Simulated preview. Meta review automated approval typically completes in 2–15 minutes.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW DETAILS & REJECTION MODAL */}
      {/* ========================================================= */}
      {detailTemplate && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15,23,42,0.65)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px' }}>
              <div className="modal-header bg-light border-bottom px-4 py-3">
                <div className="d-flex align-items-center gap-2">
                  <h5 className="modal-title fw-bold text-dark mb-0">{detailTemplate.name}</h5>
                  <span className={`badge-status ${detailTemplate.status === 'APPROVED' ? 'badge-approved' : detailTemplate.status === 'PENDING' ? 'badge-pending' : 'badge-rejected'}`}>
                    <span className="status-dot"></span>
                    <span>{detailTemplate.status}</span>
                  </span>
                </div>
                <button type="button" className="btn-close" onClick={() => setDetailTemplate(null)}></button>
              </div>

              <div className="modal-body p-4">
                {/* Rejection Alert if present */}
                {detailTemplate.status === 'REJECTED' && (
                  <div className="rejection-banner mb-4">
                    <h6 className="fw-bold mb-1 text-danger d-flex align-items-center gap-1">
                      <i className="bi bi-x-octagon-fill"></i>
                      <span>Meta Rejection Details</span>
                    </h6>
                    <p>{detailTemplate.rejection_reason || 'This template was rejected by Meta moderation policy.'}</p>
                    <div className="small text-danger mt-2">
                      <strong>Policy Tip:</strong> Check that variable placeholders have realistic sample values, promotional phrasing does not make prohibited claims, and all buttons have valid URLs or phone numbers.
                    </div>
                  </div>
                )}

                <div className="row g-4 align-items-center">
                  {/* Meta Details Metadata */}
                  <div className="col-12 col-md-6">
                    <h6 className="fw-bold mb-3 border-bottom pb-2 text-dark">
                      <i className="bi bi-info-circle me-1 text-success"></i>
                      Meta Cloud API Specifications
                    </h6>

                    <div className="card bg-light border p-3 rounded-3 mb-3">
                      <div className="mb-2">
                        <span className="text-muted small d-block">Meta Template ID:</span>
                        <div className="d-flex align-items-center gap-2">
                          <code className="text-dark fw-bold">{detailTemplate.meta_template_id || 'Not assigned'}</code>
                          {detailTemplate.meta_template_id && (
                            <button
                              type="button"
                              className="btn btn-sm btn-link p-0 text-muted"
                              title="Copy ID"
                              onClick={() => copyToClipboard(detailTemplate.meta_template_id, 'modal')}
                            >
                              <i className={`bi ${copiedId === 'modal' ? 'bi-check2 text-success' : 'bi-clipboard'}`}></i>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="row g-2 mb-2">
                        <div className="col-6">
                          <span className="text-muted small d-block">Category:</span>
                          <span className="badge-category badge-category-marketing">{detailTemplate.category}</span>
                        </div>
                        <div className="col-6">
                          <span className="text-muted small d-block">Language:</span>
                          <span className="badge bg-white text-secondary border small">{detailTemplate.language}</span>
                        </div>
                      </div>

                      <div className="mb-0">
                        <span className="text-muted small d-block">Last Synchronized:</span>
                        <span className="small text-dark fw-semibold">
                          {detailTemplate.last_synced_at ? new Date(detailTemplate.last_synced_at).toLocaleString() : 'Never'}
                        </span>
                      </div>
                    </div>

                    <div className="d-flex gap-2">
                      <button
                        onClick={() => handleCheckLiveStatus(detailTemplate)}
                        disabled={statusCheckLoading}
                        className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1 shadow-xs"
                      >
                        <i className={`bi bi-arrow-clockwise ${statusCheckLoading ? 'spin-icon' : ''}`}></i>
                        <span>{statusCheckLoading ? 'Checking...' : 'Check Live Status'}</span>
                      </button>

                      <button
                        onClick={() => handleDeleteTemplate(detailTemplate)}
                        className="btn btn-outline-danger btn-sm shadow-xs"
                      >
                        <i className="bi bi-trash me-1"></i>Delete
                      </button>
                    </div>
                  </div>

                  {/* WhatsApp Mobile Preview */}
                  <div className="col-12 col-md-6 text-center">
                    <div className="small fw-bold text-muted mb-2 text-uppercase">Recipient Preview</div>
                    {renderSimulatedPreview(detailTemplate, false)}
                  </div>
                </div>
              </div>

              <div className="modal-footer bg-light px-4 py-3">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDetailTemplate(null)}>
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* QUICK TEST SEND MODAL (Aisensy / WATI Direct Dispatch)  */}
      {/* ========================================================= */}
      {quickTestTemplate && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15,23,42,0.65)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px' }}>
              <div className="modal-header bg-light border-bottom px-4 py-3">
                <div className="d-flex align-items-center gap-2">
                  <div className="stat-icon bg-success-subtle text-success border border-success-subtle p-2 rounded-3" style={{ width: '36px', height: '36px' }}>
                    <i className="bi bi-send-fill fs-5"></i>
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold text-dark mb-0">Quick Test Send</h5>
                    <p className="text-muted small mb-0">Dispatch live test to your personal WhatsApp</p>
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setQuickTestTemplate(null)}></button>
              </div>

              <form onSubmit={handleSendQuickTest}>
                <div className="modal-body p-4">
                  {quickTestResult && (
                    <div className={`alert alert-${quickTestResult.success ? 'success' : 'danger'} py-2 px-3 small d-flex align-items-center gap-2 mb-3 rounded-3`}>
                      <i className={`bi ${quickTestResult.success ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} fs-5 flex-shrink-0`}></i>
                      <div>{quickTestResult.message}</div>
                    </div>
                  )}

                  {/* Template Info Card */}
                  <div className="card bg-light border p-3 rounded-3 mb-3">
                    <div className="d-flex align-items-center justify-content-between mb-1">
                      <span className="small text-muted">Selected Template:</span>
                      <span className="badge bg-success-subtle text-success border border-success-subtle">
                        {quickTestTemplate.status}
                      </span>
                    </div>
                    <div className="fw-bold text-dark d-flex align-items-center gap-2">
                      <i className="bi bi-whatsapp text-success"></i>
                      <span>{quickTestTemplate.name}</span>
                      <span className="badge bg-white text-secondary border small">({quickTestTemplate.language})</span>
                    </div>
                  </div>

                  {/* Recipient Phone Number */}
                  <div className="mb-3">
                    <label className="form-label small fw-bold">
                      Recipient WhatsApp Phone Number <span className="text-danger">*</span>
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-light text-muted">
                        <i className="bi bi-whatsapp text-success me-1"></i> +
                      </span>
                      <input
                        type="tel"
                        className="form-control"
                        placeholder="919876543210 (Country code + Phone number)"
                        value={quickTestPhone}
                        onChange={(e) => setQuickTestPhone(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>
                    <div className="form-text small text-muted">
                      Include country code without "+" or spaces (e.g., 919876543210 for India).
                    </div>
                  </div>

                  {/* Dynamic Variables Inputs */}
                  {Object.keys(quickTestVars).length > 0 && (
                    <div className="mb-3">
                      <label className="form-label small fw-bold mb-2">
                        Template Dynamic Variables
                      </label>
                      <div className="d-flex flex-column gap-2 bg-light p-3 rounded-3 border">
                        {Object.keys(quickTestVars).map(vName => (
                          <div key={vName} className="row g-2 align-items-center">
                            <div className="col-4">
                              <span className="wa-var-pill w-100 text-truncate text-center">
                                &#123;&#123;{vName}&#125;&#125;
                              </span>
                            </div>
                            <div className="col-8">
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder={`Value for {{${vName}}}`}
                                value={quickTestVars[vName] || ''}
                                onChange={(e) => setQuickTestVars({
                                  ...quickTestVars,
                                  [vName]: e.target.value
                                })}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="modal-footer bg-light px-4 py-3 d-flex justify-content-between">
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setQuickTestTemplate(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-success btn-sm d-flex align-items-center gap-2 shadow-xs" disabled={quickTestSending}>
                    <i className={`bi ${quickTestSending ? 'bi-arrow-repeat spin-icon' : 'bi-send-fill'}`}></i>
                    <span>{quickTestSending ? 'Dispatching...' : 'Send Live Test'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
