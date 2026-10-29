import React from 'react';
import { useAuth } from '../hooks/useAuth';

export default function Settings() {
  const { business } = useAuth();
  const webhookUrl = `${window.location.origin}/api/webhooks/whatsapp`;
  const verifyToken = 'campaignflow_meta_verify_token_xyz';

  return (
    <div>
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between mb-4 gap-3">
        <div>
          <h2 className="brand-font mb-1">Workspace Settings</h2>
          <p className="text-muted mb-0">Platform configuration, tenant profile & Meta Webhook callback</p>
        </div>
      </div>

      <div className="row g-4">
        {/* Workspace Profile */}
        <div className="col-12 col-lg-6">
          <div className="cf-card h-100">
            <div className="cf-card-header">
              <h5 className="mb-0">Workspace Profile</h5>
            </div>
            <div className="cf-card-body">
              <div className="mb-3">
                <label className="form-label small fw-semibold">Workspace Name</label>
                <input type="text" className="form-control" defaultValue={business?.name} readOnly />
              </div>
              <div className="mb-3">
                <label className="form-label small fw-semibold">Tenant Slug Identifier</label>
                <input type="text" className="form-control font-monospace" defaultValue={business?.slug} readOnly />
              </div>
              <div className="mb-3">
                <label className="form-label small fw-semibold">Workspace Timezone</label>
                <input type="text" className="form-control" defaultValue={business?.timezone || 'Asia/Kolkata'} readOnly />
              </div>
              <div className="mb-3">
                <label className="form-label small fw-semibold">Tenant Status</label>
                <div>
                  <span className="badge-status badge-approved">{business?.status || 'Active'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Meta Webhook Integration Guide */}
        <div className="col-12 col-lg-6">
          <div className="cf-card h-100">
            <div className="cf-card-header">
              <h5 className="mb-0">Meta Cloud API Webhook Setup</h5>
              <span className="badge bg-primary-subtle text-primary">v21.0 Required</span>
            </div>
            <div className="cf-card-body">
              <p className="text-muted small">
                Configure your Meta Developer App Webhook settings with these endpoints to receive live message delivery statuses and customer replies.
              </p>

              <div className="mb-3">
                <label className="form-label small fw-semibold">Callback URL</label>
                <div className="input-group">
                  <input type="text" className="form-control font-monospace small" value={webhookUrl} readOnly />
                  <button 
                    className="btn btn-outline-secondary"
                    onClick={() => navigator.clipboard.writeText(webhookUrl)}
                    title="Copy URL"
                  >
                    <i className="bi bi-clipboard"></i>
                  </button>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold">Verify Token</label>
                <div className="input-group">
                  <input type="text" className="form-control font-monospace small" value={verifyToken} readOnly />
                  <button 
                    className="btn btn-outline-secondary"
                    onClick={() => navigator.clipboard.writeText(verifyToken)}
                    title="Copy Token"
                  >
                    <i className="bi bi-clipboard"></i>
                  </button>
                </div>
              </div>

              <div className="p-3 bg-light rounded-3 small">
                <div className="fw-bold text-dark mb-1">Webhook Subscriptions to Enable:</div>
                <ul className="mb-0 text-muted ps-3">
                  <li><code>messages</code> (Receives delivery, read statuses, and STOP commands)</li>
                  <li><code>message_template_status_update</code> (Receives template approval changes)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
