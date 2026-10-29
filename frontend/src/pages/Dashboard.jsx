import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';

export default function Dashboard() {
  const { business, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentCampaigns, setRecentCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, campsRes] = await Promise.all([
        api.get('/analytics/dashboard'),
        api.get('/campaigns')
      ]);

      if (statsRes.data?.success) setStats(statsRes.data.data);
      if (campsRes.data?.success) setRecentCampaigns(campsRes.data.data.slice(0, 5));
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-success" role="status"></div>
        <div className="text-muted small mt-2">Loading workspace analytics...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Welcome Banner */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between mb-4 gap-3">
        <div>
          <h2 className="brand-font mb-1">Welcome back, {user?.name} 👋</h2>
          <p className="text-muted mb-0">
            WhatsApp Marketing Automation overview for <strong className="text-dark">{business?.name}</strong>
          </p>
        </div>
        <div className="d-flex gap-2">
          <Link to="/campaigns/new" className="btn btn-cf-primary d-flex align-items-center gap-2">
            <i className="bi bi-plus-lg"></i>
            <span>New Campaign</span>
          </Link>
          <Link to="/imports" className="btn btn-outline-secondary d-flex align-items-center gap-2">
            <i className="bi bi-file-earmark-arrow-up"></i>
            <span>Import CSV</span>
          </Link>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="stat-card">
            <div className="stat-icon-wrapper stat-icon-green">
              <i className="bi bi-people"></i>
            </div>
            <div>
              <div className="stat-label">Total Audience</div>
              <div className="stat-value">{stats?.totalContacts || 0}</div>
              <div className="small text-success fw-semibold">
                <i className="bi bi-check2-circle me-1"></i>
                {stats?.optInRate || 0}% Opted In
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="stat-card">
            <div className="stat-icon-wrapper stat-icon-blue">
              <i className="bi bi-send-check"></i>
            </div>
            <div>
              <div className="stat-label">Messages Dispatched</div>
              <div className="stat-value">{stats?.totalSent || 0}</div>
              <div className="small text-muted">
                {stats?.totalCampaigns || 0} Campaigns total
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="stat-card">
            <div className="stat-icon-wrapper stat-icon-purple">
              <i className="bi bi-check2-all"></i>
            </div>
            <div>
              <div className="stat-label">Delivery Success</div>
              <div className="stat-value">{stats?.deliveryRate || 0}%</div>
              <div className="small text-muted">
                {stats?.totalDelivered || 0} Delivered
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="stat-card">
            <div className="stat-icon-wrapper stat-icon-orange">
              <i className="bi bi-eye"></i>
            </div>
            <div>
              <div className="stat-label">Read Rate</div>
              <div className="stat-value">{stats?.readRate || 0}%</div>
              <div className="small text-muted">
                {stats?.totalRead || 0} Read by users
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Chart & Quick Links */}
      <div className="row g-4 mb-4">
        <div className="col-12 col-lg-8">
          <div className="cf-card h-100">
            <div className="cf-card-header">
              <div>
                <h5 className="mb-0">WhatsApp Delivery Trends</h5>
                <span className="small text-muted">Real-time delivery & read rates recorded via webhooks</span>
              </div>
              <span className="badge bg-light text-secondary border">Last 7 Days</span>
            </div>
            <div className="cf-card-body">
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={stats?.dailyTrend || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                    />
                    <Legend />
                    <Bar dataKey="sent" fill="#0d6efd" name="Sent" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="delivered" fill="#25D366" name="Delivered" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="read" fill="#fd7e14" name="Read" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-4">
          <div className="cf-card h-100">
            <div className="cf-card-header">
              <h5 className="mb-0">Fast Actions</h5>
            </div>
            <div className="cf-card-body d-flex flex-column gap-3">
              <Link to="/campaigns/new" className="p-3 border rounded-3 text-decoration-none text-dark d-flex align-items-center justify-content-between hover-shadow transition">
                <div className="d-flex align-items-center gap-3">
                  <div className="p-2 rounded bg-success-subtle text-success">
                    <i className="bi bi-megaphone fs-5"></i>
                  </div>
                  <div>
                    <div className="fw-semibold">Launch Broadcast</div>
                    <div className="small text-muted">5-step compliant campaign wizard</div>
                  </div>
                </div>
                <i className="bi bi-chevron-right text-muted"></i>
              </Link>

              <Link to="/ai-assistant" className="p-3 border rounded-3 text-decoration-none text-dark d-flex align-items-center justify-content-between hover-shadow transition">
                <div className="d-flex align-items-center gap-3">
                  <div className="p-2 rounded bg-primary-subtle text-primary">
                    <i className="bi bi-stars fs-5"></i>
                  </div>
                  <div>
                    <div className="fw-semibold">AI Copy Generator</div>
                    <div className="small text-muted">Hindi, Hinglish & English copy</div>
                  </div>
                </div>
                <i className="bi bi-chevron-right text-muted"></i>
              </Link>

              <Link to="/whatsapp" className="p-3 border rounded-3 text-decoration-none text-dark d-flex align-items-center justify-content-between hover-shadow transition">
                <div className="d-flex align-items-center gap-3">
                  <div className="p-2 rounded bg-warning-subtle text-warning">
                    <i className="bi bi-patch-check fs-5"></i>
                  </div>
                  <div>
                    <div className="fw-semibold">Meta WABA Status</div>
                    <div className="small text-muted">Tier 10K / Green Quality</div>
                  </div>
                </div>
                <i className="bi bi-chevron-right text-muted"></i>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Campaigns Table */}
      <div className="cf-card">
        <div className="cf-card-header">
          <h5 className="mb-0">Recent Marketing Campaigns</h5>
          <Link to="/campaigns" className="btn btn-sm btn-outline-secondary">View All</Link>
        </div>
        <div className="table-responsive">
          <table className="table cf-table">
            <thead>
              <tr>
                <th>Campaign Name</th>
                <th>Template</th>
                <th>Status</th>
                <th>Recipients</th>
                <th>Delivery Rate</th>
                <th>Read Rate</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentCampaigns.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-4 text-muted">
                    No marketing campaigns created yet. Click "New Campaign" to create your first broadcast!
                  </td>
                </tr>
              ) : (
                recentCampaigns.map((camp) => {
                  const delRate = camp.sent_count > 0 ? Math.round((camp.delivered_count / camp.sent_count) * 100) : 0;
                  const readRate = camp.delivered_count > 0 ? Math.round((camp.read_count / camp.delivered_count) * 100) : 0;

                  return (
                    <tr key={camp.id}>
                      <td>
                        <div className="fw-semibold text-dark">{camp.name}</div>
                        <div className="small text-muted">{camp.purpose || 'Promotional broadcast'}</div>
                      </td>
                      <td>
                        <span className="badge bg-light text-dark border">
                          {camp.template_name || 'Standard Template'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge-status badge-${camp.status}`}>
                          {camp.status}
                        </span>
                      </td>
                      <td>
                        <strong>{camp.total_recipients}</strong>
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div className="progress flex-grow-1" style={{ height: '6px' }}>
                            <div className="progress-bar bg-success" style={{ width: `${delRate}%` }}></div>
                          </div>
                          <span className="small text-muted">{delRate}%</span>
                        </div>
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div className="progress flex-grow-1" style={{ height: '6px' }}>
                            <div className="progress-bar bg-warning" style={{ width: `${readRate}%` }}></div>
                          </div>
                          <span className="small text-muted">{readRate}%</span>
                        </div>
                      </td>
                      <td className="text-end">
                        <Link to={`/campaigns/${camp.id}`} className="btn btn-sm btn-outline-primary">
                          View Report
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
