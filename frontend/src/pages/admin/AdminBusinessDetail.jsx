import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import '../../styles/adminTenantDetail.css';
import '../../styles/adminDashboard.css';

export default function AdminBusinessDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'numbers' | 'billing' | 'team' | 'logs'
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Modal States
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    timezone: 'Asia/Kolkata',
    status: 'active',
    allowedNumbersInput: ''
  });
  const [updatingBiz, setUpdatingBiz] = useState(false);

  const [showPlanModal, setShowPlanModal] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [updatingPlan, setUpdatingPlan] = useState(false);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPass, setResettingPass] = useState(false);

  const fetchTenantDetail = async () => {
    try {
      setLoading(true);
      const [resDetail, resPlans] = await Promise.all([
        api.get(`/admin/businesses/${id}`),
        api.get('/admin/billing/plans').catch(() => ({ data: { data: [] } }))
      ]);

      if (resDetail.data?.success) {
        setData(resDetail.data.data);
        const b = resDetail.data.data.business;
        setEditForm({
          name: b.name || '',
          timezone: b.timezone || 'Asia/Kolkata',
          status: b.status || 'active',
          allowedNumbersInput: Array.isArray(b.allowed_phone_numbers) ? b.allowed_phone_numbers.join(', ') : ''
        });
      }
      if (resPlans.data?.success) {
        setPlans(resPlans.data.data);
      }
    } catch (err) {
      console.error('Failed to load business details:', err);
      setFeedback({
        type: 'danger',
        text: err.response?.data?.message || 'Failed to load business governance details.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchTenantDetail();
    }
  }, [id]);

  // Governance Actions
  const handleToggleStatus = async () => {
    if (!data?.business) return;
    const current = data.business.status;
    const target = current === 'active' ? 'suspended' : 'active';
    if (!window.confirm(`Are you sure you want to change status of "${data.business.name}" to "${target.toUpperCase()}"?`)) {
      return;
    }

    try {
      await api.patch(`/admin/businesses/${id}/status`, { status: target });
      setFeedback({
        type: 'success',
        text: `Business status successfully updated to ${target.toUpperCase()}`
      });
      await fetchTenantDetail();
    } catch (err) {
      setFeedback({
        type: 'danger',
        text: err.response?.data?.message || 'Failed to update business status.'
      });
    }
  };

  const handleSaveGovernance = async (e) => {
    e.preventDefault();
    setUpdatingBiz(true);
    setFeedback({ type: '', text: '' });
    try {
      const allowedArr = editForm.allowedNumbersInput
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      await api.patch(`/admin/businesses/${id}`, {
        name: editForm.name,
        timezone: editForm.timezone,
        status: editForm.status,
        allowed_phone_numbers: allowedArr
      });

      setFeedback({
        type: 'success',
        text: 'Business governance profile updated successfully!'
      });
      setShowEditModal(false);
      await fetchTenantDetail();
    } catch (err) {
      setFeedback({
        type: 'danger',
        text: err.response?.data?.message || 'Failed to update business profile.'
      });
    } finally {
      setUpdatingBiz(false);
    }
  };

  const handleChangePlan = async (e) => {
    e.preventDefault();
    if (!selectedPlanId) return;
    setUpdatingPlan(true);
    setFeedback({ type: '', text: '' });
    try {
      await api.patch(`/admin/billing/tenants/${id}/plan`, {
        plan_id: Number(selectedPlanId)
      });
      setFeedback({
        type: 'success',
        text: 'Subscription plan updated successfully for this tenant!'
      });
      setShowPlanModal(false);
      await fetchTenantDetail();
    } catch (err) {
      setFeedback({
        type: 'danger',
        text: err.response?.data?.message || 'Failed to update tenant subscription plan.'
      });
    } finally {
      setUpdatingPlan(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setFeedback({ type: 'danger', text: 'Password must be at least 6 characters.' });
      return;
    }
    setResettingPass(true);
    setFeedback({ type: '', text: '' });
    try {
      const res = await api.post(`/admin/businesses/${id}/reset-owner-password`, {
        password: newPassword
      });
      setFeedback({
        type: 'success',
        text: res.data?.message || 'Owner password reset successfully!'
      });
      setShowPasswordModal(false);
      setNewPassword('');
    } catch (err) {
      setFeedback({
        type: 'danger',
        text: err.response?.data?.message || 'Failed to reset owner password.'
      });
    } finally {
      setResettingPass(false);
    }
  };

  const handleToggleAccountAdminStatus = async (accId, currentStatus) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'DEACTIVE' : 'ACTIVE';
    try {
      await api.patch(`/admin/whatsapp-accounts/${accId}/admin-status`, {
        adminStatus: nextStatus
      });
      setFeedback({
        type: 'success',
        text: `WhatsApp number status changed to ${nextStatus}`
      });
      await fetchTenantDetail();
    } catch (err) {
      setFeedback({
        type: 'danger',
        text: 'Failed to update WhatsApp account status'
      });
    }
  };

  if (loading) {
    return (
      <div className="tenant-detail-wrapper d-flex align-items-center justify-content-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading Tenant Governance...</span>
        </div>
      </div>
    );
  }

  if (!data?.business) {
    return (
      <div className="tenant-detail-wrapper">
        <div className="alert alert-danger shadow-sm">
          <h5>Business Tenant Not Found</h5>
          <p className="mb-0">The requested business tenant ID does not exist or has been removed.</p>
          <button className="btn btn-outline-danger btn-sm mt-3" onClick={() => navigate('/admin/tenants')}>
            ← Back to Businesses & Owners
          </button>
        </div>
      </div>
    );
  }

  const { business, owner, users, subscription, whatsappAccounts, metrics, auditLogs } = data;
  const isSuspended = business.status === 'suspended';

  // Quota Calculations
  const maxMsgs = Number(subscription?.max_messages_per_month || 10000);
  const sentMsgs = Number(metrics?.totalMessagesSent || 0);
  const msgPercent = maxMsgs > 0 ? Math.min(100, Math.round((sentMsgs / maxMsgs) * 100)) : 0;

  const maxContacts = Number(subscription?.max_contacts || 2500);
  const totalContacts = Number(metrics?.contactsCount || 0);
  const contactPercent = maxContacts > 0 ? Math.min(100, Math.round((totalContacts / maxContacts) * 100)) : 0;

  const maxMembers = Number(subscription?.max_team_members || 5);
  const totalMembers = Number(users?.length || 1);
  const memberPercent = maxMembers > 0 ? Math.min(100, Math.round((totalMembers / maxMembers) * 100)) : 0;

  return (
    <div className="tenant-detail-wrapper">
      {/* Sticky Header with Breadcrumb & Actions */}
      <header className="tenant-detail-header">
        <div className="tenant-breadcrumb-bar">
          <span className="tenant-breadcrumb-link" onClick={() => navigate('/admin/tenants')}>
            <i className="bi bi-chevron-left"></i>
            <span>Businesses & Owners</span>
          </span>
          <span>/</span>
          <span className="text-dark fw-semibold">{business.name}</span>
        </div>

        <div className="tenant-header-main">
          <div className="tenant-header-title-box">
            <h1 className="tenant-title">{business.name}</h1>
            <span className="tenant-slug-badge">ID #{business.id} • {business.slug}</span>
            <span className={`tenant-status-badge ${isSuspended ? 'tenant-status-badge-suspended' : 'tenant-status-badge-active'}`}>
              <i className={`bi ${isSuspended ? 'bi-x-circle-fill' : 'bi-check-circle-fill'}`}></i>
              {business.status}
            </span>
            <span className="tenant-plan-pill">
              <i className="bi bi-award-fill me-1"></i>
              {subscription?.plan_name || 'Free Trial'}
            </span>
          </div>

          <div className="tenant-header-actions">
            <button
              className="tenant-btn tenant-btn-secondary"
              onClick={() => setShowEditModal(true)}
              title="Edit Profile & Allowed Numbers"
            >
              <i className="bi bi-pencil-square"></i>
              <span>Edit Profile</span>
            </button>

            <button
              className="tenant-btn tenant-btn-secondary"
              onClick={() => {
                setSelectedPlanId(subscription?.plan_id || '');
                setShowPlanModal(true);
              }}
              title="Change Plan Tier"
            >
              <i className="bi bi-arrow-left-right"></i>
              <span>Change Plan</span>
            </button>

            <button
              className="tenant-btn tenant-btn-secondary"
              onClick={() => setShowPasswordModal(true)}
              title="Reset Owner Password"
            >
              <i className="bi bi-key-fill text-warning"></i>
              <span>Reset Owner Pass</span>
            </button>

            <button
              className={`tenant-btn ${isSuspended ? 'tenant-btn-success' : 'tenant-btn-danger'}`}
              onClick={handleToggleStatus}
              title={isSuspended ? 'Activate Business Access' : 'Suspend All Business Operations'}
            >
              <i className={`bi ${isSuspended ? 'bi-play-circle-fill' : 'bi-pause-circle-fill'}`}></i>
              <span>{isSuspended ? 'Activate Business' : 'Suspend Business'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Alert Feedback */}
      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show mb-4 shadow-sm admin-feedback-banner`} role="alert">
          {feedback.text}
          <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      {/* Top 6 KPI Metric Summary Row (Strict Single Line) */}
      <section className="tenant-kpi-grid">
        {/* KPI 1: WhatsApp Channels */}
        <div className="tenant-kpi-card">
          <div className="tenant-kpi-icon admin-kpi-icon-blue">
            <i className="bi bi-telephone-fill"></i>
          </div>
          <div className="tenant-kpi-info">
            <span className="tenant-kpi-label">WhatsApp Numbers</span>
            <span className="tenant-kpi-value">{whatsappAccounts.length}</span>
            <span className="tenant-kpi-sub">
              {whatsappAccounts.filter(a => a.admin_status === 'ACTIVE').length} Active / {whatsappAccounts.length} Total
            </span>
          </div>
        </div>

        {/* KPI 2: Messages Quota */}
        <div className="tenant-kpi-card">
          <div className="tenant-kpi-icon admin-kpi-icon-purple">
            <i className="bi bi-send-fill"></i>
          </div>
          <div className="tenant-kpi-info">
            <span className="tenant-kpi-label">Monthly Messages</span>
            <span className="tenant-kpi-value">{sentMsgs.toLocaleString()}</span>
            <span className="tenant-kpi-sub">
              Limit: {maxMsgs.toLocaleString()} ({msgPercent}%)
            </span>
          </div>
        </div>

        {/* KPI 3: Audience Contacts */}
        <div className="tenant-kpi-card">
          <div className="tenant-kpi-icon admin-kpi-icon-green">
            <i className="bi bi-person-lines-fill"></i>
          </div>
          <div className="tenant-kpi-info">
            <span className="tenant-kpi-label">Audience Contacts</span>
            <span className="tenant-kpi-value">{totalContacts.toLocaleString()}</span>
            <span className="tenant-kpi-sub">
              Limit: {maxContacts.toLocaleString()} ({contactPercent}%)
            </span>
          </div>
        </div>

        {/* KPI 4: Team Members */}
        <div className="tenant-kpi-card">
          <div className="tenant-kpi-icon admin-kpi-icon-mint">
            <i className="bi bi-people-fill"></i>
          </div>
          <div className="tenant-kpi-info">
            <span className="tenant-kpi-label">Team Members</span>
            <span className="tenant-kpi-value">{totalMembers}</span>
            <span className="tenant-kpi-sub">
              Limit: {maxMembers} Seats ({memberPercent}%)
            </span>
          </div>
        </div>

        {/* KPI 5: Monthly Revenue */}
        <div className="tenant-kpi-card">
          <div className="tenant-kpi-icon admin-kpi-icon-amber">
            <i className="bi bi-coin"></i>
          </div>
          <div className="tenant-kpi-info">
            <span className="tenant-kpi-label">Monthly Billing</span>
            <span className="tenant-kpi-value">${Number(subscription?.monthly_price || 0).toFixed(2)}</span>
            <span className="tenant-kpi-sub">
              Status: {subscription?.status || 'active'}
            </span>
          </div>
        </div>

        {/* KPI 6: Campaigns Launched */}
        <div className="tenant-kpi-card">
          <div className="tenant-kpi-icon admin-kpi-icon-violet">
            <i className="bi bi-megaphone-fill"></i>
          </div>
          <div className="tenant-kpi-info">
            <span className="tenant-kpi-label">Campaigns Total</span>
            <span className="tenant-kpi-value">{metrics.campaignsCount}</span>
            <span className="tenant-kpi-sub">
              Delivered: {metrics.totalMessagesDelivered} msgs
            </span>
          </div>
        </div>
      </section>

      {/* Governance Tabs Bar */}
      <nav className="tenant-tabs-bar">
        <button
          className={`tenant-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <i className="bi bi-speedometer2"></i>
          <span>Overview & Quotas</span>
        </button>

        <button
          className={`tenant-tab-btn ${activeTab === 'numbers' ? 'active' : ''}`}
          onClick={() => setActiveTab('numbers')}
        >
          <i className="bi bi-whatsapp"></i>
          <span>WhatsApp Phone Numbers</span>
          <span className="tenant-tab-count">{whatsappAccounts.length}</span>
        </button>

        <button
          className={`tenant-tab-btn ${activeTab === 'billing' ? 'active' : ''}`}
          onClick={() => setActiveTab('billing')}
        >
          <i className="bi bi-credit-card-2-front"></i>
          <span>Subscription & Billing</span>
        </button>

        <button
          className={`tenant-tab-btn ${activeTab === 'team' ? 'active' : ''}`}
          onClick={() => setActiveTab('team')}
        >
          <i className="bi bi-people"></i>
          <span>Team & Users</span>
          <span className="tenant-tab-count">{users.length}</span>
        </button>

        <button
          className={`tenant-tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          <i className="bi bi-shield-check"></i>
          <span>Business Audit Logs</span>
          <span className="tenant-tab-count">{auditLogs.length}</span>
        </button>
      </nav>

      {/* Tab 1: Overview & Quotas */}
      {activeTab === 'overview' && (
        <div className="row g-4">
          {/* Left Column: Business Identity & Primary Owner */}
          <div className="col-12 col-lg-7">
            <div className="tenant-card">
              <div className="tenant-card-header">
                <h2 className="tenant-card-title">
                  <i className="bi bi-building-check admin-icon-purple"></i>
                  <span>Business Identity & Platform Information</span>
                </h2>
              </div>

              <div className="tenant-info-grid mb-4">
                <div className="tenant-info-item">
                  <span className="tenant-info-label">Business Name</span>
                  <span className="tenant-info-value">{business.name}</span>
                </div>
                <div className="tenant-info-item">
                  <span className="tenant-info-label">Business Slug / Identifier</span>
                  <span className="tenant-info-value font-monospace">{business.slug}</span>
                </div>
                <div className="tenant-info-item">
                  <span className="tenant-info-label">Database ID</span>
                  <span className="tenant-info-value">#{business.id}</span>
                </div>
                <div className="tenant-info-item">
                  <span className="tenant-info-label">Timezone</span>
                  <span className="tenant-info-value">{business.timezone || 'Asia/Kolkata'}</span>
                </div>
                <div className="tenant-info-item">
                  <span className="tenant-info-label">Business Status</span>
                  <span className="tenant-info-value">
                    <span className={`tenant-status-badge ${isSuspended ? 'tenant-status-badge-suspended' : 'tenant-status-badge-active'}`}>
                      {business.status}
                    </span>
                  </span>
                </div>
                <div className="tenant-info-item">
                  <span className="tenant-info-label">Registration Date</span>
                  <span className="tenant-info-value">{new Date(business.created_at).toLocaleString()}</span>
                </div>
              </div>

              {/* Owner Profile Box */}
              <div className="p-3 bg-light rounded-3 border">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <div className="d-flex align-items-center gap-2">
                    <i className="bi bi-person-badge-fill text-primary fs-5"></i>
                    <div>
                      <div className="fw-semibold text-dark">Business Owner Account</div>
                      <small className="text-muted">Primary administrator with business management privileges</small>
                    </div>
                  </div>
                  <button
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => setShowPasswordModal(true)}
                  >
                    Reset Password
                  </button>
                </div>
                <div className="row g-3 mt-1">
                  <div className="col-sm-6">
                    <span className="text-muted small d-block">Owner Full Name</span>
                    <span className="fw-medium text-dark">{owner?.name || 'N/A'}</span>
                  </div>
                  <div className="col-sm-6">
                    <span className="text-muted small d-block">Owner Login Email</span>
                    <span className="fw-medium text-dark">{owner?.email || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Pre-Approved / Allowed Numbers */}
              <div className="mt-4">
                <span className="tenant-info-label d-block mb-2">Allowed / Pre-Approved Phone Numbers</span>
                {(!business.allowed_phone_numbers || business.allowed_phone_numbers.length === 0) ? (
                  <span className="text-muted small">No specific number restriction configured (Any verified number allowed).</span>
                ) : (
                  <div className="d-flex flex-wrap gap-2">
                    {business.allowed_phone_numbers.map((num, idx) => (
                      <span key={idx} className="tenant-number-pill">
                        <i className="bi bi-shield-lock-fill text-success"></i>
                        <span>{num}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Quota Utilization & Governance Limits */}
          <div className="col-12 col-lg-5">
            <div className="tenant-card">
              <div className="tenant-card-header">
                <h2 className="tenant-card-title">
                  <i className="bi bi-pie-chart-fill admin-icon-purple"></i>
                  <span>Resource Quotas & Limits</span>
                </h2>
              </div>

              <div className="tenant-quota-list">
                {/* Quota 1: Monthly Messages */}
                <div className="tenant-quota-item">
                  <div className="tenant-quota-header">
                    <span className="tenant-quota-name">Monthly Outbound Messages</span>
                    <span className="tenant-quota-stat">{sentMsgs.toLocaleString()} / {maxMsgs.toLocaleString()}</span>
                  </div>
                  <div className="tenant-quota-track">
                    <div
                      className={`tenant-quota-fill ${msgPercent > 80 ? 'tenant-fill-amber' : 'tenant-fill-purple'}`}
                      style={{ width: `${msgPercent}%` }}
                    />
                  </div>
                  <small className="text-muted">{maxMsgs - sentMsgs} messages available this billing cycle</small>
                </div>

                {/* Quota 2: Audience Contacts */}
                <div className="tenant-quota-item">
                  <div className="tenant-quota-header">
                    <span className="tenant-quota-name">Contact Database Limit</span>
                    <span className="tenant-quota-stat">{totalContacts.toLocaleString()} / {maxContacts.toLocaleString()}</span>
                  </div>
                  <div className="tenant-quota-track">
                    <div
                      className={`tenant-quota-fill ${contactPercent > 80 ? 'tenant-fill-amber' : 'tenant-fill-green'}`}
                      style={{ width: `${contactPercent}%` }}
                    />
                  </div>
                  <small className="text-muted">{maxContacts - totalContacts} contacts remaining</small>
                </div>

                {/* Quota 3: Team Seats */}
                <div className="tenant-quota-item">
                  <div className="tenant-quota-header">
                    <span className="tenant-quota-name">Team Member Seats</span>
                    <span className="tenant-quota-stat">{totalMembers} / {maxMembers}</span>
                  </div>
                  <div className="tenant-quota-track">
                    <div
                      className={`tenant-quota-fill ${memberPercent > 80 ? 'tenant-fill-amber' : 'tenant-fill-blue'}`}
                      style={{ width: `${memberPercent}%` }}
                    />
                  </div>
                  <small className="text-muted">{maxMembers - totalMembers} available user seats</small>
                </div>

                {/* Quota 4: WhatsApp Number Slots */}
                <div className="tenant-quota-item">
                  <div className="tenant-quota-header">
                    <span className="tenant-quota-name">Allotted WhatsApp Channels</span>
                    <span className="tenant-quota-stat">{whatsappAccounts.length} Allotted</span>
                  </div>
                  <div className="tenant-quota-track">
                    <div className="tenant-quota-fill tenant-fill-green tenant-fill-full" />
                  </div>
                  <small className="text-muted">{whatsappAccounts.filter(a => a.admin_status === 'ACTIVE').length} currently active and ready</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: WhatsApp Phone Numbers */}
      {activeTab === 'numbers' && (
        <div className="tenant-card">
          <div className="tenant-card-header">
            <h2 className="tenant-card-title">
              <i className="bi bi-whatsapp text-success"></i>
              <span>Allotted WhatsApp Business Accounts ({whatsappAccounts.length})</span>
            </h2>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate('/admin/numbers')}
            >
              <i className="bi bi-plus-circle-fill me-1"></i>
              Manage Numbers Matrix
            </button>
          </div>

          <div className="table-responsive">
            <table className="tenant-table">
              <thead>
                <tr>
                  <th>Phone Number</th>
                  <th>Display Name</th>
                  <th>Verified Name</th>
                  <th>Quality Rating</th>
                  <th>Limit Tier</th>
                  <th>Admin Status</th>
                  <th>Channel Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {whatsappAccounts.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-5 text-muted">
                      No WhatsApp phone numbers are currently allotted to this business tenant.
                    </td>
                  </tr>
                ) : (
                  whatsappAccounts.map(acc => (
                    <tr key={acc.id}>
                      <td>
                        <div className="fw-semibold text-dark">{acc.phone_number || 'N/A'}</div>
                        {acc.is_primary === 1 && (
                          <span className="badge bg-primary-subtle text-primary tenant-primary-badge">
                            PRIMARY CHANNEL
                          </span>
                        )}
                      </td>
                      <td className="fw-medium text-dark">{acc.display_name || 'N/A'}</td>
                      <td className="text-muted small">{acc.verified_name || 'N/A'}</td>
                      <td>
                        <span className="badge bg-success-subtle text-success">
                          {acc.quality_rating || 'GREEN'}
                        </span>
                      </td>
                      <td className="small text-muted">{acc.messaging_limit_tier || 'TIER_250'}</td>
                      <td>
                        <span className={`badge ${acc.admin_status === 'ACTIVE' ? 'bg-success' : 'bg-secondary'}`}>
                          {acc.admin_status || 'ACTIVE'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge-status badge-${acc.status === 'connected' ? 'active' : 'suspended'}`}>
                          {acc.status || 'connected'}
                        </span>
                      </td>
                      <td className="text-end">
                        <button
                          className={`btn btn-sm ${acc.admin_status === 'ACTIVE' ? 'btn-outline-danger' : 'btn-outline-success'}`}
                          onClick={() => handleToggleAccountAdminStatus(acc.id, acc.admin_status)}
                        >
                          {acc.admin_status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Subscription & Billing */}
      {activeTab === 'billing' && (
        <div className="row g-4">
          <div className="col-12 col-lg-6">
            <div className="tenant-card">
              <div className="tenant-card-header">
                <h2 className="tenant-card-title">
                  <i className="bi bi-award-fill admin-icon-purple"></i>
                  <span>Active Subscription Plan</span>
                </h2>
                <button
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => {
                    setSelectedPlanId(subscription?.plan_id || '');
                    setShowPlanModal(true);
                  }}
                >
                  Change Plan
                </button>
              </div>

              <div className="tenant-info-grid mb-4">
                <div className="tenant-info-item">
                  <span className="tenant-info-label">Plan Name</span>
                  <span className="tenant-info-value fs-5 fw-semibold text-primary">
                    {subscription?.plan_name || 'Free Trial'}
                  </span>
                </div>
                <div className="tenant-info-item">
                  <span className="tenant-info-label">Monthly Price</span>
                  <span className="tenant-info-value fs-5 fw-semibold text-dark">
                    ${Number(subscription?.monthly_price || 0).toFixed(2)} / month
                  </span>
                </div>
                <div className="tenant-info-item">
                  <span className="tenant-info-label">Subscription Status</span>
                  <span className="tenant-info-value">
                    <span className="tenant-status-badge tenant-status-badge-active">
                      {subscription?.status || 'active'}
                    </span>
                  </span>
                </div>
                <div className="tenant-info-item">
                  <span className="tenant-info-label">Renewal Date</span>
                  <span className="tenant-info-value">
                    {subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : 'Continuous'}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-light rounded-3 border">
                <div className="fw-semibold text-dark mb-2">Entitled Tier Features:</div>
                <div className="row g-2 small text-muted">
                  <div className="col-sm-6">
                    <i className="bi bi-check-circle-fill text-success me-1"></i>
                    Max Outbound: {maxMsgs.toLocaleString()} msgs/mo
                  </div>
                  <div className="col-sm-6">
                    <i className="bi bi-check-circle-fill text-success me-1"></i>
                    Max Contacts: {maxContacts.toLocaleString()} contacts
                  </div>
                  <div className="col-sm-6">
                    <i className="bi bi-check-circle-fill text-success me-1"></i>
                    Max Team: {maxMembers} seats
                  </div>
                  <div className="col-sm-6">
                    <i className="bi bi-check-circle-fill text-success me-1"></i>
                    Multi-Agent Inbox & Automation
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-6">
            <div className="tenant-card">
              <div className="tenant-card-header">
                <h2 className="tenant-card-title">
                  <i className="bi bi-receipt admin-icon-purple"></i>
                  <span>Platform Plan Matrix Quick Reference</span>
                </h2>
              </div>

              <div className="table-responsive">
                <table className="tenant-table">
                  <thead>
                    <tr>
                      <th>Plan</th>
                      <th>Price</th>
                      <th>Messages</th>
                      <th>Contacts</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map(p => (
                      <tr key={p.id}>
                        <td className="fw-semibold text-dark">{p.name}</td>
                        <td className="fw-bold">${Number(p.monthly_price).toFixed(2)}</td>
                        <td className="small text-muted">{Number(p.max_messages_per_month).toLocaleString()}</td>
                        <td className="small text-muted">{Number(p.max_contacts).toLocaleString()}</td>
                        <td>
                          {subscription?.plan_id === p.id ? (
                            <span className="badge bg-success-subtle text-success">Current</span>
                          ) : (
                            <button
                              className="btn btn-outline-secondary btn-sm"
                              onClick={() => {
                                setSelectedPlanId(p.id);
                                setShowPlanModal(true);
                              }}
                            >
                              Select
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Team & Users */}
      {activeTab === 'team' && (
        <div className="tenant-card">
          <div className="tenant-card-header">
            <h2 className="tenant-card-title">
              <i className="bi bi-people-fill admin-icon-purple"></i>
              <span>Registered Business Users ({users.length})</span>
            </h2>
          </div>

          <div className="table-responsive">
            <table className="tenant-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Joined Date</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="fw-semibold text-dark">{u.name}</div>
                    </td>
                    <td className="text-dark">{u.email}</td>
                    <td>
                      <span className={`badge ${u.role === 'owner' ? 'bg-primary' : u.role === 'admin' ? 'bg-info text-dark' : 'bg-light text-dark border'}`}>
                        {u.role ? u.role.toUpperCase() : 'USER'}
                      </span>
                    </td>
                    <td className="text-muted small">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Business Audit Logs */}
      {activeTab === 'logs' && (
        <div className="tenant-card">
          <div className="tenant-card-header">
            <h2 className="tenant-card-title">
              <i className="bi bi-shield-check admin-icon-purple"></i>
              <span>Business Security & Audit Logs ({auditLogs.length})</span>
            </h2>
          </div>

          <div className="table-responsive">
            <table className="tenant-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Actor / User</th>
                  <th>IP Address</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-5 text-muted">
                      No audit logs recorded for this business yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map(log => (
                    <tr key={log.id}>
                      <td>
                        <span className="badge bg-light text-primary border font-monospace">
                          {log.action}
                        </span>
                      </td>
                      <td>
                        <div className="small fw-medium text-dark">{log.user_name || 'System / Automated'}</div>
                        <div className="small text-muted">{log.user_email || 'internal'}</div>
                      </td>
                      <td className="small text-muted font-monospace">{log.ip_address || '—'}</td>
                      <td className="small text-muted">{new Date(log.created_at).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal 1: Edit Business Profile & Allowed Numbers */}
      {showEditModal && (
        <div className="tenant-modal-backdrop">
          <div className="tenant-modal-box">
            <div className="tenant-modal-header">
              <h5 className="tenant-modal-title">Edit Business Profile & Settings</h5>
              <button
                type="button"
                className="btn-close"
                disabled={updatingBiz}
                onClick={() => setShowEditModal(false)}
              ></button>
            </div>
            <form onSubmit={handleSaveGovernance}>
              <div className="tenant-modal-body">
                <div className="mb-3">
                  <label className="form-label small fw-semibold text-muted">Business / Company Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    required
                    disabled={updatingBiz}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-semibold text-muted">Timezone</label>
                  <select
                    className="form-select"
                    value={editForm.timezone}
                    onChange={(e) => setEditForm({ ...editForm, timezone: e.target.value })}
                    disabled={updatingBiz}
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST +4:00)</option>
                    <option value="Europe/London">Europe/London (GMT/BST)</option>
                    <option value="America/New_York">America/New_York (EST/EDT)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-semibold text-muted">Business Status</label>
                  <select
                    className="form-select"
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    disabled={updatingBiz}
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-semibold text-muted">
                    Allowed / Pre-Approved Phone Numbers (Comma Separated)
                  </label>
                  <input
                    type="text"
                    className="form-control font-monospace"
                    placeholder="e.g. +91 70814 99089, +91 86014 67210"
                    value={editForm.allowedNumbersInput}
                    onChange={(e) => setEditForm({ ...editForm, allowedNumbersInput: e.target.value })}
                    disabled={updatingBiz}
                  />
                  <small className="text-muted">Numbers authorized for this business</small>
                </div>
              </div>

              <div className="tenant-modal-footer">
                <button
                  type="button"
                  className="tenant-btn tenant-btn-secondary"
                  disabled={updatingBiz}
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="tenant-btn tenant-btn-primary"
                  disabled={updatingBiz}
                >
                  {updatingBiz ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Change Subscription Plan */}
      {showPlanModal && (
        <div className="tenant-modal-backdrop">
          <div className="tenant-modal-box">
            <div className="tenant-modal-header">
              <h5 className="tenant-modal-title">Change Business Subscription Plan</h5>
              <button
                type="button"
                className="btn-close"
                disabled={updatingPlan}
                onClick={() => setShowPlanModal(false)}
              ></button>
            </div>
            <form onSubmit={handleChangePlan}>
              <div className="tenant-modal-body">
                <p className="text-muted small mb-3">
                  Switch <strong>{business.name}</strong> to a different plan tier. Quotas and limits will be applied immediately.
                </p>

                <div className="mb-3">
                  <label className="form-label small fw-semibold text-muted">Select Plan</label>
                  <select
                    className="form-select"
                    value={selectedPlanId}
                    onChange={(e) => setSelectedPlanId(e.target.value)}
                    required
                    disabled={updatingPlan}
                  >
                    <option value="">-- Choose Subscription Plan --</option>
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} — ${Number(p.monthly_price).toFixed(2)}/mo ({Number(p.max_messages_per_month).toLocaleString()} msgs)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="tenant-modal-footer">
                <button
                  type="button"
                  className="tenant-btn tenant-btn-secondary"
                  disabled={updatingPlan}
                  onClick={() => setShowPlanModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="tenant-btn tenant-btn-primary"
                  disabled={updatingPlan || !selectedPlanId}
                >
                  {updatingPlan ? 'Updating...' : 'Update Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Reset Owner Password */}
      {showPasswordModal && (
        <div className="tenant-modal-backdrop">
          <div className="tenant-modal-box">
            <div className="tenant-modal-header">
              <h5 className="tenant-modal-title">Reset Business Owner Password</h5>
              <button
                type="button"
                className="btn-close"
                disabled={resettingPass}
                onClick={() => setShowPasswordModal(false)}
              ></button>
            </div>
            <form onSubmit={handleResetPassword}>
              <div className="tenant-modal-body">
                <div className="p-3 bg-light rounded-3 mb-3 border">
                  <div className="small text-muted">Business: <strong>{business.name}</strong></div>
                  <div className="small text-muted">Owner Email: <strong>{owner?.email || 'N/A'}</strong></div>
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-semibold text-muted">New Password</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter at least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={resettingPass}
                  />
                  <div className="d-flex justify-content-end mt-1">
                    <button
                      type="button"
                      className="btn btn-link btn-sm p-0 text-decoration-none"
                      onClick={() => {
                        const gen = 'Pass@' + Math.random().toString(36).slice(-6) + '!';
                        setNewPassword(gen);
                      }}
                    >
                      Generate Strong Password
                    </button>
                  </div>
                </div>
              </div>

              <div className="tenant-modal-footer">
                <button
                  type="button"
                  className="tenant-btn tenant-btn-secondary"
                  disabled={resettingPass}
                  onClick={() => setShowPasswordModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="tenant-btn tenant-btn-primary"
                  disabled={resettingPass || !newPassword}
                >
                  {resettingPass ? 'Resetting...' : 'Set New Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
