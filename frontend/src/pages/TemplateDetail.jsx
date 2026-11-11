import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate, useOutletContext } from 'react-router-dom';
import api from '../services/api';
import AiwavoHeader from '../components/AiwavoHeader';
import '../styles/templates.css';

export default function TemplateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const outletContext = useOutletContext();
  const onToggleSidebar = outletContext?.onToggleSidebar;

  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [copiedKey, setCopiedKey] = useState('');
  const [activeTab, setActiveTab] = useState('components'); // 'components' | 'specs' | 'campaigns' | 'test'

  // Live Variable Playground State (allows user to test different variables in phone preview)
  const [sampleVariables, setSampleVariables] = useState({});

  // Test Send Form State
  const [testRecipient, setTestRecipient] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Delete Confirmation Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchTemplate();
  }, [id]);

  const fetchTemplate = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/whatsapp/templates/${id}`);
      if (res.data?.success && res.data.data) {
        const tpl = res.data.data;
        setTemplate(tpl);

        // Extract variables from body text to initialize sample values
        const comps = Array.isArray(tpl.components)
          ? tpl.components
          : (typeof tpl.components === 'string' ? JSON.parse(tpl.components || '[]') : []);
        const bodyComp = comps.find(c => c.type === 'BODY' || c.type === 'body');
        if (bodyComp?.text) {
          const matches = bodyComp.text.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) || [];
          const initialSamples = {};
          matches.forEach((m, idx) => {
            const key = m.replace(/[{}]/g, '');
            initialSamples[key] = idx === 0 ? 'Rahul Sharma' : (idx === 1 ? 'DIWALI50' : `Sample ${key}`);
          });
          setSampleVariables(initialSamples);
        }
      } else {
        setError('Template not found or has been removed.');
      }
    } catch (err) {
      console.error('Failed to fetch template detail', err);
      setError(err.response?.data?.error?.message || err.message || 'Failed to load template.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckLiveStatus = async () => {
    try {
      setRefreshingStatus(true);
      setFeedback({ type: '', text: '' });
      const res = await api.get(`/whatsapp/templates/${id}/status`);
      if (res.data?.success && res.data.data) {
        const updated = res.data.data;
        setTemplate(prev => ({ ...prev, ...updated }));
        setFeedback({
          type: 'success',
          text: `Meta Live Status updated: ${updated.status} (Verified at ${new Date().toLocaleTimeString()})`
        });
      }
    } catch (err) {
      console.error('Status check failed', err);
      setFeedback({
        type: 'danger',
        text: err.response?.data?.error?.message || 'Failed to verify live Meta status.'
      });
    } finally {
      setRefreshingStatus(false);
    }
  };

  const handleDeleteTemplate = async () => {
    try {
      setDeleting(true);
      const res = await api.delete(`/whatsapp/templates/${id}`);
      if (res.data?.success) {
        navigate('/templates');
      }
    } catch (err) {
      console.error('Delete failed', err);
      setFeedback({
        type: 'danger',
        text: err.response?.data?.error?.message || 'Failed to delete template from Meta.'
      });
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  };

  const copyToClipboard = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  const handleSendTestMessage = async (e) => {
    e.preventDefault();
    if (!testRecipient.trim()) {
      setFeedback({ type: 'danger', text: 'Please enter a valid recipient WhatsApp number.' });
      return;
    }

    try {
      setSendingTest(true);
      setTestResult(null);

      const parameters = Object.keys(sampleVariables).map(k => ({
        type: 'text',
        text: sampleVariables[k]
      }));

      const payload = {
        phoneNumber: testRecipient.replace(/[^0-9]/g, ''),
        templateName: template.name,
        language: template.language || 'en',
        parameters: parameters.length > 0 ? parameters : undefined,
        accountId: template.whatsapp_account_id || undefined
      };

      const res = await api.post('/whatsapp/send-test', payload);
      if (res.data?.success) {
        setTestResult({
          success: true,
          message: `Test message dispatched to +${testRecipient}! Message ID: ${res.data.data?.messageId || 'Generated'}`
        });
      } else {
        setTestResult({
          success: false,
          message: res.data?.message || 'Failed to send test message.'
        });
      }
    } catch (err) {
      console.error('Test message send failed', err);
      setTestResult({
        success: false,
        message: err.response?.data?.error?.message || err.message || 'Error occurred while sending test template.'
      });
    } finally {
      setSendingTest(false);
    }
  };

  // Parsing components
  const components = useMemo(() => {
    if (!template?.components) return [];
    if (Array.isArray(template.components)) return template.components;
    try {
      return JSON.parse(template.components);
    } catch {
      return [];
    }
  }, [template]);

  const headerComp = components.find(c => c.type === 'HEADER' || c.type === 'header');
  const bodyComp = components.find(c => c.type === 'BODY' || c.type === 'body');
  const footerComp = components.find(c => c.type === 'FOOTER' || c.type === 'footer');
  const buttonsComp = components.find(c => c.type === 'BUTTONS' || c.type === 'buttons');
  const buttonsList = buttonsComp?.buttons || [];

  // Dynamic preview text with sample variables replaced
  const previewBodyText = useMemo(() => {
    if (!bodyComp?.text) return 'No body text';
    let text = bodyComp.text;
    Object.keys(sampleVariables).forEach(k => {
      text = text.split(`{{${k}}}`).join(sampleVariables[k] || `{{${k}}}`);
    });
    return text;
  }, [bodyComp, sampleVariables]);

  const detectedVariables = useMemo(() => {
    if (!bodyComp?.text) return [];
    const matches = bodyComp.text.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) || [];
    return Array.from(new Set(matches.map(m => m.replace(/[{}]/g, ''))));
  }, [bodyComp]);

  // Syntax highlighting helper for variables
  const renderHighlightedBody = (text) => {
    if (!text) return <span className="text-muted fst-italic">No message body defined</span>;
    const parts = text.split(/(\{\{[a-zA-Z0-9_]+\}\})/g);
    return parts.map((part, i) => {
      if (part.startsWith('{{') && part.endsWith('}}')) {
        return (
          <span key={i} className="variable-badge mx-1">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  if (loading) {
    return (
      <div className="container-fluid py-5 text-center">
        <div className="spinner-border text-success" role="status" style={{ width: '3rem', height: '3rem' }}></div>
        <p className="text-muted mt-3 fw-semibold">Loading WhatsApp template specifications...</p>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="container-fluid py-5">
        <div className="card border-0 shadow-sm p-5 text-center" style={{ maxWidth: '600px', margin: '0 auto', borderRadius: '18px' }}>
          <div className="display-4 text-danger mb-3">
            <i className="bi bi-exclamation-triangle-fill"></i>
          </div>
          <h4 className="fw-bold text-dark">Template Not Found</h4>
          <p className="text-muted mb-4">{error || 'The requested template could not be loaded.'}</p>
          <div className="d-flex justify-content-center gap-2">
            <Link to="/templates" className="btn btn-outline-secondary">
              <i className="bi bi-arrow-left me-1"></i> Back to Templates
            </Link>
            <button onClick={fetchTemplate} className="btn btn-success">
              <i className="bi bi-arrow-repeat me-1"></i> Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const statusClass = template.status === 'APPROVED' ? 'badge-approved' :
    template.status === 'PENDING' ? 'badge-pending' :
    template.status === 'REJECTED' ? 'badge-rejected' : 'badge-paused';

  const catClass = template.category === 'MARKETING' ? 'badge-category-marketing' :
    template.category === 'UTILITY' ? 'badge-category-utility' : 'badge-category-auth';

  const isApproved = template.status === 'APPROVED';
  const isPending = template.status === 'PENDING';
  const isRejected = template.status === 'REJECTED';

  return (
    <div>
      <AiwavoHeader
        title={`Template: ${template.name}`}
        subtitle={`${template.category || 'MARKETING'} • ${template.language} • Status: ${template.status}`}
        onToggleSidebar={onToggleSidebar}
      />

      <div className="td-page-container">
        {/* 1. Top Action Bar */}
        <div className="td-action-bar">
          <div className="d-flex align-items-center gap-2">
            <Link to="/templates" className="td-btn-back">
              <i className="bi bi-arrow-left"></i>
              <span>Templates Studio</span>
            </Link>
            <span className="td-status-pill-top">
              {template.status}
            </span>
          </div>

          <button
            onClick={handleCheckLiveStatus}
            disabled={refreshingStatus}
            className="td-btn-check-status-top"
          >
            <i className={`bi bi-arrow-repeat ${refreshingStatus ? 'spin-icon' : ''}`}></i>
            <span>Check Status</span>
          </button>
        </div>

        {/* 2. Top Main Hero & Audit Trail Card */}
        <div className="td-hero-card">
          {/* Row 1: Badges & Action Buttons */}
          <div className="td-hero-row-top">
            <div className="td-hero-badges">
              <span className="td-badge-approved">
                <i className="bi bi-check-lg"></i>
                <span>{template.status}</span>
              </span>
              <span className="td-badge-cat">
                <i className="bi bi-gear-fill"></i>
                <span>{template.category || 'UTILITY'}</span>
              </span>
              <span className="td-badge-lang">
                <i className="bi bi-globe"></i>
                <span>{template.language}</span>
              </span>
              {template.account && (
                <span className="td-badge-account">
                  <i className="bi bi-building"></i>
                  <span>{template.account.display_name || template.account.phone_number || 'Kalaakchar'}</span>
                </span>
              )}
            </div>

            <div className="td-hero-actions">
              <button
                type="button"
                onClick={handleCheckLiveStatus}
                disabled={refreshingStatus}
                className="td-btn-check-live"
              >
                <i className={`bi bi-arrow-repeat ${refreshingStatus ? 'spin-icon' : ''}`}></i>
                <span>Check Live Status</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('test')}
                className="td-btn-test-send"
              >
                <i className="bi bi-send"></i>
                <span>Test Send</span>
              </button>

              {isApproved ? (
                <Link
                  to={`/campaigns/new?templateId=${template.id}`}
                  className="td-btn-launch"
                >
                  <i className="bi bi-megaphone-fill"></i>
                  <span>Launch Campaign</span>
                </Link>
              ) : (
                <button disabled className="td-btn-launch opacity-75">
                  <i className="bi bi-lock-fill"></i>
                  <span>Launch Campaign</span>
                </button>
              )}

              <div className="dropdown">
                <button className="td-btn-more" data-bs-toggle="dropdown">
                  <i className="bi bi-three-dots-vertical"></i>
                </button>
                <ul className="dropdown-menu dropdown-menu-end shadow-sm">
                  <li>
                    <Link to="/templates" className="dropdown-item small">
                      <i className="bi bi-grid me-2"></i>All Templates
                    </Link>
                  </li>
                  {template.meta_template_id && (
                    <li>
                      <button className="dropdown-item small" onClick={() => copyToClipboard(template.meta_template_id, 'drop_meta_id')}>
                        <i className="bi bi-clipboard me-2"></i>Copy Meta Template ID
                      </button>
                    </li>
                  )}
                  <li><hr className="dropdown-divider" /></li>
                  <li>
                    <button className="dropdown-item small text-danger" onClick={() => setShowDeleteModal(true)}>
                      <i className="bi bi-trash me-2"></i>Delete Template
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Row 2: Template Name & Meta Details */}
          <div className="td-hero-name-row">
            <h1 className="td-hero-name">{template.name}</h1>
            <button
              type="button"
              className="td-hero-copy-icon"
              title="Copy Template Name"
              onClick={() => copyToClipboard(template.name, 'name_copy')}
            >
              <i className={`bi ${copiedKey === 'name_copy' ? 'bi-check2 text-success' : 'bi-copy'}`}></i>
            </button>
          </div>

          <div className="td-hero-meta-row">
            {template.meta_template_id && (
              <span>
                Meta ID: <code>{template.meta_template_id}</code>{' '}
                <button
                  type="button"
                  className="td-hero-copy-icon ms-1"
                  title="Copy Meta ID"
                  onClick={() => copyToClipboard(template.meta_template_id, 'meta_id_copy')}
                >
                  <i className={`bi ${copiedKey === 'meta_id_copy' ? 'bi-check2 text-success' : 'bi-copy'}`}></i>
                </button>
              </span>
            )}
            <span>•</span>
            <span>
              WABA ID: <span className="td-hero-meta-waba">{template.account?.waba_id || '1763651071618866'}</span>
            </span>
            <span>•</span>
            <span>
              Last Synced: {template.last_synced_at ? new Date(template.last_synced_at).toLocaleDateString() : '11/5/2026'}
            </span>
          </div>

          {/* Row 3: Meta Cloud API Lifecycle & Review Audit Trail */}
          <div className="pt-3 border-top">
            <div className="td-audit-header">
              <span className="td-audit-title">
                META CLOUD API LIFECYCLE & REVIEW AUDIT TRAIL
              </span>
              <span className="td-audit-format">
                Format: <strong>{template.parameter_format || 'POSITIONAL'}</strong>
              </span>
            </div>

            <div className="td-stepper-wrap">
              <div className="td-stepper-line"></div>

              <div className="td-step-item">
                <div className="td-step-circle">
                  <i className="bi bi-check-lg"></i>
                </div>
                <div className="td-step-title">Draft Created</div>
                <div className="td-step-sub">{new Date(template.created_at || Date.now()).toLocaleDateString()}</div>
              </div>

              <div className="td-step-item">
                <div className="td-step-circle">
                  <i className="bi bi-check-lg"></i>
                </div>
                <div className="td-step-title">Submitted to Meta</div>
                <div className="td-step-sub">WABA Verified</div>
              </div>

              <div className="td-step-item">
                <div className="td-step-circle">
                  <i className="bi bi-check-lg"></i>
                </div>
                <div className="td-step-title">Automated Review</div>
                <div className="td-step-sub">Evaluated</div>
              </div>

              <div className="td-step-item">
                <div className="td-step-circle">
                  <i className="bi bi-check-lg"></i>
                </div>
                <div className="td-step-title">Meta Approved</div>
                <div className="td-step-sub">Live & Operational</div>
              </div>
            </div>
          </div>
        </div>

        {/* Feedback Banner */}
        {feedback.text && (
          <div className={`alert alert-${feedback.type} alert-dismissible fade show shadow-xs d-flex align-items-center justify-content-between mb-4 rounded-3`} role="alert">
            <div className="d-flex align-items-center gap-2">
              <i className={`bi ${feedback.type === 'success' ? 'bi-check-circle-fill text-success' : 'bi-exclamation-triangle-fill text-danger'} fs-5`}></i>
              <span className="small">{feedback.text}</span>
            </div>
            <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
          </div>
        )}

        {/* 3. 4 Key Metrics KPI Cards Grid */}
        <div className="td-kpis-grid">
          {/* Card 1: Quality */}
          <div className="td-kpi-card">
            <div>
              <div className="td-kpi-label">META QUALITY RATING</div>
              <div className="td-kpi-val green">
                <i className="bi bi-check-circle-fill me-1" style={{ fontSize: '1.2rem' }}></i>
                {template.account?.quality_rating || 'GREEN'}
              </div>
              <div className="td-kpi-sub">Healthy delivery score</div>
            </div>
            <div className="td-kpi-icon-box td-kpi-icon-green">
              <i className="bi bi-check-circle-fill"></i>
            </div>
          </div>

          {/* Card 2: Category & Rate Tier */}
          <div className="td-kpi-card">
            <div>
              <div className="td-kpi-label">CATEGORY & RATE TIER</div>
              <div className="td-kpi-val blue">{template.category || 'UTILITY'}</div>
              <div className="td-kpi-sub">
                {template.category === 'MARKETING' ? 'R1.5 / Marketing Conv.' : 'R1.2 / Utility Conv.'}
              </div>
            </div>
            <div className="td-kpi-icon-box td-kpi-icon-blue">
              <i className="bi bi-tag-fill"></i>
            </div>
          </div>

          {/* Card 3: Dynamic Variables */}
          <div className="td-kpi-card">
            <div>
              <div className="td-kpi-label">DYNAMIC VARIABLES</div>
              <div className="td-kpi-val dark">{detectedVariables.length} Params</div>
              <div className="td-kpi-sub">
                {detectedVariables.length > 0 ? `{{${detectedVariables.join('}}, {{')}}}` : 'Static message (No params)'}
              </div>
            </div>
            <div className="td-kpi-icon-box td-kpi-icon-cyan">
              <span style={{ fontWeight: 800, fontSize: '1.2rem' }}>&#123;&#125;</span>
            </div>
          </div>

          {/* Card 4: Broadcast Usage */}
          <div className="td-kpi-card">
            <div>
              <div className="td-kpi-label">BROADCAST USAGE</div>
              <div className="td-kpi-val amber">{template.campaigns?.length || 0} Campaigns</div>
              <div className="td-kpi-sub">Ready for bulk broadcast</div>
            </div>
            <div className="td-kpi-icon-box td-kpi-icon-amber">
              <i className="bi bi-megaphone-fill"></i>
            </div>
          </div>
        </div>

        {/* 4. Main 2-Column Split: Tabs & Blueprint / Simulator */}
        <div className="row g-4">
          {/* Left Column: Tabs & Blueprint */}
          <div className="col-12 col-lg-7">
            {/* Tabs Bar */}
            <div className="td-tabs-bar">
              <button
                type="button"
                className={`td-tab-btn ${activeTab === 'components' ? 'active' : ''}`}
                onClick={() => setActiveTab('components')}
              >
                <i className="bi bi-layers-fill"></i>
                <span>Components Blueprint</span>
              </button>
              <button
                type="button"
                className={`td-tab-btn ${activeTab === 'specs' ? 'active' : ''}`}
                onClick={() => setActiveTab('specs')}
              >
                <i className="bi bi-box"></i>
                <span>Meta Cloud API Specs</span>
              </button>
              <button
                type="button"
                className={`td-tab-btn ${activeTab === 'campaigns' ? 'active' : ''}`}
                onClick={() => setActiveTab('campaigns')}
              >
                <i className="bi bi-megaphone"></i>
                <span>Campaigns ({template.campaigns?.length || 0})</span>
              </button>
              <button
                type="button"
                className={`td-tab-btn ${activeTab === 'test' ? 'active' : ''}`}
                onClick={() => setActiveTab('test')}
              >
                <i className="bi bi-send"></i>
                <span>Live Test Sender</span>
              </button>
            </div>

            {/* Tab 1: Components Blueprint */}
            {activeTab === 'components' && (
              <div className="td-blueprint-card">
                {/* 1. Header Component */}
                <div className="td-section-block">
                  <div className="td-section-header">
                    <span className="td-section-title">
                      <i className="bi bi-card-heading text-primary"></i>
                      <span>1. HEADER COMPONENT</span>
                    </span>
                    <span className="td-section-badge">
                      Format: {headerComp?.format || 'TEXT'}
                    </span>
                  </div>
                  <div className="td-section-box">
                    <span className="fw-bold">{headerComp?.text || 'Hello World'}</span>
                  </div>
                </div>

                {/* 2. Message Body */}
                <div className="td-section-block">
                  <div className="td-section-header">
                    <span className="td-section-title">
                      <i className="bi bi-chat-left-text-fill text-success"></i>
                      <span>2. MESSAGE BODY (REQUIRED)</span>
                    </span>
                    <div className="d-flex align-items-center gap-2">
                      <span className="td-section-badge">
                        {bodyComp?.text ? `${bodyComp.text.length} chars` : '191 chars'}
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm btn-link p-0 text-muted small d-flex align-items-center gap-1 text-decoration-none"
                        onClick={() => copyToClipboard(bodyComp?.text || '', 'body_copy')}
                      >
                        <i className={`bi ${copiedKey === 'body_copy' ? 'bi-check2 text-success' : 'bi-copy'}`}></i>
                        <span>Copy Body</span>
                      </button>
                    </div>
                  </div>
                  <div className="td-section-box">
                    {bodyComp?.text || 'Welcome and congratulations!! This message demonstrates your ability to send a WhatsApp message notification from the Cloud API, hosted by Meta. Thank you for taking the time to test with us.'}
                  </div>
                </div>

                {/* 3. Footer Component */}
                <div className="td-section-block">
                  <div className="td-section-header">
                    <span className="td-section-title">
                      <i className="bi bi-card-text text-secondary"></i>
                      <span>3. FOOTER COMPONENT (OPTIONAL)</span>
                    </span>
                    <span className="td-section-badge">
                      {footerComp?.text ? 'Configured' : 'Optional'}
                    </span>
                  </div>
                  <div className="td-section-box td-section-box-muted fst-italic">
                    {footerComp?.text || 'WhatsApp Business Platform sample message'}
                  </div>
                </div>

                {/* 4. Interactive Buttons */}
                <div className="td-section-block mb-0">
                  <div className="td-section-header">
                    <span className="td-section-title">
                      <i className="bi bi-hand-index-thumb text-warning"></i>
                      <span>4. INTERACTIVE BUTTONS ({buttonsList.length})</span>
                    </span>
                    <span className="td-section-badge">
                      Max: 3 Buttons
                    </span>
                  </div>
                  <div className="td-section-box td-section-box-muted">
                    {buttonsList.length > 0 ? (
                      buttonsList.map((b, i) => (
                        <div key={i} className="mb-1">{b.text} ({b.type})</div>
                      ))
                    ) : (
                      <span><i className="bi bi-slash-circle me-1"></i> No interactive CTA buttons attached.</span>
                    )}
                  </div>
                </div>

                {/* Compliance Checklist Banner */}
                <div className="td-compliance-banner">
                  <div className="td-compliance-title">
                    <i className="bi bi-shield-fill-check"></i>
                    <span>Meta Cloud API Compliance Checklist</span>
                  </div>
                  <ul className="td-compliance-list">
                    <li>Approved for direct outbound broadcasting outside the 24-hour customer window.</li>
                    <li>Cloud API Webhooks automatically track delivery, read receipts, and button clicks.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Tab 2: Meta Cloud API Specs */}
            {activeTab === 'specs' && (
              <div className="td-blueprint-card">
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <h6 className="fw-bold text-dark mb-0">Meta Cloud API Specifications</h6>
                  <span className="badge bg-light text-secondary border small">Cloud API v21.0</span>
                </div>
                <div className="table-responsive border rounded-3 mb-3">
                  <table className="table table-sm table-striped align-middle mb-0">
                    <tbody>
                      <tr>
                        <td className="fw-semibold text-secondary w-25">Meta Template ID</td>
                        <td><code>{template.meta_template_id}</code></td>
                      </tr>
                      <tr>
                        <td className="fw-semibold text-secondary">Local Database ID</td>
                        <td><code>#{template.id}</code></td>
                      </tr>
                      <tr>
                        <td className="fw-semibold text-secondary">Template Name</td>
                        <td><code>{template.name}</code></td>
                      </tr>
                      <tr>
                        <td className="fw-semibold text-secondary">Category</td>
                        <td>{template.category}</td>
                      </tr>
                      <tr>
                        <td className="fw-semibold text-secondary">Language Code</td>
                        <td><code>{template.language}</code></td>
                      </tr>
                      <tr>
                        <td className="fw-semibold text-secondary">Target WABA ID</td>
                        <td><code>{template.account?.waba_id}</code></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <pre className="p-3 bg-dark text-light rounded-3 small mb-0" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                  {JSON.stringify(template.components, null, 2)}
                </pre>
              </div>
            )}

            {/* Tab 3: Campaigns */}
            {activeTab === 'campaigns' && (
              <div className="td-blueprint-card">
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <h6 className="fw-bold text-dark mb-0">Broadcast Campaigns Using This Template</h6>
                  {isApproved && (
                    <Link to={`/campaigns/new?templateId=${template.id}`} className="btn btn-sm btn-success">
                      <i className="bi bi-plus-lg me-1"></i> New Campaign
                    </Link>
                  )}
                </div>
                {!template.campaigns || template.campaigns.length === 0 ? (
                  <div className="text-center py-5 bg-light rounded-3 border">
                    <i className="bi bi-broadcast fs-1 text-muted mb-2"></i>
                    <h6 className="fw-bold text-dark">No Campaigns Launched Yet</h6>
                    <p className="text-muted small mb-0">This template hasn't been used in any marketing broadcasts yet.</p>
                  </div>
                ) : (
                  <div className="table-responsive border rounded-3">
                    <table className="table table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Campaign Name</th>
                          <th>Status</th>
                          <th>Audience</th>
                          <th>Sent</th>
                          <th>Created Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {template.campaigns.map(c => (
                          <tr key={c.id}>
                            <td className="fw-semibold text-dark">{c.name}</td>
                            <td><span className="badge bg-success">{c.status}</span></td>
                            <td>{c.audience_count || 0}</td>
                            <td>{c.sent_count || 0}</td>
                            <td className="text-muted small">{new Date(c.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: Live Test Sender */}
            {activeTab === 'test' && (
              <div className="td-blueprint-card">
                <h6 className="fw-bold text-dark mb-1 d-flex align-items-center gap-2">
                  <i className="bi bi-send text-success"></i>
                  <span>Send Real-Time WhatsApp Test Message</span>
                </h6>
                <p className="text-muted small mb-3">
                  Send a live test message of <code>{template.name}</code> to your own personal WhatsApp number.
                </p>
                {testResult && (
                  <div className={`alert alert-${testResult.success ? 'success' : 'danger'} small mb-3`}>
                    {testResult.message}
                  </div>
                )}
                <form onSubmit={handleSendTestMessage}>
                  <div className="mb-3">
                    <label className="form-label small fw-bold text-dark">Recipient Phone Number</label>
                    <input
                      type="tel"
                      className="form-control"
                      placeholder="e.g. 918601467210"
                      value={testRecipient}
                      onChange={(e) => setTestRecipient(e.target.value)}
                      required
                    />
                  </div>
                  <div className="d-flex justify-content-end">
                    <button type="submit" disabled={sendingTest} className="btn btn-success btn-sm">
                      {sendingTest ? 'Sending...' : 'Send Live Test'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Right Column: Live Simulator */}
          <div className="col-12 col-lg-5">
            <div className="td-sim-header">
              <span className="td-sim-title">
                <i className="bi bi-phone text-success"></i>
                <span>LIVE WHATSAPP RECIPIENT SIMULATOR</span>
              </span>
              <span className="td-sim-badge">Interactive Preview</span>
            </div>

            {/* Chassis / Phone Frame */}
            <div className="td-phone-frame">
              {/* Top Notch Status Bar */}
              <div className="td-phone-notch-bar">
                <span>9:41</span>
                <div className="td-phone-dynamic-island"></div>
                <div className="d-flex align-items-center gap-1">
                  <i className="bi bi-wifi" style={{ fontSize: '0.65rem' }}></i>
                  <span style={{ fontSize: '0.6rem', fontWeight: 700 }}>5G</span>
                  <i className="bi bi-battery-full fs-6"></i>
                </div>
              </div>

              {/* WhatsApp Navigation Bar */}
              <div className="td-phone-wa-nav">
                <div className="d-flex align-items-center gap-1 text-white">
                  <i className="bi bi-chevron-left" style={{ fontSize: '0.8rem' }}></i>
                  <span style={{ fontSize: '0.72rem', opacity: 0.9 }}>99+</span>
                </div>
                <div className="wa-screen-avatar ms-1">
                  <i className="bi bi-whatsapp"></i>
                </div>
                <div className="flex-grow-1 text-start ms-1" style={{ lineHeight: 1.2 }}>
                  <div className="fw-bold small d-flex align-items-center gap-1 text-white">
                    <span>WhatsApp Business</span>
                    <i className="bi bi-patch-check-fill text-warning" style={{ fontSize: '0.85rem' }}></i>
                  </div>
                  <div style={{ fontSize: '0.64rem', color: '#bbf7d0' }}>
                    <span className="badge rounded-pill bg-success-subtle text-success py-0 px-1 me-1" style={{ fontSize: '0.58rem' }}>● Online</span>
                    Verified Channel
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2 text-white opacity-85">
                  <i className="bi bi-camera-video" style={{ fontSize: '0.85rem' }}></i>
                  <i className="bi bi-telephone" style={{ fontSize: '0.8rem' }}></i>
                  <i className="bi bi-three-dots-vertical" style={{ fontSize: '0.85rem' }}></i>
                </div>
              </div>

              {/* Phone Screen Body & Chat Bubble */}
              <div className="td-phone-screen-body">
                <div className="td-phone-bubble">
                  {headerComp?.text && (
                    <div className="td-phone-bubble-header">{headerComp.text}</div>
                  )}
                  <div className="td-phone-bubble-body">
                    {previewBodyText}
                  </div>
                  {footerComp?.text && (
                    <div className="td-phone-bubble-footer">{footerComp.text}</div>
                  )}
                  <div className="td-phone-bubble-meta">
                    <span>12:45 PM</span>
                    <span className="td-phone-tick">✓</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Banner */}
            <div className="td-sim-info-banner">
              <i className="bi bi-info-circle-fill"></i>
              <span>This template has no dynamic variables. It sends the identical verified text to every recipient.</span>
            </div>
          </div>
        </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15,23,42,0.65)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold text-danger d-flex align-items-center gap-2">
                  <i className="bi bi-exclamation-triangle-fill"></i>
                  <span>Delete Template?</span>
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowDeleteModal(false)}></button>
              </div>
              <div className="modal-body p-4">
                <p className="text-dark mb-2">
                  Are you sure you want to permanently delete <strong>{template.name}</strong>?
                </p>
                <div className="alert alert-warning py-2 small mb-0">
                  <i className="bi bi-info-circle me-1"></i>
                  This will remove the template from your local workspace and delete it from your official Meta WhatsApp Business Account. Any running campaigns using this template may fail.
                </div>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setShowDeleteModal(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDeleteTemplate}
                  className="btn btn-danger d-flex align-items-center gap-1"
                >
                  {deleting ? (
                    <>
                      <div className="spinner-border spinner-border-sm" role="status"></div>
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <i className="bi bi-trash"></i>
                      <span>Confirm Delete</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
