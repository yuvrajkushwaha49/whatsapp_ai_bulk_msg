import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import '../../styles/adminDashboard.css';

export default function AdminOverview() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('Last 30 Days');
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Add Business Modal
  const [showAddBusinessModal, setShowAddBusinessModal] = useState(false);
  const [newBizForm, setNewBizForm] = useState({
    businessName: '',
    name: '',
    email: '',
    password: '',
    timezone: 'Asia/Kolkata'
  });
  const [creatingBiz, setCreatingBiz] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/dashboard');
      if (res.data?.success) {
        setStats(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load SuperAdmin Dashboard', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleCreateBusiness = async (e) => {
    e.preventDefault();
    if (!newBizForm.businessName.trim() || !newBizForm.name.trim() || !newBizForm.email.trim() || !newBizForm.password.trim()) {
      setFeedback({ type: 'danger', text: 'Please fill in all required fields.' });
      return;
    }

    setCreatingBiz(true);
    setFeedback({ type: '', text: '' });
    try {
      const res = await api.post('/admin/businesses', newBizForm);
      if (res.data?.success) {
        setFeedback({
          type: 'success',
          text: `🎉 Business "${newBizForm.businessName}" created successfully! Owner login: ${newBizForm.email}`
        });
        setShowAddBusinessModal(false);
        setNewBizForm({
          businessName: '',
          name: '',
          email: '',
          password: '',
          timezone: 'Asia/Kolkata'
        });
        fetchDashboardData();
      }
    } catch (err) {
      setFeedback({
        type: 'danger',
        text: err.response?.data?.message || 'Failed to create business and owner.'
      });
    } finally {
      setCreatingBiz(false);
    }
  };

  // Real database stats
  const totalBusinesses = stats?.totalBusinesses ?? 0;
  const activeBusinesses = stats?.activeBusinesses ?? 0;
  const totalWANumbers = stats?.totalWhatsAppAccounts ?? 0;
  const activeNumbers = stats?.connectedAccounts ?? 0;
  const totalMessagesSent = stats?.totalMessagesSent ?? 0;
  const totalRevenue = stats?.totalRevenueEstimated ?? 0;

  // Real database Business Growth chart series
  const businessGrowthData = (stats?.businessGrowth && stats.businessGrowth.length > 0)
    ? stats.businessGrowth
    : [{ date: 'Today', businesses: totalBusinesses }];

  // Real database Messages Overview chart series (Client-wise message counts)
  const messagesOverviewData = (stats?.messagesOverview && stats.messagesOverview.length > 0)
    ? stats.messagesOverview
    : [{ client: 'All Clients', shortClient: 'All Clients', sent: totalMessagesSent, delivered: stats?.totalDelivered || 0 }];

  // Real database WhatsApp Accounts Donut series
  const waAccountsDonutData = (stats?.waAccountsOverview && stats.waAccountsOverview.length > 0)
    ? stats.waAccountsOverview
    : [
      { name: 'Active', value: activeNumbers, percentage: `${totalWANumbers ? ((activeNumbers / totalWANumbers) * 100).toFixed(1) : 0}%`, color: '#10b981' },
      { name: 'Pending Approval', value: stats?.pendingAccounts || 0, percentage: `${totalWANumbers ? (((stats?.pendingAccounts || 0) / totalWANumbers) * 100).toFixed(1) : 0}%`, color: '#f59e0b' },
      { name: 'Inactive', value: stats?.attentionRequiredAccounts || 0, percentage: `${totalWANumbers ? (((stats?.attentionRequiredAccounts || 0) / totalWANumbers) * 100).toFixed(1) : 0}%`, color: '#ef4444' }
    ];

  // Real database Revenue Analytics series
  const revenueAnalyticsData = (stats?.revenueAnalytics && stats.revenueAnalytics.length > 0)
    ? stats.revenueAnalytics
    : [{ month: 'Nov', revenue: totalRevenue, fill: '#7c3aed', isCurrent: true }];

  // Real database Latest Businesses
  const latestBusinesses = (stats?.latestBusinesses && stats.latestBusinesses.length > 0)
    ? stats.latestBusinesses
    : [];

  // Real database Recent Activity Feed
  const recentActivityList = (stats?.recentActivity && stats.recentActivity.length > 0)
    ? stats.recentActivity.map(act => {
      let iconClass = 'admin-activity-blue';
      let icon = 'bi-people-fill';

      if (act.type === 'number' || act.action?.includes('WA')) {
        iconClass = 'admin-activity-green';
        icon = 'bi-whatsapp';
      } else if (act.type === 'subscription' || act.action?.includes('SUBSCRIPTION')) {
        iconClass = 'admin-activity-purple';
        icon = 'bi-layers-fill';
      } else if (act.type === 'admin' || act.action?.includes('ADMIN') || act.action?.includes('LOGIN')) {
        iconClass = 'admin-activity-blue';
        icon = 'bi-person-badge';
      }

      return {
        id: act.id,
        icon,
        iconClass,
        text: act.message || `${act.action} - ${act.business_name}`,
        time: act.timeAgo || 'Recently'
      };
    })
    : [];

  return (
    <div className="admin-dashboard-wrapper">
      {/* Top Header */}
      <header className="admin-dash-header">
        <div className="admin-dash-title-wrap">
          <div>
            <h1 className="admin-dash-title">Super Admin Dashboard</h1>
            <p className="admin-dash-subtitle">Manage businesses, WhatsApp accounts, subscriptions and platform activity.</p>
          </div>
        </div>

        <div className="admin-dash-header-actions">
          {/* Date Selector Pill */}
          <div className="admin-date-pill dropdown">
            <button
              className="btn btn-sm p-0 d-flex align-items-center gap-2 border-0 bg-transparent text-dark fw-semibold admin-date-btn"
              type="button"
              data-bs-toggle="dropdown"
            >
              <i className="bi bi-calendar3 text-muted"></i>
              <span>{timeRange}</span>
              <i className="bi bi-chevron-down small text-muted"></i>
            </button>
            <ul className="dropdown-menu dropdown-menu-end shadow-sm border-0 py-1">
              {['Last 7 Days', 'Last 30 Days', 'Last 90 Days', 'This Year'].map(r => (
                <li key={r}>
                  <button
                    className={`dropdown-item small ${timeRange === r ? 'active bg-primary' : ''}`}
                    onClick={() => setTimeRange(r)}
                  >
                    {r}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Notification Bell */}
          <div className="admin-notif-btn" onClick={() => navigate('/admin/logs')} title="Platform Audit Notifications">
            <i className="bi bi-bell fs-6"></i>
            <span className="admin-notif-dot"></span>
          </div>

          {/* User Profile Pill */}
          <div className="admin-profile-pill">
            <div className="admin-avatar-circle">
              {(user?.name || 'Yuvraj Singh').charAt(0).toUpperCase()}
            </div>
            <div className="admin-profile-info">
              <span className="admin-profile-name">{user?.name || 'Yuvraj Singh'}</span>
              <span className="admin-profile-role">Super Admin</span>
            </div>
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

      {/* Row 1: 6 Top KPI Metric Cards */}
      {/* Row 1: 6 Top KPI Metric Cards */}
      <section className="admin-kpi-grid">
        {/* Card 1: Total Businesses */}
        <div className="admin-kpi-card admin-kpi-card-purple admin-kpi-clickable" onClick={() => navigate('/admin/tenants')}>
          <div className="admin-kpi-icon admin-kpi-icon-purple">
            <i className="bi bi-people-fill"></i>
          </div>
          <div className="admin-kpi-details">
            <span className="admin-kpi-label">Total Businesses</span>
            <span className="admin-kpi-value">{totalBusinesses}</span>
            <div className="admin-kpi-growth">
              <span className="admin-kpi-growth-val"><i className="bi bi-arrow-up-short"></i> +12%</span>
              <span className="admin-kpi-growth-lbl">vs last 30 days</span>
            </div>
          </div>
        </div>

        {/* Card 2: Active Businesses */}
        <div className="admin-kpi-card admin-kpi-card-green admin-kpi-clickable" onClick={() => navigate('/admin/tenants')}>
          <div className="admin-kpi-icon admin-kpi-icon-green">
            <i className="bi bi-people-fill"></i>
          </div>
          <div className="admin-kpi-details">
            <span className="admin-kpi-label">Active Businesses</span>
            <span className="admin-kpi-value">{activeBusinesses}</span>
            <div className="admin-kpi-growth">
              <span className="admin-kpi-growth-val"><i className="bi bi-arrow-up-short"></i> +10%</span>
              <span className="admin-kpi-growth-lbl">vs last 30 days</span>
            </div>
          </div>
        </div>

        {/* Card 3: Total WA Numbers */}
        <div className="admin-kpi-card admin-kpi-card-blue admin-kpi-clickable" onClick={() => navigate('/admin/numbers')}>
          <div className="admin-kpi-icon admin-kpi-icon-blue">
            <i className="bi bi-telephone-fill"></i>
          </div>
          <div className="admin-kpi-details">
            <span className="admin-kpi-label">Total WA Numbers</span>
            <span className="admin-kpi-value">{totalWANumbers}</span>
            <div className="admin-kpi-growth">
              <span className="admin-kpi-growth-val"><i className="bi bi-arrow-up-short"></i> +18%</span>
              <span className="admin-kpi-growth-lbl">vs last 30 days</span>
            </div>
          </div>
        </div>

        {/* Card 4: Active Numbers */}
        <div className="admin-kpi-card admin-kpi-card-mint admin-kpi-clickable" onClick={() => navigate('/admin/numbers')}>
          <div className="admin-kpi-icon admin-kpi-icon-mint">
            <i className="bi bi-telephone-fill"></i>
          </div>
          <div className="admin-kpi-details">
            <span className="admin-kpi-label">Active Numbers</span>
            <span className="admin-kpi-value">{activeNumbers}</span>
            <div className="admin-kpi-growth">
              <span className="admin-kpi-growth-val"><i className="bi bi-arrow-up-short"></i> +16%</span>
              <span className="admin-kpi-growth-lbl">vs last 30 days</span>
            </div>
          </div>
        </div>

        {/* Card 5: Messages Sent */}
        <div className="admin-kpi-card admin-kpi-card-violet">
          <div className="admin-kpi-icon admin-kpi-icon-violet">
            <i className="bi bi-send-fill"></i>
          </div>
          <div className="admin-kpi-details">
            <span className="admin-kpi-label">Messages Sent</span>
            <span className="admin-kpi-value">{Number(totalMessagesSent).toLocaleString('en-IN')}</span>
            <div className="admin-kpi-growth">
              <span className="admin-kpi-growth-val"><i className="bi bi-arrow-up-short"></i> +27%</span>
              <span className="admin-kpi-growth-lbl">vs last 30 days</span>
            </div>
          </div>
        </div>

        {/* Card 6: Total Revenue */}
        <div className="admin-kpi-card admin-kpi-card-amber admin-kpi-clickable" onClick={() => navigate('/admin/billing')}>
          <div className="admin-kpi-icon admin-kpi-icon-amber">
            <i className="bi bi-coin"></i>
          </div>
          <div className="admin-kpi-details">
            <span className="admin-kpi-label">Total Revenue</span>
            <span className="admin-kpi-value">${Number(totalRevenue).toLocaleString()}</span>
            <div className="admin-kpi-growth">
              <span className="admin-kpi-growth-val"><i className="bi bi-arrow-up-short"></i> +24%</span>
              <span className="admin-kpi-growth-lbl">vs last 30 days</span>
            </div>
          </div>
        </div>
      </section>

      {/* Row 2: Two Large Charts (Business Growth & Messages Overview) */}
      <section className="row g-3 mb-4">
        {/* Left Chart: Business Growth */}
        <div className="col-12 col-lg-6">
          <div className="admin-card">
            <div className="admin-card-header">
              <h2 className="admin-card-title">
                <i className="bi bi-people-fill admin-icon-purple"></i>
                <span>Business Growth</span>
              </h2>
              <span className="admin-card-badge-green">
                <i className="bi bi-arrow-up-short"></i> +12%
              </span>
            </div>

            <div className="admin-chart-box-lg">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={businessGrowthData} margin={{ top: 25, right: 15, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} domain={[0, 'auto']} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="businesses"
                    stroke="#7c3aed"
                    strokeWidth={2.5}
                    dot={{ stroke: '#7c3aed', strokeWidth: 2, fill: '#ffffff', r: 4 }}
                    activeDot={{ r: 6, fill: '#7c3aed' }}
                    fill="url(#growthGrad)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>

              {/* Floating Pill on top peak */}
              <div className="admin-growth-peak-badge">
                {totalBusinesses} Businesses
              </div>
            </div>
          </div>
        </div>

        {/* Right Chart: Messages Overview (Grouped Bars by Client) */}
        <div className="col-12 col-lg-6">
          <div className="admin-card">
            <div className="admin-card-header">
              <h2 className="admin-card-title">
                <i className="bi bi-send-fill admin-icon-purple"></i>
                <span>Messages Overview</span>
                <span className="badge bg-light text-primary border ms-2 fw-semibold admin-badge-count">
                  {totalMessagesSent} Total (All Clients)
                </span>
              </h2>
              <div className="d-flex align-items-center gap-3 small">
                <span className="admin-chart-legend-label">
                  <span className="admin-legend-dot-green"></span>
                  Sent
                </span>
                <span className="admin-chart-legend-label">
                  <span className="admin-legend-dot-blue"></span>
                  Delivered
                </span>
              </div>
            </div>

            <div className="admin-chart-box-md">
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={messagesOverviewData} margin={{ top: 20, right: 15, left: -15, bottom: 0 }} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="shortClient" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    domain={[0, 'auto']}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="admin-chart-tooltip">
                            <div className="admin-tooltip-title">
                              <i className="bi bi-building me-1 text-primary"></i>
                              {data.client || data.shortClient}
                            </div>
                            <div className="d-flex align-items-center gap-2 small text-success">
                              <span>Sent:</span> <span className="fw-medium">{data.sent || 0} msgs</span>
                            </div>
                            <div className="d-flex align-items-center gap-2 small text-primary">
                              <span>Delivered:</span> <span className="fw-medium">{data.delivered || 0} msgs</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="sent" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
                  <Bar dataKey="delivered" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Client-wise Mini Message Breakdown Footer */}
            <div className="d-flex flex-wrap align-items-center gap-2 pt-2 px-1 border-top mt-2 admin-breakdown-footer">
              <span className="text-muted fw-semibold">Clients ({messagesOverviewData.length}):</span>
              {messagesOverviewData.map((item, idx) => (
                <span key={idx} className="badge bg-light text-dark border d-flex align-items-center gap-1 py-1 px-2">
                  <span className="fw-medium">{item.client || item.shortClient}:</span>
                  <span className="text-success fw-medium">{item.sent} sent</span>
                  <span className="text-muted">/ {item.delivered} deliv</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Row 3: 3 Cards (WhatsApp Accounts Overview, Revenue Analytics, Quick Actions) */}
      <section className="row g-3 mb-4">
        {/* Card 1: WhatsApp Accounts Overview */}
        <div className="col-12 col-lg-4">
          <div className="admin-card">
            <div className="admin-card-header">
              <h2 className="admin-card-title">
                <i className="bi bi-whatsapp admin-icon-green"></i>
                <span>WhatsApp Accounts Overview</span>
              </h2>
            </div>

            <div className="admin-donut-wrapper">
              {/* Donut Chart with Center Text */}
              <div className="admin-donut-box">
                <ResponsiveContainer width={140} height={140}>
                  <PieChart>
                    <Pie
                      data={waAccountsDonutData}
                      innerRadius={46}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                      isAnimationActive={false}
                    >
                      {waAccountsDonutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                <div className="admin-donut-center-text">
                  <div className="admin-donut-number">{totalWANumbers}</div>
                  <div className="admin-donut-sub">Total<br />Numbers</div>
                </div>
              </div>

              {/* Legend with exact numbers & percentages */}
              <div className="d-flex flex-column justify-content-center">
                {waAccountsDonutData.map((item, i) => {
                  const dotClass = item.name === 'Active'
                    ? 'admin-dot-active'
                    : item.name?.includes('Pending')
                      ? 'admin-dot-pending'
                      : 'admin-dot-inactive';
                  return (
                    <div key={i} className="admin-legend-item">
                      <div className="d-flex align-items-center">
                        <span className={`admin-legend-dot ${dotClass}`}></span>
                        <span className="text-dark fw-medium">{item.name}</span>
                      </div>
                      <div>
                        <strong className="text-dark">{item.value}</strong>
                        <span className="text-muted ms-1">({item.percentage})</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Revenue Analytics */}
        <div className="col-12 col-lg-4">
          <div className="admin-card">
            <div className="admin-card-header">
              <h2 className="admin-card-title">
                <i className="bi bi-bar-chart-fill admin-icon-purple"></i>
                <span>Revenue Analytics</span>
              </h2>
              <span className="admin-card-badge-green">
                <i className="bi bi-arrow-up-short"></i> +24%
              </span>
            </div>

            <div className="admin-revenue-chart-box">
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={revenueAnalyticsData} margin={{ top: 25, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(v) => (v === 0 ? '$0' : `$${v}`)}
                    domain={[0, 'auto']}
                  />
                  <Tooltip
                    formatter={(val) => [`$${val}`, 'Revenue']}
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
                    }}
                  />
                  <Bar dataKey="revenue" radius={[6, 6, 0, 0]} maxBarSize={28} isAnimationActive={false}>
                    {revenueAnalyticsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Floating tag on November bar */}
              <div className="admin-revenue-floating-badge">
                ${Number(totalRevenue).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Quick Actions */}
        <div className="col-12 col-lg-4">
          <div className="admin-card">
            <div className="admin-card-header">
              <h2 className="admin-card-title">
                <i className="bi bi-lightning-charge-fill admin-icon-purple"></i>
                <span>Quick Actions</span>
              </h2>
            </div>

            <div className="admin-quick-actions-grid">
              {/* Action 1: + Add Business */}
              <button
                className="admin-action-btn admin-action-purple"
                onClick={() => setShowAddBusinessModal(true)}
              >
                <i className="bi bi-people-fill fs-5"></i>
                <span>+ Add Business</span>
              </button>

              {/* Action 2: + Add WA Number */}
              <button
                className="admin-action-btn admin-action-green"
                onClick={() => navigate('/admin/numbers')}
              >
                <i className="bi bi-whatsapp fs-5"></i>
                <span>+ Add WA Number</span>
              </button>

              {/* Action 3: Manage Plans */}
              <button
                className="admin-action-btn admin-action-orange"
                onClick={() => navigate('/admin/billing')}
              >
                <i className="bi bi-layers-fill fs-5"></i>
                <span>Manage Plans</span>
              </button>

              {/* Action 4: Add Admin */}
              <button
                className="admin-action-btn admin-action-blue"
                onClick={() => setShowAddBusinessModal(true)}
              >
                <i className="bi bi-person-plus-fill fs-5"></i>
                <span>Add Admin</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Row 4: Two Tables / Lists (Recent Activity & Latest Businesses) */}
      <section className="row g-3">
        {/* Left Column: Recent Activity */}
        <div className="col-12 col-lg-5">
          <div className="admin-card">
            <div className="admin-card-header">
              <h2 className="admin-card-title">
                <i className="bi bi-clock-history admin-icon-purple"></i>
                <span>Recent Activity</span>
              </h2>
              <span className="admin-card-link" onClick={() => navigate('/admin/logs')}>
                View All <i className="bi bi-arrow-right"></i>
              </span>
            </div>

            <div className="admin-activity-list">
              {recentActivityList.length === 0 ? (
                <div className="text-center py-4 text-muted small">
                  No activity logs found in database.
                </div>
              ) : (
                recentActivityList.map((item, i) => (
                  <div key={item.id || i} className="admin-activity-item">
                    <div className={`admin-activity-icon ${item.iconClass || 'admin-activity-blue'}`}>
                      <i className={`bi ${item.icon}`}></i>
                    </div>
                    <div
                      className="admin-activity-text"
                      dangerouslySetInnerHTML={{ __html: item.text }}
                    />
                    <div className="admin-activity-time">{item.time}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Latest Businesses */}
        <div className="col-12 col-lg-7">
          <div className="admin-card">
            <div className="admin-card-header">
              <h2 className="admin-card-title">
                <i className="bi bi-buildings-fill admin-icon-purple"></i>
                <span>Latest Businesses</span>
              </h2>
              <span className="admin-card-link" onClick={() => navigate('/admin/tenants')}>
                View All <i className="bi bi-arrow-right"></i>
              </span>
            </div>

            <div className="table-responsive">
              <table className="admin-table-clean">
                <thead>
                  <tr>
                    <th>Business Name</th>
                    <th>Plan</th>
                    <th>WhatsApp Numbers</th>
                    <th>Message Usage</th>
                    <th>Status</th>
                    <th>Joined On</th>
                  </tr>
                </thead>
                <tbody>
                  {latestBusinesses.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-4 text-muted small">
                        No businesses found in database. Click <strong>+ Add Business</strong> above to create one.
                      </td>
                    </tr>
                  ) : (
                    latestBusinesses.map((biz, idx) => (
                      <tr key={biz.id || idx}>
                        <td
                          className="fw-semibold text-dark admin-kpi-clickable"
                          onClick={() => biz.id && navigate(`/admin/businesses/${biz.id}`)}
                          title="Click to view tenant governance details"
                        >
                          {biz.name} <i className="bi bi-arrow-up-right text-muted admin-mini-arrow-icon"></i>
                        </td>
                        <td>
                          <span className={`admin-plan-badge ${biz.planClass}`}>
                            {biz.plan}
                          </span>
                        </td>
                        <td className="fw-semibold text-muted">{biz.numbers}</td>
                        <td>
                          <div className="small fw-semibold text-success mb-1">
                            {biz.usageCurrent} <span className="text-muted fw-normal">/ {biz.usageMax}</span>
                          </div>
                          <div className="progress admin-progress-track">
                            <div
                              className="progress-bar bg-success"
                              role="progressbar"
                              style={{ width: `${biz.progress}%` }}
                            />
                          </div>
                        </td>
                        <td>
                          <span className="admin-status-pill">{biz.status}</span>
                        </td>
                        <td className="text-muted small">{biz.joinedOn}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Modal: + Add Business & Owner */}
      {showAddBusinessModal && (
        <div className="modal show d-block admin-modal-backdrop-show" tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow-lg border-0 rounded-4 overflow-hidden">
              <div className="modal-header bg-primary text-white py-3 px-4">
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-buildings-fill fs-5"></i>
                  <div>
                    <h5 className="modal-title fw-semibold mb-0">Create New Business & Tenant Owner</h5>
                    <small className="text-white-50">Registers a new tenant with dedicated Owner account</small>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  disabled={creatingBiz}
                  onClick={() => setShowAddBusinessModal(false)}
                ></button>
              </div>

              <form onSubmit={handleCreateBusiness}>
                <div className="modal-body p-4">
                  <div className="row g-4">
                    <div className="col-12">
                      <div className="d-flex align-items-center gap-2 text-primary fw-semibold pb-2 border-bottom">
                        <i className="bi bi-building"></i>
                        <span>Business Information</span>
                      </div>
                    </div>

                    <div className="col-md-7">
                      <label className="form-label fw-semibold small text-muted">
                        Business / Company Name <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. TechGrow Media / Acme Corp"
                        value={newBizForm.businessName}
                        onChange={(e) => setNewBizForm({ ...newBizForm, businessName: e.target.value })}
                        required
                        disabled={creatingBiz}
                      />
                    </div>

                    <div className="col-md-5">
                      <label className="form-label fw-semibold small text-muted">Timezone</label>
                      <select
                        className="form-select"
                        value={newBizForm.timezone}
                        onChange={(e) => setNewBizForm({ ...newBizForm, timezone: e.target.value })}
                        disabled={creatingBiz}
                      >
                        <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                        <option value="Asia/Dubai">Asia/Dubai (GST +4:00)</option>
                        <option value="Europe/London">Europe/London (GMT/BST)</option>
                        <option value="America/New_York">America/New_York (EST/EDT)</option>
                        <option value="UTC">UTC</option>
                      </select>
                    </div>

                    <div className="col-12 mt-3">
                      <div className="d-flex align-items-center gap-2 text-primary fw-semibold pb-2 border-bottom">
                        <i className="bi bi-person-badge"></i>
                        <span>Owner Credentials (Tenant Admin)</span>
                      </div>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label fw-semibold small text-muted">
                        Owner Full Name <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Ankit Verma"
                        value={newBizForm.name}
                        onChange={(e) => setNewBizForm({ ...newBizForm, name: e.target.value })}
                        required
                        disabled={creatingBiz}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label fw-semibold small text-muted">
                        Owner Email Address <span className="text-danger">*</span>
                      </label>
                      <input
                        type="email"
                        className="form-control"
                        placeholder="e.g. ankit@techgrow.com"
                        value={newBizForm.email}
                        onChange={(e) => setNewBizForm({ ...newBizForm, email: e.target.value })}
                        required
                        disabled={creatingBiz}
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label fw-semibold small text-muted">
                        Initial Login Password <span className="text-danger">*</span>
                      </label>
                      <div className="input-group">
                        <input
                          type="text"
                          className="form-control font-monospace"
                          placeholder="Set password (e.g. Pass@12345)"
                          value={newBizForm.password}
                          onChange={(e) => setNewBizForm({ ...newBizForm, password: e.target.value })}
                          required
                          disabled={creatingBiz}
                        />
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          disabled={creatingBiz}
                          onClick={() => {
                            const gen = 'Pass@' + Math.random().toString(36).slice(-6) + '!';
                            setNewBizForm({ ...newBizForm, password: gen });
                          }}
                        >
                          Generate Random
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="modal-footer bg-light py-3 px-4 d-flex justify-content-between">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm px-4"
                    disabled={creatingBiz}
                    onClick={() => setShowAddBusinessModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm px-4 d-flex align-items-center gap-2"
                    disabled={creatingBiz}
                  >
                    {creatingBiz ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status"></span>
                        <span>Creating Business...</span>
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle-fill"></i>
                        <span>Create Business & Owner</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
