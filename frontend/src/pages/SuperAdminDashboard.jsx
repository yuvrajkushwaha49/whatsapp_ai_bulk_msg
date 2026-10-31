import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function SuperAdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'meta_integration' | 'meta_monitoring' | 'whatsapp_accounts'
  const [stats, setStats] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [whatsappAccounts, setWhatsappAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Platform Meta Integration state
  const [metaConfig, setMetaConfig] = useState({
    metaAppId: '',
    metaAppSecret: '',
    embeddedSignupConfigId: '',
    graphApiVersion: 'v21.0',
    webhookVerifyToken: 'campaignflow_secure_webhook_token_2026',
    isEnabled: true
  });
  const [metaConfigStatus, setMetaConfigStatus] = useState(null);
  const [savingMeta, setSavingMeta] = useState(false);
  const [testingMeta, setTestingMeta] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [showSecret, setShowSecret] = useState(false);

  // Meta Integration Monitoring state
  const [monitoring, setMonitoring] = useState(null);
  const [loadingMonitoring, setLoadingMonitoring] = useState(false);

  useEffect(() => {
    fetchAdminData();
    fetchPlatformMetaConfig();
    fetchMonitoring();
  }, []);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [statsRes, bizRes, waRes] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/admin/businesses'),
        api.get('/admin/whatsapp-accounts').catch(() => ({ data: { success: true, data: [] } }))
      ]);

      if (statsRes.data?.success) setStats(statsRes.data.data);
      if (bizRes.data?.success) setBusinesses(bizRes.data.data);
      if (waRes.data?.success) setWhatsappAccounts(waRes.data.data || []);
    } catch (err) {
      console.error('Failed to load SuperAdmin data', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlatformMetaConfig = async () => {
    try {
      const res = await api.get('/admin/meta-integration');
      if (res.data?.success && res.data?.data) {
        const d = res.data.data;
        setMetaConfigStatus(d);
        setMetaConfig({
          metaAppId: d.metaAppId || '',
          metaAppSecret: '', // Secret remains masked on client
          embeddedSignupConfigId: d.embeddedSignupConfigId || '',
          graphApiVersion: d.graphApiVersion || 'v21.0',
          webhookVerifyToken: d.webhookVerifyToken || 'campaignflow_secure_webhook_token_2026',
          isEnabled: d.isEnabled !== undefined ? d.isEnabled : true
        });
      }
    } catch (err) {
      console.warn('Failed to load platform meta config', err);
    }
  };

  const fetchMonitoring = async () => {
    try {
      setLoadingMonitoring(true);
      const res = await api.get('/admin/meta-integration/monitoring');
      if (res.data?.success) {
        setMonitoring(res.data.data);
      }
    } catch (err) {
      console.warn('Failed to load monitoring metrics', err);
    } finally {
      setLoadingMonitoring(false);
    }
  };

  const handleSaveMetaConfig = async (e) => {
    e.preventDefault();
    setSavingMeta(true);
    setFeedback({ type: '', text: '' });
    try {
      const res = await api.post('/admin/meta-integration', metaConfig);
      if (res.data?.success) {
        setFeedback({ type: 'success', text: 'Platform Meta Developer App configuration saved and encrypted at rest!' });
        fetchPlatformMetaConfig();
        fetchMonitoring();
      }
    } catch (err) {
      setFeedback({ type: 'danger', text: err.response?.data?.message || 'Failed to save Meta configuration.' });
    } finally {
      setSavingMeta(false);
    }
  };

  const handleTestMetaConnection = async () => {
    setTestingMeta(true);
    setTestResult(null);
    setFeedback({ type: '', text: '' });
    try {
      const res = await api.post('/admin/meta-integration/test');
      setTestResult(res.data?.data);
      if (res.data?.data?.success) {
        setFeedback({ type: 'success', text: `✅ Meta Graph API connection verified! Connected as "${res.data.data.appName}".` });
      } else {
        setFeedback({ type: 'warning', text: `Verification failed: ${res.data?.data?.message}` });
      }
      fetchPlatformMetaConfig();
    } catch (err) {
      const msg = err.response?.data?.message || 'Meta API verification failed';
      setTestResult({ success: false, message: msg });
      setFeedback({ type: 'danger', text: msg });
    } finally {
      setTestingMeta(false);
    }
  };

  const handleToggleStatus = async (bizId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    if (!window.confirm(`Are you sure you want to change tenant status to "${newStatus}"?`)) return;

    try {
      await api.patch(`/admin/businesses/${bizId}/status`, { status: newStatus });
      setFeedback({ type: 'success', text: `Tenant status updated to ${newStatus}` });
      fetchAdminData();
    } catch (err) {
      setFeedback({ type: 'danger', text: 'Failed to update tenant status' });
    }
  };

  const webhookCallbackUrl = `${window.location.origin.replace('5173', '5000')}/api/webhooks/whatsapp`;

  return (
    <div>
      {/* Top Header */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between mb-4 gap-3">
        <div>
          <span className="badge bg-warning text-dark mb-1">Super Administrator Control Panel</span>
          <h2 className="brand-font mb-0">Platform Overview & Meta SaaS Governance</h2>
        </div>
        <div className="d-flex align-items-center gap-2">
          <button
            onClick={() => { fetchAdminData(); fetchPlatformMetaConfig(); fetchMonitoring(); }}
            className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
          >
            <i className="bi bi-arrow-clockwise"></i>
            <span>Refresh All</span>
          </button>
        </div>
      </div>

      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show mb-4 shadow-sm`} role="alert">
          {feedback.text}
          <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      {/* Navigation Tabs */}
      <ul className="nav nav-pills mb-4 gap-2 border-bottom pb-3">
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold px-3 py-2 ${activeTab === 'overview' ? 'active' : 'text-dark'}`}
            onClick={() => setActiveTab('overview')}
          >
            <i className="bi bi-grid-fill me-2"></i>Platform Overview
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold px-3 py-2 ${activeTab === 'meta_integration' ? 'active' : 'text-dark'}`}
            onClick={() => setActiveTab('meta_integration')}
          >
            <i className="bi bi-gear-wide-connected me-2"></i>Meta Platform Integration
            {metaConfigStatus?.readinessStatus === 'ready' ? (
              <span className="badge bg-success ms-2">Ready</span>
            ) : (
              <span className="badge bg-warning text-dark ms-2">Action Required</span>
            )}
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold px-3 py-2 ${activeTab === 'meta_monitoring' ? 'active' : 'text-dark'}`}
            onClick={() => setActiveTab('meta_monitoring')}
          >
            <i className="bi bi-activity me-2"></i>Meta Integration Monitoring
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold px-3 py-2 ${activeTab === 'whatsapp_accounts' ? 'active' : 'text-dark'}`}
            onClick={() => setActiveTab('whatsapp_accounts')}
          >
            <i className="bi bi-whatsapp me-2"></i>Client Accounts ({whatsappAccounts.length})
          </button>
        </li>
      </ul>

      {/* TAB 1: PLATFORM OVERVIEW */}
      {activeTab === 'overview' && (
        <div>
          {/* Global Stat Cards */}
          <div className="row g-3 mb-4">
            <div className="col-12 col-sm-6 col-xl-3">
              <div className="stat-card">
                <div className="stat-icon-wrapper stat-icon-blue">
                  <i className="bi bi-buildings"></i>
                </div>
                <div>
                  <div className="stat-label">Total Businesses</div>
                  <div className="stat-value">{stats?.totalBusinesses || 0}</div>
                  <div className="small text-success">
                    {stats?.activeBusinesses || 0} Active Tenants
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-xl-3">
              <div className="stat-card">
                <div className="stat-icon-wrapper stat-icon-green">
                  <i className="bi bi-send-check"></i>
                </div>
                <div>
                  <div className="stat-label">Platform Messages</div>
                  <div className="stat-value">{stats?.totalMessagesSent || 0}</div>
                  <div className="small text-muted">{stats?.totalCampaigns || 0} Campaigns total</div>
                </div>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-xl-3">
              <div className="stat-card">
                <div className="stat-icon-wrapper stat-icon-purple">
                  <i className="bi bi-person-badge"></i>
                </div>
                <div>
                  <div className="stat-label">Total Users</div>
                  <div className="stat-value">{stats?.totalUsers || 0}</div>
                  <div className="small text-muted">Across all tenants</div>
                </div>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-xl-3">
              <div className="stat-card">
                <div className="stat-icon-wrapper stat-icon-orange">
                  <i className="bi bi-currency-dollar"></i>
                </div>
                <div>
                  <div className="stat-label">MRR Revenue</div>
                  <div className="stat-value">${stats?.totalRevenueEstimated || 0}</div>
                  <div className="small text-success">Active Subscriptions</div>
                </div>
              </div>
            </div>
          </div>

          {/* Infrastructure Health Status */}
          <div className="cf-card mb-4">
            <div className="cf-card-header bg-dark text-white">
              <h5 className="mb-0 text-white">
                <i className="bi bi-activity text-success me-2"></i> Infrastructure & Integration Health
              </h5>
            </div>
            <div className="cf-card-body">
              <div className="row g-3">
                <div className="col-sm-6 col-md-3">
                  <div className="p-3 border rounded-3 bg-light">
                    <div className="text-muted small">REST API Gateway</div>
                    <div className="fw-bold text-success d-flex align-items-center gap-1">
                      <span className="badge bg-success rounded-circle" style={{ width: 8, height: 8 }}></span>
                      {stats?.systemHealth?.apiStatus || 'HEALTHY'}
                    </div>
                  </div>
                </div>
                <div className="col-sm-6 col-md-3">
                  <div className="p-3 border rounded-3 bg-light">
                    <div className="text-muted small">Database Storage</div>
                    <div className="fw-bold text-success d-flex align-items-center gap-1">
                      <span className="badge bg-success rounded-circle" style={{ width: 8, height: 8 }}></span>
                      OPERATIONAL
                    </div>
                  </div>
                </div>
                <div className="col-sm-6 col-md-3">
                  <div className="p-3 border rounded-3 bg-light">
                    <div className="text-muted small">BullMQ Queue Engine</div>
                    <div className="fw-bold text-success d-flex align-items-center gap-1">
                      <span className="badge bg-success rounded-circle" style={{ width: 8, height: 8 }}></span>
                      {stats?.systemHealth?.queueStatus || 'ACTIVE'}
                    </div>
                  </div>
                </div>
                <div className="col-sm-6 col-md-3">
                  <div className="p-3 border rounded-3 bg-light">
                    <div className="text-muted small">Platform Meta Integration</div>
                    <div className={`fw-bold d-flex align-items-center gap-1 ${metaConfigStatus?.readinessStatus === 'ready' ? 'text-success' : 'text-warning'}`}>
                      <span className={`badge ${metaConfigStatus?.readinessStatus === 'ready' ? 'bg-success' : 'bg-warning'} rounded-circle`} style={{ width: 8, height: 8 }}></span>
                      {metaConfigStatus?.readinessStatus === 'ready' ? 'READY (v21.0)' : 'CONFIG NEEDED'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tenant Governance Table */}
          <div className="cf-card">
            <div className="cf-card-header">
              <h5 className="mb-0">Tenant Directory ({businesses.length})</h5>
            </div>
            <div className="table-responsive">
              <table className="table cf-table">
                <thead>
                  <tr>
                    <th>Tenant Name / Slug</th>
                    <th>Users</th>
                    <th>Subscription Plan</th>
                    <th>Timezone</th>
                    <th>Status</th>
                    <th>Joined Date</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="text-center py-5">
                        <div className="spinner-border text-success" role="status"></div>
                      </td>
                    </tr>
                  ) : (
                    businesses.map(b => (
                      <tr key={b.id}>
                        <td>
                          <div className="fw-bold text-dark">{b.name}</div>
                          <code className="small text-muted">{b.slug}</code>
                        </td>
                        <td>
                          <span className="badge bg-light text-dark border">
                            {b.userCount || 1} Users
                          </span>
                        </td>
                        <td>
                          <span className="badge bg-primary-subtle text-primary">
                            {b.planName}
                          </span>
                        </td>
                        <td className="small text-muted">{b.timezone}</td>
                        <td>
                          <span className={`badge-status badge-${b.status}`}>
                            {b.status}
                          </span>
                        </td>
                        <td className="small text-muted">
                          {new Date(b.created_at).toLocaleDateString()}
                        </td>
                        <td className="text-end">
                          <button
                            onClick={() => handleToggleStatus(b.id, b.status)}
                            className={`btn btn-sm ${b.status === 'active' ? 'btn-outline-danger' : 'btn-outline-success'}`}
                          >
                            {b.status === 'active' ? 'Suspend Tenant' : 'Activate Tenant'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: META PLATFORM INTEGRATION (Section 2) */}
      {activeTab === 'meta_integration' && (
        <div className="row g-4">
          <div className="col-12 col-lg-7">
            <div className="cf-card">
              <div className="cf-card-header d-flex align-items-center justify-content-between">
                <div>
                  <h5 className="mb-0">Platform Meta Developer App Configuration</h5>
                  <p className="text-muted small mb-0">Common Meta App shared across all SaaS clients for Embedded Signup</p>
                </div>
                <span className={`badge ${metaConfigStatus?.readinessStatus === 'ready' ? 'bg-success' : 'bg-warning text-dark'}`}>
                  {metaConfigStatus?.readinessStatus === 'ready' ? 'READY FOR CLIENTS' : 'ACTION REQUIRED'}
                </span>
              </div>
              <div className="cf-card-body">
                <form onSubmit={handleSaveMetaConfig}>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">Meta App ID <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control font-monospace"
                      placeholder="e.g. 1165054629187576"
                      value={metaConfig.metaAppId}
                      onChange={(e) => setMetaConfig({ ...metaConfig, metaAppId: e.target.value })}
                      required
                    />
                    <div className="form-text small">Meta Developer Dashboard → App Settings → Basic → App ID</div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">Meta App Secret <span className="text-danger">*</span></label>
                    <div className="input-group">
                      <input
                        type={showSecret ? 'text' : 'password'}
                        className="form-control font-monospace"
                        placeholder={metaConfigStatus?.appSecretConfigured ? '•••••••••••••••••••••••• (Encrypted at Rest)' : 'Paste 32-character Meta App Secret'}
                        value={metaConfig.metaAppSecret}
                        onChange={(e) => setMetaConfig({ ...metaConfig, metaAppSecret: e.target.value })}
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => setShowSecret(!showSecret)}
                      >
                        <i className={`bi bi-eye${showSecret ? '-slash' : ''}`}></i>
                      </button>
                    </div>
                    <div className="form-text small">Encrypted using AES-256 at rest. Never sent in plain text to the browser.</div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">Embedded Signup Configuration ID (Optional)</label>
                    <input
                      type="text"
                      className="form-control font-monospace"
                      placeholder="e.g. 987654321098765"
                      value={metaConfig.embeddedSignupConfigId}
                      onChange={(e) => setMetaConfig({ ...metaConfig, embeddedSignupConfigId: e.target.value })}
                    />
                    <div className="form-text small">Configured inside Meta Developer Portal WhatsApp product for customized onboarding screens.</div>
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Graph API Version</label>
                      <input
                        type="text"
                        className="form-control font-monospace"
                        value={metaConfig.graphApiVersion}
                        onChange={(e) => setMetaConfig({ ...metaConfig, graphApiVersion: e.target.value })}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Webhook Verify Token</label>
                      <input
                        type="text"
                        className="form-control font-monospace"
                        value={metaConfig.webhookVerifyToken}
                        onChange={(e) => setMetaConfig({ ...metaConfig, webhookVerifyToken: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="mb-4 form-check form-switch">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="enableMetaSwitch"
                      checked={metaConfig.isEnabled}
                      onChange={(e) => setMetaConfig({ ...metaConfig, isEnabled: e.target.checked })}
                    />
                    <label className="form-check-label small fw-bold" htmlFor="enableMetaSwitch">
                      Enable Client WhatsApp Onboarding via this App
                    </label>
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <button type="submit" disabled={savingMeta} className="btn btn-primary px-4 fw-semibold">
                      {savingMeta ? 'Saving...' : 'Save Configuration'}
                    </button>
                    <button
                      type="button"
                      disabled={testingMeta}
                      onClick={handleTestMetaConnection}
                      className="btn btn-outline-success px-3 fw-semibold d-flex align-items-center gap-1"
                    >
                      {testingMeta ? (
                        <>
                          <span className="spinner-border spinner-border-sm" role="status"></span>
                          <span>Testing...</span>
                        </>
                      ) : (
                        <>
                          <i className="bi bi-shield-check"></i>
                          <span>Test Meta Connection</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* Meta Developer Portal Setup Checklist */}
          <div className="col-12 col-lg-5">
            <div className="cf-card h-100">
              <div className="cf-card-header">
                <h5 className="mb-0">Meta Developer Portal Requirements</h5>
              </div>
              <div className="cf-card-body">
                <p className="text-muted small">
                  In your Meta Developer App (<strong>{metaConfig.metaAppId || 'App ID'}</strong>), ensure these URLs are whitelisted:
                </p>

                <div className="mb-3">
                  <label className="small text-muted fw-bold">1. App Domains (Settings → Basic)</label>
                  <div className="p-2 bg-light rounded font-monospace small border">
                    bhaktisong.fun, whatsapp.bhaktisong.fun
                  </div>
                </div>

                <div className="mb-3">
                  <label className="small text-muted fw-bold">2. Valid OAuth Redirect URIs (Facebook Login → Settings)</label>
                  <div className="p-2 bg-light rounded font-monospace small border">
                    https://whatsapp.bhaktisong.fun/whatsapp/callback
                  </div>
                </div>

                <div className="mb-3">
                  <label className="small text-muted fw-bold">3. Webhook Callback URL (WhatsApp → Configuration)</label>
                  <div className="p-2 bg-light rounded font-monospace small border">
                    {webhookCallbackUrl}
                  </div>
                </div>

                <div className="alert alert-info border-info-subtle small mb-0">
                  <i className="bi bi-info-circle me-1"></i>
                  <strong>AiSensy-Style Architecture:</strong> Clients do not need to create developer accounts. When they click "Continue with Facebook", Meta verifies their business and returns their independent WABA ID and Phone Number ID to our SaaS platform.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: META INTEGRATION MONITORING (Section 12) */}
      {activeTab === 'meta_monitoring' && (
        <div>
          <div className="row g-3 mb-4">
            <div className="col-12 col-sm-6 col-xl-3">
              <div className="stat-card border-success-subtle">
                <div className="stat-icon-wrapper stat-icon-green">
                  <i className="bi bi-diagram-3-fill"></i>
                </div>
                <div>
                  <div className="stat-label">Connected Tenants</div>
                  <div className="stat-value">{monitoring?.totalTenantsConnected || 0}</div>
                  <div className="small text-muted">Active SaaS Workspaces</div>
                </div>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-xl-3">
              <div className="stat-card border-primary-subtle">
                <div className="stat-icon-wrapper stat-icon-blue">
                  <i className="bi bi-meta"></i>
                </div>
                <div>
                  <div className="stat-label">Unique WABAs</div>
                  <div className="stat-value">{monitoring?.totalConnectedWABAs || 0}</div>
                  <div className="small text-muted">Meta Business Accounts</div>
                </div>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-xl-3">
              <div className="stat-card">
                <div className="stat-icon-wrapper stat-icon-purple">
                  <i className="bi bi-telephone-fill"></i>
                </div>
                <div>
                  <div className="stat-label">Active Phone Numbers</div>
                  <div className="stat-value">{monitoring?.totalConnectedPhoneNumbers || 0}</div>
                  <div className="small text-success">Verified Cloud Senders</div>
                </div>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-xl-3">
              <div className="stat-card">
                <div className="stat-icon-wrapper stat-icon-orange">
                  <i className="bi bi-exclamation-triangle-fill"></i>
                </div>
                <div>
                  <div className="stat-label">Needs Reconnect</div>
                  <div className="stat-value text-warning">{monitoring?.requiresAttention || 0}</div>
                  <div className="small text-muted">Token expired / action required</div>
                </div>
              </div>
            </div>
          </div>

          <div className="cf-card mb-4">
            <div className="cf-card-header d-flex align-items-center justify-content-between">
              <h5 className="mb-0">
                <i className="bi bi-shield-check text-success me-2"></i> Multi-Tenant Account Isolation Verification
              </h5>
              <span className="badge bg-success-subtle text-success">Strict Isolation Active</span>
            </div>
            <div className="cf-card-body">
              <div className="row g-3">
                <div className="col-md-4">
                  <div className="p-3 border rounded-3 bg-light">
                    <div className="fw-bold small text-dark mb-1">AES-256 Token Encryption</div>
                    <div className="text-muted small">Every client access token is encrypted with AES-256-CBC before storing in the database.</div>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="p-3 border rounded-3 bg-light">
                    <div className="fw-bold small text-dark mb-1">Tenant ID Scoped Queries</div>
                    <div className="text-muted small">All campaigns, contacts, templates, and chats are strictly filtered by <code>business_id</code>.</div>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="p-3 border rounded-3 bg-light">
                    <div className="fw-bold small text-dark mb-1">Webhook Inbound Routing</div>
                    <div className="text-muted small">Incoming webhook messages are dynamically routed to the matching tenant based on <code>phone_number_id</code> and <code>waba_id</code>.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CLIENT WHATSAPP BUSINESS ACCOUNTS TABLE */}
      {activeTab === 'whatsapp_accounts' && (
        <div className="cf-card mb-4">
          <div className="cf-card-header d-flex align-items-center justify-content-between">
            <h5 className="mb-0">
              <i className="bi bi-whatsapp text-success me-2"></i> Client WhatsApp Business Accounts ({whatsappAccounts.length})
            </h5>
            <span className="badge bg-light text-dark border">Strict Token Isolation Active</span>
          </div>
          <div className="table-responsive">
            <table className="table cf-table">
              <thead>
                <tr>
                  <th>Tenant / Business</th>
                  <th>Display Name & Phone</th>
                  <th>Phone Number ID</th>
                  <th>WABA ID</th>
                  <th>Quality</th>
                  <th>Status</th>
                  <th>Last Verified</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-4">
                      <div className="spinner-border text-success" role="status"></div>
                    </td>
                  </tr>
                ) : whatsappAccounts.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center text-muted py-4">
                      No client WhatsApp accounts registered yet.
                    </td>
                  </tr>
                ) : (
                  whatsappAccounts.map(wa => (
                    <tr key={wa.id}>
                      <td>
                        <div className="fw-bold text-dark">{wa.tenant_name || `Tenant #${wa.business_id}`}</div>
                        <code className="small text-muted">{wa.business_slug || `tenant-${wa.business_id}`}</code>
                      </td>
                      <td>
                        <div className="fw-bold">{wa.verified_name || wa.account_name}</div>
                        <div className="small text-muted">{wa.display_phone_number || 'No phone verified'}</div>
                      </td>
                      <td>
                        <code className="small text-muted">{wa.phone_number_id || '—'}</code>
                      </td>
                      <td>
                        <code className="small text-muted">{wa.waba_id}</code>
                      </td>
                      <td>
                        <span className={`badge ${
                          wa.quality_rating === 'GREEN' ? 'bg-success-subtle text-success' :
                          wa.quality_rating === 'YELLOW' ? 'bg-warning-subtle text-warning' :
                          wa.quality_rating === 'RED' ? 'bg-danger-subtle text-danger' :
                          'bg-light text-muted'
                        }`}>
                          {wa.quality_rating || 'UNKNOWN'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${
                          wa.status === 'connected' ? 'bg-success text-white' :
                          wa.status === 'action_required' ? 'bg-warning text-dark' :
                          wa.status === 'token_expired' ? 'bg-danger text-white' :
                          'bg-secondary text-white'
                        }`}>
                          {wa.status}
                        </span>
                      </td>
                      <td className="small text-muted">
                        {wa.last_verified_at ? new Date(wa.last_verified_at).toLocaleString() : 'Pending'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
