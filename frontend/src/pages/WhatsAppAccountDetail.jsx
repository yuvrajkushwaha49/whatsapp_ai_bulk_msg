import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';

export default function WhatsAppAccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();

  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [settingPrimary, setSettingPrimary] = useState(false);
  const [syncingTemplates, setSyncingTemplates] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [copiedKey, setCopiedKey] = useState('');

  // Disconnect / Delete modals
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);

  // SuperAdmin Live Test Messenger
  const [testForm, setTestForm] = useState({
    recipientPhone: '919565763089',
    messageType: 'template',
    templateName: 'hello_world',
    textBody: 'Hello from CampaignFlow WhatsApp Cloud API!'
  });
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Analytics Metrics (Hooks must always execute unconditionally at top level)
  const totalSent = account?.stats?.totalSent || 0;
  const totalDelivered = account?.stats?.totalDelivered || 0;
  const totalRead = account?.stats?.totalRead || 0;
  const totalFailed = account?.stats?.totalFailed || 0;
  const totalConversations = account?.stats?.totalConversations || 0;

  const deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;
  const readRate = totalDelivered > 0 ? Math.round((totalRead / totalDelivered) * 100) : 0;

  // Donut Pie Chart Data
  const pieData = useMemo(() => {
    const list = [
      { name: 'Read', value: totalRead, color: '#198754' },
      { name: 'Delivered', value: Math.max(0, totalDelivered - totalRead), color: '#25D366' },
      { name: 'Sent (In Transit)', value: Math.max(0, totalSent - totalDelivered), color: '#0d6efd' },
      { name: 'Failed', value: totalFailed, color: '#dc3545' }
    ].filter(d => d.value > 0);
    return list;
  }, [totalRead, totalDelivered, totalSent, totalFailed]);

  // Bar Chart Data (Delivery Funnel)
  const barData = useMemo(() => {
    return [
      { name: 'Sent', count: totalSent, fill: '#0d6efd' },
      { name: 'Delivered', count: totalDelivered, fill: '#25D366' },
      { name: 'Read', count: totalRead, fill: '#198754' },
      { name: 'Conversations', count: totalConversations, fill: '#6f42c1' },
      { name: 'Failed', count: totalFailed, fill: '#dc3545' }
    ];
  }, [totalSent, totalDelivered, totalRead, totalConversations, totalFailed]);

  useEffect(() => {
    fetchAccountDetail();
  }, [id]);

  const fetchAccountDetail = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/whatsapp/accounts/${id}`);
      if (res.data?.success && res.data?.data) {
        setAccount(res.data.data);
      } else {
        setError(res.data?.message || 'Failed to load WhatsApp Account details');
      }
    } catch (err) {
      console.error('Failed to load WhatsApp account detail:', err);
      setError(err.response?.data?.message || 'WhatsApp Account not found or unauthorized');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    try {
      setVerifying(true);
      setFeedback({ type: '', text: '' });
      const res = await api.post(`/whatsapp/accounts/${id}/verify`);
      if (res.data?.success) {
        setFeedback({ type: 'success', text: '✅ Meta Graph API connection verified and status updated!' });
        await fetchAccountDetail();
      }
    } catch (err) {
      setFeedback({ type: 'danger', text: err.response?.data?.message || 'Verification failed.' });
    } finally {
      setVerifying(false);
    }
  };

  const handleSetPrimary = async () => {
    try {
      setSettingPrimary(true);
      setFeedback({ type: '', text: '' });
      const res = await api.post(`/whatsapp/accounts/${id}/primary`);
      if (res.data?.success) {
        setFeedback({ type: 'success', text: `⭐ ${account.phone_number || account.display_name} is now your Primary Default sender!` });
        await fetchAccountDetail();
      }
    } catch (err) {
      setFeedback({ type: 'danger', text: err.response?.data?.message || 'Failed to set as primary account.' });
    } finally {
      setSettingPrimary(false);
    }
  };

  const handleSyncTemplates = async () => {
    try {
      setSyncingTemplates(true);
      setFeedback({ type: '', text: '' });
      const res = await api.post('/whatsapp/templates/sync');
      if (res.data?.success) {
        setFeedback({ type: 'success', text: `✅ Templates synced with Meta! Total: ${res.data.data?.syncedCount || 0}` });
        await fetchAccountDetail();
      }
    } catch (err) {
      setFeedback({ type: 'danger', text: err.response?.data?.message || 'Failed to sync templates.' });
    } finally {
      setSyncingTemplates(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setActionInProgress(true);
      await api.delete(`/whatsapp/accounts/${id}`);
      setFeedback({ type: 'success', text: 'WhatsApp account disconnected.' });
      setShowDisconnectModal(false);
      navigate('/whatsapp');
    } catch (err) {
      setFeedback({ type: 'danger', text: err.response?.data?.message || 'Failed to disconnect account.' });
      setShowDisconnectModal(false);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleDeletePermanent = async () => {
    try {
      setActionInProgress(true);
      await api.delete(`/whatsapp/accounts/${id}/permanent`);
      setShowDeleteModal(false);
      navigate('/whatsapp');
    } catch (err) {
      setFeedback({ type: 'danger', text: err.response?.data?.message || 'Failed to delete account permanently.' });
      setShowDeleteModal(false);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleSendTestMessage = async (e) => {
    e.preventDefault();
    try {
      setSendingTest(true);
      setTestResult(null);
      const res = await api.post(`/whatsapp/accounts/${id}/test-message`, testForm);
      if (res.data?.success) {
        setTestResult({ success: true, message: `Message sent successfully! Meta Message ID: ${res.data.data?.meta_message_id || res.data.data?.id || 'delivered'}` });
      } else {
        setTestResult({ success: false, message: res.data?.message || 'Failed to send test message' });
      }
    } catch (err) {
      setTestResult({ success: false, message: err.response?.data?.message || 'Test message failed to send' });
    } finally {
      setSendingTest(false);
    }
  };

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-success" role="status" style={{ width: '3rem', height: '3rem' }}></div>
        <p className="mt-3 text-muted fw-semibold">Loading WhatsApp Number Details...</p>
      </div>
    );
  }

  if (error || !account) {
    return (
      <div className="container py-5">
        <div className="alert alert-danger shadow-sm p-4 text-center rounded-3">
          <i className="bi bi-exclamation-triangle-fill fs-2 mb-2 d-block"></i>
          <h4>Unable to Load WhatsApp Account</h4>
          <p className="text-muted">{error || 'This account may have been removed or deactivated by SuperAdmin.'}</p>
          <Link to="/whatsapp" className="btn btn-primary mt-2">
            <i className="bi bi-arrow-left me-1"></i> Back to WhatsApp Accounts
          </Link>
        </div>
      </div>
    );
  }

  const qualityColor =
    account.quality_rating === 'GREEN' ? 'success' :
    account.quality_rating === 'YELLOW' ? 'warning' :
    account.quality_rating === 'RED' ? 'danger' : 'secondary';

  const isConnected = account.status === 'connected';

  return (
    <div>
      {/* Back Navigation Bar */}
      <div className="mb-3">
        <Link to="/whatsapp" className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1 shadow-xs">
          <i className="bi bi-arrow-left"></i>
          <span>Back to All Connected WhatsApp Numbers</span>
        </Link>
      </div>

      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show mb-4 shadow-sm`} role="alert">
          {feedback.text}
          <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      {/* Hero Header Card */}
      <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '16px', background: 'linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%)' }}>
        <div className="card-body p-4 p-md-5">
          <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
            <div className="d-flex align-items-center gap-3">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center text-white shadow-sm"
                style={{
                  width: '68px',
                  height: '68px',
                  background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                  fontSize: '2.2rem',
                  flexShrink: 0
                }}
              >
                <i className="bi bi-whatsapp"></i>
              </div>

              <div>
                <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                  <h3 className="fw-bold text-dark mb-0 font-monospace">
                    {account.phone_number || account.display_name || 'WhatsApp Number'}
                  </h3>
                  {account.is_primary ? (
                    <span className="badge bg-warning text-dark border border-warning shadow-xs">
                      ⭐ Primary Default Sender
                    </span>
                  ) : (
                    <button
                      className="btn btn-xs btn-outline-secondary py-0 px-2"
                      onClick={handleSetPrimary}
                      disabled={settingPrimary}
                      title="Set as workspace primary sender"
                    >
                      {settingPrimary ? 'Setting...' : 'Set as Primary'}
                    </button>
                  )}
                  <span className={`badge ${isConnected ? 'bg-success text-white' : 'bg-danger text-white'}`}>
                    <i className={`bi ${isConnected ? 'bi-check-circle-fill' : 'bi-x-circle-fill'} me-1`}></i>
                    {account.status?.toUpperCase()}
                  </span>
                  <span className="badge bg-light text-dark border">
                    Admin Status: <strong className="text-success">{account.admin_status || 'ACTIVE'}</strong>
                  </span>
                </div>

                <div className="text-secondary small">
                  <strong>Verified Name:</strong> {account.verified_name || account.display_name || 'WhatsApp Business Account'}
                  <span className="mx-2">•</span>
                  <span><strong>WABA ID:</strong> <code>{account.waba_id}</code></span>
                </div>
              </div>
            </div>

            {/* Quick Header Actions */}
            <div className="d-flex flex-wrap align-items-center gap-2">
              <button
                className="btn btn-outline-success btn-sm d-inline-flex align-items-center gap-1 shadow-xs"
                onClick={handleVerify}
                disabled={verifying}
              >
                <i className={`bi bi-arrow-repeat ${verifying ? 'spin' : ''}`}></i>
                <span>{verifying ? 'Verifying...' : 'Live Health Check'}</span>
              </button>
              <Link to="/inbox" className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1 shadow-xs">
                <i className="bi bi-chat-dots-fill"></i>
                <span>Open Inbox</span>
              </Link>
              <Link to="/campaigns/new" className="btn btn-success btn-sm d-inline-flex align-items-center gap-1 shadow-xs">
                <i className="bi bi-megaphone-fill"></i>
                <span>Launch Campaign</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Summary KPI Cards */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="stat-card">
            <div className="stat-icon-wrapper stat-icon-green">
              <i className="bi bi-broadcast"></i>
            </div>
            <div>
              <div className="stat-label">Connection Status</div>
              <div className="stat-value text-success text-capitalize">{account.status || 'Connected'}</div>
              <div className="small text-muted">Cloud API v21.0 Live</div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="stat-card">
            <div className="stat-icon-wrapper" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
              <i className="bi bi-shield-check"></i>
            </div>
            <div>
              <div className="stat-label">Quality Rating</div>
              <div className="stat-value text-primary">{account.quality_rating || 'GREEN'}</div>
              <div className="small text-muted">{account.messaging_limit_tier || 'STANDARD TIER'}</div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="stat-card">
            <div className="stat-icon-wrapper stat-icon-blue">
              <i className="bi bi-file-earmark-text"></i>
            </div>
            <div>
              <div className="stat-label">Synced Templates</div>
              <div className="stat-value">{account.stats?.totalTemplates || 0}</div>
              <div className="small text-muted">Approved & Ready to send</div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="stat-card">
            <div className="stat-icon-wrapper stat-icon-purple">
              <i className="bi bi-send-check"></i>
            </div>
            <div>
              <div className="stat-label">Broadcast Campaigns</div>
              <div className="stat-value">{account.stats?.totalCampaigns || 0}</div>
              <div className="small text-muted">Sent from this workspace</div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance & Delivery Analytics Visuals */}
      <div className="row g-4 mb-4">
        {/* Donut Pie Chart: Delivery Breakdown */}
        <div className="col-12 col-lg-5">
          <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '14px' }}>
            <div className="card-header bg-white border-bottom py-3 d-flex align-items-center justify-content-between">
              <h6 className="mb-0 fw-bold d-flex align-items-center gap-2">
                <i className="bi bi-pie-chart-fill text-success"></i>
                <span>Message Delivery Distribution</span>
              </h6>
              <span className="badge bg-success-subtle text-success border border-success-subtle">
                {deliveryRate}% Delivery Rate
              </span>
            </div>
            <div className="card-body d-flex flex-column align-items-center justify-content-center p-3">
              {pieData.length > 0 ? (
                <div style={{ width: '100%', height: 240 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`wa-pie-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36} iconSize={10} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-4 text-muted small">
                  <i className="bi bi-broadcast fs-3 d-block mb-2 text-secondary"></i>
                  No broadcast messages sent from this WhatsApp number yet.
                </div>
              )}
              <div className="w-100 border-top pt-2 mt-2 d-flex justify-content-around text-center small text-muted">
                <div>
                  <div className="fw-bold text-dark">{totalSent}</div>
                  <div>Sent</div>
                </div>
                <div>
                  <div className="fw-bold text-success">{totalDelivered}</div>
                  <div>Delivered</div>
                </div>
                <div>
                  <div className="fw-bold text-warning">{totalRead}</div>
                  <div>Read ({readRate}%)</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bar Chart: Message Traffic Funnel */}
        <div className="col-12 col-lg-7">
          <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '14px' }}>
            <div className="card-header bg-white border-bottom py-3 d-flex align-items-center justify-content-between">
              <h6 className="mb-0 fw-bold d-flex align-items-center gap-2">
                <i className="bi bi-bar-chart-fill text-primary"></i>
                <span>Channel Traffic & Conversions</span>
              </h6>
              <span className="small text-muted">
                Real-time Meta Webhooks
              </span>
            </div>
            <div className="card-body p-3">
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={barData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}
                    />
                    <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                      {barData.map((entry, index) => (
                        <Cell key={`wa-bar-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Technical & Operational Grid */}
      <div className="row g-4 mb-4">
        {/* Left Column: Official Meta Cloud API Credentials & Info */}
        <div className="col-lg-7">
          <div className="card border-0 shadow-sm mb-4 h-100" style={{ borderRadius: '14px' }}>
            <div className="card-header bg-white border-bottom py-3 d-flex align-items-center justify-content-between">
              <h6 className="mb-0 fw-bold d-flex align-items-center gap-2">
                <i className="bi bi-cpu-fill text-primary"></i>
                <span>Meta Cloud API Technical Credentials</span>
              </h6>
              <span className="badge bg-success-subtle text-success border border-success-subtle">
                Isolated Tenant Credential
              </span>
            </div>

            <div className="card-body p-4">
              <div className="table-responsive">
                <table className="table table-borderless align-middle mb-0">
                  <tbody>
                    {/* Phone Number ID */}
                    <tr className="border-bottom">
                      <td className="text-muted fw-semibold" style={{ width: '38%' }}>Phone Number ID</td>
                      <td>
                        <div className="d-flex align-items-center justify-content-between bg-light p-2 rounded border">
                          <code className="text-dark fw-bold font-monospace">{account.phone_number_id || '—'}</code>
                          <button
                            className="btn btn-sm btn-link text-secondary p-0"
                            onClick={() => copyToClipboard(account.phone_number_id, 'phone_id')}
                            title="Copy Phone Number ID"
                          >
                            <i className={`bi ${copiedKey === 'phone_id' ? 'bi-check-lg text-success' : 'bi-clipboard'}`}></i>
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* WABA ID */}
                    <tr className="border-bottom">
                      <td className="text-muted fw-semibold">WhatsApp Business (WABA) ID</td>
                      <td>
                        <div className="d-flex align-items-center justify-content-between bg-light p-2 rounded border">
                          <code className="text-dark fw-bold font-monospace">{account.waba_id || '—'}</code>
                          <button
                            className="btn btn-sm btn-link text-secondary p-0"
                            onClick={() => copyToClipboard(account.waba_id, 'waba_id')}
                            title="Copy WABA ID"
                          >
                            <i className={`bi ${copiedKey === 'waba_id' ? 'bi-check-lg text-success' : 'bi-clipboard'}`}></i>
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Meta Business Manager ID */}
                    <tr className="border-bottom">
                      <td className="text-muted fw-semibold">Meta Business Portfolio ID</td>
                      <td>
                        <code className="text-muted">{account.meta_business_id || 'Embedded Multi-App Business Portfolio'}</code>
                      </td>
                    </tr>

                    {/* Graph API Version */}
                    <tr className="border-bottom">
                      <td className="text-muted fw-semibold">Graph API Version</td>
                      <td>
                        <span className="badge bg-light text-dark border">Meta Graph API v21.0</span>
                      </td>
                    </tr>

                    {/* Access Token Security */}
                    <tr className="border-bottom">
                      <td className="text-muted fw-semibold">Token Security & Storage</td>
                      <td>
                        <span className="badge bg-success-subtle text-success border border-success-subtle">
                          <i className="bi bi-lock-fill me-1"></i> AES-256 Encrypted at Rest
                        </span>
                      </td>
                    </tr>

                    {/* Webhook Subscription */}
                    <tr className="border-bottom">
                      <td className="text-muted fw-semibold">Webhook Subscription</td>
                      <td>
                        <span className="badge bg-info-subtle text-info border border-info-subtle">
                          <i className="bi bi-bell-fill me-1"></i> Subscribed & Active
                        </span>
                      </td>
                    </tr>

                    {/* Connected On */}
                    <tr className="border-bottom">
                      <td className="text-muted fw-semibold">First Connected Date</td>
                      <td className="small text-dark">
                        {account.created_at ? new Date(account.created_at).toLocaleString() : 'Recent'}
                      </td>
                    </tr>

                    {/* Last Health Verified */}
                    <tr>
                      <td className="text-muted fw-semibold">Last Meta Health Check</td>
                      <td className="small text-dark">
                        {account.last_verified_at ? new Date(account.last_verified_at).toLocaleString() : 'Live Connected'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Operations, Management & SuperAdmin Testing */}
        <div className="col-lg-5">
          {/* Quick Operations Suite */}
          <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '14px' }}>
            <div className="card-header bg-white border-bottom py-3">
              <h6 className="mb-0 fw-bold d-flex align-items-center gap-2">
                <i className="bi bi-sliders text-success"></i>
                <span>Number Operations & Resources</span>
              </h6>
            </div>
            <div className="card-body p-4">
              <div className="d-grid gap-2">
                <Link to="/campaigns/new" className="btn btn-outline-success text-start py-2 d-flex align-items-center justify-content-between">
                  <span><i className="bi bi-megaphone-fill me-2 text-success"></i> Launch Broadcast Campaign</span>
                  <i className="bi bi-arrow-right"></i>
                </Link>

                <Link to="/inbox" className="btn btn-outline-primary text-start py-2 d-flex align-items-center justify-content-between">
                  <span><i className="bi bi-chat-dots-fill me-2 text-primary"></i> Open Two-Way Live Chat Inbox</span>
                  <i className="bi bi-arrow-right"></i>
                </Link>

                <Link to="/templates" className="btn btn-outline-secondary text-start py-2 d-flex align-items-center justify-content-between">
                  <span><i className="bi bi-file-earmark-text-fill me-2 text-secondary"></i> Create & Manage Meta Templates</span>
                  <i className="bi bi-arrow-right"></i>
                </Link>

                <button
                  className="btn btn-light border text-start py-2 d-flex align-items-center justify-content-between"
                  onClick={handleSyncTemplates}
                  disabled={syncingTemplates}
                >
                  <span>
                    <i className={`bi bi-arrow-repeat me-2 text-primary ${syncingTemplates ? 'spin' : ''}`}></i>
                    {syncingTemplates ? 'Syncing Templates...' : 'Sync Meta Cloud Templates'}
                  </span>
                  <span className="badge bg-secondary">Sync</span>
                </button>

                {!account.is_primary && (
                  <button
                    className="btn btn-light border text-start py-2 d-flex align-items-center justify-content-between"
                    onClick={handleSetPrimary}
                    disabled={settingPrimary}
                  >
                    <span><i className="bi bi-star-fill me-2 text-warning"></i> Set as Primary Workspace Sender</span>
                    <span className="badge bg-warning text-dark">Primary</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* SuperAdmin Live Test Messenger (Restricted to SuperAdmin Only) */}
          {isSuperAdmin() && (
            <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '14px', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>
              <div className="card-header bg-white border-bottom py-3">
                <h6 className="mb-0 fw-bold d-flex align-items-center gap-2">
                  <i className="bi bi-send-fill text-primary"></i>
                  <span>Super Admin Live Test Messenger</span>
                </h6>
              </div>
              <div className="card-body p-4">
                <p className="small text-muted mb-3">
                  Send a live test message through this specific phone number ID using Meta Cloud API.
                </p>
                <form onSubmit={handleSendTestMessage}>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Recipient Mobile Number (with country code):</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="e.g. 919565763089"
                      value={testForm.recipientPhone}
                      onChange={(e) => setTestForm(prev => ({ ...prev, recipientPhone: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Template Name:</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={testForm.templateName}
                      onChange={(e) => setTestForm(prev => ({ ...prev, templateName: e.target.value }))}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary btn-sm w-100 fw-semibold"
                    disabled={sendingTest}
                  >
                    {sendingTest ? <span className="spinner-border spinner-border-sm me-1"></span> : <i className="bi bi-send me-1"></i>}
                    <span>Send Test Message</span>
                  </button>
                </form>

                {testResult && (
                  <div className={`alert alert-${testResult.success ? 'success' : 'danger'} small mt-3 mb-0 py-2`}>
                    {testResult.message}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Danger Zone Card */}
          <div className="card border-0 shadow-sm" style={{ borderRadius: '14px' }}>
            <div className="card-header bg-white border-bottom py-3">
              <h6 className="mb-0 fw-bold text-danger d-flex align-items-center gap-2">
                <i className="bi bi-exclamation-octagon-fill"></i>
                <span>Danger Zone</span>
              </h6>
            </div>
            <div className="card-body p-4">
              <div className="d-flex flex-column gap-3">
                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <div className="fw-semibold small">Disconnect Number</div>
                    <div className="text-muted small">Temporarily pause message sending (can reconnect anytime).</div>
                  </div>
                  <button
                    className="btn btn-outline-warning btn-sm text-dark"
                    onClick={() => setShowDisconnectModal(true)}
                  >
                    Disconnect
                  </button>
                </div>

                <hr className="my-1" />

                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <div className="fw-semibold small text-danger">Permanently Delete</div>
                    <div className="text-muted small">Remove this number and credentials completely.</div>
                  </div>
                  <button
                    className="btn btn-outline-danger btn-sm"
                    onClick={() => setShowDeleteModal(true)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Disconnect Confirmation Modal */}
      {showDisconnectModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold text-warning">Disconnect WhatsApp Account?</h5>
                <button type="button" className="btn-close" onClick={() => setShowDisconnectModal(false)}></button>
              </div>
              <div className="modal-body">
                <p>Are you sure you want to disconnect <strong>{account.phone_number || account.display_name}</strong>?</p>
                <p className="text-muted small mb-0">Active campaigns will pause, but your configuration and history remain safe.</p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowDisconnectModal(false)}>Cancel</button>
                <button type="button" className="btn btn-warning btn-sm" disabled={actionInProgress} onClick={handleDisconnect}>
                  {actionInProgress ? 'Disconnecting...' : 'Yes, Disconnect'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title fw-bold">Permanently Delete WhatsApp Account?</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowDeleteModal(false)}></button>
              </div>
              <div className="modal-body">
                <p className="text-danger fw-bold">⚠️ Warning: This action cannot be undone!</p>
                <p>This will permanently delete <strong>{account.phone_number || account.display_name}</strong> and remove encrypted credentials from the database.</p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                <button type="button" className="btn btn-danger btn-sm" disabled={actionInProgress} onClick={handleDeletePermanent}>
                  {actionInProgress ? 'Deleting...' : 'Permanently Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
