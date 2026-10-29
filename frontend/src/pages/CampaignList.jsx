import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function CampaignList() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const res = await api.get('/campaigns');
      if (res.data?.success) setCampaigns(res.data.data);
    } catch (err) {
      console.error('Failed to load campaigns', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async (id) => {
    try {
      await api.post(`/campaigns/${id}/pause`);
      fetchCampaigns();
    } catch (err) {
      alert('Failed to pause campaign');
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this broadcast? Unsent recipients will be stopped.')) return;
    try {
      await api.post(`/campaigns/${id}/cancel`);
      fetchCampaigns();
    } catch (err) {
      alert('Failed to cancel campaign');
    }
  };

  return (
    <div>
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between mb-4 gap-3">
        <div>
          <h2 className="brand-font mb-1">Marketing Campaigns</h2>
          <p className="text-muted mb-0">Track broadcast status, delivery webhooks, and recipient engagement</p>
        </div>
        <Link to="/campaigns/new" className="btn btn-cf-primary d-flex align-items-center gap-2">
          <i className="bi bi-plus-lg"></i>
          <span>Create Campaign</span>
        </Link>
      </div>

      <div className="cf-card">
        <div className="cf-card-header">
          <h5 className="mb-0">All Campaigns ({campaigns.length})</h5>
        </div>
        <div className="table-responsive">
          <table className="table cf-table">
            <thead>
              <tr>
                <th>Campaign Name</th>
                <th>Template Used</th>
                <th>Status</th>
                <th>Recipients</th>
                <th>Delivered</th>
                <th>Read</th>
                <th>Created Date</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-5">
                    <div className="spinner-border text-success" role="status"></div>
                  </td>
                </tr>
              ) : campaigns.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-5 text-muted">
                    No campaigns created yet. Click "Create Campaign" to start your first WhatsApp broadcast!
                  </td>
                </tr>
              ) : (
                campaigns.map(camp => {
                  const delRate = camp.sent_count > 0 ? Math.round((camp.delivered_count / camp.sent_count) * 100) : 0;
                  const readRate = camp.delivered_count > 0 ? Math.round((camp.read_count / camp.delivered_count) * 100) : 0;

                  return (
                    <tr key={camp.id}>
                      <td>
                        <div className="fw-bold text-dark">{camp.name}</div>
                        <div className="small text-muted">{camp.purpose || 'Promotional broadcast'}</div>
                      </td>
                      <td>
                        <span className="badge bg-light text-dark border">
                          {camp.template_name || 'Approved Template'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge-status badge-${camp.status}`}>
                          {camp.status}
                        </span>
                      </td>
                      <td><strong>{camp.total_recipients}</strong></td>
                      <td>
                        <span className="text-success fw-bold">{camp.delivered_count}</span>
                        <span className="small text-muted ms-1">({delRate}%)</span>
                      </td>
                      <td>
                        <span className="text-warning fw-bold">{camp.read_count}</span>
                        <span className="small text-muted ms-1">({readRate}%)</span>
                      </td>
                      <td className="small text-muted">
                        {new Date(camp.created_at).toLocaleDateString()}
                      </td>
                      <td className="text-end">
                        <div className="btn-group btn-group-sm">
                          {camp.status === 'running' && (
                            <button onClick={() => handlePause(camp.id)} className="btn btn-outline-warning" title="Pause broadcast">
                              <i className="bi bi-pause-fill"></i>
                            </button>
                          )}
                          {['running', 'scheduled'].includes(camp.status) && (
                            <button onClick={() => handleCancel(camp.id)} className="btn btn-outline-danger" title="Cancel broadcast">
                              <i className="bi bi-stop-fill"></i>
                            </button>
                          )}
                          <Link to={`/campaigns/${camp.id}`} className="btn btn-outline-primary">
                            Report
                          </Link>
                        </div>
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
