import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate, useOutletContext } from 'react-router-dom';
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
import { initSocket } from '../services/socket';
import AiwavoHeader from '../components/AiwavoHeader';
import ResendCampaignModal from '../components/ResendCampaignModal';
import '../styles/campaigns.css';

const PIE_COLORS = {
  Sent: '#0d6efd',
  Delivered: '#25D366',
  Read: '#198754',
  Failed: '#dc3545',
  Pending: '#6c757d'
};

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const outletContext = useOutletContext();
  const onToggleSidebar = outletContext?.onToggleSidebar;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);
  const [showResendModal, setShowResendModal] = useState(false);

  const handleResendSuccess = (result) => {
    setToastMsg(result?.message || 'Campaign successfully re-dispatched!');
    if (result?.data?.campaignId && result.data.campaignId !== Number(id)) {
      navigate(`/campaigns/${result.data.campaignId}`);
    } else {
      fetchCampaignDetails();
    }
  };

  // Active Tab: 'overview' | 'recipients' | 'template' | 'logs'
  const [activeTab, setActiveTab] = useState('overview');

  // Recipient table search & filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Selected recipient for interactive mockup preview
  const [previewContactId, setPreviewContactId] = useState(null);

  useEffect(() => {
    fetchCampaignDetails();
    // Auto-refresh when status is active/running
    const interval = setInterval(() => {
      fetchCampaignDetails(true);
    }, 5000);

    const socket = initSocket();
    const handleStatusUpdate = () => {
      fetchCampaignDetails(true);
    };
    if (socket) {
      socket.on('campaign:status_update', handleStatusUpdate);
    }

    return () => {
      clearInterval(interval);
      if (socket) {
        socket.off('campaign:status_update', handleStatusUpdate);
      }
    };
  }, [id]);

  const showToast = (type, text) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const fetchCampaignDetails = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const res = await api.get(`/campaigns/${id}`);
      if (res.data?.success) {
        setData(res.data.data);
        setError('');
      }
    } catch (err) {
      console.error('[CampaignDetail] fetch error:', err);
      if (!isBackground) {
        setError(err.response?.data?.message || 'Failed to fetch campaign details');
      }
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  // Campaign Actions
  const handleStartCampaign = async () => {
    if (!window.confirm('Are you sure you want to trigger this campaign broadcast now?')) return;
    try {
      setActionLoading(true);
      const res = await api.post(`/campaigns/${id}/start`);
      if (res.data?.success) {
        showToast('success', res.data.message || 'Campaign broadcast triggered successfully!');
        fetchCampaignDetails();
      }
    } catch (err) {
      showToast('danger', err.response?.data?.message || 'Failed to start campaign.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePauseCampaign = async () => {
    try {
      setActionLoading(true);
      const res = await api.post(`/campaigns/${id}/pause`);
      if (res.data?.success) {
        showToast('warning', 'Campaign broadcast paused.');
        fetchCampaignDetails();
      }
    } catch (err) {
      showToast('danger', err.response?.data?.message || 'Failed to pause campaign.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelCampaign = async () => {
    if (!window.confirm('Cancel this campaign? Unsent recipients will be aborted.')) return;
    try {
      setActionLoading(true);
      const res = await api.post(`/campaigns/${id}/cancel`);
      if (res.data?.success) {
        showToast('info', 'Campaign cancelled.');
        fetchCampaignDetails();
      }
    } catch (err) {
      showToast('danger', err.response?.data?.message || 'Failed to cancel campaign.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!data?.recipients || data.recipients.length === 0) {
      showToast('warning', 'No recipients data available to export.');
      return;
    }
    const headers = ['Recipient Phone', 'Contact Name', 'Status', 'Sent At', 'Delivered At', 'Read At', 'Provider Message ID', 'Error / Reason'];
    const rows = data.recipients.map(r => [
      `"${r.phone || ''}"`,
      `"${r.contact_name || ''}"`,
      `"${r.status || ''}"`,
      `"${r.sent_at ? new Date(r.sent_at).toISOString() : ''}"`,
      `"${r.delivered_at ? new Date(r.delivered_at).toISOString() : ''}"`,
      `"${r.read_at ? new Date(r.read_at).toISOString() : ''}"`,
      `"${r.provider_message_id || ''}"`,
      `"${(r.error_message || r.skip_reason || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `campaign_${id}_${data.campaign?.name || 'recipients'}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('success', 'Recipient logs exported to CSV!');
  };

  const campaign = data?.campaign;
  const rawRecipients = data?.recipients || [];

  // Mappings & template parsing
  const variableMappings = useMemo(() => {
    if (!campaign?.variable_mappings) return {};
    if (typeof campaign.variable_mappings === 'string') {
      try {
        return JSON.parse(campaign.variable_mappings);
      } catch (e) {
        return {};
      }
    }
    return campaign.variable_mappings;
  }, [campaign?.variable_mappings]);

  const templateComponents = useMemo(() => {
    if (!campaign?.template_components) return [];
    if (typeof campaign.template_components === 'string') {
      try {
        return JSON.parse(campaign.template_components);
      } catch (e) {
        return [];
      }
    }
    return Array.isArray(campaign.template_components) ? campaign.template_components : [];
  }, [campaign?.template_components]);

  // Recipient stats & Rates
  const totalRecipients = campaign?.total_recipients || rawRecipients.length || 0;
  const sentCount = campaign?.sent_count || 0;
  const deliveredCount = campaign?.delivered_count || 0;
  const readCount = campaign?.read_count || 0;
  const failedCount = campaign?.failed_count || 0;

  const deliveryRate = sentCount > 0 ? Math.min(100, Math.round((deliveredCount / sentCount) * 100)) : 0;
  const readRate = deliveredCount > 0 ? Math.min(100, Math.round((readCount / deliveredCount) * 100)) : 0;
  const failureRate = totalRecipients > 0 ? Math.min(100, Math.round((failedCount / totalRecipients) * 100)) : 0;

  // Chart Data
  const pieData = useMemo(() => {
    const list = [
      { name: 'Read', value: readCount, color: PIE_COLORS.Read },
      { name: 'Delivered', value: Math.max(0, deliveredCount - readCount), color: PIE_COLORS.Delivered },
      { name: 'Sent (In Transit)', value: Math.max(0, sentCount - deliveredCount), color: PIE_COLORS.Sent },
      { name: 'Failed', value: failedCount, color: PIE_COLORS.Failed }
    ].filter(d => d.value > 0);
    return list;
  }, [readCount, deliveredCount, sentCount, failedCount]);

  const barData = [
    { name: 'Audience', count: totalRecipients, fill: '#6c757d' },
    { name: 'Sent', count: sentCount, fill: '#0d6efd' },
    { name: 'Delivered', count: deliveredCount, fill: '#25D366' },
    { name: 'Read', count: readCount, fill: '#198754' },
    { name: 'Failed', count: failedCount, fill: '#dc3545' }
  ];

  // Filtered Recipients
  const filteredRecipients = useMemo(() => {
    return rawRecipients.filter(r => {
      const matchesSearch =
        !searchTerm.trim() ||
        (r.phone && r.phone.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (r.contact_name && r.contact_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (r.provider_message_id && r.provider_message_id.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'delivered' && (r.status === 'delivered' || r.status === 'read')) ||
        r.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [rawRecipients, searchTerm, statusFilter]);

  const totalPages = Math.ceil(filteredRecipients.length / pageSize) || 1;
  const paginatedRecipients = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecipients.slice(start, start + pageSize);
  }, [filteredRecipients, currentPage, pageSize]);

  // Dynamic preview text resolution
  const activePreviewRecipient = useMemo(() => {
    if (previewContactId) {
      const found = rawRecipients.find(r => r.id === previewContactId);
      if (found) return found;
    }
    return rawRecipients[0] || { contact_name: 'Priya Sharma', phone: '+91 98765 43210' };
  }, [previewContactId, rawRecipients]);

  const renderedTemplateBody = useMemo(() => {
    const bodyComp = templateComponents.find(c => (c.type || '').toUpperCase() === 'BODY');
    if (!bodyComp || !bodyComp.text) {
      return 'Hello! Thank you for connecting with our WhatsApp channel.';
    }

    let text = bodyComp.text;
    const phMatches = Array.from(new Set(text.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) || []));

    phMatches.forEach((ph, idx) => {
      const cleanKey = ph.replace(/[{}]/g, '');
      const varKey = `var_${idx + 1}`;
      const mappedField = variableMappings[cleanKey] || variableMappings[varKey];

      let val = activePreviewRecipient.contact_name || activePreviewRecipient.phone || 'Customer';
      if (mappedField && mappedField !== 'contact.name') {
        val = mappedField;
      }
      text = text.split(ph).join(val);
    });

    return text;
  }, [templateComponents, variableMappings, activePreviewRecipient]);

  const headerComponent = templateComponents.find(c => (c.type || '').toUpperCase() === 'HEADER');
  const footerComponent = templateComponents.find(c => (c.type || '').toUpperCase() === 'FOOTER');
  const buttonsComponent = templateComponents.find(c => (c.type || '').toUpperCase() === 'BUTTONS');

  if (loading && !data) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-success" role="status"></div>
        <div className="text-muted small mt-2">Loading campaign analytics & logs...</div>
      </div>
    );
  }

  if (!data && error) {
    return (
      <div className="text-center py-5">
        <div className="alert alert-light border shadow-sm d-inline-block px-4 py-4 rounded-4 text-start" style={{ maxWidth: '500px' }}>
          <div className="d-flex align-items-center gap-2 mb-2">
            <i className="bi bi-exclamation-triangle-fill text-warning fs-3"></i>
            <h5 className="mb-0 fw-bold text-dark">Campaign #{id} Not Found</h5>
          </div>
          <p className="text-muted small mb-3">
            {error || 'This campaign does not exist or may have been removed.'}
          </p>
          <div className="d-flex gap-2">
            <Link to="/campaigns" className="btn btn-sm btn-outline-secondary">
              <i className="bi bi-arrow-left me-1"></i> Back to Campaigns
            </Link>
            <Link to="/campaigns/new" className="btn btn-sm btn-cf-primary">
              <i className="bi bi-plus-lg me-1"></i> Create Campaign
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="campaign-detail-page pb-5">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`alert alert-${toastMsg.type} alert-dismissible fade show shadow-sm position-fixed top-0 end-0 m-3 z-3`}
          role="alert"
          style={{ maxWidth: '420px', zIndex: 1080 }}
        >
          <div className="d-flex align-items-center gap-2">
            <i className={`bi ${toastMsg.type === 'success' ? 'bi-check-circle-fill' : 'bi-info-circle-fill'}`}></i>
            <span>{toastMsg.text}</span>
          </div>
          <button type="button" className="btn-close" onClick={() => setToastMsg(null)}></button>
        </div>
      )}

      {/* Top Header & Breadcrumbs */}
      <AiwavoHeader
        title={`Campaign: ${campaign?.name || `#${campaign?.id}`}`}
        subtitle={`Account: ${campaign?.account_name || 'Primary WhatsApp'} • Template: ${campaign?.template_name || 'N/A'}`}
        onToggleSidebar={onToggleSidebar}
      />

      <div className="p-4">
        {/* Campaign Action Toolbar */}
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4 bg-white p-3 rounded-3 border">
          <div className="d-flex align-items-center gap-2">
            <Link to="/campaigns" className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1 shadow-xs">
              <i className="bi bi-arrow-left"></i>
              <span>Back to Campaigns</span>
            </Link>
            <span className={`badge-status badge-${campaign?.status} ms-1`}>
              {campaign?.status?.toUpperCase()}
            </span>
          </div>

          <div className="d-flex flex-wrap align-items-center gap-2">
            {['draft', 'scheduled'].includes(campaign?.status) && (
              <button
                onClick={handleStartCampaign}
                disabled={actionLoading}
                className="btn btn-success btn-sm d-flex align-items-center gap-1 shadow-sm"
              >
                <i className="bi bi-play-fill fs-6"></i>
                <span>{actionLoading ? 'Starting...' : (campaign?.status === 'scheduled' ? 'Launch Now' : 'Send Broadcast')}</span>
              </button>
            )}

            {campaign?.status === 'running' && (
              <button
                onClick={handlePauseCampaign}
                disabled={actionLoading}
                className="btn btn-warning btn-sm d-flex align-items-center gap-1"
              >
                <i className="bi bi-pause-fill fs-6"></i>
                <span>Pause</span>
              </button>
            )}

            {['running', 'scheduled', 'draft'].includes(campaign?.status) && (
              <button
                onClick={handleCancelCampaign}
                disabled={actionLoading}
                className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1"
              >
                <i className="bi bi-stop-fill fs-6"></i>
                <span>Cancel</span>
              </button>
            )}

            <button
              onClick={() => setShowResendModal(true)}
              className="btn btn-outline-success btn-sm d-flex align-items-center gap-1 shadow-sm"
              title="Resend broadcast to all or failed recipients"
            >
              <i className="bi bi-arrow-repeat fs-6"></i>
              <span>Resend Campaign</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
              title="Download CSV report of all recipients"
            >
              <i className="bi bi-download"></i>
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => fetchCampaignDetails()}
              className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
              title="Refresh analytics and webhooks"
            >
              <i className="bi bi-arrow-clockwise"></i>
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Scheduled Campaign Alert Banner */}
        {campaign?.status === 'scheduled' && (
          <div className="alert alert-primary border-primary-subtle d-flex flex-wrap align-items-center justify-content-between p-3 rounded-3 mb-4 shadow-xs gap-3">
            <div className="d-flex align-items-center gap-3">
              <div className="rounded-circle bg-primary-subtle text-primary p-2 d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: '42px', height: '42px' }}>
                <i className="bi bi-clock-history fs-4"></i>
              </div>
              <div>
                <h6 className="fw-bold mb-1 text-dark">Automated Broadcast Scheduled</h6>
                <div className="small text-muted">
                  This campaign is queued to automatically start broadcasting on{' '}
                  <strong className="text-dark">
                    {campaign?.scheduled_at ? new Date(campaign.scheduled_at).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' }) : 'the configured schedule'}
                  </strong>.
                </div>
              </div>
            </div>
            <button
              onClick={handleStartCampaign}
              disabled={actionLoading}
              className="btn btn-success btn-sm d-flex align-items-center gap-1 shadow-sm px-3"
            >
              <i className="bi bi-send-fill"></i>
              <span>{actionLoading ? 'Launching...' : 'Launch Now (Skip Schedule)'}</span>
            </button>
          </div>
        )}

      {/* KPI Stats Cards */}
      <div className="row g-3 mb-4">
        {/* Total Audience */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="p-3 border rounded-3 bg-white shadow-sm h-100 d-flex flex-column justify-content-between">
            <div className="d-flex align-items-center justify-content-between text-muted small mb-2">
              <span className="fw-semibold text-uppercase" style={{ fontSize: '0.72rem', letterSpacing: '0.5px' }}>
                Total Audience
              </span>
              <div className="badge bg-secondary-subtle text-secondary rounded-pill p-1 px-2">
                <i className="bi bi-people-fill"></i>
              </div>
            </div>
            <div>
              <div className="fs-3 fw-bold text-dark">{totalRecipients}</div>
              <div className="text-muted small mt-1">100% targeted recipients</div>
            </div>
          </div>
        </div>

        {/* Dispatched / Sent */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="p-3 border rounded-3 bg-white shadow-sm h-100 d-flex flex-column justify-content-between">
            <div className="d-flex align-items-center justify-content-between text-muted small mb-2">
              <span className="fw-semibold text-uppercase" style={{ fontSize: '0.72rem', letterSpacing: '0.5px' }}>
                Dispatched / Sent
              </span>
              <div className="badge bg-primary-subtle text-primary rounded-pill p-1 px-2">
                <i className="bi bi-send-fill"></i>
              </div>
            </div>
            <div>
              <div className="fs-3 fw-bold text-primary">{sentCount}</div>
              <div className="text-muted small mt-1">
                {totalRecipients > 0 ? `${Math.round((sentCount / totalRecipients) * 100)}% dispatched` : '0%'}
              </div>
            </div>
          </div>
        </div>

        {/* Delivered Webhooks */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="p-3 border rounded-3 bg-white shadow-sm h-100 d-flex flex-column justify-content-between">
            <div className="d-flex align-items-center justify-content-between text-muted small mb-2">
              <span className="fw-semibold text-uppercase text-success" style={{ fontSize: '0.72rem', letterSpacing: '0.5px' }}>
                Delivered Webhooks
              </span>
              <div className="badge bg-success-subtle text-success rounded-pill p-1 px-2">
                <i className="bi bi-check2-all"></i>
              </div>
            </div>
            <div>
              <div className="fs-3 fw-bold text-success">{deliveredCount}</div>
              <div className="d-flex align-items-center gap-1 text-success small mt-1 fw-semibold">
                <span>{deliveryRate}% Delivery Rate</span>
              </div>
            </div>
          </div>
        </div>

        {/* Read by Customers */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="p-3 border rounded-3 bg-white shadow-sm h-100 d-flex flex-column justify-content-between">
            <div className="d-flex align-items-center justify-content-between text-muted small mb-2">
              <span className="fw-semibold text-uppercase text-warning" style={{ fontSize: '0.72rem', letterSpacing: '0.5px' }}>
                Read by Customers
              </span>
              <div className="badge bg-warning-subtle text-warning rounded-pill p-1 px-2">
                <i className="bi bi-eye-fill"></i>
              </div>
            </div>
            <div>
              <div className="fs-3 fw-bold text-warning">{readCount}</div>
              <div className="d-flex align-items-center gap-1 text-warning small mt-1 fw-semibold">
                <span>{readRate}% Open / Read Rate</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <ul className="nav nav-tabs mb-4 border-bottom">
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold px-4 py-2 ${activeTab === 'overview' ? 'active text-success border-success border-bottom-0' : 'text-muted'}`}
            onClick={() => setActiveTab('overview')}
          >
            <i className="bi bi-graph-up me-2"></i>
            Analytics & Overview
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold px-4 py-2 ${activeTab === 'recipients' ? 'active text-success border-success border-bottom-0' : 'text-muted'}`}
            onClick={() => setActiveTab('recipients')}
          >
            <i className="bi bi-people me-2"></i>
            Recipient Delivery Logs ({rawRecipients.length})
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold px-4 py-2 ${activeTab === 'template' ? 'active text-success border-success border-bottom-0' : 'text-muted'}`}
            onClick={() => setActiveTab('template')}
          >
            <i className="bi bi-chat-dots me-2"></i>
            Message Mockup & Payload
          </button>
        </li>
      </ul>

      {/* ==================================================================
          TAB 1: Analytics & Overview
          ================================================================== */}
      {activeTab === 'overview' && (
        <div className="row g-4">
          {/* Visual Charts */}
          <div className="col-12 col-lg-7">
            <div className="cf-card mb-4">
              <div className="cf-card-header d-flex justify-content-between align-items-center">
                <h5 className="mb-0 fw-bold">Delivery Funnel & Webhook Conversions</h5>
                <span className="small text-muted">Real-time status</span>
              </div>
              <div className="cf-card-body">
                <div style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer>
                    <BarChart data={barData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}
                      />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {barData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Campaign Timelines & Execution Stats */}
            <div className="cf-card">
              <div className="cf-card-header">
                <h5 className="mb-0 fw-bold">Broadcast Lifecycle & Execution</h5>
              </div>
              <div className="cf-card-body">
                <div className="row g-3">
                  <div className="col-sm-6">
                    <div className="p-3 bg-light rounded-3">
                      <div className="text-muted small">Started At</div>
                      <div className="fw-semibold text-dark mt-1">
                        {campaign?.started_at ? new Date(campaign.started_at).toLocaleString() : 'Not started yet'}
                      </div>
                    </div>
                  </div>
                  <div className="col-sm-6">
                    <div className="p-3 bg-light rounded-3">
                      <div className="text-muted small">Completed At</div>
                      <div className="fw-semibold text-dark mt-1">
                        {campaign?.completed_at ? new Date(campaign.completed_at).toLocaleString() : (campaign?.status === 'running' ? 'In Progress...' : 'N/A')}
                      </div>
                    </div>
                  </div>
                  <div className="col-sm-6">
                    <div className="p-3 bg-light rounded-3">
                      <div className="text-muted small">Failed / Undelivered</div>
                      <div className="fw-semibold text-danger mt-1">
                        {failedCount} recipients ({failureRate}%)
                      </div>
                    </div>
                  </div>
                  <div className="col-sm-6">
                    <div className="p-3 bg-light rounded-3">
                      <div className="text-muted small">WhatsApp Account Routing</div>
                      <div className="fw-semibold text-dark mt-1 text-truncate">
                        {campaign?.account_name} ({campaign?.account_phone || 'Default channel'})
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Breakdown Pie & Live Preview Preview */}
          <div className="col-12 col-lg-5">
            <div className="cf-card mb-4">
              <div className="cf-card-header">
                <h5 className="mb-0 fw-bold">Delivery Status Distribution</h5>
              </div>
              <div className="cf-card-body d-flex align-items-center justify-content-center">
                {pieData.length > 0 ? (
                  <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={95}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`pie-cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center py-5 text-muted small">
                    <i className="bi bi-clock-history fs-3 d-block mb-2 text-secondary"></i>
                    Awaiting initial delivery status webhooks from Meta WhatsApp Cloud API...
                  </div>
                )}
              </div>
            </div>

            {/* Quick Template Preview Widget */}
            <div className="cf-card">
              <div className="cf-card-header d-flex justify-content-between align-items-center">
                <h5 className="mb-0 fw-bold">WhatsApp Message Preview</h5>
                <button
                  type="button"
                  className="btn btn-sm btn-link text-success text-decoration-none p-0"
                  onClick={() => setActiveTab('template')}
                >
                  View Details <i className="bi bi-arrow-right"></i>
                </button>
              </div>
              <div className="cf-card-body bg-light text-center py-3">
                <div className="wa-preview-screen" style={{ maxWidth: '340px' }}>
                  <div className="wa-bubble text-start shadow-sm">
                    {headerComponent?.text && (
                      <div className="wa-header fw-bold text-dark mb-1">{headerComponent.text}</div>
                    )}
                    <div className="wa-body" style={{ whiteSpace: 'pre-wrap', fontSize: '0.88rem' }}>
                      {renderedTemplateBody}
                    </div>
                    {footerComponent?.text && (
                      <div className="wa-footer small text-muted mt-2 border-top pt-1">
                        {footerComponent.text}
                      </div>
                    )}
                    {buttonsComponent?.buttons?.[0]?.text && (
                      <div className="wa-button small fw-bold text-success text-center border-top mt-2 pt-2">
                        {buttonsComponent.buttons[0].text}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================
          TAB 2: Recipient Delivery Logs
          ================================================================== */}
      {activeTab === 'recipients' && (
        <div className="cf-card">
          <div className="cf-card-header d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
            <div>
              <h5 className="mb-0 fw-bold">
                Recipient Delivery Logs ({filteredRecipients.length} of {rawRecipients.length})
              </h5>
              <span className="small text-muted">
                Each message is authenticated and tracked via WhatsApp Cloud API webhooks
              </span>
            </div>

            {/* Search and Filters */}
            <div className="d-flex flex-wrap align-items-center gap-2">
              <div className="input-group input-group-sm" style={{ width: '240px' }}>
                <span className="input-group-text bg-white border-end-0">
                  <i className="bi bi-search text-muted"></i>
                </span>
                <input
                  type="text"
                  className="form-control border-start-0"
                  placeholder="Search phone or name..."
                  value={searchTerm}
                  onChange={e => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>

              <select
                className="form-select form-select-sm"
                style={{ width: '150px' }}
                value={statusFilter}
                onChange={e => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">All Statuses</option>
                <option value="read">Read</option>
                <option value="delivered">Delivered / Read</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
              </select>

              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={handleExportCSV}
                title="Export this list"
              >
                <i className="bi bi-download"></i>
              </button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table cf-table mb-0 align-middle">
              <thead>
                <tr>
                  <th>Recipient</th>
                  <th>Status</th>
                  <th>Provider Message ID</th>
                  <th>Sent At</th>
                  <th>Delivered At</th>
                  <th>Read At</th>
                  <th>Errors / Skips</th>
                  <th className="text-end">Preview</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRecipients.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-5 text-muted">
                      No recipients matching your search filter.
                    </td>
                  </tr>
                ) : (
                  paginatedRecipients.map(r => (
                    <tr key={r.id}>
                      <td>
                        <div className="fw-bold text-dark">{r.phone}</div>
                        {r.contact_name && (
                          <div className="small text-muted d-flex align-items-center gap-1">
                            <i className="bi bi-person-fill text-secondary"></i>
                            <span>{r.contact_name}</span>
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`badge-status badge-${r.status}`}>
                          {r.status?.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span
                          className="small font-monospace text-muted text-truncate d-inline-block"
                          style={{ maxWidth: '160px', fontSize: '0.72rem' }}
                          title={r.provider_message_id}
                        >
                          {r.provider_message_id || 'Pending Webhook'}
                        </span>
                      </td>
                      <td className="small text-muted">
                        {r.sent_at ? new Date(r.sent_at).toLocaleTimeString() : '-'}
                      </td>
                      <td className="small text-success">
                        {r.delivered_at ? new Date(r.delivered_at).toLocaleTimeString() : '-'}
                      </td>
                      <td className="small text-warning">
                        {r.read_at ? new Date(r.read_at).toLocaleTimeString() : '-'}
                      </td>
                      <td>
                        {r.skip_reason && <span className="badge bg-warning-subtle text-warning">{r.skip_reason}</span>}
                        {r.error_message && (
                          <span
                            className="badge bg-danger-subtle text-danger text-truncate d-inline-block"
                            style={{ maxWidth: '200px' }}
                            title={r.error_message}
                          >
                            {r.error_message}
                          </span>
                        )}
                        {!r.skip_reason && !r.error_message && <span className="text-muted small">-</span>}
                      </td>
                      <td className="text-end">
                        <button
                          type="button"
                          className={`btn btn-sm ${previewContactId === r.id ? 'btn-success' : 'btn-outline-secondary'}`}
                          onClick={() => {
                            setPreviewContactId(r.id);
                            setActiveTab('template');
                          }}
                          title="Preview personalized message for this recipient"
                        >
                          <i className="bi bi-eye"></i>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="cf-card-footer d-flex justify-content-between align-items-center p-3 border-top bg-light">
              <span className="small text-muted">
                Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredRecipients.length)} of {filteredRecipients.length} entries
              </span>
              <div className="btn-group btn-group-sm">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                >
                  Previous
                </button>
                <button type="button" className="btn btn-outline-secondary disabled">
                  Page {currentPage} of {totalPages}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================
          TAB 3: Message Mockup & Configuration
          ================================================================== */}
      {activeTab === 'template' && (
        <div className="row g-4">
          {/* Interactive WhatsApp Mockup */}
          <div className="col-12 col-lg-5">
            <div className="cf-card">
              <div className="cf-card-header d-flex justify-content-between align-items-center">
                <h5 className="mb-0 fw-bold">Live Message Mockup</h5>
                <span className="badge bg-success-subtle text-success">
                  <i className="bi bi-whatsapp me-1"></i> WhatsApp
                </span>
              </div>
              <div className="cf-card-body bg-light text-center py-4">
                <div className="mb-3 text-start small">
                  <span className="text-muted">Previewing for: </span>
                  <strong className="text-dark">
                    {activePreviewRecipient.contact_name || activePreviewRecipient.phone}
                  </strong>{' '}
                  <span className="text-muted">({activePreviewRecipient.phone})</span>
                </div>

                <div className="wa-preview-screen shadow-sm">
                  <div className="wa-bubble text-start">
                    {headerComponent?.text && (
                      <div className="wa-header fw-bold text-dark">{headerComponent.text}</div>
                    )}
                    <div className="wa-body" style={{ whiteSpace: 'pre-wrap' }}>
                      {renderedTemplateBody}
                    </div>
                    {footerComponent?.text && (
                      <div className="wa-footer">{footerComponent.text}</div>
                    )}
                    {buttonsComponent?.buttons?.[0]?.text && (
                      <div className="wa-button">{buttonsComponent.buttons[0].text}</div>
                    )}
                  </div>
                </div>

                <div className="mt-3 text-muted small">
                  <i className="bi bi-info-circle me-1"></i>
                  Variables are dynamically substituted from recipient CRM data
                </div>
              </div>
            </div>
          </div>

          {/* Configuration & Meta Payload Details */}
          <div className="col-12 col-lg-7">
            <div className="cf-card mb-4">
              <div className="cf-card-header">
                <h5 className="mb-0 fw-bold">Template & Variable Mappings</h5>
              </div>
              <div className="cf-card-body">
                <div className="table-responsive">
                  <table className="table table-sm table-bordered mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Template Parameter</th>
                        <th>Mapped Contact Field</th>
                        <th>Sample Evaluated Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(variableMappings).filter(k => k !== 'sender_account_ids').length === 0 ? (
                        <tr>
                          <td colSpan="3" className="text-muted text-center py-3">
                            No custom variables mapped for this template.
                          </td>
                        </tr>
                      ) : (
                        Object.entries(variableMappings)
                          .filter(([k]) => k !== 'sender_account_ids')
                          .map(([key, val]) => (
                            <tr key={key}>
                              <td>
                                <code>{`{{${key}}}`}</code>
                              </td>
                              <td className="fw-semibold text-primary">{String(val)}</td>
                              <td>
                                <span className="badge bg-light text-dark border">
                                  {val === 'contact.name'
                                    ? (activePreviewRecipient.contact_name || 'Ananya Gupta')
                                    : String(val)}
                                </span>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="cf-card">
              <div className="cf-card-header">
                <h5 className="mb-0 fw-bold">Meta Cloud API Parameters</h5>
              </div>
              <div className="cf-card-body">
                <div className="row g-3 small">
                  <div className="col-sm-4 text-muted">WhatsApp Account ID:</div>
                  <div className="col-sm-8 fw-bold">#{campaign?.whatsapp_account_id} ({campaign?.account_name})</div>

                  <div className="col-sm-4 text-muted">Meta Template Name:</div>
                  <div className="col-sm-8"><code>{campaign?.template_name}</code></div>

                  <div className="col-sm-4 text-muted">Raw Configuration:</div>
                  <div className="col-sm-8">
                    <pre className="bg-light p-2 rounded small mb-0 font-monospace" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                      {typeof campaign?.variable_mappings === 'string'
                        ? campaign.variable_mappings
                        : JSON.stringify(campaign?.variable_mappings, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>

      <ResendCampaignModal
        isOpen={showResendModal}
        campaign={campaign}
        onClose={() => setShowResendModal(false)}
        onSuccess={handleResendSuccess}
      />
    </div>
  );
}

