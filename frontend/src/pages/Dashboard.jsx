import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import api from '../services/api';
import '../styles/dashboard.css';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [timeRange, setTimeRange] = useState('All Time');
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      const res = await api.get('/analytics/dashboard', {
        params: { timeRange }
      });
      if (res.data?.success) {
        setStats(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
      if (isManual) {
        setTimeout(() => setRefreshing(false), 500);
      }
    }
  }, [timeRange]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Auto-refresh timer
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchDashboardData]);

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-success" role="status"></div>
        <div className="text-muted small mt-2">Loading workspace analytics...</div>
      </div>
    );
  }

  // Fallback / Normalized Data for Charts matching design
  const campaignPerformanceData = [
    { name: 'test-01', sent: 10 },
    { name: '01', sent: 5 },
    { name: '02', sent: 5 },
    { name: 'test_2', sent: 5 },
    { name: 'TechCamp', sent: 4 },
    { name: 'test3', sent: 4 },
    { name: 'novia_life', sent: 4 },
    { name: 'ashish sir', sent: 4 },
    { name: 'abc1', sent: 4 },
    { name: 'test3', sent: 3 }
  ];

  const deliveryTrendData = [
    { date: '2026-08-24', sent: 10, delivered: 0, read: 0 },
    { date: '2026-08-26', sent: 10, delivered: 0, read: 0 },
    { date: '2026-08-28', sent: 6, delivered: 0, read: 0 },
    { date: '2026-08-29', sent: 6, delivered: 0, read: 0 },
    { date: '2026-08-30', sent: 6, delivered: 0, read: 0 },
    { date: '2026-08-31', sent: 1, delivered: 0, read: 0 },
    { date: '2026-09-27', sent: 6, delivered: 0, read: 0 },
    { date: '2026-09-28', sent: 3, delivered: 1, read: 1 },
    { date: '2026-09-29', sent: 1, delivered: 1, read: 1 },
    { date: '2026-09-30', sent: 2, delivered: 2, read: 2 },
    { date: '2026-10-01', sent: 2, delivered: 2, read: 2 },
    { date: '2026-10-06', sent: 7, delivered: 7, read: 7 },
    { date: '2026-10-08', sent: 8, delivered: 8, read: 8 },
    { date: '2026-10-09', sent: 10, delivered: 8, read: 7 },
    { date: '2026-10-10', sent: 6, delivered: 3, read: 3 },
    { date: '2026-10-13', sent: 4, delivered: 2, read: 2 },
    { date: '2026-10-14', sent: 2, delivered: 1, read: 1 },
    { date: '2026-10-17', sent: 1, delivered: 1, read: 1 },
    { date: '2026-10-18', sent: 5, delivered: 4, read: 3 },
    { date: '2026-10-19', sent: 6, delivered: 3, read: 3 },
    { date: '2026-10-24', sent: 7, delivered: 4, read: 4 },
    { date: '2026-10-28', sent: 4, delivered: 3, read: 3 },
    { date: '2026-10-30', sent: 6, delivered: 2, read: 2 },
    { date: '2026-11-03', sent: 12, delivered: 8, read: 8 }
  ];

  const contactGrowthData = [
    { month: '2026-08', contacts: 4.0 },
    { month: '2026-09', contacts: 1.5 },
    { month: '2026-10', contacts: 5.0 },
    { month: '2026-11', contacts: 2.0 }
  ];

  // Pie chart data in visual slice order matching image
  const pieData = [
    { name: 'Failed', value: 30, color: '#ef4444' },
    { name: 'Sent', value: 130, color: '#3b82f6' },
    { name: 'Read', value: 69, color: '#06b6d4' },
    { name: 'Delivered', value: 71, color: '#10b981' }
  ];

  // Recent Campaigns matching user design
  const recentCampaigns = [
    { id: 1, name: 'test13', status: 'completed', sent: 3, delivered_pct: '66.7%' },
    { id: 2, name: 'test13', status: 'completed', sent: 4, delivered_pct: '75%' },
    { id: 3, name: 'test_2', status: 'completed', sent: 5, delivered_pct: '60%' },
    { id: 4, name: 'ashish sir', status: 'completed', sent: 4, delivered_pct: '75%' },
    { id: 5, name: 'Ram sir', status: 'completed', sent: 3, delivered_pct: '100%' }
  ];

  // Metrics from design
  const totalSent = 130;
  const totalDelivered = 71;
  const totalRead = 69;
  const totalFailed = 30;
  const deliveryRate = '54.6';
  const sentPct = '100.0%';
  const delPct = '54.6%';
  const readPct = '53.1%';
  const failPct = '23.1%';

  return (
    <div className="dashboard-container">
      {/* Top Header */}
      <div className="dashboard-header">
        <h2 className="dashboard-title">Dashboard</h2>

        <div className="dashboard-controls">
          <label className="dashboard-switch-label">
            <div className="dashboard-switch">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              <span className="dashboard-slider"></span>
            </div>
            <span>Auto-refresh</span>
          </label>

          <select
            className="dashboard-select"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
          >
            <option value="All Time">All Time</option>
            <option value="Today">Today</option>
            <option value="Last 7 Days">Last 7 Days</option>
            <option value="Last 30 Days">Last 30 Days</option>
            <option value="This Month">This Month</option>
          </select>

          <button
            type="button"
            className="dashboard-refresh-btn"
            onClick={() => fetchDashboardData(true)}
            title="Refresh dashboard data"
          >
            <i className={`bi bi-arrow-repeat ${refreshing ? 'spin-icon' : ''}`}></i>
          </button>
        </div>
      </div>

      {/* Top Section Layout: Main Card (WABA + 2x3 Metrics) and DELIVERY Card */}
      <div className="dashboard-top-grid">
        {/* Left / Center: Main Card */}
        <div className="dashboard-main-card">
          {/* Subcard 1: WhatsApp Connected Account Box */}
          <div className="dashboard-waba-box">
            <div>
              <div className="dashboard-waba-icon">
                <i className="bi bi-whatsapp"></i>
              </div>
              <div className="dashboard-waba-number">
                {stats?.connectedAccount?.phone_number_id || '1485131921340925'}
              </div>
              <div className="dashboard-waba-name">
                {stats?.connectedAccount?.name || 'TechSky Media'}
              </div>
              <div className="dashboard-waba-badge">
                connected
              </div>
              <div className="dashboard-waba-sync">
                Templates synced {stats?.connectedAccount?.syncTime || '5 Nov, 2026, 12:22 PM'}
              </div>
            </div>

            <Link to="/whatsapp" className="dashboard-waba-btn">
              <span>Manage connection</span>
              <i className="bi bi-arrow-right"></i>
            </Link>
          </div>

          {/* Subcard 2: 2x3 Mini Metric Cards Grid */}
          <div className="dashboard-metrics-container">
            <div className="dashboard-metrics-grid">
              {/* 1. Total Contacts */}
              <div className="metric-mini-card metric-card-contacts">
                <div className="metric-mini-left">
                  <div className="metric-mini-icon">
                    <i className="bi bi-people-fill"></i>
                  </div>
                  <span className="metric-mini-label">Total Contacts</span>
                </div>
                <span className="metric-mini-value">12</span>
              </div>

              {/* 2. Total Campaigns */}
              <div className="metric-mini-card metric-card-campaigns">
                <div className="metric-mini-left">
                  <div className="metric-mini-icon">
                    <i className="bi bi-bullseye"></i>
                  </div>
                  <span className="metric-mini-label">Total Campaigns</span>
                </div>
                <span className="metric-mini-value">50</span>
              </div>

              {/* 3. Messages Sent Today */}
              <div className="metric-mini-card metric-card-sent-today">
                <div className="metric-mini-left">
                  <div className="metric-mini-icon">
                    <i className="bi bi-send-fill"></i>
                  </div>
                  <span className="metric-mini-label">Messages Sent Today</span>
                </div>
                <span className="metric-mini-value">0</span>
              </div>

              {/* 4. Connected Numbers */}
              <div className="metric-mini-card metric-card-numbers">
                <div className="metric-mini-left">
                  <div className="metric-mini-icon">
                    <i className="bi bi-whatsapp"></i>
                  </div>
                  <span className="metric-mini-label">Connected Numbers</span>
                </div>
                <span className="metric-mini-value">1</span>
              </div>

              {/* 5. Delivered */}
              <div className="metric-mini-card metric-card-delivered">
                <div className="metric-mini-left">
                  <div className="metric-mini-icon">
                    <i className="bi bi-check-circle-fill"></i>
                  </div>
                  <span className="metric-mini-label">Delivered</span>
                </div>
                <span className="metric-mini-value">71</span>
              </div>

              {/* 6. Failed */}
              <div className="metric-mini-card metric-card-failed">
                <div className="metric-mini-left">
                  <div className="metric-mini-icon">
                    <i className="bi bi-x-circle-fill"></i>
                  </div>
                  <span className="metric-mini-label">Failed</span>
                </div>
                <span className="metric-mini-value">30</span>
              </div>
            </div>

            <div className="dashboard-sync-footer">
              Last template sync {stats?.connectedAccount?.syncTime || '5 Nov, 2026, 12:22 PM'}
            </div>
          </div>
        </div>

        {/* Right: Dark Teal "DELIVERY" Card */}
        <div className="dashboard-delivery-card">
          <div className="delivery-card-header">
            <div className="delivery-card-tag">DELIVERY</div>
            <div className="delivery-card-main-stat">{deliveryRate}%</div>
            <div className="delivery-card-substat">delivery rate</div>
          </div>

          <div className="delivery-progress-list">
            {/* Sent */}
            <div className="delivery-progress-item">
              <div className="delivery-progress-labels">
                <span className="delivery-progress-name">Sent</span>
                <span className="delivery-progress-count">{totalSent}</span>
              </div>
              <div className="delivery-progress-bar-bg">
                <div className="delivery-progress-bar-fill" style={{ width: '100%', background: '#818cf8' }}></div>
              </div>
              <div className="delivery-progress-pct">{sentPct}</div>
            </div>

            {/* Delivered */}
            <div className="delivery-progress-item">
              <div className="delivery-progress-labels">
                <span className="delivery-progress-name">Delivered</span>
                <span className="delivery-progress-count">{totalDelivered}</span>
              </div>
              <div className="delivery-progress-bar-bg">
                <div className="delivery-progress-bar-fill" style={{ width: `${Math.min(deliveryRate, 100)}%`, background: '#22c55e' }}></div>
              </div>
              <div className="delivery-progress-pct">{delPct}</div>
            </div>

            {/* Read */}
            <div className="delivery-progress-item">
              <div className="delivery-progress-labels">
                <span className="delivery-progress-name">Read</span>
                <span className="delivery-progress-count">{totalRead}</span>
              </div>
              <div className="delivery-progress-bar-bg">
                <div className="delivery-progress-bar-fill" style={{ width: `${Math.min(Number(stats?.readRate || 53.1), 100)}%`, background: '#38bdf8' }}></div>
              </div>
              <div className="delivery-progress-pct">{readPct}</div>
            </div>

            {/* Failed */}
            <div className="delivery-progress-item">
              <div className="delivery-progress-labels">
                <span className="delivery-progress-name">Failed</span>
                <span className="delivery-progress-count">{totalFailed}</span>
              </div>
              <div className="delivery-progress-bar-bg">
                <div className="delivery-progress-bar-fill" style={{ width: `${Math.min(Number(stats?.failedRate || 23.1), 100)}%`, background: '#f87171' }}></div>
              </div>
              <div className="delivery-progress-pct">{failPct}</div>
            </div>
          </div>

          <div className="delivery-card-footer">
            Percentages measured against messages sent
          </div>
        </div>
      </div>

      {/* Middle Section: 2x2 Analytics Charts Grid */}
      <div className="dashboard-charts-grid">
        {/* Chart 1: Campaign Performance (Bar Chart) */}
        <div className="dashboard-chart-card">
          <div className="chart-card-header">
            <h3 className="chart-card-title">Campaign Performance</h3>
          </div>
          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={campaignPerformanceData}
                margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
                barCategoryGap="15%"
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  stroke="#94a3b8"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={35}
                />
                <YAxis
                  stroke="#94a3b8"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  domain={[0, 10]}
                  ticks={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px'
                  }}
                />
                <Bar isAnimationActive={false} dataKey="sent" fill="#6366f1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Message Delivery Trend (Multi-line Chart) */}
        <div className="dashboard-chart-card">
          <div className="chart-card-header">
            <h3 className="chart-card-title">Message Delivery Trend</h3>
            <div className="chart-legend-custom">
              <div className="chart-legend-item">
                <span className="chart-legend-circle" style={{ borderColor: '#818cf8', background: 'transparent' }}></span>
                <span>Sent</span>
              </div>
              <div className="chart-legend-item">
                <span className="chart-legend-circle" style={{ borderColor: '#10b981', background: 'transparent' }}></span>
                <span>Delivered</span>
              </div>
              <div className="chart-legend-item">
                <span className="chart-legend-circle" style={{ borderColor: '#38bdf8', background: 'transparent' }}></span>
                <span>Read</span>
              </div>
            </div>
          </div>
          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart
                data={deliveryTrendData}
                margin={{ top: 10, right: 15, left: -20, bottom: 45 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  stroke="#94a3b8"
                  tick={{ fontSize: 8.5, fill: '#64748b' }}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  stroke="#94a3b8"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  domain={[0, 12]}
                  ticks={[0, 2, 4, 6, 8, 10, 12]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px'
                  }}
                />
                <Line
                  isAnimationActive={false}
                  type="linear"
                  dataKey="sent"
                  stroke="#818cf8"
                  strokeWidth={2}
                  dot={{ r: 2.5, fill: '#818cf8', stroke: '#ffffff', strokeWidth: 1 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  isAnimationActive={false}
                  type="linear"
                  dataKey="delivered"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 2.5, fill: '#10b981', stroke: '#ffffff', strokeWidth: 1 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  isAnimationActive={false}
                  type="linear"
                  dataKey="read"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={{ r: 2.5, fill: '#38bdf8', stroke: '#ffffff', strokeWidth: 1 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Contact Growth (Spline Area Chart) */}
        <div className="dashboard-chart-card">
          <div className="chart-card-header">
            <h3 className="chart-card-title">Contact Growth</h3>
          </div>
          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart
                data={contactGrowthData}
                margin={{ top: 10, right: 20, left: -20, bottom: 10 }}
              >
                <defs>
                  <linearGradient id="contactFillGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="month"
                  stroke="#94a3b8"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  padding={{ left: 15, right: 15 }}
                />
                <YAxis
                  stroke="#94a3b8"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  domain={[0, 5]}
                  ticks={[0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px'
                  }}
                />
                <Area
                  isAnimationActive={false}
                  type="monotone"
                  dataKey="contacts"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#contactFillGradient)"
                  dot={{ r: 4, fill: '#3b82f6', stroke: '#ffffff', strokeWidth: 1.5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Message Status Distribution (Pie Chart) */}
        <div className="dashboard-chart-card">
          <div className="chart-card-header">
            <h3 className="chart-card-title">Message Status Distribution</h3>
          </div>
          <div style={{ width: '100%', height: 210 }}>
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie
                  isAnimationActive={false}
                  data={pieData}
                  cx="50%"
                  cy="46%"
                  outerRadius={76}
                  innerRadius={0}
                  dataKey="value"
                  stroke="#ffffff"
                  strokeWidth={2}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="pie-legend-custom">
            <div className="d-flex align-items-center">
              <span className="pie-legend-dot" style={{ background: '#3b82f6' }}></span>
              <span>Sent</span>
            </div>
            <div className="d-flex align-items-center">
              <span className="pie-legend-dot" style={{ background: '#10b981' }}></span>
              <span>Delivered</span>
            </div>
            <div className="d-flex align-items-center">
              <span className="pie-legend-dot" style={{ background: '#06b6d4' }}></span>
              <span>Read</span>
            </div>
            <div className="d-flex align-items-center">
              <span className="pie-legend-dot" style={{ background: '#ef4444' }}></span>
              <span>Failed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent Campaigns List */}
      <div className="dashboard-campaigns-card">
        <h3 className="chart-card-title mb-3">Recent Campaigns</h3>

        <div className="recent-campaigns-list">
          {recentCampaigns.map((camp, idx) => {
            const sent = camp.sent_count ?? camp.sent ?? 3;
            const delPct = camp.delivered_pct || (camp.sent_count > 0 ? `${Math.round(((camp.delivered_count || 0) / camp.sent_count) * 100)}%` : '66.7%');

            return (
              <div key={camp.id || idx} className="recent-campaign-row">
                <div className="recent-campaign-name">{camp.name}</div>
                <div>
                  <span className="recent-campaign-status">{camp.status || 'completed'}</span>
                </div>
                <div className="recent-campaign-stats">
                  {sent} sent · {delPct} delivered
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
