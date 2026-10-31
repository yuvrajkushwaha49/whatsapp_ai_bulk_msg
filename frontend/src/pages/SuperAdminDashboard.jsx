import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [whatsappAccounts, setWhatsappAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchAdminData();
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

  return (
    <div>
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between mb-4 gap-3">
        <div>
          <span className="badge bg-warning text-dark mb-1">Super Administrator Control Panel</span>
          <h2 className="brand-font mb-0">Platform Overview & Tenant Governance</h2>
        </div>
        <button onClick={fetchAdminData} className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1">
          <i className="bi bi-arrow-clockwise"></i>
          <span>Refresh Metrics</span>
        </button>
      </div>

      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show mb-4`} role="alert">
          {feedback.text}
          <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

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

      {/* System Health Status */}
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
                <div className="text-muted small">Meta Cloud API v21.0</div>
                <div className="fw-bold text-success d-flex align-items-center gap-1">
                  <span className="badge bg-success rounded-circle" style={{ width: 8, height: 8 }}></span>
                  {stats?.systemHealth?.metaCloudApi || 'VERIFIED'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Meta WABA Multi-Tenant Asset Overview */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="stat-card border-success-subtle">
            <div className="stat-icon-wrapper stat-icon-green">
              <i className="bi bi-diagram-3-fill"></i>
            </div>
            <div>
              <div className="stat-label">Client WABAs</div>
              <div className="stat-value">{stats?.totalWABAs || 0}</div>
              <div className="small text-muted">Independent Client Accounts</div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="stat-card border-primary-subtle">
            <div className="stat-icon-wrapper stat-icon-blue">
              <i className="bi bi-telephone-fill"></i>
            </div>
            <div>
              <div className="stat-label">Phone Numbers</div>
              <div className="stat-value">{stats?.totalPhoneNumbers || 0}</div>
              <div className="small text-muted">Registered Official Senders</div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="stat-card">
            <div className="stat-icon-wrapper stat-icon-purple">
              <i className="bi bi-shield-check"></i>
            </div>
            <div>
              <div className="stat-label">Active Connections</div>
              <div className="stat-value">{stats?.connectedAccounts || 0}</div>
              <div className="small text-success">Verified with Meta Cloud</div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="stat-card">
            <div className="stat-icon-wrapper stat-icon-orange">
              <i className="bi bi-exclamation-triangle-fill"></i>
            </div>
            <div>
              <div className="stat-label">Requires Attention</div>
              <div className="stat-value text-warning">{stats?.attentionRequiredAccounts || 0}</div>
              <div className="small text-muted">Expired token or pending</div>
            </div>
          </div>
        </div>
      </div>

      {/* Client WhatsApp Business Accounts Table */}
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
  );
}
