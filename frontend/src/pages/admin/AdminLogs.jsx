import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../services/api';
import AiwavoHeader from '../../components/AiwavoHeader';

export default function AdminLogs() {
  const { onToggleSidebar } = useOutletContext() || {};

  const [logs, setLogs] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Filters
  const [selectedBusinessId, setSelectedBusinessId] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 20 });

  // Detail Modal
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedBusinessId && selectedBusinessId !== 'ALL') params.append('businessId', selectedBusinessId);
      if (selectedCategory && selectedCategory !== 'ALL') params.append('category', selectedCategory);
      if (search.trim()) params.append('search', search.trim());
      params.append('page', page);
      params.append('limit', 20);

      const res = await api.get(`/logs?${params.toString()}`);
      if (res.data?.success) {
        setLogs(res.data.data.logs || []);
        setPagination(res.data.data.pagination || { total: 0, totalPages: 1, limit: 20 });
        setStats(res.data.data.stats || null);
        if (res.data.data.businesses) {
          setBusinesses(res.data.data.businesses);
        }
      }
    } catch (err) {
      console.error('Failed to load global audit logs', err);
      setFeedback({ type: 'danger', text: 'Failed to fetch global activity logs' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedBusinessId, selectedCategory, page]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const getActionBadgeColor = (action = '') => {
    const act = action.toUpperCase();
    if (act.includes('DELETE') || act.includes('REMOVE') || act.includes('SUSPEND')) return 'danger';
    if (act.includes('CREATE') || act.includes('REGISTER') || act.includes('CONNECT')) return 'success';
    if (act.includes('UPDATE') || act.includes('CHANGE') || act.includes('STATUS')) return 'primary';
    if (act.includes('LOGIN') || act.includes('AUTH')) return 'info';
    return 'secondary';
  };

  return (
    <div>
      <AiwavoHeader
        title="Global Platform Activity & Audit Logs"
        subtitle="Real-time Multi-Tenant Audit Trail, Security Events & Operational Records"
        onToggleSidebar={onToggleSidebar}
      />

      <div className="p-4">
        {feedback.text && (
          <div className={`alert alert-${feedback.type} alert-dismissible fade show mb-4 shadow-sm`} role="alert">
            {feedback.text}
            <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
          </div>
        )}

        {/* Global Summary Stats */}
        <div className="row g-3 mb-4">
          <div className="col-12 col-sm-6 col-xl-3">
            <div className="stat-card">
              <div className="stat-icon-wrapper stat-icon-blue">
                <i className="bi bi-journal-text"></i>
              </div>
              <div>
                <div className="stat-label">Total Audit Events</div>
                <div className="stat-value">{stats?.totalLogs || pagination.total || 0}</div>
                <div className="small text-muted">Across all registered tenants</div>
              </div>
            </div>
          </div>

          <div className="col-12 col-sm-6 col-xl-3">
            <div className="stat-card">
              <div className="stat-icon-wrapper stat-icon-green">
                <i className="bi bi-shield-check"></i>
              </div>
              <div>
                <div className="stat-label">Successful Events</div>
                <div className="stat-value text-success">{stats?.successfulActions || 0}</div>
                <div className="small text-muted">Authorized platform actions</div>
              </div>
            </div>
          </div>

          <div className="col-12 col-sm-6 col-xl-3">
            <div className="stat-card">
              <div className="stat-icon-wrapper stat-icon-orange">
                <i className="bi bi-key-fill"></i>
              </div>
              <div>
                <div className="stat-label">Auth & Login Logs</div>
                <div className="stat-value">{stats?.authEvents || 0}</div>
                <div className="small text-muted">Sign-in & token renewals</div>
              </div>
            </div>
          </div>

          <div className="col-12 col-sm-6 col-xl-3">
            <div className="stat-card">
              <div className="stat-icon-wrapper stat-icon-purple">
                <i className="bi bi-send-check-fill"></i>
              </div>
              <div>
                <div className="stat-label">Campaign & Dispatch</div>
                <div className="stat-value">{stats?.campaignEvents || 0}</div>
                <div className="small text-muted">Message queue activities</div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Card */}
        <div className="cf-card mb-4">
          <div className="cf-card-header d-flex flex-wrap justify-content-between align-items-center gap-3">
            <div>
              <h5 className="mb-0 fw-bold d-flex align-items-center gap-2">
                <i className="bi bi-sliders text-primary"></i>
                <span>Cross-Tenant Audit Trail Explorer</span>
              </h5>
              <small className="text-muted">Inspect live actions executed by owners, marketers, and automated system workers</small>
            </div>

            <button
              onClick={() => { setPage(1); fetchLogs(); }}
              className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
            >
              <i className="bi bi-arrow-clockwise"></i>
              <span>Refresh Logs</span>
            </button>
          </div>

          <div className="cf-card-body border-bottom bg-light bg-opacity-50">
            <form onSubmit={handleSearchSubmit} className="row g-3 align-items-end">
              {/* Tenant Dropdown Filter */}
              <div className="col-12 col-md-4">
                <label className="form-label small fw-bold text-dark mb-1">
                  <i className="bi bi-buildings me-1 text-primary"></i>Filter by Business / Tenant:
                </label>
                <select
                  className="form-select form-select-sm fw-semibold"
                  value={selectedBusinessId}
                  onChange={(e) => { setSelectedBusinessId(e.target.value); setPage(1); }}
                >
                  <option value="ALL">🌐 All Businesses (Platform-Wide Master Feed)</option>
                  {businesses.map(b => (
                    <option key={b.id} value={b.id}>
                      🏢 {b.name} ({b.slug})
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Filter */}
              <div className="col-12 col-md-3">
                <label className="form-label small fw-bold text-dark mb-1">
                  <i className="bi bi-funnel me-1 text-secondary"></i>Category:
                </label>
                <select
                  className="form-select form-select-sm"
                  value={selectedCategory}
                  onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}
                >
                  <option value="ALL">All Categories</option>
                  <option value="AUTH">Authentication & Users</option>
                  <option value="CAMPAIGN">Campaigns & Dispatches</option>
                  <option value="TEMPLATE">WhatsApp Templates</option>
                  <option value="CONTACT">Contacts & Audience</option>
                  <option value="WHATSAPP">WhatsApp Numbers</option>
                  <option value="BILLING">Billing & Subscriptions</option>
                  <option value="SETTINGS">System Settings</option>
                </select>
              </div>

              {/* Text Search */}
              <div className="col-12 col-md-3">
                <label className="form-label small fw-bold text-dark mb-1">
                  <i className="bi bi-search me-1 text-muted"></i>Search Keyword:
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Action, IP, details..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="col-12 col-md-2">
                <button type="submit" className="btn btn-primary btn-sm w-100">
                  <i className="bi bi-search me-1"></i>Search
                </button>
              </div>
            </form>
          </div>

          {/* Logs Table */}
          <div className="table-responsive">
            <table className="table cf-table align-middle mb-0">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Tenant / Business</th>
                  <th>User / Actor</th>
                  <th>Action Executed</th>
                  <th>Entity</th>
                  <th>IP / Source</th>
                  <th className="text-end">Details</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-5">
                      <div className="spinner-border text-primary" role="status"></div>
                      <div className="small text-muted mt-2">Loading platform logs...</div>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-5 text-muted">
                      No activity logs found matching the selected filters.
                    </td>
                  </tr>
                ) : (
                  logs.map(l => (
                    <tr key={l.id}>
                      <td>
                        <div className="small fw-semibold text-dark">
                          {new Date(l.created_at).toLocaleTimeString()}
                        </div>
                        <div className="small text-muted" style={{ fontSize: '0.72rem' }}>
                          {new Date(l.created_at).toLocaleDateString()}
                        </div>
                      </td>

                      <td>
                        <div className="fw-bold text-primary small">
                          <i className="bi bi-building me-1"></i>
                          {l.business_name || 'Global System'}
                        </div>
                      </td>

                      <td>
                        <div className="fw-semibold text-dark small">{l.user_name || 'System Worker'}</div>
                        <div className="small text-muted" style={{ fontSize: '0.72rem' }}>
                          {l.user_email || 'automated'} ({l.user_role || 'system'})
                        </div>
                      </td>

                      <td>
                        <span className={`badge bg-${getActionBadgeColor(l.action)}-subtle text-${getActionBadgeColor(l.action)} font-monospace px-2 py-1`}>
                          {l.action}
                        </span>
                      </td>

                      <td>
                        <div className="small text-muted">
                          {l.entity_type ? `${l.entity_type} #${l.entity_id || ''}` : 'N/A'}
                        </div>
                      </td>

                      <td>
                        <code className="small text-muted">{l.ip_address || '127.0.0.1'}</code>
                      </td>

                      <td className="text-end">
                        <button
                          className="btn btn-outline-secondary btn-sm py-1 px-2"
                          onClick={() => setSelectedLog(l)}
                          title="Inspect raw log payload"
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

          {/* Pagination Footer */}
          {pagination.totalPages > 1 && (
            <div className="p-3 border-top d-flex justify-content-between align-items-center bg-light bg-opacity-25">
              <small className="text-muted">
                Showing Page {pagination.page} of {pagination.totalPages} ({pagination.total} total logs)
              </small>
              <div className="btn-group btn-group-sm">
                <button
                  className="btn btn-outline-secondary"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                >
                  <i className="bi bi-chevron-left me-1"></i>Previous
                </button>
                <button
                  className="btn btn-outline-secondary"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage(prev => prev + 1)}
                >
                  Next<i className="bi bi-chevron-right ms-1"></i>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow-lg border-0 rounded-4 overflow-hidden">
              <div className="modal-header bg-dark text-white py-3 px-4">
                <h5 className="modal-title fw-bold mb-0 d-flex align-items-center gap-2">
                  <i className="bi bi-journal-code text-warning"></i>
                  <span>Audit Log Event Details #{selectedLog.id}</span>
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setSelectedLog(null)}
                ></button>
              </div>

              <div className="modal-body p-4">
                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label className="text-muted small fw-bold">Business Tenant</label>
                    <div className="fw-semibold text-primary">{selectedLog.business_name}</div>
                  </div>
                  <div className="col-md-6">
                    <label className="text-muted small fw-bold">Actor / User</label>
                    <div className="fw-semibold">{selectedLog.user_name} ({selectedLog.user_email})</div>
                  </div>
                  <div className="col-md-6">
                    <label className="text-muted small fw-bold">Action</label>
                    <div><span className="badge bg-primary font-monospace">{selectedLog.action}</span></div>
                  </div>
                  <div className="col-md-6">
                    <label className="text-muted small fw-bold">Timestamp</label>
                    <div className="small text-muted">{new Date(selectedLog.created_at).toLocaleString()}</div>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="text-muted small fw-bold">IP Address & User Agent</label>
                  <div className="p-2 border rounded-2 bg-light small font-monospace">
                    IP: {selectedLog.ip_address || '127.0.0.1'}<br />
                    Agent: {selectedLog.user_agent || 'Mozilla/5.0'}
                  </div>
                </div>

                <div>
                  <label className="text-muted small fw-bold">Payload / Changed Values</label>
                  <pre className="p-3 bg-dark text-success rounded-3 small font-monospace overflow-auto" style={{ maxHeight: '250px' }}>
                    {JSON.stringify(selectedLog.new_values || selectedLog.old_values || { message: 'Action executed successfully without additional payload' }, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="modal-footer bg-light py-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm px-4"
                  onClick={() => setSelectedLog(null)}
                >
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
