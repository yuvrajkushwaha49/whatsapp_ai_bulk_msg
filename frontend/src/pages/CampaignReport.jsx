import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import api from '../services/api';

const COLORS = ['#25D366', '#0d6efd', '#fd7e14', '#dc3545', '#6c757d'];

export default function CampaignReport() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchReport();
    const interval = setInterval(fetchReport, 5000); // Poll status updates every 5s while viewing
    return () => clearInterval(interval);
  }, [id]);

  const fetchReport = async () => {
    try {
      const res = await api.get(`/campaigns/${id}`);
      if (res.data?.success) {
        setData(res.data.data);
      }
    } catch (err) {
      setError('Failed to fetch campaign report');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-success" role="status"></div>
        <div className="text-muted small mt-2">Loading live campaign report...</div>
      </div>
    );
  }

  if (!data && error) {
    return (
      <div className="text-center py-5">
        <div className="alert alert-light border shadow-sm d-inline-block px-4 py-4 rounded-4 text-start" style={{ maxWidth: '480px' }}>
          <div className="d-flex align-items-center gap-2 mb-2">
            <i className="bi bi-exclamation-triangle-fill text-warning fs-3"></i>
            <h5 className="mb-0 fw-bold text-dark">Campaign #{id} Not Found</h5>
          </div>
          <p className="text-muted small mb-3">
            This campaign report is not available. It might have been deleted or created prior to a server restart.
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

  const campaign = data?.campaign;
  const recipients = data?.recipients || [];

  const pieData = [
    { name: 'Delivered', value: campaign?.delivered_count || 0 },
    { name: 'Read', value: campaign?.read_count || 0 },
    { name: 'Sent / Pending Webhook', value: Math.max(0, (campaign?.sent_count || 0) - (campaign?.delivered_count || 0)) },
    { name: 'Failed', value: campaign?.failed_count || 0 }
  ].filter(d => d.value > 0);

  return (
    <div>
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between mb-4 gap-3">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <Link to="/campaigns" className="text-muted text-decoration-none">
              <i className="bi bi-arrow-left me-1"></i> Campaigns
            </Link>
            <span className="text-muted">/</span>
            <span className={`badge-status badge-${campaign?.status}`}>{campaign?.status}</span>
          </div>
          <h2 className="brand-font mb-0">{campaign?.name}</h2>
          <span className="text-muted small">Sent via {campaign?.account_name} ({campaign?.account_phone})</span>
        </div>

        <div className="d-flex gap-2">
          <button onClick={fetchReport} className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1">
            <i className="bi bi-arrow-clockwise"></i>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Counters */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="p-3 border rounded-3 bg-white text-center shadow-sm">
            <div className="text-muted small">Total Audience</div>
            <div className="fs-3 fw-bold text-dark">{campaign?.total_recipients || 0}</div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="p-3 border rounded-3 bg-white text-center shadow-sm">
            <div className="text-muted small">Dispatched</div>
            <div className="fs-3 fw-bold text-primary">{campaign?.sent_count || 0}</div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="p-3 border rounded-3 bg-white text-center shadow-sm">
            <div className="text-success small fw-semibold">Delivered Webhooks</div>
            <div className="fs-3 fw-bold text-success">{campaign?.delivered_count || 0}</div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="p-3 border rounded-3 bg-white text-center shadow-sm">
            <div className="text-warning small fw-semibold">Read by Customers</div>
            <div className="fs-3 fw-bold text-warning">{campaign?.read_count || 0}</div>
          </div>
        </div>
      </div>

      <div className="row g-4 mb-4">
        {/* Engagement Pie Chart */}
        <div className="col-12 col-lg-5">
          <div className="cf-card h-100">
            <div className="cf-card-header">
              <h5 className="mb-0">Delivery Breakdown</h5>
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
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-muted text-center py-5">Awaiting initial delivery status webhooks...</div>
              )}
            </div>
          </div>
        </div>

        {/* Campaign Info */}
        <div className="col-12 col-lg-7">
          <div className="cf-card h-100">
            <div className="cf-card-header">
              <h5 className="mb-0">Configuration & Meta Payload</h5>
            </div>
            <div className="cf-card-body">
              <div className="row g-3 small mb-3">
                <div className="col-sm-4 text-muted">Template Name:</div>
                <div className="col-sm-8 fw-bold"><code>{campaign?.template_name}</code></div>

                <div className="col-sm-4 text-muted">Started At:</div>
                <div className="col-sm-8">{campaign?.started_at ? new Date(campaign.started_at).toLocaleString() : 'N/A'}</div>

                <div className="col-sm-4 text-muted">Completed At:</div>
                <div className="col-sm-8">{campaign?.completed_at ? new Date(campaign.completed_at).toLocaleString() : 'In Progress'}</div>

                <div className="col-sm-4 text-muted">Variable Mappings:</div>
                <div className="col-sm-8">
                  <pre className="bg-light p-2 rounded small mb-0 font-monospace">
                    {typeof campaign?.variable_mappings === 'string' ? campaign.variable_mappings : JSON.stringify(campaign?.variable_mappings, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recipient Level Status Log */}
      <div className="cf-card">
        <div className="cf-card-header">
          <h5 className="mb-0">Recipient Delivery Logs ({recipients.length})</h5>
          <span className="small text-muted">Verified by Meta Cloud API webhook events</span>
        </div>
        <div className="table-responsive">
          <table className="table cf-table">
            <thead>
              <tr>
                <th>Recipient Phone</th>
                <th>Status</th>
                <th>Provider Message ID</th>
                <th>Sent At</th>
                <th>Delivered At</th>
                <th>Read At</th>
                <th>Errors / Skips</th>
              </tr>
            </thead>
            <tbody>
              {recipients.map(r => (
                <tr key={r.id}>
                  <td>
                    <code className="fw-bold text-dark">{r.phone}</code>
                    {r.contact_name && <div className="small text-muted">{r.contact_name}</div>}
                  </td>
                  <td>
                    <span className={`badge-status badge-${r.status}`}>
                      {r.status}
                    </span>
                  </td>
                  <td>
                    <span className="small font-monospace text-muted" style={{ fontSize: '0.75rem' }}>
                      {r.provider_message_id || 'Pending API ID'}
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
                    {r.skip_reason && <span className="small text-warning">{r.skip_reason}</span>}
                    {r.error_message && <span className="small text-danger">{r.error_message}</span>}
                    {!r.skip_reason && !r.error_message && <span className="text-muted small">-</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
