import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../services/api';
import AiwavoHeader from '../components/AiwavoHeader';
import { useAuth } from '../hooks/useAuth';
import '../styles/logs.css';

export default function ActivityLogs() {
  const { user, isSuperAdmin } = useAuth();
  const outletContext = useOutletContext();
  const onToggleSidebar = outletContext?.onToggleSidebar;

  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({
    totalEvents: 0,
    authEvents: 0,
    campaignEvents: 0,
    teamEvents: 0
  });
  const [businesses, setBusinesses] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [selectedBusinessId, setSelectedBusinessId] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  const superAdmin = isSuperAdmin ? isSuperAdmin() : user?.role === 'superadmin';

  useEffect(() => {
    fetchLogs();
  }, [category, selectedBusinessId, currentPage]);

  // Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchLogs();
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: 20
      };

      if (category !== 'ALL') params.category = category;
      if (search.trim()) params.search = search.trim();
      if (superAdmin && selectedBusinessId !== 'ALL') params.businessId = selectedBusinessId;

      const res = await api.get('/activity-logs', { params });
      if (res.data?.success) {
        const data = res.data.data;
        setLogs(data.logs || []);
        if (data.pagination) setPagination(data.pagination);
        if (data.stats) setStats(data.stats);
        if (data.businesses) setBusinesses(data.businesses);
      }
    } catch (err) {
      console.error('Failed to load activity logs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper to format timestamp
  const formatTimestamp = (dateStr) => {
    if (!dateStr) return { primary: 'Unknown', relative: '' };
    let date = new Date(dateStr);
    if (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !dateStr.includes('+')) {
      date = new Date(dateStr.replace(' ', 'T') + 'Z');
    }
    const primary = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }) + ' • ' + date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const diffMs = Math.max(0, Date.now() - date.getTime());
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    let relative = '';
    if (diffMins < 1) relative = 'Just now';
    else if (diffMins < 60) relative = `${diffMins}m ago`;
    else if (diffHours < 24) relative = `${diffHours}h ago`;
    else relative = `${diffDays}d ago`;

    return { primary, relative };
  };

  // Helper for Action Badge Class
  const getActionBadge = (action, entityType) => {
    const act = (action || '').toUpperCase();
    if (act.includes('LOGIN') || act.includes('AUTH') || entityType === 'AUTH') {
      return { className: 'act-login', label: 'USER LOGIN', icon: 'bi-box-arrow-in-right' };
    }
    if (act.includes('CAMPAIGN') || entityType === 'CAMPAIGNS') {
      return { className: 'act-campaign', label: act.replace(/_/g, ' '), icon: 'bi-megaphone-fill' };
    }
    if (act.includes('TEMPLATE') || entityType === 'TEMPLATES') {
      return { className: 'act-template', label: act.replace(/_/g, ' '), icon: 'bi-chat-square-text-fill' };
    }
    if (act.includes('CONTACT') || act.includes('GROUP') || entityType === 'CONTACTS') {
      return { className: 'act-contact', label: act.replace(/_/g, ' '), icon: 'bi-person-lines-fill' };
    }
    if (act.includes('MEMBER') || act.includes('ROLE') || entityType === 'TEAM') {
      return { className: 'act-team', label: act.replace(/_/g, ' '), icon: 'bi-people-fill' };
    }
    if (act.includes('PLAN') || act.includes('BILLING') || entityType === 'BILLING') {
      return { className: 'act-billing', label: act.replace(/_/g, ' '), icon: 'bi-credit-card-fill' };
    }
    if (act.includes('WHATSAPP') || entityType === 'WHATSAPP') {
      return { className: 'act-template', label: 'WHATSAPP WABA', icon: 'bi-whatsapp' };
    }
    return { className: 'act-system', label: act.replace(/_/g, ' '), icon: 'bi-gear-fill' };
  };

  // Helper for Avatar Initials and color
  const getInitials = (name) => {
    if (!name) return 'SYS';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const getAvatarBg = (role, name) => {
    if (role === 'owner' || name?.toLowerCase().includes('rahul') || name?.toLowerCase().includes('vikram')) {
      return '#10b981'; // emerald
    }
    if (role === 'marketer' || name?.toLowerCase().includes('priya') || name?.toLowerCase().includes('sneha')) {
      return '#2563eb'; // blue
    }
    if (role === 'superadmin') {
      return '#0f172a'; // dark navy
    }
    return '#64748b'; // slate
  };

  // Export CSV
  const handleExportCSV = () => {
    if (logs.length === 0) return;
    const headers = ['ID', 'Timestamp', 'User', 'Role', 'Company', 'Action', 'Entity', 'Details', 'IP'];
    const rows = logs.map(l => [
      l.id,
      new Date(l.created_at).toISOString(),
      `"${l.user_name || ''}"`,
      `"${l.user_role || ''}"`,
      `"${l.business_name || ''}"`,
      `"${l.action || ''}"`,
      `"${l.entity_type || ''}"`,
      `"${(typeof l.details === 'object' ? l.details?.message || JSON.stringify(l.details) : l.details || '').replace(/"/g, '""')}"`,
      l.ip_address || ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `audit_logs_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <AiwavoHeader
        title="Activity Logs"
        subtitle="Track real-time security events, campaign dispatches, team modifications, and audit trails."
        onToggleSidebar={onToggleSidebar}
      />

      <div className="logs-page-container">
        {/* 1. Hero Banner */}
        <div className="logs-hero-banner">
          <div className="logs-hero-left">
            <div className="logs-hero-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div>
              <h1 className="logs-hero-title">Activity Logs & Audit Trail</h1>
              <p className="logs-hero-subtitle">
                {superAdmin
                  ? 'SuperAdmin Global Audit Stream: Real-time operational logs across all companies and workspaces.'
                  : 'Company Workspace Audit Stream: Real-time security events, campaigns, and team activities for your workspace.'}
              </p>
            </div>
          </div>

          <div className="logs-hero-actions">
            <button
              type="button"
              className="logs-btn-refresh"
              onClick={fetchLogs}
              title="Refresh logs stream"
            >
              <i className={`bi bi-arrow-repeat ${loading ? 'spin-icon' : ''}`}></i>
              <span>Refresh</span>
            </button>

            <button
              type="button"
              className="logs-btn-export"
              onClick={handleExportCSV}
              title="Export visible logs as CSV"
            >
              <i className="bi bi-download"></i>
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* 2. Stats Grid */}
        <div className="logs-stats-row">
          <div className="logs-stat-card">
            <div className="logs-stat-icon stat-total">
              <i className="bi bi-clock-history"></i>
            </div>
            <div>
              <div className="logs-stat-label">Total Events</div>
              <div className="logs-stat-value">{stats.totalEvents || logs.length}</div>
            </div>
          </div>

          <div className="logs-stat-card">
            <div className="logs-stat-icon stat-auth">
              <i className="bi bi-shield-check"></i>
            </div>
            <div>
              <div className="logs-stat-label">Auth & Security</div>
              <div className="logs-stat-value">{stats.authEvents || 0}</div>
            </div>
          </div>

          <div className="logs-stat-card">
            <div className="logs-stat-icon stat-campaigns">
              <i className="bi bi-megaphone-fill"></i>
            </div>
            <div>
              <div className="logs-stat-label">Campaigns & Sending</div>
              <div className="logs-stat-value">{stats.campaignEvents || 0}</div>
            </div>
          </div>

          <div className="logs-stat-card">
            <div className="logs-stat-icon stat-team">
              <i className="bi bi-people-fill"></i>
            </div>
            <div>
              <div className="logs-stat-label">Team & RBAC</div>
              <div className="logs-stat-value">{stats.teamEvents || 0}</div>
            </div>
          </div>
        </div>

        {/* 3. Controls & Filter Card */}
        <div className="logs-controls-card">
          <div className="logs-controls-top">
            {/* Search Box */}
            <div className="logs-search-box">
              <i className="bi bi-search logs-search-icon"></i>
              <input
                type="text"
                className="logs-search-input"
                placeholder="Search by user, action, details, or IP..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* SuperAdmin Multi-Tenant Company Filter Dropdown */}
            {superAdmin && (
              <div className="logs-company-filter-wrap">
                <span className="logs-admin-badge">
                  <i className="bi bi-shield-lock-fill"></i> SuperAdmin View
                </span>
                <select
                  className="logs-company-select"
                  value={selectedBusinessId}
                  onChange={(e) => {
                    setSelectedBusinessId(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="ALL">🌐 All Companies (Global View)</option>
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      🏢 {b.name || `Business #${b.id}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="logs-category-pills">
            <button
              type="button"
              className={`logs-category-btn ${category === 'ALL' ? 'active' : ''}`}
              onClick={() => { setCategory('ALL'); setCurrentPage(1); }}
            >
              All Events
            </button>
            <button
              type="button"
              className={`logs-category-btn ${category === 'AUTH' ? 'active' : ''}`}
              onClick={() => { setCategory('AUTH'); setCurrentPage(1); }}
            >
              Auth & Security
            </button>
            <button
              type="button"
              className={`logs-category-btn ${category === 'CAMPAIGNS' ? 'active' : ''}`}
              onClick={() => { setCategory('CAMPAIGNS'); setCurrentPage(1); }}
            >
              Campaigns
            </button>
            <button
              type="button"
              className={`logs-category-btn ${category === 'CONTACTS' ? 'active' : ''}`}
              onClick={() => { setCategory('CONTACTS'); setCurrentPage(1); }}
            >
              Contacts & Imports
            </button>
            <button
              type="button"
              className={`logs-category-btn ${category === 'TEMPLATES' ? 'active' : ''}`}
              onClick={() => { setCategory('TEMPLATES'); setCurrentPage(1); }}
            >
              Templates
            </button>
            <button
              type="button"
              className={`logs-category-btn ${category === 'TEAM' ? 'active' : ''}`}
              onClick={() => { setCategory('TEAM'); setCurrentPage(1); }}
            >
              Team & Roles
            </button>
            <button
              type="button"
              className={`logs-category-btn ${category === 'BILLING' ? 'active' : ''}`}
              onClick={() => { setCategory('BILLING'); setCurrentPage(1); }}
            >
              Billing
            </button>
          </div>
        </div>

        {/* 4. Logs Table Card */}
        <div className="logs-table-card">
          <div className="table-responsive">
            <table className="logs-table">
              <thead>
                <tr>
                  <th style={{ width: '18%' }}>TIMESTAMP</th>
                  <th style={{ width: '20%' }}>USER / ACTOR</th>
                  {superAdmin && <th style={{ width: '16%' }}>COMPANY</th>}
                  <th style={{ width: '18%' }}>ACTION TYPE</th>
                  <th style={{ width: superAdmin ? '18%' : '32%' }}>EVENT DETAILS</th>
                  <th style={{ width: '10%' }}>IP ADDRESS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={superAdmin ? 6 : 5} className="text-center py-5">
                      <div className="spinner-border text-success" role="status"></div>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={superAdmin ? 6 : 5} className="text-center py-5 text-muted">
                      <div className="mb-2">
                        <i className="bi bi-clock-history fs-2 text-secondary"></i>
                      </div>
                      <div className="fw-semibold">No audit logs found</div>
                      <div className="small">No events match your current filter and search criteria.</div>
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const time = formatTimestamp(log.created_at);
                    const badge = getActionBadge(log.action, log.entity_type);
                    const detailsText =
                      typeof log.details === 'object'
                        ? log.details?.message || JSON.stringify(log.details)
                        : log.details || 'No additional details provided';

                    return (
                      <tr key={log.id}>
                        {/* Timestamp */}
                        <td>
                          <div className="log-time-primary">{time.primary}</div>
                          <div className="log-time-relative">{time.relative}</div>
                        </td>

                        {/* User / Actor */}
                        <td>
                          <div className="log-user-wrap">
                            <div
                              className="log-user-avatar"
                              style={{ backgroundColor: getAvatarBg(log.user_role, log.user_name) }}
                            >
                              {getInitials(log.user_name)}
                            </div>
                            <div>
                              <div className="log-user-name">{log.user_name}</div>
                              <div className="log-user-email">{log.user_email}</div>
                            </div>
                          </div>
                        </td>

                        {/* Company (SuperAdmin view only) */}
                        {superAdmin && (
                          <td>
                            <span
                              className={`log-company-tag ${
                                !log.business_id ? 'company-global' : ''
                              }`}
                            >
                              <i className={`bi ${!log.business_id ? 'bi-globe' : 'bi-building'}`}></i>
                              {log.business_name || (log.business_id ? `Business #${log.business_id}` : 'Global System')}
                            </span>
                          </td>
                        )}

                        {/* Action Type */}
                        <td>
                          <span className={`log-action-pill ${badge.className}`}>
                            <i className={`bi ${badge.icon}`}></i>
                            {badge.label}
                          </span>
                        </td>

                        {/* Details */}
                        <td>
                          <div className="log-details-text">{detailsText}</div>
                        </td>

                        {/* IP Address */}
                        <td>
                          <span className="log-ip-badge">{log.ip_address || '127.0.0.1'}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 5. Pagination Footer */}
          <div className="logs-pagination-footer">
            <div className="logs-pagination-info">
              Showing <strong>{logs.length}</strong> of <strong>{pagination.total}</strong> total events
              {pagination.totalPages > 1 && ` (Page ${pagination.page} of ${pagination.totalPages})`}
            </div>

            <div className="logs-pagination-buttons">
              <button
                type="button"
                className="logs-btn-page"
                disabled={currentPage <= 1 || loading}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <i className="bi bi-chevron-left me-1"></i> Previous
              </button>
              <button
                type="button"
                className="logs-btn-page"
                disabled={currentPage >= pagination.totalPages || loading}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                Next <i className="bi bi-chevron-right ms-1"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

