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

const PIE_COLORS = {
  Read: '#198754',      // WhatsApp Green
  Delivered: '#25D366', // Light WhatsApp Green
  Sent: '#0d6efd',      // Primary Blue
  Failed: '#dc3545',    // Red
  Pending: '#6c757d'    // Gray
};

export default function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    status: 'active',
    tagInput: ''
  });

  // Consent Modal state
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentAction, setConsentAction] = useState(true); // true = opt-in, false = opt-out
  const [consentReason, setConsentReason] = useState('');

  // Active Tab: 'overview' | 'campaigns' | 'consent'
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchContactDetails();
  }, [id]);

  const showToast = (type, text) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const fetchContactDetails = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/contacts/${id}`);
      if (res.data?.success) {
        setData(res.data.data);
        const c = res.data.data.contact;
        setFormData({
          name: c.name || '',
          email: c.email || '',
          phone: c.phone || '',
          status: c.status || 'active',
          tagInput: (c.tags || []).map(t => t.name).join(', ')
        });
        setError('');
      }
    } catch (err) {
      console.error('[ContactDetail] fetch error:', err);
      setError(err.response?.data?.message || 'Failed to load contact profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateContact = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const tagsArray = formData.tagInput
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      const res = await api.put(`/contacts/${id}`, {
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim(),
        status: formData.status,
        tags: tagsArray
      });

      if (res.data?.success) {
        showToast('success', 'Contact profile updated successfully!');
        setIsEditing(false);
        fetchContactDetails();
      }
    } catch (err) {
      showToast('danger', err.response?.data?.message || 'Failed to update contact.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleConsent = async () => {
    try {
      setActionLoading(true);
      const res = await api.patch(`/contacts/${id}/consent`, {
        optedIn: consentAction,
        reason: consentReason.trim() || (consentAction ? 'Opt-in confirmed by staff' : 'Customer requested unsubscribe')
      });

      if (res.data?.success) {
        showToast('success', `Consent updated: ${consentAction ? 'Subscribed / Opted In' : 'Opted Out'}`);
        setShowConsentModal(false);
        setConsentReason('');
        fetchContactDetails();
      }
    } catch (err) {
      showToast('danger', err.response?.data?.message || 'Failed to update consent status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteContact = async () => {
    if (!window.confirm(`Permanently delete ${data?.contact?.name || 'this contact'}? This cannot be undone.`)) return;
    try {
      setActionLoading(true);
      await api.delete(`/contacts/${id}`);
      showToast('success', 'Contact deleted successfully.');
      navigate('/contacts');
    } catch (err) {
      showToast('danger', err.response?.data?.message || 'Failed to delete contact.');
      setActionLoading(false);
    }
  };

  const contact = data?.contact;
  const consents = data?.consents || [];
  const campaignHistory = data?.campaignHistory || [];
  const conversationId = data?.conversationId;

  // Avatar helper
  const getAvatarLetter = (name) => {
    const clean = String(name || '').trim();
    const match = clean.match(/[a-zA-Z]/);
    if (match) return match[0].toUpperCase();
    return <i className="bi bi-person-fill"></i>;
  };

  // -------------------------------------------------------------
  // Analytics & Graph Calculations
  // -------------------------------------------------------------
  const totalBroadcasts = campaignHistory.length;
  const readCount = campaignHistory.filter(c => c.status === 'read').length;
  const deliveredOnlyCount = campaignHistory.filter(c => c.status === 'delivered').length;
  const sentOnlyCount = campaignHistory.filter(c => c.status === 'sent').length;
  const failedCount = campaignHistory.filter(c => c.status === 'failed').length;

  // Donut Pie Chart Data
  const pieData = useMemo(() => {
    const list = [
      { name: 'Read', value: readCount, color: PIE_COLORS.Read },
      { name: 'Delivered', value: deliveredOnlyCount, color: PIE_COLORS.Delivered },
      { name: 'Sent (In Transit)', value: sentOnlyCount, color: PIE_COLORS.Sent },
      { name: 'Failed', value: failedCount, color: PIE_COLORS.Failed }
    ].filter(d => d.value > 0);
    return list;
  }, [readCount, deliveredOnlyCount, sentOnlyCount, failedCount]);

  // Bar Chart Data (Engagement Funnel)
  const barData = useMemo(() => {
    return [
      { name: 'Total Dispatched', count: totalBroadcasts, fill: '#0d6efd' },
      { name: 'Delivered', count: readCount + deliveredOnlyCount, fill: '#25D366' },
      { name: 'Read', count: readCount, fill: '#198754' },
      { name: 'Failed / Bounced', count: failedCount, fill: '#dc3545' }
    ];
  }, [totalBroadcasts, readCount, deliveredOnlyCount, failedCount]);

  const deliveryRate = totalBroadcasts > 0
    ? Math.round(((readCount + deliveredOnlyCount) / totalBroadcasts) * 100)
    : 0;

  const readRate = (readCount + deliveredOnlyCount) > 0
    ? Math.round((readCount / (readCount + deliveredOnlyCount)) * 100)
    : 0;

  if (loading && !data) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-success" role="status"></div>
        <div className="text-muted small mt-2">Loading contact profile & marketing history...</div>
      </div>
    );
  }

  if (!data && error) {
    return (
      <div className="text-center py-5">
        <div className="alert alert-light border shadow-sm d-inline-block px-4 py-4 rounded-4 text-start" style={{ maxWidth: '480px' }}>
          <div className="d-flex align-items-center gap-2 mb-2">
            <i className="bi bi-exclamation-triangle-fill text-warning fs-3"></i>
            <h5 className="mb-0 fw-bold text-dark">Contact Not Found</h5>
          </div>
          <p className="text-muted small mb-3">
            {error || 'This contact does not exist or may have been deleted.'}
          </p>
          <div className="d-flex gap-2">
            <Link to="/contacts" className="btn btn-sm btn-outline-secondary">
              <i className="bi bi-arrow-left me-1"></i> Back to Contacts
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="contact-detail-page pb-5">
      {/* Toast Alert */}
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

      {/* Top Header & Breadcrumb */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between mb-4 gap-3">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <Link to="/contacts" className="text-muted text-decoration-none small">
              <i className="bi bi-arrow-left me-1"></i> Audience & Contacts
            </Link>
            <span className="text-muted small">/</span>
            <span className="text-muted small fw-semibold">#{contact?.id}</span>
            <span className={`badge ${contact?.status === 'active' ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'} border ms-1`}>
              {contact?.status?.toUpperCase()}
            </span>
            {contact?.is_opted_in ? (
              <span className="badge bg-success-subtle text-success border d-inline-flex align-items-center gap-1">
                <i className="bi bi-check-circle-fill"></i>
                <span>Opted In</span>
              </span>
            ) : (
              <span className="badge bg-danger-subtle text-danger border d-inline-flex align-items-center gap-1">
                <i className="bi bi-slash-circle"></i>
                <span>Opted Out</span>
              </span>
            )}
          </div>
          <h2 className="brand-font mb-0 text-dark fw-bold">
            {contact?.name || contact?.phone}
          </h2>
          <span className="text-muted small">
            Member since {contact?.created_at ? new Date(contact.created_at).toLocaleDateString() : 'N/A'}
          </span>
        </div>

        {/* Action Controls */}
        <div className="d-flex flex-wrap align-items-center gap-2">
          {conversationId ? (
            <Link
              to="/inbox"
              className="btn btn-success btn-sm d-flex align-items-center gap-1 shadow-sm"
              title="Open WhatsApp chat with this contact"
            >
              <i className="bi bi-whatsapp"></i>
              <span>Open in Inbox</span>
            </Link>
          ) : (
            <Link
              to="/inbox"
              className="btn btn-outline-success btn-sm d-flex align-items-center gap-1"
              title="Start a WhatsApp conversation"
            >
              <i className="bi bi-chat-dots-fill"></i>
              <span>Start WhatsApp Chat</span>
            </Link>
          )}

          <button
            onClick={() => {
              setConsentAction(!contact?.is_opted_in);
              setShowConsentModal(true);
            }}
            className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
            title="Manage Opt-in / Opt-out consent"
          >
            <i className={`bi ${contact?.is_opted_in ? 'bi-shield-x text-warning' : 'bi-shield-check text-success'}`}></i>
            <span>{contact?.is_opted_in ? 'Opt-Out Contact' : 'Opt-In Contact'}</span>
          </button>

          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`btn btn-sm d-flex align-items-center gap-1 ${isEditing ? 'btn-secondary' : 'btn-outline-primary'}`}
          >
            <i className="bi bi-pencil-square"></i>
            <span>{isEditing ? 'Cancel Edit' : 'Edit Profile'}</span>
          </button>

          <button
            onClick={handleDeleteContact}
            disabled={actionLoading}
            className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1"
            title="Delete this contact"
          >
            <i className="bi bi-trash"></i>
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Main Grid Profile Section */}
      <div className="row g-4">
        {/* Left Column: Contact Profile Card & Engagement Metrics */}
        <div className="col-12 col-lg-4">
          <div className="cf-card mb-4">
            <div className="cf-card-body text-center p-4">
              <div
                className="rounded-circle d-inline-flex align-items-center justify-content-center text-white fw-bold shadow-sm mb-3"
                style={{
                  width: '84px',
                  height: '84px',
                  backgroundColor: '#00a884',
                  fontSize: '2rem'
                }}
              >
                {getAvatarLetter(contact?.name)}
              </div>

              <h4 className="fw-bold text-dark mb-1">{contact?.name || 'Unnamed Contact'}</h4>
              <div className="text-muted small mb-3">
                <i className="bi bi-telephone me-1"></i>
                <code className="text-dark fw-semibold">{contact?.phone}</code>
              </div>

              {/* Status and Consent Badges */}
              <div className="d-flex justify-content-center flex-wrap gap-2 mb-3">
                <span className={`badge ${contact?.is_opted_in ? 'bg-success text-white' : 'bg-secondary text-white'}`}>
                  {contact?.is_opted_in ? 'WhatsApp Consent Active' : 'Consent Withdrawn'}
                </span>
                <span className="badge bg-light text-dark border">
                  Country: +{contact?.country_code || '91'}
                </span>
              </div>

              {/* Tags Section */}
              <div className="border-top pt-3 text-start">
                <div className="small fw-semibold text-muted text-uppercase mb-2" style={{ fontSize: '0.72rem' }}>
                  Audience Tags ({contact?.tags?.length || 0})
                </div>
                <div className="d-flex flex-wrap gap-1">
                  {contact?.tags && contact.tags.length > 0 ? (
                    contact.tags.map(t => (
                      <span
                        key={t.id || t.name}
                        className="badge rounded-pill"
                        style={{ backgroundColor: t.color || '#10b981', color: '#fff' }}
                      >
                        {t.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted small">No audience tags assigned</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="cf-card">
            <div className="cf-card-header d-flex justify-content-between align-items-center">
              <h6 className="mb-0 fw-bold">Engagement Rates</h6>
              <span className="badge bg-light text-dark border">Cloud API Verified</span>
            </div>
            <div className="cf-card-body p-3">
              <div className="d-flex justify-content-between align-items-center py-2 border-bottom">
                <span className="text-muted small">Total Broadcasts</span>
                <span className="fw-bold text-dark">{totalBroadcasts}</span>
              </div>
              <div className="d-flex justify-content-between align-items-center py-2 border-bottom">
                <span className="text-muted small">Delivered Rate</span>
                <span className="fw-bold text-success">{deliveryRate}%</span>
              </div>
              <div className="d-flex justify-content-between align-items-center py-2 border-bottom">
                <span className="text-muted small">Read / Open Rate</span>
                <span className="fw-bold text-warning">{readRate}%</span>
              </div>
              <div className="d-flex justify-content-between align-items-center py-2">
                <span className="text-muted small">Last Activity</span>
                <span className="small text-dark">
                  {contact?.last_contacted_at ? new Date(contact.last_contacted_at).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Edit Profile or Detailed Tabs */}
        <div className="col-12 col-lg-8">
          {isEditing ? (
            /* Edit Form */
            <div className="cf-card">
              <div className="cf-card-header d-flex justify-content-between align-items-center">
                <h5 className="mb-0 fw-bold">Edit Contact Profile</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setIsEditing(false)}
                ></button>
              </div>
              <div className="cf-card-body">
                <form onSubmit={handleUpdateContact}>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Full Name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Phone Number (E.164 with Country Code)</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Email Address</label>
                      <input
                        type="email"
                        className="form-control"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Status</label>
                      <select
                        className="form-select"
                        value={formData.status}
                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                      >
                        <option value="active">Active</option>
                        <option value="unsubscribed">Unsubscribed</option>
                        <option value="bounced">Bounced / Inactive</option>
                      </select>
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-semibold">Tags (comma separated)</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.tagInput}
                        onChange={e => setFormData({ ...formData, tagInput: e.target.value })}
                        placeholder="e.g. VIP, Wholesale, Lead"
                      />
                      <div className="form-text small">
                        Assign segmentation tags to target this customer in marketing campaigns.
                      </div>
                    </div>
                  </div>

                  <div className="d-flex justify-content-end gap-2 mt-4">
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setIsEditing(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="btn btn-cf-primary d-flex align-items-center gap-1"
                    >
                      <i className="bi bi-save"></i>
                      <span>{actionLoading ? 'Saving...' : 'Save Profile'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            /* Navigation Tabs */
            <div>
              <ul className="nav nav-tabs mb-4 border-bottom">
                <li className="nav-item">
                  <button
                    className={`nav-link fw-semibold px-4 py-2 ${activeTab === 'overview' ? 'active text-success border-success border-bottom-0' : 'text-muted'}`}
                    onClick={() => setActiveTab('overview')}
                  >
                    <i className="bi bi-person-lines-fill me-2"></i>
                    CRM Profile Overview
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className={`nav-link fw-semibold px-4 py-2 ${activeTab === 'campaigns' ? 'active text-success border-success border-bottom-0' : 'text-muted'}`}
                    onClick={() => setActiveTab('campaigns')}
                  >
                    <i className="bi bi-send-check me-2"></i>
                    Campaign Broadcasts ({campaignHistory.length})
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className={`nav-link fw-semibold px-4 py-2 ${activeTab === 'consent' ? 'active text-success border-success border-bottom-0' : 'text-muted'}`}
                    onClick={() => setActiveTab('consent')}
                  >
                    <i className="bi bi-shield-lock me-2"></i>
                    Consent Audit Trail ({consents.length})
                  </button>
                </li>
              </ul>

              {/* ==========================================================
                  TAB 1: CRM Profile Overview + Visual Charts
                  ========================================================== */}
              {activeTab === 'overview' && (
                <div>
                  {/* Visual Graphs Section */}
                  <div className="row g-3 mb-4">
                    {/* Donut Pie Chart: Message Status Breakdown */}
                    <div className="col-12 col-md-6">
                      <div className="cf-card h-100">
                        <div className="cf-card-header d-flex justify-content-between align-items-center">
                          <h6 className="mb-0 fw-bold">Delivery Status Breakdown</h6>
                          <span className="small text-muted">WhatsApp Webhooks</span>
                        </div>
                        <div className="cf-card-body d-flex align-items-center justify-content-center p-2">
                          {pieData.length > 0 ? (
                            <div style={{ width: '100%', height: 210 }}>
                              <ResponsiveContainer>
                                <PieChart>
                                  <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={75}
                                    paddingAngle={4}
                                    dataKey="value"
                                  >
                                    {pieData.map((entry, index) => (
                                      <Cell key={`contact-pie-${index}`} fill={entry.color} />
                                    ))}
                                  </Pie>
                                  <Tooltip />
                                  <Legend verticalAlign="bottom" height={32} iconSize={10} />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                          ) : (
                            <div className="text-center py-4 text-muted small">
                              <i className="bi bi-pie-chart fs-3 d-block mb-1 text-secondary"></i>
                              No campaign delivery data available yet
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bar Chart: Engagement Funnel */}
                    <div className="col-12 col-md-6">
                      <div className="cf-card h-100">
                        <div className="cf-card-header d-flex justify-content-between align-items-center">
                          <h6 className="mb-0 fw-bold">Message Engagement Funnel</h6>
                          <span className="small text-muted">Conversion Counts</span>
                        </div>
                        <div className="cf-card-body d-flex align-items-center justify-content-center p-2">
                          {totalBroadcasts > 0 ? (
                            <div style={{ width: '100%', height: 210 }}>
                              <ResponsiveContainer>
                                <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
                                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                                  <Tooltip
                                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.8rem' }}
                                  />
                                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                    {barData.map((entry, index) => (
                                      <Cell key={`bar-cell-${index}`} fill={entry.fill} />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          ) : (
                            <div className="text-center py-4 text-muted small">
                              <i className="bi bi-bar-chart fs-3 d-block mb-1 text-secondary"></i>
                              No broadcast interactions recorded yet
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Customer Information Cards */}
                  <div className="cf-card">
                    <div className="cf-card-header">
                      <h5 className="mb-0 fw-bold">Customer CRM Information</h5>
                    </div>
                    <div className="cf-card-body">
                      <div className="row g-4">
                        <div className="col-sm-6">
                          <div className="p-3 bg-light rounded-3">
                            <span className="text-muted small">Full Name</span>
                            <div className="fw-bold text-dark mt-1 fs-5">
                              {contact?.name || 'N/A'}
                            </div>
                          </div>
                        </div>
                        <div className="col-sm-6">
                          <div className="p-3 bg-light rounded-3">
                            <span className="text-muted small">WhatsApp Phone Number</span>
                            <div className="fw-bold text-dark mt-1 fs-5">
                              <code>{contact?.phone}</code>
                            </div>
                          </div>
                        </div>
                        <div className="col-sm-6">
                          <div className="p-3 bg-light rounded-3">
                            <span className="text-muted small">Email Address</span>
                            <div className="fw-semibold text-dark mt-1">
                              {contact?.email || <span className="text-muted">Not provided</span>}
                            </div>
                          </div>
                        </div>
                        <div className="col-sm-6">
                          <div className="p-3 bg-light rounded-3">
                            <span className="text-muted small">Opt-In Status & Consent</span>
                            <div className="fw-semibold mt-1">
                              {contact?.is_opted_in ? (
                                <span className="text-success d-flex align-items-center gap-1">
                                  <i className="bi bi-check-circle-fill"></i> Opted-In (Promotional & Utility)
                                </span>
                              ) : (
                                <span className="text-danger d-flex align-items-center gap-1">
                                  <i className="bi bi-slash-circle"></i> Unsubscribed / Opted-Out
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="col-12">
                          <div className="p-3 bg-light rounded-3">
                            <span className="text-muted small">System Information</span>
                            <div className="row mt-2 small text-muted">
                              <div className="col-sm-6">Record ID: #{contact?.id}</div>
                              <div className="col-sm-6">Business Tenant ID: #{contact?.business_id}</div>
                              <div className="col-sm-6 mt-1">Created At: {contact?.created_at ? new Date(contact.created_at).toLocaleString() : 'N/A'}</div>
                              <div className="col-sm-6 mt-1">Last Updated: {contact?.updated_at ? new Date(contact.updated_at).toLocaleString() : 'N/A'}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Campaign Broadcast History */}
              {activeTab === 'campaigns' && (
                <div className="cf-card">
                  <div className="cf-card-header d-flex justify-content-between align-items-center">
                    <h5 className="mb-0 fw-bold">Broadcast Campaigns Received</h5>
                    <span className="small text-muted">{campaignHistory.length} broadcasts sent to this number</span>
                  </div>
                  <div className="table-responsive">
                    <table className="table cf-table mb-0 align-middle">
                      <thead>
                        <tr>
                          <th>Campaign Name</th>
                          <th>Status</th>
                          <th>Sent At</th>
                          <th>Delivered At</th>
                          <th>Read At</th>
                          <th className="text-end">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {campaignHistory.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="text-center py-5 text-muted">
                              This contact has not received any broadcast campaigns yet.
                            </td>
                          </tr>
                        ) : (
                          campaignHistory.map(ch => (
                            <tr key={ch.id}>
                              <td>
                                <div className="fw-bold text-dark">{ch.campaign_name || 'Campaign'}</div>
                                <div className="small text-muted">ID: #{ch.campaign_id}</div>
                              </td>
                              <td>
                                <span className={`badge-status badge-${ch.status}`}>
                                  {ch.status?.toUpperCase()}
                                </span>
                              </td>
                              <td className="small text-muted">
                                {ch.sent_at ? new Date(ch.sent_at).toLocaleTimeString() : '-'}
                              </td>
                              <td className="small text-success">
                                {ch.delivered_at ? new Date(ch.delivered_at).toLocaleTimeString() : '-'}
                              </td>
                              <td className="small text-warning">
                                {ch.read_at ? new Date(ch.read_at).toLocaleTimeString() : '-'}
                              </td>
                              <td className="text-end">
                                <Link
                                  to={`/campaigns/${ch.campaign_id}`}
                                  className="btn btn-sm btn-outline-secondary"
                                  title="View Campaign Details"
                                >
                                  <i className="bi bi-box-arrow-up-right me-1"></i> Campaign
                                </Link>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: Consent Audit Trail */}
              {activeTab === 'consent' && (
                <div className="cf-card">
                  <div className="cf-card-header d-flex justify-content-between align-items-center">
                    <h5 className="mb-0 fw-bold">Consent Compliance Audit Trail</h5>
                    <span className="badge bg-light text-dark border">Meta GDPR & TCPA Compliance</span>
                  </div>
                  <div className="table-responsive">
                    <table className="table cf-table mb-0 align-middle">
                      <thead>
                        <tr>
                          <th>Consent Status</th>
                          <th>Source</th>
                          <th>Proof / Notes</th>
                          <th>Logged At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {consents.length === 0 ? (
                          <tr>
                            <td colSpan="4" className="text-center py-5 text-muted">
                              No explicit consent logs recorded. Contact was added via default import.
                            </td>
                          </tr>
                        ) : (
                          consents.map(cc => (
                            <tr key={cc.id}>
                              <td>
                                <span className={`badge ${cc.consent_status === 'opted_in' ? 'bg-success text-white' : 'bg-danger text-white'}`}>
                                  {cc.consent_status === 'opted_in' ? 'OPTED IN' : 'OPTED OUT'}
                                </span>
                              </td>
                              <td className="small text-muted">{cc.consent_source || 'dashboard'}</td>
                              <td className="small text-dark">{cc.proof_notes || '-'}</td>
                              <td className="small text-muted">
                                {cc.created_at ? new Date(cc.created_at).toLocaleString() : '-'}
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
          )}
        </div>
      </div>

      {/* Consent Modal */}
      {showConsentModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">
                  {consentAction ? 'Opt-In Contact to Marketing' : 'Opt-Out & Unsubscribe Contact'}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowConsentModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <p className="text-muted small">
                  {consentAction
                    ? 'Confirming opt-in ensures this contact can receive scheduled marketing and promotional broadcasts via WhatsApp Cloud API.'
                    : 'Opting out will immediately exclude this contact from all future broadcast campaigns to maintain WhatsApp compliance and number quality rating.'}
                </p>
                <div className="mb-3">
                  <label className="form-label small fw-semibold">Audit / Proof Reason</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Requested via WhatsApp chat, website form, or in-store consent"
                    value={consentReason}
                    onChange={e => setConsentReason(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setShowConsentModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleToggleConsent}
                  className={`btn ${consentAction ? 'btn-success' : 'btn-danger'}`}
                >
                  {actionLoading ? 'Updating...' : (consentAction ? 'Confirm Opt-In' : 'Confirm Opt-Out')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
