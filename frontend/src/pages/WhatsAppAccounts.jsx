import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function WhatsAppAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const [formData, setFormData] = useState({
    displayName: '',
    phoneNumber: '',
    phoneNumberId: '',
    wabaId: '',
    accessToken: ''
  });

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/whatsapp/accounts');
      if (res.data?.success) setAccounts(res.data.data);
    } catch (err) {
      console.error('Failed to load WhatsApp accounts', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncTemplates = async (accountId) => {
    setSyncingId(accountId);
    setFeedback({ type: '', text: '' });
    try {
      const res = await api.post(`/whatsapp/accounts/${accountId}/sync-templates`);
      setFeedback({
        type: 'success',
        text: `Successfully synced ${res.data.data.syncedCount} approved templates from Meta Cloud API!`
      });
    } catch (err) {
      setFeedback({
        type: 'danger',
        text: err.response?.data?.error?.message || 'Template synchronization failed'
      });
    } finally {
      setSyncingId(null);
    }
  };

  const handleConnect = async (e) => {
    e.preventDefault();
    try {
      await api.post('/whatsapp/connect', formData);
      setShowConnectModal(false);
      setFormData({ displayName: '', phoneNumber: '', phoneNumberId: '', wabaId: '', accessToken: '' });
      setFeedback({ type: 'success', text: 'WhatsApp Business account successfully connected!' });
      fetchAccounts();
    } catch (err) {
      setFeedback({ type: 'danger', text: err.response?.data?.error?.message || 'Failed to connect WhatsApp account' });
    }
  };

  return (
    <div>
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between mb-4 gap-3">
        <div>
          <h2 className="brand-font mb-1">Official WhatsApp Business Accounts</h2>
          <p className="text-muted mb-0">Meta Cloud API v21.0 WABA & Phone Number ID Management</p>
        </div>
        <button onClick={() => setShowConnectModal(true)} className="btn btn-cf-primary d-flex align-items-center gap-2">
          <i className="bi bi-plus-lg"></i>
          <span>Connect WABA Account</span>
        </button>
      </div>

      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show mb-4`} role="alert">
          {feedback.text}
          <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      {/* Account Cards */}
      <div className="row g-4 mb-4">
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-success" role="status"></div>
          </div>
        ) : accounts.length === 0 ? (
          <div className="col-12">
            <div className="cf-card text-center py-5">
              <i className="bi bi-whatsapp text-muted fs-1 mb-3"></i>
              <h5>No WhatsApp Accounts Connected</h5>
              <p className="text-muted small">Connect your official Meta WhatsApp Business Account to start sending broadcasts.</p>
              <button onClick={() => setShowConnectModal(true)} className="btn btn-cf-primary">
                Connect Account Now
              </button>
            </div>
          </div>
        ) : (
          accounts.map(acc => (
            <div key={acc.id} className="col-12 col-lg-6">
              <div className="cf-card h-100">
                <div className="cf-card-header bg-light">
                  <div className="d-flex align-items-center gap-2">
                    <i className="bi bi-patch-check-fill text-success fs-5"></i>
                    <div>
                      <h5 className="mb-0 fw-bold">{acc.display_name}</h5>
                      <span className="small text-muted">{acc.phone_number}</span>
                    </div>
                  </div>
                  <span className="badge-status badge-approved">{acc.status}</span>
                </div>
                <div className="cf-card-body">
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <div className="p-2 border rounded bg-light">
                        <div className="text-muted small">Quality Rating</div>
                        <div className="fw-bold text-success d-flex align-items-center gap-1">
                          <span className="badge bg-success rounded-circle" style={{ width: 8, height: 8 }}></span>
                          {acc.quality_rating || 'HIGH'}
                        </div>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="p-2 border rounded bg-light">
                        <div className="text-muted small">Daily Messaging Tier</div>
                        <div className="fw-bold text-dark">{acc.messaging_limit_tier || 'TIER_10K'}</div>
                      </div>
                    </div>
                  </div>

                  <div className="small text-muted mb-2">
                    <strong>WABA ID:</strong> <code>{acc.waba_id}</code>
                  </div>
                  <div className="small text-muted mb-4">
                    <strong>Phone Number ID:</strong> <code>{acc.phone_number_id}</code>
                  </div>

                  <div className="d-flex gap-2">
                    <button
                      onClick={() => handleSyncTemplates(acc.id)}
                      disabled={syncingId === acc.id}
                      className="btn btn-outline-success btn-sm d-flex align-items-center gap-2"
                    >
                      {syncingId === acc.id ? (
                        <>
                          <span className="spinner-border spinner-border-sm" role="status"></span>
                          <span>Syncing with Meta...</span>
                        </>
                      ) : (
                        <>
                          <i className="bi bi-arrow-repeat"></i>
                          <span>Synchronize Meta Templates</span>
                        </>
                      )}
                    </button>
                    <a href="/templates" className="btn btn-outline-secondary btn-sm">
                      View Templates
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Connect Account Modal */}
      {showConnectModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px' }}>
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold">Connect WhatsApp Business Account</h5>
                <button type="button" className="btn-close" onClick={() => setShowConnectModal(false)}></button>
              </div>
              <form onSubmit={handleConnect}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Display Brand Name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Acme Retail Support"
                      value={formData.displayName}
                      onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">WhatsApp Sender Phone Number</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="+919876543210"
                      value={formData.phoneNumber}
                      onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Meta Phone Number ID</label>
                    <input
                      type="text"
                      className="form-control font-monospace"
                      placeholder="e.g. 1092837465992"
                      value={formData.phoneNumberId}
                      onChange={(e) => setFormData({ ...formData, phoneNumberId: e.target.value })}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Meta WABA ID (WhatsApp Business Account ID)</label>
                    <input
                      type="text"
                      className="form-control font-monospace"
                      placeholder="e.g. 992837465001"
                      value={formData.wabaId}
                      onChange={(e) => setFormData({ ...formData, wabaId: e.target.value })}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">System User Access Token</label>
                    <input
                      type="password"
                      className="form-control font-monospace"
                      placeholder="Permanent Meta Graph API Token"
                      value={formData.accessToken}
                      onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
                    />
                    <div className="form-text small">Encrypted securely at rest. Leave blank to use development mock adapter.</div>
                  </div>
                </div>

                <div className="modal-footer border-top bg-light">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowConnectModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-cf-primary">
                    Connect Account
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
