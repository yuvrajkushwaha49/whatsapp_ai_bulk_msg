import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
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
  const [templates, setTemplates] = useState([]);
  const [stats, setStats] = useState({ total: 0, approved: 0, pending: 0, rejected: 0, paused_or_disabled: 0 });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [languageFilter, setLanguageFilter] = useState('ALL');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [detailTemplate, setDetailTemplate] = useState(null);
  const [statusCheckLoading, setStatusCheckLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

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
    fetchTemplates();
  }, [activeFilter, categoryFilter, languageFilter]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const params = {};
      if (activeFilter !== 'ALL') params.status = activeFilter;
      if (categoryFilter !== 'ALL') params.category = categoryFilter;
      if (languageFilter !== 'ALL') params.language = languageFilter;
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
      const res = await api.post('/whatsapp/templates/sync');
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

    // Validation
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
        // Reset form
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

      // Replace variables with examples in preview
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
              <i className="bi bi-person-fill"></i>
            </div>
            <div>
              <div className="fw-bold small">Official WhatsApp Business</div>
              <div style={{ fontSize: '0.68rem', opacity: 0.85 }}>Verified Meta Channel</div>
            </div>
          </div>
          <div className="wa-screen-body">
            <div className="wa-bubble-preview">
              {hType !== 'NONE' && (
                <>
                  {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(hType) ? (
                    <div className="wa-header-media">
                      <i className={`bi ${hType === 'IMAGE' ? 'bi-image' : hType === 'VIDEO' ? 'bi-play-circle' : 'bi-file-earmark-text'} fs-3 me-2`}></i>
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
                12:45 PM <i className="bi bi-check2-all text-primary ms-1"></i>
              </div>

              {btnList.length > 0 && (
                <div className="wa-buttons-container">
                  {btnList.map((btn, idx) => (
                    <div key={idx} className="wa-action-button">
                      <i className={`bi ${btn.type === 'URL' ? 'bi-box-arrow-up-right' : btn.type === 'PHONE_NUMBER' ? 'bi-telephone-fill' : 'bi-reply-fill'} me-1`}></i>
                      {btn.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="container-fluid py-4 px-md-4">
      {/* Header Bar */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between mb-4 gap-3">
        <div>
          <h2 className="brand-font mb-1 d-flex align-items-center gap-2">
            <i className="bi bi-card-checklist text-success"></i>
            <span>WhatsApp Templates</span>
          </h2>
          <p className="text-muted mb-0">
            Create, synchronize, and monitor Meta-approved WhatsApp Cloud API message templates
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          <button
            onClick={handleSyncFromMeta}
            disabled={syncing}
            className="btn btn-outline-success d-flex align-items-center gap-2 shadow-sm"
          >
            <i className={`bi bi-arrow-repeat ${syncing ? 'spin-icon' : ''}`}></i>
            <span>{syncing ? 'Syncing with Meta...' : 'Sync from Meta'}</span>
          </button>

          <button
            onClick={() => { setShowCreateModal(true); setFormError(''); }}
            className="btn btn-success d-flex align-items-center gap-2 shadow-sm"
          >
            <i className="bi bi-plus-circle-fill"></i>
            <span>Create Template</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMsg && (
        <div className={`alert alert-${feedbackMsg.type} alert-dismissible fade show shadow-sm d-flex align-items-center justify-content-between mb-4`} role="alert">
          <div>
            <i className={`bi ${feedbackMsg.type === 'success' ? 'bi-check-circle-fill text-success' : 'bi-exclamation-triangle-fill text-danger'} me-2 fs-5`}></i>
            <span>{typeof feedbackMsg?.text === 'string' ? feedbackMsg.text : (feedbackMsg?.text?.message || JSON.stringify(feedbackMsg?.text || ''))}</span>
          </div>
          <button type="button" className="btn-close" onClick={() => setFeedbackMsg(null)}></button>
        </div>
      )}

      {/* Top Stats Dashboard Cards */}
      <div className="template-stats-grid">
        <div
          className={`template-stat-card ${activeFilter === 'ALL' ? 'active-filter' : ''}`}
          onClick={() => setActiveFilter('ALL')}
          style={{ cursor: 'pointer' }}
        >
          <div className="d-flex align-items-center justify-content-between">
            <div>
              <div className="stat-count">{stats.total}</div>
              <div className="stat-label">Total Templates</div>
            </div>
            <div className="stat-icon bg-light text-secondary">
              <i className="bi bi-collection-fill"></i>
            </div>
          </div>
        </div>

        <div
          className={`template-stat-card ${activeFilter === 'APPROVED' ? 'active-filter' : ''}`}
          onClick={() => setActiveFilter('APPROVED')}
          style={{ cursor: 'pointer' }}
        >
          <div className="d-flex align-items-center justify-content-between">
            <div>
              <div className="stat-count text-success">{stats.approved}</div>
              <div className="stat-label">Meta Approved</div>
            </div>
            <div className="stat-icon bg-success-subtle text-success">
              <i className="bi bi-check-circle-fill"></i>
            </div>
          </div>
        </div>

        <div
          className={`template-stat-card ${activeFilter === 'PENDING' ? 'active-filter' : ''}`}
          onClick={() => setActiveFilter('PENDING')}
          style={{ cursor: 'pointer' }}
        >
          <div className="d-flex align-items-center justify-content-between">
            <div>
              <div className="stat-count text-warning">{stats.pending}</div>
              <div className="stat-label">In Review (Pending)</div>
            </div>
            <div className="stat-icon bg-warning-subtle text-warning">
              <i className="bi bi-hourglass-split"></i>
            </div>
          </div>
        </div>

        <div
          className={`template-stat-card ${activeFilter === 'REJECTED' ? 'active-filter' : ''}`}
          onClick={() => setActiveFilter('REJECTED')}
          style={{ cursor: 'pointer' }}
        >
          <div className="d-flex align-items-center justify-content-between">
            <div>
              <div className="stat-count text-danger">{stats.rejected}</div>
              <div className="stat-label">Meta Rejected</div>
            </div>
            <div className="stat-icon bg-danger-subtle text-danger">
              <i className="bi bi-x-octagon-fill"></i>
            </div>
          </div>
        </div>

        <div
          className={`template-stat-card ${activeFilter === 'PAUSED_DISABLED' ? 'active-filter' : ''}`}
          onClick={() => setActiveFilter('PAUSED_DISABLED')}
          style={{ cursor: 'pointer' }}
        >
          <div className="d-flex align-items-center justify-content-between">
            <div>
              <div className="stat-count text-secondary">{stats.paused_or_disabled}</div>
              <div className="stat-label">Paused / Disabled</div>
            </div>
            <div className="stat-icon bg-light text-muted">
              <i className="bi bi-pause-circle-fill"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body p-3">
          <div className="row g-2 align-items-center">
            {/* Search Input */}
            <div className="col-12 col-md-4">
              <div className="input-group">
                <span className="input-group-text bg-white border-end-0 text-muted">
                  <i className="bi bi-search"></i>
                </span>
                <input
                  type="text"
                  className="form-control border-start-0"
                  placeholder="Search template name or text..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchTemplates()}
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="col-6 col-md-3">
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
            <div className="col-6 col-md-3">
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
            <div className="col-12 col-md-2">
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
          </div>
        </div>
      </div>

      {/* Templates Content View */}
      {loading ? (
        <div className="row g-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="col-12 col-md-6 col-lg-4">
              <div className="card p-4 border-0 shadow-sm skeleton-box" style={{ height: '180px' }}></div>
            </div>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="empty-templates-state">
          <div className="display-4 text-muted mb-3">
            <i className="bi bi-chat-left-dots"></i>
          </div>
          <h5 className="fw-bold">No WhatsApp Templates Found</h5>
          <p className="text-muted mb-4" style={{ maxWidth: '480px', margin: '0 auto' }}>
            {activeFilter !== 'ALL' || searchQuery || categoryFilter !== 'ALL'
              ? 'No templates matched your active filter criteria. Try resetting filters.'
              : 'Sync your pre-approved templates directly from Meta or create a new template now.'}
          </p>
          <div className="d-flex justify-content-center gap-2">
            <button onClick={handleSyncFromMeta} className="btn btn-outline-success">
              <i className="bi bi-arrow-repeat me-1"></i> Sync from Meta
            </button>
            <button onClick={() => setShowCreateModal(true)} className="btn btn-success">
              <i className="bi bi-plus-circle me-1"></i> Create New Template
            </button>
          </div>
        </div>
      ) : (
        <div className="row g-3">
          {templates.map(tpl => {
            const comps = Array.isArray(tpl.components)
              ? tpl.components
              : (typeof tpl.components === 'string' ? JSON.parse(tpl.components || '[]') : []);
            const bodyComp = comps.find(c => c.type === 'BODY' || c.type === 'body');
            const statusClass = tpl.status === 'APPROVED' ? 'badge-approved' :
              tpl.status === 'PENDING' ? 'badge-pending' :
              tpl.status === 'REJECTED' ? 'badge-rejected' : 'badge-paused';

            return (
              <div key={tpl.id} className="col-12 col-md-6 col-lg-4">
                <div className="template-item-card shadow-sm">
                  <div>
                    {/* Header: Title and Status */}
                    <div className="d-flex align-items-start justify-content-between mb-2">
                      <div className="fw-bold text-dark text-break fs-6 me-2" title={tpl.name}>
                        {tpl.name}
                      </div>
                      <span className={`badge-status ${statusClass} flex-shrink-0`}>
                        {tpl.status === 'APPROVED' && <i className="bi bi-check-circle-fill"></i>}
                        {tpl.status === 'PENDING' && <i className="bi bi-hourglass-split"></i>}
                        {tpl.status === 'REJECTED' && <i className="bi bi-x-circle-fill"></i>}
                        {tpl.status}
                      </span>
                    </div>

                    {/* Metadata Badges */}
                    <div className="d-flex align-items-center gap-2 mb-3">
                      <span className="badge-category">{tpl.category || 'MARKETING'}</span>
                      <span className="badge-category"><i className="bi bi-translate me-1"></i>{tpl.language}</span>
                      {tpl.meta_template_id && (
                        <span className="text-muted small" title="Meta Template ID">
                          ID: {tpl.meta_template_id.substring(0, 10)}...
                        </span>
                      )}
                    </div>

                    {/* Rejection Alert if Rejected */}
                    {tpl.status === 'REJECTED' && tpl.rejection_reason && (
                      <div className="rejection-banner py-2 px-2 small mb-2">
                        <strong>Reason:</strong> {tpl.rejection_reason}
                      </div>
                    )}

                    {/* Body Preview */}
                    <p className="text-muted small mb-3 text-truncate-3" style={{ minHeight: '3.6em', whiteSpace: 'pre-wrap' }}>
                      {bodyComp?.text || 'No text content'}
                    </p>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-2 border-top d-flex align-items-center justify-content-between">
                    <button
                      onClick={() => setDetailTemplate(tpl)}
                      className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"
                    >
                      <i className="bi bi-eye"></i>
                      <span>Details & Preview</span>
                    </button>

                    <div className="dropdown">
                      <button className="btn btn-sm btn-light border-0" data-bs-toggle="dropdown">
                        <i className="bi bi-three-dots-vertical"></i>
                      </button>
                      <ul className="dropdown-menu dropdown-menu-end shadow-sm">
                        <li>
                          <button className="dropdown-item small" onClick={() => handleCheckLiveStatus(tpl)}>
                            <i className="bi bi-arrow-clockwise me-2 text-primary"></i>Check Live Meta Status
                          </button>
                        </li>
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
      )}

      {/* ========================================================= */}
      {/* CREATE TEMPLATE MODAL */}
      {/* ========================================================= */}
      {showCreateModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header bg-light">
                <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                  <i className="bi bi-plus-circle-fill text-success"></i>
                  <span>Create & Submit WhatsApp Template</span>
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowCreateModal(false)}></button>
              </div>

              <div className="modal-body p-4">
                {formError && (
                  <div className="alert alert-danger py-2 small d-flex align-items-center gap-2 mb-3">
                    <i className="bi bi-exclamation-triangle-fill fs-5"></i>
                    <div>{formError}</div>
                  </div>
                )}

                <div className="row g-4">
                  {/* Left Column: Form Controls */}
                  <div className="col-12 col-lg-7">
                    <form onSubmit={handleCreateSubmit}>
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
                          <div className="form-text small">
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
                          {['MARKETING', 'UTILITY', 'AUTHENTICATION'].map(cat => (
                            <button
                              key={cat}
                              type="button"
                              className={`btn btn-sm flex-fill ${formCategory === cat ? 'btn-success' : 'btn-outline-secondary'}`}
                              onClick={() => setFormCategory(cat)}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Header Selection */}
                      <div className="mb-3">
                        <label className="form-label small fw-bold">Header (Optional)</label>
                        <select
                          className="form-select mb-2"
                          value={headerType}
                          onChange={(e) => setHeaderType(e.target.value)}
                        >
                          <option value="NONE">None</option>
                          <option value="TEXT">Text Header</option>
                          <option value="IMAGE">Image Header</option>
                          <option value="VIDEO">Video Header</option>
                          <option value="DOCUMENT">Document Header</option>
                        </select>

                        {headerType === 'TEXT' && (
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Header text (e.g. Exclusive Offer!)"
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
                            className="btn btn-sm btn-outline-primary py-0 px-2"
                            style={{ fontSize: '0.75rem' }}
                            onClick={() => {
                              const nextNum = detectedVariables.length + 1;
                              setBodyText(prev => `${prev} {{${nextNum}}}`);
                            }}
                          >
                            + Add Variable &#123;&#123;{detectedVariables.length + 1}&#125;&#125;
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
                        <div className="card bg-light border-0 p-3 mb-3">
                          <div className="fw-bold small mb-2 text-dark">
                            <i className="bi bi-info-circle me-1 text-primary"></i>
                            Variable Example Values (Required by Meta for Review):
                          </div>
                          <div className="row g-2">
                            {detectedVariables.map((v) => (
                              <div key={v} className="col-12 col-md-6">
                                <label className="form-label small text-muted mb-1">
                                  Variable <span className="variable-badge">&#123;&#123;{v}&#125;&#125;</span>
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
                          <label className="form-label small fw-bold mb-0">Call to Action Buttons</label>
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
                          <div key={idx} className="card p-2 mb-2 border bg-light">
                            <div className="d-flex align-items-center justify-content-between mb-1">
                              <span className="badge bg-secondary small">{btn.type}</span>
                              <button
                                type="button"
                                className="btn btn-sm btn-link text-danger p-0"
                                onClick={() => handleRemoveButton(idx)}
                              >
                                Remove
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

                      <div className="d-flex justify-content-end gap-2">
                        <button
                          type="button"
                          className="btn btn-secondary"
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
                    <div className="small fw-bold text-muted mb-2 text-uppercase">Live WhatsApp Mobile Simulator</div>
                    {renderSimulatedPreview(null, true)}
                    <div className="text-muted small mt-2">
                      <i className="bi bi-shield-check text-success me-1"></i>
                      Simulated preview. Meta automated review typically takes 2–15 minutes.
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
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header bg-light">
                <div className="d-flex align-items-center gap-2">
                  <h5 className="modal-title fw-bold mb-0">{detailTemplate.name}</h5>
                  <span className={`badge-status ${detailTemplate.status === 'APPROVED' ? 'badge-approved' : detailTemplate.status === 'PENDING' ? 'badge-pending' : 'badge-rejected'}`}>
                    {detailTemplate.status}
                  </span>
                </div>
                <button type="button" className="btn-close" onClick={() => setDetailTemplate(null)}></button>
              </div>

              <div className="modal-body p-4">
                {/* Rejection Alert if present */}
                {detailTemplate.status === 'REJECTED' && (
                  <div className="rejection-banner mb-3">
                    <h6 className="fw-bold mb-1">
                      <i className="bi bi-x-octagon-fill me-2"></i>Meta Rejection Details
                    </h6>
                    <p>{detailTemplate.rejection_reason || 'This template was rejected by Meta moderation policy.'}</p>
                    <div className="small text-danger mt-2">
                      Tip: Ensure template name contains only lowercase alphanumeric characters, no promotional claims violating policy, and provides proper variable examples.
                    </div>
                  </div>
                )}

                <div className="row g-4">
                  {/* Meta Details Metadata */}
                  <div className="col-12 col-md-6">
                    <h6 className="fw-bold mb-3 border-bottom pb-2">Meta Cloud API Specifications</h6>

                    <div className="mb-2">
                      <span className="text-muted small d-block">Meta Template ID:</span>
                      <code>{detailTemplate.meta_template_id || 'Not assigned'}</code>
                    </div>

                    <div className="mb-2">
                      <span className="text-muted small d-block">Category:</span>
                      <span className="badge-category">{detailTemplate.category}</span>
                    </div>

                    <div className="mb-2">
                      <span className="text-muted small d-block">Language:</span>
                      <span className="badge-category">{detailTemplate.language}</span>
                    </div>

                    <div className="mb-2">
                      <span className="text-muted small d-block">Last Synchronized:</span>
                      <span className="small text-dark">
                        {detailTemplate.last_synced_at ? new Date(detailTemplate.last_synced_at).toLocaleString() : 'Never'}
                      </span>
                    </div>

                    <div className="mt-4 pt-3 border-top d-flex gap-2">
                      <button
                        onClick={() => handleCheckLiveStatus(detailTemplate)}
                        disabled={statusCheckLoading}
                        className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
                      >
                        <i className={`bi bi-arrow-clockwise ${statusCheckLoading ? 'spin-icon' : ''}`}></i>
                        <span>{statusCheckLoading ? 'Checking...' : 'Check Live Status'}</span>
                      </button>

                      <button
                        onClick={() => handleDeleteTemplate(detailTemplate)}
                        className="btn btn-outline-danger btn-sm"
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

              <div className="modal-footer bg-light">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDetailTemplate(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
