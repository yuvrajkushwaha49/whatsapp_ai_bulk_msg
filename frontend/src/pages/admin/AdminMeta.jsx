import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../services/api';
import AiwavoHeader from '../../components/AiwavoHeader';

export default function AdminMeta() {
  const { onToggleSidebar } = useOutletContext() || {};

  const [metaConfig, setMetaConfig] = useState({
    metaAppId: '',
    metaAppSecret: '',
    embeddedSignupConfigId: '',
    graphApiVersion: 'v21.0',
    webhookVerifyToken: 'campaignflow_secure_webhook_token_2026',
    isEnabled: true
  });
  const [metaConfigStatus, setMetaConfigStatus] = useState(null);
  const [savingMeta, setSavingMeta] = useState(false);
  const [testingMeta, setTestingMeta] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [showSecret, setShowSecret] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const fetchPlatformMetaConfig = async () => {
    try {
      const res = await api.get('/admin/meta-integration');
      if (res.data?.success && res.data?.data) {
        const d = res.data.data;
        setMetaConfigStatus(d);
        setMetaConfig({
          metaAppId: d.metaAppId || '',
          metaAppSecret: '',
          embeddedSignupConfigId: d.embeddedSignupConfigId || '',
          graphApiVersion: d.graphApiVersion || 'v21.0',
          webhookVerifyToken: d.webhookVerifyToken || 'campaignflow_secure_webhook_token_2026',
          isEnabled: d.isEnabled !== undefined ? d.isEnabled : true
        });
      }
    } catch (err) {
      console.warn('Failed to load platform meta config', err);
    }
  };

  useEffect(() => {
    fetchPlatformMetaConfig();
  }, []);

  const handleSaveMetaConfig = async (e) => {
    e.preventDefault();
    setSavingMeta(true);
    setFeedback({ type: '', text: '' });
    try {
      const res = await api.post('/admin/meta-integration', metaConfig);
      if (res.data?.success) {
        setFeedback({ type: 'success', text: 'Platform Meta Developer App configuration saved and encrypted at rest!' });
        fetchPlatformMetaConfig();
      }
    } catch (err) {
      setFeedback({ type: 'danger', text: err.response?.data?.message || 'Failed to save Meta configuration.' });
    } finally {
      setSavingMeta(false);
    }
  };

  const handleTestMetaConnection = async () => {
    setTestingMeta(true);
    setTestResult(null);
    setFeedback({ type: '', text: '' });
    try {
      const res = await api.post('/admin/meta-integration/test');
      setTestResult(res.data?.data);
      if (res.data?.data?.success) {
        setFeedback({ type: 'success', text: `✅ Meta Graph API connection verified! Connected as "${res.data.data.appName}".` });
      } else {
        setFeedback({ type: 'warning', text: `Verification failed: ${res.data?.data?.message}` });
      }
      fetchPlatformMetaConfig();
    } catch (err) {
      const msg = err.response?.data?.message || 'Meta API verification failed';
      setTestResult({ success: false, message: msg });
      setFeedback({ type: 'danger', text: msg });
    } finally {
      setTestingMeta(false);
    }
  };

  const webhookCallbackUrl = `${window.location.origin.replace('5173', '5000').replace('5174', '5000')}/api/webhooks/whatsapp`;

  return (
    <div>
      <AiwavoHeader
        title="Meta Platform Developer App Integration"
        subtitle="Configure the shared Meta App for Multi-Tenant Embedded Signup & Graph API"
        onToggleSidebar={onToggleSidebar}
      />

      <div className="p-4">
        {feedback.text && (
          <div className={`alert alert-${feedback.type} alert-dismissible fade show mb-4 shadow-sm`} role="alert">
            {feedback.text}
            <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
          </div>
        )}

        <div className="row g-4">
          <div className="col-12 col-lg-7">
            <div className="cf-card mb-4">
              <div className="cf-card-header d-flex align-items-center justify-content-between">
                <div>
                  <h5 className="mb-0 fw-bold">Platform Meta App Configuration</h5>
                  <p className="text-muted small mb-0">Common Meta Developer App credentials shared across all client tenants</p>
                </div>
                <span className={`badge ${metaConfigStatus?.readinessStatus === 'ready' ? 'bg-success' : 'bg-warning text-dark'}`}>
                  {metaConfigStatus?.readinessStatus === 'ready' ? 'READY FOR CLIENTS' : 'CONFIG NEEDED'}
                </span>
              </div>

              <div className="cf-card-body">
                <form onSubmit={handleSaveMetaConfig}>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">Meta App ID <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control font-monospace"
                      placeholder="e.g. 1165054629187576"
                      value={metaConfig.metaAppId}
                      onChange={(e) => setMetaConfig({ ...metaConfig, metaAppId: e.target.value })}
                      required
                    />
                    <div className="form-text small">Meta Developer Dashboard → App Settings → Basic → App ID</div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">Meta App Secret <span className="text-danger">*</span></label>
                    <div className="input-group">
                      <input
                        type={showSecret ? 'text' : 'password'}
                        className="form-control font-monospace"
                        placeholder={metaConfigStatus?.appSecretConfigured ? '•••••••••••••••••••••••• (Encrypted at Rest)' : 'Paste 32-character Meta App Secret'}
                        value={metaConfig.metaAppSecret}
                        onChange={(e) => setMetaConfig({ ...metaConfig, metaAppSecret: e.target.value })}
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => setShowSecret(!showSecret)}
                      >
                        <i className={`bi bi-eye${showSecret ? '-slash' : ''}`}></i>
                      </button>
                    </div>
                    <div className="form-text small">Encrypted using AES-256 at rest. Never exposed in plain text.</div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">Embedded Signup Configuration ID (Optional)</label>
                    <input
                      type="text"
                      className="form-control font-monospace"
                      placeholder="e.g. 1153688433853632"
                      value={metaConfig.embeddedSignupConfigId}
                      onChange={(e) => setMetaConfig({ ...metaConfig, embeddedSignupConfigId: e.target.value })}
                    />
                    <div className="form-text small">Meta WhatsApp → Quickstart / Configuration ID for the embedded onboarding popup.</div>
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-sm-6">
                      <label className="form-label small fw-bold">Graph API Version</label>
                      <input
                        type="text"
                        className="form-control font-monospace"
                        value={metaConfig.graphApiVersion}
                        onChange={(e) => setMetaConfig({ ...metaConfig, graphApiVersion: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-sm-6">
                      <label className="form-label small fw-bold">Webhook Verify Token</label>
                      <input
                        type="text"
                        className="form-control font-monospace"
                        value={metaConfig.webhookVerifyToken}
                        onChange={(e) => setMetaConfig({ ...metaConfig, webhookVerifyToken: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        id="enableMetaIntegration"
                        checked={metaConfig.isEnabled}
                        onChange={(e) => setMetaConfig({ ...metaConfig, isEnabled: e.target.checked })}
                      />
                      <label className="form-check-label small fw-bold" htmlFor="enableMetaIntegration">
                        Enable Platform Meta Integration for Clients
                      </label>
                    </div>
                  </div>

                  <div className="d-flex gap-2">
                    <button
                      type="submit"
                      disabled={savingMeta}
                      className="btn btn-primary d-flex align-items-center gap-2"
                    >
                      {savingMeta ? (
                        <>
                          <span className="spinner-border spinner-border-sm" role="status"></span>
                          <span>Saving Encrypted...</span>
                        </>
                      ) : (
                        <>
                          <i className="bi bi-shield-lock-fill"></i>
                          <span>Save & Encrypt Config</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={testingMeta || !metaConfig.metaAppId}
                      onClick={handleTestMetaConnection}
                      className="btn btn-outline-secondary d-flex align-items-center gap-2"
                    >
                      {testingMeta ? (
                        <>
                          <span className="spinner-border spinner-border-sm" role="status"></span>
                          <span>Testing Connection...</span>
                        </>
                      ) : (
                        <>
                          <i className="bi bi-lightning-charge"></i>
                          <span>Test Meta Graph API</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {testResult && (
                  <div className={`mt-4 p-3 rounded-3 border ${testResult.success ? 'bg-success-subtle border-success' : 'bg-danger-subtle border-danger'}`}>
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <i className={`bi ${testResult.success ? 'bi-check-circle-fill text-success' : 'bi-x-circle-fill text-danger'} fs-5`}></i>
                      <strong className={testResult.success ? 'text-success' : 'text-danger'}>
                        {testResult.success ? 'Meta API Connection Successful!' : 'Connection Test Failed'}
                      </strong>
                    </div>
                    <div className="small text-muted mb-2">{testResult.message}</div>
                    {testResult.appId && (
                      <div className="font-monospace small bg-white p-2 rounded border">
                        <div><strong>App Name:</strong> {testResult.appName}</div>
                        <div><strong>App ID:</strong> {testResult.appId}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-5">
            {/* Meta Webhook Endpoint */}
            <div className="cf-card mb-4">
              <div className="cf-card-header">
                <h6 className="mb-0 fw-bold">Platform Webhook Callback URL</h6>
              </div>
              <div className="cf-card-body">
                <p className="text-muted small mb-2">Configure this URL in Meta Developer Dashboard → WhatsApp → Configuration:</p>
                <div className="input-group mb-3">
                  <input
                    type="text"
                    className="form-control font-monospace small bg-light"
                    value={webhookCallbackUrl}
                    readOnly
                  />
                  <button
                    className="btn btn-outline-secondary"
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(webhookCallbackUrl);
                      alert('Webhook URL copied to clipboard!');
                    }}
                    title="Copy URL"
                  >
                    <i className="bi bi-clipboard"></i>
                  </button>
                </div>

                <div className="p-3 bg-light rounded-3 border">
                  <div className="fw-bold small text-dark mb-1">Webhook Fields to Subscribe:</div>
                  <div className="d-flex flex-wrap gap-1">
                    {['messages', 'message_template_status_update', 'account_update', 'phone_number_name_update'].map(f => (
                      <span key={f} className="badge bg-secondary font-monospace" style={{ fontSize: '0.72rem' }}>{f}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
