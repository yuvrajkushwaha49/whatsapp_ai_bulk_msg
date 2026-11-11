import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import AiwavoHeader from '../components/AiwavoHeader';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import '../styles/settings.css';

export default function Settings() {
  const { business } = useAuth();
  const outletContext = useOutletContext();
  const onToggleSidebar = outletContext?.onToggleSidebar;

  const webhookUrl = `${window.location.origin}/api/webhooks/whatsapp`;
  const verifyToken = 'campaignflow_meta_verify_token_xyz';

  // Security & Masking State
  const [isVerified, setIsVerified] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const [showToken, setShowToken] = useState(false);

  // Password Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPasswordPlain, setShowPasswordPlain] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [pendingAction, setPendingAction] = useState(null); // 'COPY_URL' | 'COPY_TOKEN' | 'TOGGLE_URL' | 'TOGGLE_TOKEN'

  // Feedback Toasts
  const [copiedField, setCopiedField] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const MASKED_STRING = '••••••••••••••••••••••••••••••••••••••••';

  // Trigger copy or reveal with password verification gate
  const requestProtectedAction = (actionType) => {
    if (isVerified) {
      executeAction(actionType);
      return;
    }

    setPendingAction(actionType);
    setPasswordInput('');
    setPasswordError('');
    setShowPasswordModal(true);
  };

  const executeAction = (actionType) => {
    if (actionType === 'COPY_URL') {
      navigator.clipboard.writeText(webhookUrl);
      setCopiedField('URL');
      setFeedback({ type: 'success', text: 'Callback URL copied to clipboard!' });
      setTimeout(() => setCopiedField(null), 2500);
      setTimeout(() => setFeedback({ type: '', text: '' }), 3500);
    } else if (actionType === 'COPY_TOKEN') {
      navigator.clipboard.writeText(verifyToken);
      setCopiedField('TOKEN');
      setFeedback({ type: 'success', text: 'Verify Token copied to clipboard!' });
      setTimeout(() => setCopiedField(null), 2500);
      setTimeout(() => setFeedback({ type: '', text: '' }), 3500);
    } else if (actionType === 'TOGGLE_URL') {
      setShowUrl((prev) => !prev);
    } else if (actionType === 'TOGGLE_TOKEN') {
      setShowToken((prev) => !prev);
    }
  };

  // Submit Password Verification
  const handleVerifyPassword = async (e) => {
    e.preventDefault();
    if (!passwordInput.trim()) {
      setPasswordError('Please enter your account password.');
      return;
    }

    try {
      setVerifying(true);
      setPasswordError('');

      const res = await api.post('/auth/verify-password', { password: passwordInput });
      if (res.data?.success) {
        setIsVerified(true);
        setShowPasswordModal(false);

        // Auto reveal both fields for user convenience
        setShowUrl(true);
        setShowToken(true);

        // Execute the intended action
        if (pendingAction) {
          executeAction(pendingAction);
        }
      }
    } catch (err) {
      setPasswordError(
        err.response?.data?.error?.message || 'Incorrect password. Please enter your valid account password.'
      );
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div>
      <AiwavoHeader
        title="Settings"
        subtitle="Platform configuration, tenant profile & Meta Webhook callback"
        onToggleSidebar={onToggleSidebar}
      />

      <div className="settings-page-container">
        {feedback.text && (
          <div className={`alert alert-${feedback.type} alert-dismissible fade show mb-4`} role="alert">
            <i className="bi bi-check-circle-fill me-2"></i>
            {feedback.text}
            <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
          </div>
        )}

        {/* 1. Hero Banner */}
        <div className="settings-hero-banner">
          <div className="settings-hero-left">
            <div className="settings-hero-icon">
              <i className="bi bi-gear-fill"></i>
            </div>
            <div>
              <h1 className="settings-hero-title">Workspace & API Configuration</h1>
              <p className="settings-hero-subtitle">
                Manage your tenant environment, security policies, and official Meta Cloud API Webhook endpoints.
              </p>
            </div>
          </div>
        </div>

        {/* 2. Settings Grid */}
        <div className="row g-4">
          {/* Workspace Profile */}
          <div className="col-12 col-lg-6">
            <div className="settings-card">
              <div className="settings-card-header">
                <h5 className="settings-card-title">
                  <i className="bi bi-building text-success"></i>
                  <span>Workspace Profile</span>
                </h5>
                <span className="badge bg-success-subtle text-success fw-bold px-2 py-1">Verified Tenant</span>
              </div>
              <div className="settings-card-body">
                <div className="mb-3">
                  <label className="settings-label">Workspace Name</label>
                  <input type="text" className="settings-input" defaultValue={business?.name} readOnly />
                </div>
                <div className="mb-3">
                  <label className="settings-label">Tenant Slug Identifier</label>
                  <input type="text" className="settings-input font-monospace" defaultValue={business?.slug} readOnly />
                </div>
                <div className="mb-3">
                  <label className="settings-label">Workspace Timezone</label>
                  <input
                    type="text"
                    className="settings-input"
                    defaultValue={business?.timezone || 'Asia/Kolkata'}
                    readOnly
                  />
                </div>
                <div className="mb-3">
                  <label className="settings-label">Tenant Status</label>
                  <div>
                    <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-2 fw-bold">
                      <i className="bi bi-patch-check-fill me-1"></i> {business?.status || 'Active'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Meta Webhook Integration Guide */}
          <div className="col-12 col-lg-6">
            <div className="settings-card">
              <div className="settings-card-header">
                <h5 className="settings-card-title">
                  <i className="bi bi-shield-lock-fill text-primary"></i>
                  <span>Meta Cloud API Webhook Setup</span>
                </h5>
                <span className="badge bg-primary-subtle text-primary fw-bold px-2 py-1">v21.0 Required</span>
              </div>
              <div className="settings-card-body">
                <p className="text-muted small mb-3">
                  Configure your Meta Developer App Webhook settings with these endpoints to receive live message
                  delivery statuses and customer replies.
                </p>

                {/* Callback URL */}
                <div className="mb-3">
                  <label className="settings-label">
                    <span>Callback URL</span>
                    {copiedField === 'URL' && (
                      <span className="text-success small fw-bold">
                        <i className="bi bi-check-circle me-1"></i> Copied!
                      </span>
                    )}
                  </label>
                  <div className="d-flex">
                    <input
                      type="text"
                      className={`settings-input font-monospace small ${!showUrl ? 'settings-input-masked' : ''}`}
                      style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                      value={showUrl ? webhookUrl : MASKED_STRING}
                      readOnly
                    />
                    <button
                      type="button"
                      className="settings-reveal-btn"
                      onClick={() => requestProtectedAction('TOGGLE_URL')}
                      title={showUrl ? 'Hide URL' : 'Reveal URL (Requires Password)'}
                    >
                      <i className={`bi ${showUrl ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`}></i>
                    </button>
                    <button
                      type="button"
                      className="settings-copy-btn"
                      onClick={() => requestProtectedAction('COPY_URL')}
                      title="Copy Callback URL"
                    >
                      <i className={`bi ${copiedField === 'URL' ? 'bi-check2' : 'bi-clipboard'}`}></i>
                      <span>{copiedField === 'URL' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* Verify Token */}
                <div className="mb-3">
                  <label className="settings-label">
                    <span>Verify Token</span>
                    {copiedField === 'TOKEN' && (
                      <span className="text-success small fw-bold">
                        <i className="bi bi-check-circle me-1"></i> Copied!
                      </span>
                    )}
                  </label>
                  <div className="d-flex">
                    <input
                      type="text"
                      className={`settings-input font-monospace small ${!showToken ? 'settings-input-masked' : ''}`}
                      style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                      value={showToken ? verifyToken : MASKED_STRING}
                      readOnly
                    />
                    <button
                      type="button"
                      className="settings-reveal-btn"
                      onClick={() => requestProtectedAction('TOGGLE_TOKEN')}
                      title={showToken ? 'Hide Token' : 'Reveal Token (Requires Password)'}
                    >
                      <i className={`bi ${showToken ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`}></i>
                    </button>
                    <button
                      type="button"
                      className="settings-copy-btn"
                      onClick={() => requestProtectedAction('COPY_TOKEN')}
                      title="Copy Verify Token"
                    >
                      <i className={`bi ${copiedField === 'TOKEN' ? 'bi-check2' : 'bi-clipboard'}`}></i>
                      <span>{copiedField === 'TOKEN' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-light rounded-3 small border">
                  <div className="fw-bold text-dark mb-1">
                    <i className="bi bi-info-circle-fill text-primary me-1"></i>
                    Webhook Subscriptions to Enable:
                  </div>
                  <ul className="mb-0 text-muted ps-3">
                    <li>
                      <code>messages</code> (Receives delivery, read statuses, and STOP commands)
                    </li>
                    <li>
                      <code>message_template_status_update</code> (Receives template approval changes)
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Password Verification Security Modal */}
        {showPasswordModal && (
          <div className="settings-modal-overlay">
            <div className="settings-modal-dialog">
              <div className="settings-modal-header">
                <h5 className="settings-modal-title">
                  <i className="bi bi-shield-lock-fill text-success"></i>
                  <span>Security Verification Required</span>
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowPasswordModal(false)}
                ></button>
              </div>

              <form onSubmit={handleVerifyPassword}>
                <div className="settings-modal-body">
                  <p className="text-muted small mb-3">
                    Meta Cloud API Webhook credentials provide direct webhook access to your workspace. Please verify
                    your account password to copy and decrypt these credentials.
                  </p>

                  {passwordError && (
                    <div className="alert alert-danger py-2 px-3 small mb-3">
                      <i className="bi bi-exclamation-triangle-fill me-1"></i>
                      {passwordError}
                    </div>
                  )}

                  <div className="mb-2">
                    <label className="form-label small fw-bold text-dark">Account Password</label>
                    <div className="input-group">
                      <input
                        type={showPasswordPlain ? 'text' : 'password'}
                        className="form-control"
                        placeholder="Enter your login password"
                        value={passwordInput}
                        autoFocus
                        onChange={(e) => setPasswordInput(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => setShowPasswordPlain((p) => !p)}
                        title={showPasswordPlain ? 'Hide password' : 'Show password'}
                      >
                        <i className={`bi ${showPasswordPlain ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="settings-modal-footer">
                  <button
                    type="button"
                    className="btn btn-light px-3 fw-semibold"
                    onClick={() => setShowPasswordModal(false)}
                    disabled={verifying}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-success px-4 fw-bold d-inline-flex align-items-center gap-2"
                    style={{ backgroundColor: '#00a859', borderColor: '#00a859' }}
                    disabled={verifying}
                  >
                    {verifying && <span className="spinner-border spinner-border-sm" role="status"></span>}
                    <span>{verifying ? 'Verifying...' : 'Verify & Copy'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
