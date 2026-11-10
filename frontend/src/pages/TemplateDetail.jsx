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
        badge={<span className={`badge-status ${statusClass} ms-2`}>{template.status}</span>}
        onToggleSidebar={onToggleSidebar}
      >
        <Link to="/templates" className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1 shadow-xs">
          <i className="bi bi-arrow-left"></i>
          <span>Templates Studio</span>
        </Link>
        <button
          onClick={handleCheckLiveStatus}
          disabled={refreshingStatus}
          className="btn btn-outline-success btn-sm d-flex align-items-center gap-1 shadow-xs bg-white"
        >
          <i className={`bi bi-arrow-repeat ${refreshingStatus ? 'spin-icon' : ''}`}></i>
          <span>Check Status</span>
        </button>
      </AiwavoHeader>

      <div className="p-4">
        {/* Main Hero Card */}
      <div className="template-detail-hero mb-4">
        <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
          <div>
            <div className="d-flex align-items-center flex-wrap gap-2 mb-2">
              <span className={`badge-status ${statusClass}`}>
                <span className="status-dot"></span>
                <span>{template.status}</span>
              </span>
              <span className={`badge-category ${catClass}`}>
                {template.category === 'MARKETING' && <i className="bi bi-megaphone-fill"></i>}
                {template.category === 'UTILITY' && <i className="bi bi-gear-fill"></i>}
                {template.category === 'AUTHENTICATION' && <i className="bi bi-shield-lock-fill"></i>}
                {template.category || 'MARKETING'}
              </span>
              <span className="badge bg-white text-secondary border small">
                <i className="bi bi-translate me-1"></i>{template.language}
              </span>
              {template.account && (
                <span className="badge bg-white text-success border small d-flex align-items-center gap-1">
                  <i className="bi bi-whatsapp"></i>
                  {template.account.display_name || template.account.phone_number || `Account #${template.whatsapp_account_id}`}
                </span>
              )}
            </div>

            <div className="d-flex align-items-center gap-2">
              <h2 className="fw-bold text-dark mb-0 font-monospace" style={{ letterSpacing: '-0.02em' }}>
                {template.name}
              </h2>
              <button
                type="button"
                className="btn btn-sm btn-link p-0 text-muted"
                title="Copy Template Name"
                onClick={() => copyToClipboard(template.name, 'hero_name')}
              >
                <i className={`bi ${copiedKey === 'hero_name' ? 'bi-check2 text-success fs-5' : 'bi-clipboard fs-5'}`}></i>
              </button>
            </div>

            <div className="d-flex align-items-center flex-wrap gap-3 text-muted small mt-2">
              {template.meta_template_id && (
                <span>
                  Meta ID: <code className="text-secondary fw-semibold">{template.meta_template_id}</code>
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0 ms-1 text-muted"
                    title="Copy Meta ID"
                    onClick={() => copyToClipboard(template.meta_template_id, 'hero_meta_id')}
                  >
                    <i className={`bi ${copiedKey === 'hero_meta_id' ? 'bi-check2 text-success' : 'bi-clipboard'}`}></i>
                  </button>
                </span>
              )}
              <span>•</span>
              <span>
                WABA ID: <code>{template.account?.waba_id || '1618945099958602'}</code>
              </span>
              <span>•</span>
              <span>
                Last Synced: {template.last_synced_at ? new Date(template.last_synced_at).toLocaleDateString() : 'Active'}
              </span>
            </div>
          </div>

          {/* Action Controls */}
          <div className="d-flex align-items-center flex-wrap gap-2">
            <button
              onClick={handleCheckLiveStatus}
              disabled={refreshingStatus}
              className="btn btn-outline-primary d-flex align-items-center gap-2 shadow-xs bg-white"
              title="Query Meta Cloud API to check live review status"
            >
              <i className={`bi bi-arrow-clockwise ${refreshingStatus ? 'spin-icon' : ''}`}></i>
              <span>{refreshingStatus ? 'Checking...' : 'Check Live Status'}</span>
            </button>

            <button
              type="button"
              className="btn btn-outline-secondary d-flex align-items-center gap-1 shadow-xs bg-white"
              onClick={() => setActiveTab('test')}
              title="Send a real test message to your personal WhatsApp"
            >
              <i className="bi bi-send text-primary"></i>
              <span>Test Send</span>
            </button>

            {isApproved ? (
              <Link
                to={`/campaigns/new?templateId=${template.id}`}
                className="btn btn-success d-flex align-items-center gap-2 shadow-sm"
              >
                <i className="bi bi-broadcast"></i>
                <span>Launch Campaign</span>
              </Link>
            ) : (
              <button
                disabled
                className="btn btn-secondary d-flex align-items-center gap-1 opacity-75"
                title="Only approved templates can be used to broadcast campaigns"
              >
                <i className="bi bi-lock-fill"></i>
                <span>Launch Campaign (Approved Only)</span>
              </button>
            )}

            <div className="dropdown">
              <button className="btn btn-light border shadow-xs" data-bs-toggle="dropdown">
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

        {/* Approval Timeline Stepper */}
        <div className="mt-4 pt-3 border-top">
          <div className="d-flex align-items-center justify-content-between mb-1">
            <span className="small fw-bold text-muted text-uppercase" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>
              Meta Cloud API Lifecycle & Review Audit Trail
            </span>
            <span className="small text-muted" style={{ fontSize: '0.72rem' }}>
              Format: <strong>{template.parameter_format || 'POSITIONAL'}</strong>
            </span>
          </div>

          <div className="tpl-timeline-container">
            {/* Step 1 */}
            <div className="tpl-timeline-step completed">
              <div className="tpl-timeline-dot">
                <i className="bi bi-check-lg"></i>
              </div>
              <div className="tpl-timeline-label">Draft Created</div>
              <div className="tpl-timeline-time">{new Date(template.created_at || Date.now()).toLocaleDateString()}</div>
            </div>

            {/* Step 2 */}
            <div className="tpl-timeline-step completed">
              <div className="tpl-timeline-dot">
                <i className="bi bi-check-lg"></i>
              </div>
              <div className="tpl-timeline-label">Submitted to Meta</div>
              <div className="tpl-timeline-time">WABA Verified</div>
            </div>

            {/* Step 3 */}
            <div className={`tpl-timeline-step ${isApproved ? 'completed' : isPending ? 'active' : 'completed'}`}>
              <div className="tpl-timeline-dot">
                {isApproved ? <i className="bi bi-check-lg"></i> : isPending ? <i className="bi bi-hourglass-split"></i> : <i className="bi bi-x"></i>}
              </div>
              <div className="tpl-timeline-label">Automated Review</div>
              <div className="tpl-timeline-time">{isPending ? 'Under Audit' : 'Evaluated'}</div>
            </div>

            {/* Step 4 */}
            <div className={`tpl-timeline-step ${isApproved ? 'completed' : isRejected ? 'active' : ''}`}>
              <div className="tpl-timeline-dot">
                {isApproved ? <i className="bi bi-patch-check-fill"></i> : isRejected ? <i className="bi bi-x-octagon-fill text-danger"></i> : <i className="bi bi-circle"></i>}
              </div>
              <div className="tpl-timeline-label">
                {isApproved ? 'Meta Approved' : isRejected ? 'Policy Rejected' : 'Ready to Send'}
              </div>
              <div className="tpl-timeline-time">{isApproved ? 'Live Channel' : isRejected ? 'Needs Fix' : 'Pending'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show shadow-xs d-flex align-items-center justify-content-between mb-4`} role="alert">
          <div className="d-flex align-items-center gap-2">
            <i className={`bi ${feedback.type === 'success' ? 'bi-check-circle-fill text-success' : 'bi-exclamation-triangle-fill text-danger'} fs-5`}></i>
            <span className="small">{feedback.text}</span>
          </div>
          <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      {/* Rejection Alert Box */}
      {isRejected && (
        <div className="rejection-banner shadow-xs mb-4">
          <div className="d-flex align-items-start gap-3">
            <div className="stat-icon bg-danger text-white rounded-3 p-2 flex-shrink-0" style={{ width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="bi bi-x-octagon-fill fs-4"></i>
            </div>
            <div className="flex-grow-1">
              <h6 className="fw-bold text-danger mb-1">
                Meta Content Moderation Rejection: {template.rejection_reason || 'PROMOTIONAL_POLICY_VIOLATION'}
              </h6>
              <p className="text-danger small mb-2">
                This template has been flagged and rejected by Meta automated moderation. WhatsApp Cloud API policy requires compliance with message guidelines before campaigns can be dispatched.
              </p>
              <div className="card bg-white border border-danger-subtle p-3 rounded-3 mt-2">
                <span className="small fw-bold text-dark d-block mb-1">
                  <i className="bi bi-lightbulb-fill text-warning me-1"></i> Actions required to get approved:
                </span>
                <ul className="small text-muted mb-0 ps-3">
                  <li>Ensure template name only contains lowercase alphanumeric characters and underscores.</li>
                  <li>Verify all variable placeholders like <code>&#123;&#123;1&#125;&#125;</code> have realistic sample text values attached.</li>
                  <li>Do not use prohibited promotional claims, spam phrasing, or misleading links.</li>
                  <li>Include an opt-out mechanism (e.g. "Reply STOP to unsubscribe") for promotional marketing messages.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Key Metrics Cards */}
      <div className="row g-3 mb-4">
        {/* KPI 1 */}
        <div className="col-6 col-md-3">
          <div className="template-kpi-card">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <div className="kpi-label">Meta Quality Rating</div>
                <div className="kpi-value text-success d-flex align-items-center gap-1">
                  <i className="bi bi-shield-fill-check fs-4"></i>
                  <span>{template.account?.quality_rating || 'GREEN'}</span>
                </div>
                <div className="kpi-subtext">Healthy delivery score</div>
              </div>
              <div className="stat-icon bg-success-subtle text-success border border-success-subtle" style={{ width: '42px', height: '42px', borderRadius: '12px' }}>
                <i className="bi bi-patch-check"></i>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="col-6 col-md-3">
          <div className="template-kpi-card">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <div className="kpi-label">Category & Rate Tier</div>
                <div className="kpi-value text-primary">
                  {template.category || 'MARKETING'}
                </div>
                <div className="kpi-subtext">
                  {template.category === 'MARKETING' ? '₹0.72 / Marketing Conv.' : '₹0.12 / Utility Conv.'}
                </div>
              </div>
              <div className="stat-icon bg-primary-subtle text-primary border border-primary-subtle" style={{ width: '42px', height: '42px', borderRadius: '12px' }}>
                <i className="bi bi-tag-fill"></i>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="col-6 col-md-3">
          <div className="template-kpi-card">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <div className="kpi-label">Dynamic Variables</div>
                <div className="kpi-value text-dark">
                  {detectedVariables.length} <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#64748b' }}>Params</span>
                </div>
                <div className="kpi-subtext">
                  {detectedVariables.length > 0 ? `{{${detectedVariables.join('}}, {{')}}}` : 'Static message (No params)'}
                </div>
              </div>
              <div className="stat-icon bg-info-subtle text-info border border-info-subtle" style={{ width: '42px', height: '42px', borderRadius: '12px' }}>
                <i className="bi bi-braces"></i>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="col-6 col-md-3">
          <div className="template-kpi-card">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <div className="kpi-label">Broadcast Usage</div>
                <div className="kpi-value text-warning">
                  {template.campaigns?.length || 0} <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#64748b' }}>Campaigns</span>
                </div>
                <div className="kpi-subtext">
                  {isApproved ? 'Ready for bulk broadcast' : 'Waiting approval'}
                </div>
              </div>
              <div className="stat-icon bg-warning-subtle text-warning border border-warning-subtle" style={{ width: '42px', height: '42px', borderRadius: '12px' }}>
                <i className="bi bi-send-check"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Studio Workspace: 2-Column Layout */}
      <div className="row g-4">
        {/* Left Column: Interactive Inspector Tabs */}
        <div className="col-12 col-lg-7">
          <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
            {/* Tabs Navigation */}
            <div className="card-header bg-light border-bottom p-0">
              <ul className="nav nav-tabs border-0 px-3 pt-2" role="tablist">
                <li className="nav-item">
                  <button
                    className={`nav-link border-0 fw-semibold small py-3 px-3 d-flex align-items-center gap-1 ${activeTab === 'components' ? 'active text-success border-bottom border-success border-3 bg-white' : 'text-muted'}`}
                    onClick={() => setActiveTab('components')}
                  >
                    <i className="bi bi-puzzle"></i>
                    <span>Components Blueprint</span>
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className={`nav-link border-0 fw-semibold small py-3 px-3 d-flex align-items-center gap-1 ${activeTab === 'specs' ? 'active text-success border-bottom border-success border-3 bg-white' : 'text-muted'}`}
                    onClick={() => setActiveTab('specs')}
                  >
                    <i className="bi bi-cpu"></i>
                    <span>Meta Cloud API Specs</span>
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className={`nav-link border-0 fw-semibold small py-3 px-3 d-flex align-items-center gap-1 ${activeTab === 'campaigns' ? 'active text-success border-bottom border-success border-3 bg-white' : 'text-muted'}`}
                    onClick={() => setActiveTab('campaigns')}
                  >
                    <i className="bi bi-broadcast"></i>
                    <span>Campaigns ({template.campaigns?.length || 0})</span>
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className={`nav-link border-0 fw-semibold small py-3 px-3 d-flex align-items-center gap-1 ${activeTab === 'test' ? 'active text-success border-bottom border-success border-3 bg-white' : 'text-muted'}`}
                    onClick={() => setActiveTab('test')}
                  >
                    <i className="bi bi-send-check"></i>
                    <span>Live Test Sender</span>
                  </button>
                </li>
              </ul>
            </div>

            {/* Tab Contents */}
            <div className="card-body p-4">
              {/* TAB 1: COMPONENTS BLUEPRINT */}
              {activeTab === 'components' && (
                <div>
                  {/* Header Component */}
                  <div className="tpl-blueprint-card">
                    <div className="tpl-blueprint-header">
                      <div className="tpl-blueprint-title">
                        <i className="bi bi-card-heading text-primary"></i>
                        <span>1. Header Component</span>
                      </div>
                      <span className="badge bg-light text-secondary border small">
                        Format: {headerComp?.format || headerComp?.type || 'NONE'}
                      </span>
                    </div>
                    {headerComp ? (
                      <div className="tpl-blueprint-content">
                        {headerComp.format === 'TEXT' || headerComp.text ? (
                          <div className="fw-bold text-dark fs-6">{headerComp.text}</div>
                        ) : (
                          <div className="d-flex align-items-center gap-3">
                            <div className="stat-icon bg-primary-subtle text-primary rounded-3 p-2">
                              <i className={`bi ${headerComp.format === 'IMAGE' ? 'bi-image' : headerComp.format === 'VIDEO' ? 'bi-play-circle' : 'bi-file-earmark-text'} fs-3`}></i>
                            </div>
                            <div>
                              <div className="fw-bold small text-dark">Dynamic Media Header ({headerComp.format || 'Media'})</div>
                              <div className="text-muted small">Meta accepts media uploads during campaign broadcasting.</div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-muted small d-flex align-items-center gap-2 py-1">
                        <i className="bi bi-dash-circle text-secondary"></i>
                        <span>No header configured (Clean body-only layout).</span>
                      </div>
                    )}
                  </div>

                  {/* Body Component */}
                  <div className="tpl-blueprint-card">
                    <div className="tpl-blueprint-header">
                      <div className="tpl-blueprint-title">
                        <i className="bi bi-chat-left-text text-success"></i>
                        <span>2. Message Body (Required)</span>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <span className="badge bg-light text-muted border small">
                          {bodyComp?.text ? `${bodyComp.text.length} chars` : '0 chars'}
                        </span>
                        <button
                          type="button"
                          className="btn btn-sm btn-link p-0 text-muted small d-flex align-items-center gap-1"
                          onClick={() => copyToClipboard(bodyComp?.text || '', 'body_text')}
                        >
                          <i className={`bi ${copiedKey === 'body_text' ? 'bi-check2 text-success' : 'bi-clipboard'}`}></i>
                          <span>Copy Body</span>
                        </button>
                      </div>
                    </div>

                    <div className="tpl-blueprint-content" style={{ whiteSpace: 'pre-wrap', minHeight: '80px' }}>
                      {renderHighlightedBody(bodyComp?.text)}
                    </div>

                    {/* Detected Variables Chips */}
                    {detectedVariables.length > 0 && (
                      <div className="mt-3 pt-2 border-top d-flex align-items-center flex-wrap gap-2">
                        <span className="small text-muted fw-semibold">Dynamic Variables:</span>
                        {detectedVariables.map(v => (
                          <span key={v} className="variable-badge">
                            &#123;&#123;{v}&#125;&#125;
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer Component */}
                  <div className="tpl-blueprint-card">
                    <div className="tpl-blueprint-header">
                      <div className="tpl-blueprint-title">
                        <i className="bi bi-card-text text-secondary"></i>
                        <span>3. Footer Component (Optional)</span>
                      </div>
                      <span className="badge bg-light text-secondary border small">
                        {footerComp?.text ? 'Configured' : 'None'}
                      </span>
                    </div>
                    {footerComp?.text ? (
                      <div className="tpl-blueprint-content text-muted small fst-italic">
                        {footerComp.text}
                      </div>
                    ) : (
                      <div className="text-muted small d-flex align-items-center gap-2 py-1">
                        <i className="bi bi-dash-circle text-secondary"></i>
                        <span>No footer disclaimer configured.</span>
                      </div>
                    )}
                  </div>

                  {/* Buttons Component */}
                  <div className="tpl-blueprint-card mb-0">
                    <div className="tpl-blueprint-header">
                      <div className="tpl-blueprint-title">
                        <i className="bi bi-hand-index-thumb text-warning"></i>
                        <span>4. Interactive Buttons ({buttonsList.length})</span>
                      </div>
                      <span className="badge bg-light text-secondary border small">
                        Max: 3 Buttons
                      </span>
                    </div>

                    {buttonsList.length > 0 ? (
                      <div className="row g-2">
                        {buttonsList.map((btn, idx) => (
                          <div key={idx} className="col-12 col-md-6">
                            <div className="p-3 bg-light rounded-3 border d-flex align-items-center justify-content-between">
                              <div className="d-flex align-items-center gap-2">
                                <i className={`bi ${btn.type === 'URL' ? 'bi-box-arrow-up-right text-primary' : btn.type === 'PHONE_NUMBER' ? 'bi-telephone-fill text-success' : 'bi-reply-fill text-secondary'} fs-5`}></i>
                                <div>
                                  <div className="fw-bold small text-dark">{btn.text}</div>
                                  <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                                    Type: <code>{btn.type}</code>
                                    {btn.url && ` • ${btn.url}`}
                                    {btn.phone_number && ` • ${btn.phone_number}`}
                                  </div>
                                </div>
                              </div>
                              <span className="badge bg-white text-secondary border small">#{idx + 1}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-muted small d-flex align-items-center gap-2 py-1">
                        <i className="bi bi-dash-circle text-secondary"></i>
                        <span>No interactive CTA buttons attached.</span>
                      </div>
                    )}
                  </div>

                  {/* Meta Policy Compliance Advisory */}
                  <div className="card bg-success-subtle bg-opacity-25 border border-success-subtle p-3 rounded-3 mt-4">
                    <div className="d-flex align-items-center gap-2 text-success fw-bold small mb-1">
                      <i className="bi bi-shield-check fs-5"></i>
                      <span>Meta Cloud API Compliance Checklist</span>
                    </div>
                    <ul className="small text-muted mb-0 ps-3">
                      <li>Approved for direct outbound broadcasting outside the 24-hour customer window.</li>
                      <li>Cloud API Webhooks automatically track delivery, read receipts, and button clicks.</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* TAB 2: META CLOUD API SPECS */}
              {activeTab === 'specs' && (
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <h6 className="fw-bold text-dark mb-0">Meta Cloud API Specifications</h6>
                    <span className="badge bg-light text-secondary border small">
                      Cloud API v21.0
                    </span>
                  </div>

                  <div className="table-responsive border rounded-3 mb-4">
                    <table className="table table-sm table-striped align-middle mb-0">
                      <tbody>
                        <tr>
                          <td className="fw-semibold text-secondary w-25">Meta Template ID</td>
                          <td>
                            <div className="d-flex align-items-center gap-2">
                              <code>{template.meta_template_id || 'Not assigned / Pending sync'}</code>
                              {template.meta_template_id && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-link p-0 text-muted"
                                  onClick={() => copyToClipboard(template.meta_template_id, 'specs_meta_id')}
                                >
                                  <i className={`bi ${copiedKey === 'specs_meta_id' ? 'bi-check2 text-success' : 'bi-clipboard'}`}></i>
                                </button>
                              )}
                            </div>
                          </td>
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
                          <td><span className={`badge-category ${catClass}`}>{template.category}</span></td>
                        </tr>
                        <tr>
                          <td className="fw-semibold text-secondary">Language Code</td>
                          <td><code>{template.language}</code></td>
                        </tr>
                        <tr>
                          <td className="fw-semibold text-secondary">Target WABA ID</td>
                          <td><code>{template.account?.waba_id || '1618945099958602'}</code></td>
                        </tr>
                        <tr>
                          <td className="fw-semibold text-secondary">Sending Phone ID</td>
                          <td><code>{template.account?.phone_number_id || '1341070215765610'}</code></td>
                        </tr>
                        <tr>
                          <td className="fw-semibold text-secondary">Parameter Format</td>
                          <td><code>{template.parameter_format || 'POSITIONAL'}</code></td>
                        </tr>
                        <tr>
                          <td className="fw-semibold text-secondary">Last Synchronized</td>
                          <td>
                            {template.last_synced_at
                              ? new Date(template.last_synced_at).toLocaleString()
                              : 'Never synced from Meta'}
                          </td>
                        </tr>
                        <tr>
                          <td className="fw-semibold text-secondary">Created At</td>
                          <td>{new Date(template.created_at || Date.now()).toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="small text-uppercase fw-bold text-muted">Raw Meta Components JSON Tree</span>
                    <button
                      type="button"
                      className="btn btn-sm btn-link p-0 text-muted small d-flex align-items-center gap-1"
                      onClick={() => copyToClipboard(JSON.stringify(template.components, null, 2), 'raw_json')}
                    >
                      <i className={`bi ${copiedKey === 'raw_json' ? 'bi-check2 text-success' : 'bi-clipboard'}`}></i>
                      <span>Copy JSON</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-dark text-light rounded-3 small mb-0" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                    {JSON.stringify(template.components, null, 2)}
                  </pre>
                </div>
              )}

              {/* TAB 3: CAMPAIGNS */}
              {activeTab === 'campaigns' && (
                <div>
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
                      <p className="text-muted small mb-3">
                        This template hasn't been used in any marketing broadcasts yet.
                      </p>
                      {isApproved ? (
                        <Link to={`/campaigns/new?templateId=${template.id}`} className="btn btn-sm btn-outline-success">
                          Launch First Campaign with {template.name}
                        </Link>
                      ) : (
                        <span className="badge bg-warning-subtle text-warning border">
                          Waiting for Meta Approval to launch
                        </span>
                      )}
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
                            <th className="text-end">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {template.campaigns.map(c => (
                            <tr key={c.id}>
                              <td className="fw-semibold text-dark">{c.name}</td>
                              <td>
                                <span className={`badge bg-${c.status === 'COMPLETED' ? 'success' : c.status === 'RUNNING' ? 'primary' : 'secondary'}`}>
                                  {c.status}
                                </span>
                              </td>
                              <td>{c.audience_count || 0}</td>
                              <td>{c.sent_count || 0}</td>
                              <td className="text-muted small">{new Date(c.created_at).toLocaleDateString()}</td>
                              <td className="text-end">
                                <Link to={`/campaigns/${c.id}`} className="btn btn-sm btn-outline-primary py-0 px-2">
                                  View
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: LIVE TEST SENDER */}
              {activeTab === 'test' && (
                <div>
                  <h6 className="fw-bold text-dark mb-1 d-flex align-items-center gap-2">
                    <i className="bi bi-send text-success"></i>
                    <span>Send Real-Time WhatsApp Test Message</span>
                  </h6>
                  <p className="text-muted small mb-4">
                    Send a live test message of <code>{template.name}</code> to your own personal WhatsApp number to verify layout, variables, and CTA buttons before broadcasting to customers.
                  </p>

                  {testResult && (
                    <div className={`alert alert-${testResult.success ? 'success' : 'danger'} alert-dismissible fade show small d-flex align-items-center gap-2 mb-3`} role="alert">
                      <i className={`bi ${testResult.success ? 'bi-check-circle-fill fs-5' : 'bi-exclamation-triangle-fill fs-5'}`}></i>
                      <div>{testResult.message}</div>
                    </div>
                  )}

                  <form onSubmit={handleSendTestMessage}>
                    <div className="mb-3">
                      <label className="form-label small fw-bold text-dark">
                        Recipient WhatsApp Number <span className="text-danger">*</span>
                      </label>
                      <div className="input-group">
                        <span className="input-group-text bg-white text-muted">
                          <i className="bi bi-telephone"></i>
                        </span>
                        <input
                          type="tel"
                          className="form-control"
                          placeholder="e.g. 918601467210 (Country code + Phone without +)"
                          value={testRecipient}
                          onChange={(e) => setTestRecipient(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-text small text-muted">
                        Format: International number including country code without plus sign (e.g. <code>918601467210</code>).
                      </div>
                    </div>

                    {/* Variable Values for Test Send */}
                    {detectedVariables.length > 0 && (
                      <div className="card bg-light border p-3 rounded-3 mb-3">
                        <div className="fw-bold small text-dark mb-2">
                          <i className="bi bi-braces text-primary me-1"></i>
                          Template Dynamic Variables:
                        </div>
                        <div className="row g-2">
                          {detectedVariables.map(v => (
                            <div key={v} className="col-12 col-md-6">
                              <label className="form-label small text-muted mb-1 d-flex align-items-center gap-1">
                                <span>Variable</span>
                                <span className="variable-badge">&#123;&#123;{v}&#125;&#125;</span>
                              </label>
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder={`Value for {{${v}}}`}
                                value={sampleVariables[v] || ''}
                                onChange={(e) => setSampleVariables({ ...sampleVariables, [v]: e.target.value })}
                                required
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="d-flex justify-content-end">
                      <button
                        type="submit"
                        disabled={sendingTest}
                        className="btn btn-success d-flex align-items-center gap-2 shadow-sm"
                      >
                        {sendingTest ? (
                          <>
                            <div className="spinner-border spinner-border-sm" role="status"></div>
                            <span>Dispatching via Meta API...</span>
                          </>
                        ) : (
                          <>
                            <i className="bi bi-send-fill"></i>
                            <span>Send Live Test WhatsApp</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Live WhatsApp Mobile Simulator & Variable Playground */}
        <div className="col-12 col-lg-5">
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white sticky-top" style={{ top: '1.5rem' }}>
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="small fw-bold text-muted text-uppercase d-flex align-items-center gap-1">
                <i className="bi bi-phone text-success"></i>
                <span>Live WhatsApp Recipient Simulator</span>
              </span>
              <span className="badge bg-success-subtle text-success border border-success-subtle small">
                Interactive Preview
              </span>
            </div>

            {/* WhatsApp Phone Mockup Chassis */}
            <div className="wa-phone-mockup mb-3">
              {/* Dynamic Island Notch */}
              <div className="wa-ios-notch"></div>

              <div className="wa-screen">
                {/* iOS Status Bar */}
                <div className="wa-ios-status-bar">
                  <span>9:41</span>
                  <div className="d-flex align-items-center gap-1">
                    <i className="bi bi-wifi" style={{ fontSize: '0.65rem' }}></i>
                    <span style={{ fontSize: '0.6rem', fontWeight: 700 }}>5G</span>
                    <i className="bi bi-battery-full fs-6"></i>
                  </div>
                </div>

                {/* WhatsApp Chat Navigation Bar */}
                <div className="wa-screen-nav">
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

                {/* Screen Body with Chat Bubble */}
                <div className="wa-screen-body">
                  <div className="wa-bubble-preview">
                    {/* Header Media / Text */}
                    {headerComp && (
                      <>
                        {headerComp.format === 'TEXT' || headerComp.text ? (
                          <div className="wa-header-text">{headerComp.text}</div>
                        ) : (
                          <div className="wa-header-media">
                            <i className={`bi ${headerComp.format === 'IMAGE' ? 'bi-image' : headerComp.format === 'VIDEO' ? 'bi-play-circle' : 'bi-file-earmark-text'} fs-1 text-secondary mb-1`}></i>
                            <span>WhatsApp {headerComp.format || 'Media'} Header</span>
                          </div>
                        )}
                      </>
                    )}

                    {/* Body Text */}
                    <div className="wa-body-text">{previewBodyText}</div>

                    {/* Footer Text */}
                    {footerComp?.text && (
                      <div className="wa-footer-text">{footerComp.text}</div>
                    )}

                    {/* Timestamp & Double Blue Tick */}
                    <div className="wa-timestamp">
                      <span>12:45 PM</span>
                      <i className="bi bi-check2-all text-primary ms-1"></i>
                    </div>
                  </div>

                  {/* Call to Action Buttons */}
                  {buttonsList.length > 0 && (
                    <div className="wa-buttons-container">
                      {buttonsList.map((btn, idx) => (
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

            {/* Variable Testing Playground */}
            {detectedVariables.length > 0 ? (
              <div className="card bg-light border p-3 rounded-3 mt-2">
                <div className="small fw-bold text-dark mb-2 d-flex align-items-center justify-content-between">
                  <span>
                    <i className="bi bi-sliders text-success me-1"></i>
                    Preview Variables Playground:
                  </span>
                  <span className="text-muted small" style={{ fontSize: '0.72rem' }}>Updates mockup live</span>
                </div>
                <div className="row g-2">
                  {detectedVariables.map(v => (
                    <div key={v} className="col-12">
                      <div className="input-group input-group-sm">
                        <span className="input-group-text bg-white font-monospace" style={{ fontSize: '0.75rem' }}>
                          &#123;&#123;{v}&#125;&#125;
                        </span>
                        <input
                          type="text"
                          className="form-control"
                          value={sampleVariables[v] || ''}
                          onChange={(e) => setSampleVariables({ ...sampleVariables, [v]: e.target.value })}
                          placeholder={`Enter sample value for {{${v}}}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="card bg-light border p-3 rounded-3 mt-2 text-center text-muted small">
                <i className="bi bi-info-circle text-primary me-1"></i>
                This template has no dynamic variables. It sends the identical verified text to every recipient.
              </div>
            )}
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
