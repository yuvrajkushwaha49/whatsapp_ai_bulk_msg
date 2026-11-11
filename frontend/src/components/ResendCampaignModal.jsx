import React, { useState } from 'react';
import api from '../services/api';
import '../styles/campaigns.css';

export default function ResendCampaignModal({
  isOpen,
  campaign,
  onClose,
  onSuccess
}) {
  if (!isOpen || !campaign) return null;

  // Form State
  const [target, setTarget] = useState('all'); // 'all' | 'failed' | 'unread'
  const [mode, setMode] = useState('new'); // 'new' | 'existing'
  const [customName, setCustomName] = useState(`${campaign.name || 'Campaign'} (Resend)`);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Audience metric calculations
  const totalRecipients = Number(campaign.total_recipients) || 0;
  const failedCount = Number(campaign.failed_count) || 0;
  const unreadCount = Math.max(0, (Number(campaign.delivered_count) || totalRecipients) - (Number(campaign.read_count) || 0));

  const getTargetEstimatedCount = () => {
    if (target === 'failed') return failedCount > 0 ? failedCount : '0';
    if (target === 'unread') return unreadCount > 0 ? unreadCount : 'All unread';
    return totalRecipients > 0 ? totalRecipients : 'All';
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        target,
        mode,
        name: mode === 'new' ? (customName.trim() || `${campaign.name} (Resend)`) : campaign.name
      };

      const res = await api.post(`/campaigns/${campaign.id}/resend`, payload);
      if (res.data?.success) {
        if (onSuccess) {
          onSuccess(res.data);
        }
        onClose();
      } else {
        setError(res.data?.message || 'Failed to resend campaign');
      }
    } catch (err) {
      console.error('Error resending campaign:', err);
      setError(
        err.response?.data?.message ||
        err.response?.data?.error?.message ||
        'Failed to resend campaign. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="resend-modal-backdrop" onClick={onClose}>
      <div className="resend-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="resend-modal-header">
          <div className="d-flex align-items-center gap-3">
            <div className="resend-modal-header-icon">
              <i className="bi bi-arrow-repeat"></i>
            </div>
            <div>
              <h2 className="resend-modal-title">Resend Campaign</h2>
              <p className="resend-modal-sub">
                Re-dispatch broadcast for <strong>{campaign.name}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            className="resend-modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <form onSubmit={handleFormSubmit}>
          <div className="resend-modal-body">
            {error && (
              <div className="alert alert-danger py-2 px-3 small mb-3 d-flex align-items-center gap-2">
                <i className="bi bi-exclamation-triangle-fill flex-shrink-0"></i>
                <span>{error}</span>
              </div>
            )}

            {/* Mode Switch Tabs */}
            <div className="resend-section-title">Dispatch Mode</div>
            <div className="resend-mode-container">
              <button
                type="button"
                className={`resend-mode-tab ${mode === 'new' ? 'active' : ''}`}
                onClick={() => setMode('new')}
              >
                <i className="bi bi-plus-circle-fill"></i>
                <span>Create New Broadcast (Recommended)</span>
              </button>
              <button
                type="button"
                className={`resend-mode-tab ${mode === 'existing' ? 'active' : ''}`}
                onClick={() => setMode('existing')}
              >
                <i className="bi bi-arrow-clockwise"></i>
                <span>Restart Existing</span>
              </button>
            </div>

            {/* Campaign Name Input (when mode === 'new') */}
            {mode === 'new' && (
              <div className="resend-name-input-wrap">
                <label className="form-label small fw-bold text-dark mb-1">
                  New Campaign Name
                </label>
                <input
                  type="text"
                  className="form-control resend-name-input"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Diwali Festive Blast (Resend)"
                  required
                />
              </div>
            )}

            {/* Target Audience Options */}
            <div className="resend-section-title">Target Audience</div>
            <div className="resend-options-grid">
              {/* Option 1: All */}
              <label
                className={`resend-option-card ${target === 'all' ? 'selected' : ''}`}
                onClick={() => setTarget('all')}
              >
                <input
                  type="radio"
                  name="resendTarget"
                  value="all"
                  checked={target === 'all'}
                  onChange={() => setTarget('all')}
                  className="resend-option-radio"
                />
                <div className="resend-option-info">
                  <div className="resend-option-name">
                    <span>All Recipients</span>
                    <span className="resend-option-badge">
                      {totalRecipients.toLocaleString()} contacts
                    </span>
                  </div>
                  <p className="resend-option-desc">
                    Re-dispatch broadcast message to all original target recipients in this campaign.
                  </p>
                </div>
              </label>

              {/* Option 2: Failed Only */}
              <label
                className={`resend-option-card ${target === 'failed' ? 'selected' : ''}`}
                onClick={() => setTarget('failed')}
              >
                <input
                  type="radio"
                  name="resendTarget"
                  value="failed"
                  checked={target === 'failed'}
                  onChange={() => setTarget('failed')}
                  className="resend-option-radio"
                />
                <div className="resend-option-info">
                  <div className="resend-option-name">
                    <span>Failed Deliveries Only</span>
                    <span className="resend-option-badge">
                      {failedCount} failed
                    </span>
                  </div>
                  <p className="resend-option-desc">
                    Smart retry: dispatch strictly to contacts who experienced delivery failure or network timeouts.
                  </p>
                </div>
              </label>

              {/* Option 3: Unread */}
              <label
                className={`resend-option-card ${target === 'unread' ? 'selected' : ''}`}
                onClick={() => setTarget('unread')}
              >
                <input
                  type="radio"
                  name="resendTarget"
                  value="unread"
                  checked={target === 'unread'}
                  onChange={() => setTarget('unread')}
                  className="resend-option-radio"
                />
                <div className="resend-option-info">
                  <div className="resend-option-name">
                    <span>Unread / Unopened Contacts</span>
                    <span className="resend-option-badge">
                      {unreadCount} contacts
                    </span>
                  </div>
                  <p className="resend-option-desc">
                    Follow-up nudge: re-target contacts who received the message but have not read or opened it yet.
                  </p>
                </div>
              </label>
            </div>

            {/* Summary Notice */}
            <div className="resend-summary-box">
              <i className="bi bi-shield-check"></i>
              <div>
                Will queue <strong>{getTargetEstimatedCount()}</strong> WhatsApp Cloud API messages using template{' '}
                <strong>{campaign.template_name || 'Approved Template'}</strong>.
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="resend-modal-footer">
            <button
              type="button"
              className="resend-btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="resend-btn-submit"
              disabled={loading}
            >
              {loading && <span className="spinner-border spinner-border-sm" role="status"></span>}
              <i className="bi bi-send-fill"></i>
              <span>{loading ? 'Queueing Broadcast...' : 'Confirm & Resend Now'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
