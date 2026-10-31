import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import WhatsAppConnectButton from '../components/WhatsAppConnectButton';
import MetaSetupWizardModal from '../components/MetaSetupWizardModal';

export default function WhatsAppAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState(null);
  const [verifyingId, setVerifyingId] = useState(null);
  const [settingPrimaryId, setSettingPrimaryId] = useState(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [disconnectModal, setDisconnectModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const [manualForm, setManualForm] = useState({
    displayName: '',
    phoneNumber: '',
    phoneNumberId: '',
    wabaId: '',
    accessToken: ''
  });

  // In-Software Meta Test Messenger & Webhook Status States
  const [testModal, setTestModal] = useState({
    isOpen: false,
    accountId: '',
    recipientPhone: '919565763089',
    messageType: 'template',
    templateName: 'welcome_msg',
    textBody: 'Hello from CampaignFlow WhatsApp Cloud API!',
    sending: false,
    result: null,
    error: null
  });
  const [webhookStatus, setWebhookStatus] = useState(null);
  const [pingingWebhook, setPingingWebhook] = useState(false);
  const [detectedMeta, setDetectedMeta] = useState(null);
  const [autoConnecting, setAutoConnecting] = useState(false);

  const openTestModal = (accId) => {
    const chosenAcc = accounts.find(a => String(a.id) === String(accId)) || accounts[0];
    const isSandbox = chosenAcc?.phone_number?.includes('555-199') || chosenAcc?.phone_number?.startsWith('+1 555');
    setTestModal(prev => ({
      ...prev,
      isOpen: true,
      accountId: chosenAcc ? String(chosenAcc.id) : '',
      templateName: isSandbox ? 'hello_world' : 'welcome_msg',
      result: null,
      error: null
    }));
  };

  const closeTestModal = () => {
    setTestModal(prev => ({ ...prev, isOpen: false, result: null, error: null }));
  };

  const handleSendTestMessage = async (e) => {
    e.preventDefault();
    if (!testModal.accountId) {
      setTestModal(prev => ({ ...prev, error: 'Please select a WhatsApp sender account.' }));
      return;
    }
    setTestModal(prev => ({ ...prev, sending: true, error: null, result: null }));
    try {
      const res = await api.post(`/whatsapp/accounts/${testModal.accountId}/test-message`, {
        recipientPhone: testModal.recipientPhone,
        messageType: testModal.messageType,
        templateName: testModal.templateName,
        textBody: testModal.textBody
      });
      if (res.data?.success) {
        setTestModal(prev => ({
          ...prev,
          sending: false,
          result: res.data.data
        }));
      }
    } catch (err) {
      setTestModal(prev => ({
        ...prev,
        sending: false,
        error: err.response?.data?.message || err.response?.data?.error?.message || 'Failed to send test message via Meta API.'
      }));
    }
  };

  const handlePingWebhook = async () => {
    setPingingWebhook(true);
    try {
      const res = await api.get('/whatsapp/webhook/ping');
      if (res.data?.success) {
        setWebhookStatus(res.data.data);
        setFeedback({
          type: 'success',
          text: `✅ Meta Webhook listener is ACTIVE at ${res.data.data.webhookUrl}! Subscribed to messages and template delivery updates.`
        });
      }
    } catch (err) {
      setFeedback({
        type: 'warning',
        text: 'Webhook check: verify your local backend server is running.'
      });
    } finally {
      setPingingWebhook(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/whatsapp/accounts');
      if (res.data?.success) {
        setAccounts(res.data.data || []);
      }
      checkDetectedMeta();
    } catch (err) {
      console.error('Failed to load WhatsApp accounts', err);
    } finally {
      setLoading(false);
    }
  };

  const checkDetectedMeta = async () => {
    try {
      const res = await api.get('/whatsapp/detect-meta');
      if (res.data?.success && res.data?.detected && !res.data?.alreadyConnected) {
        setDetectedMeta(res.data.account);
      } else {
        setDetectedMeta(null);
      }
    } catch (e) {
      setDetectedMeta(null);
    }
  };

  const handleAutoConnect = async () => {
    setAutoConnecting(true);
    setFeedback({ type: '', text: '' });
    try {
      const res = await api.post('/whatsapp/auto-connect');
      setFeedback({
        type: 'success',
        text: `WhatsApp Account "${res.data?.data?.display_name || ''}" (${res.data?.data?.phone_number || ''}) connected successfully! Meta templates synced.`
      });
      fetchAccounts();
    } catch (err) {
      setFeedback({
        type: 'danger',
        text: err.response?.data?.message || 'Failed to auto-connect Meta WhatsApp account'
      });
    } finally {
      setAutoConnecting(false);
    }
  };

  const handleOnboardingSuccess = (newAccount) => {
    setFeedback({
      type: 'success',
      text: `🎉 WhatsApp Business Account "${newAccount.display_name || newAccount.waba_id}" successfully connected and verified with Meta!`
    });
    fetchAccounts();
  };

  const handleOnboardingError = (errMsg) => {
    setFeedback({
      type: 'danger',
      text: errMsg || 'WhatsApp connection failed. Please try again.'
    });
  };

  const handleSetPrimary = async (accountId) => {
    setSettingPrimaryId(accountId);
    setFeedback({ type: '', text: '' });
    try {
      const res = await api.post(`/whatsapp/accounts/${accountId}/primary`);
      if (res.data?.success) {
        setFeedback({
          type: 'success',
          text: `⭐ Default primary sender updated! All broadcasts and chats will default to this number.`
        });
        fetchAccounts();
      }
    } catch (err) {
      setFeedback({
        type: 'danger',
        text: err.response?.data?.message || 'Failed to set primary account'
      });
    } finally {
      setSettingPrimaryId(null);
    }
  };

  const handleVerifyAccount = async (accountId) => {
    setVerifyingId(accountId);
    setFeedback({ type: '', text: '' });
    try {
      const res = await api.post(`/whatsapp/accounts/${accountId}/verify`);
      if (res.data?.success) {
        setFeedback({
          type: 'success',
          text: `Account verified! Quality Rating: ${res.data.data.qualityRating || 'GREEN'}, Webhook Subscribed: Active.`
        });
        fetchAccounts();
      }
    } catch (err) {
      setFeedback({
        type: 'warning',
        text: err.response?.data?.message || 'Verification refresh failed. Please check Meta permissions.'
      });
    } finally {
      setVerifyingId(null);
    }
  };

  const handleSyncTemplates = async (accountId) => {
    setSyncingId(accountId);
    setFeedback({ type: '', text: '' });
    try {
      const res = await api.post(`/whatsapp/accounts/${accountId}/sync-templates`);
      setFeedback({
        type: 'success',
        text: `Successfully synced approved templates from Meta Cloud API!`
      });
    } catch (err) {
      setFeedback({
        type: 'danger',
        text: err.response?.data?.message || err.response?.data?.error?.message || 'Template synchronization failed'
      });
    } finally {
      setSyncingId(null);
    }
  };

  const handleDisconnect = async (accountId) => {
    try {
      await api.delete(`/whatsapp/accounts/${accountId}`);
      setDisconnectModal(null);
      setFeedback({ type: 'info', text: 'WhatsApp account disconnected successfully.' });
      fetchAccounts();
    } catch (err) {
      setFeedback({ type: 'danger', text: err.response?.data?.message || 'Failed to disconnect account' });
    }
  };

  const handleDelete = async (accountId) => {
    setDeletingId(accountId);
    try {
      const res = await api.delete(`/whatsapp/accounts/${accountId}/permanent`);
      setDeleteModal(null);
      setFeedback({
        type: 'success',
        text: res.data?.message || 'WhatsApp account deleted from database successfully.'
      });
      fetchAccounts();
      checkDetectedMeta();
    } catch (err) {
      setFeedback({
        type: 'danger',
        text: err.response?.data?.message || 'Failed to delete account from database'
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleManualConnect = async (e) => {
    e.preventDefault();
    try {
      await api.post('/whatsapp/connect', manualForm);
      setShowManualModal(false);
      setManualForm({ displayName: '', phoneNumber: '', phoneNumberId: '', wabaId: '', accessToken: '' });
      setFeedback({ type: 'success', text: 'WhatsApp Business account successfully connected!' });
      fetchAccounts();
    } catch (err) {
      setFeedback({ type: 'danger', text: err.response?.data?.message || 'Failed to connect WhatsApp account' });
    }
  };

  const handleContinueWithFacebook = () => {
    setShowSetupWizard(true);
  };

  return (
    <div className="container-fluid py-4">
      {/* Page Title & Top CTA */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between mb-4 gap-3">
        <div>
          <h2 className="brand-font mb-1">Official WhatsApp Business Accounts</h2>
          <p className="text-muted mb-0">Meta WhatsApp Cloud API v21.0 WABA & Phone Number Management</p>
        </div>
        <div className="d-flex align-items-center gap-2">
          {detectedMeta && (
            <button
              type="button"
              disabled={autoConnecting}
              onClick={handleAutoConnect}
              className="btn btn-success d-flex align-items-center gap-2 px-3 py-2 fw-semibold shadow-xs"
              title="1-Click Connect Configured Meta WhatsApp Account"
            >
              {autoConnecting ? (
                <span className="spinner-border spinner-border-sm" role="status"></span>
              ) : (
                <i className="bi bi-lightning-charge-fill"></i>
              )}
              <span>⚡ Auto-Connect {detectedMeta.displayName}</span>
            </button>
          )}
          {/* Guided Meta Setup Wizard CTA */}
          <button
            type="button"
            onClick={handleContinueWithFacebook}
            className="btn btn-primary d-flex align-items-center gap-2 px-3 py-2 fw-semibold shadow-xs"
            style={{ backgroundColor: '#1877F2', borderColor: '#1877F2' }}
          >
            <i className="bi bi-facebook fs-5"></i>
            <span>{accounts.length > 0 ? "+ Connect Another Number" : "Continue with Facebook"}</span>
          </button>
          <button
            onClick={() => setShowManualModal(true)}
            className="btn btn-outline-secondary"
            title="Advanced Manual Configuration"
          >
            <i className="bi bi-gear-fill me-1"></i>
            Manual Setup
          </button>
        </div>
      </div>

      {/* Alert / Feedback Notification */}
      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show mb-4 shadow-sm`} role="alert">
          <div className="d-flex align-items-center gap-2">
            <i className={`bi ${feedback.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} fs-5`}></i>
            <div>{feedback.text}</div>
          </div>
          <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      {/* Multi-Account Info Banner (When 1 or more accounts are connected) */}
      {accounts.length > 0 && !loading && (
        <div className="card border-0 shadow-sm mb-4" style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', borderRadius: '12px' }}>
          <div className="card-body p-3 p-md-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div className="d-flex align-items-center gap-3">
              <div className="rounded-circle bg-success text-white p-3 d-flex align-items-center justify-content-center shadow-xs" style={{ width: '46px', height: '46px' }}>
                <i className="bi bi-diagram-3-fill fs-5"></i>
              </div>
              <div>
                <div className="d-flex align-items-center gap-2">
                  <h5 className="mb-0 fw-bold">{accounts.length} Connected WhatsApp {accounts.length === 1 ? 'Number' : 'Numbers'}</h5>
                  <span className="badge bg-success-subtle text-success border border-success-subtle">Multi-Account Enabled</span>
                </div>
                <p className="text-muted small mb-0 mt-1">
                  You can connect multiple phone numbers under the same or different WABAs. Broadcast campaigns can round-robin send across all numbers to increase throughput.
                </p>
              </div>
            </div>
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                onClick={handleContinueWithFacebook}
                className="btn btn-sm btn-primary d-flex align-items-center gap-2 fw-semibold shadow-xs"
                style={{ backgroundColor: '#1877F2', borderColor: '#1877F2' }}
              >
                <i className="bi bi-facebook"></i>
                <span>+ Add WhatsApp Number</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Meta Developer In-Software Control Center (All Developer Operations in CampaignFlow) */}
      {accounts.length > 0 && !loading && (
        <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '14px', background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' }}>
          <div className="card-header bg-white border-bottom py-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2">
              <div className="p-2 rounded-circle bg-primary-subtle text-primary">
                <i className="bi bi-cpu-fill fs-5"></i>
              </div>
              <div>
                <h6 className="mb-0 fw-bold">Meta Developer In-Software Control Center</h6>
                <p className="text-muted small mb-0">Meta Developer Console ke saare zaroori kaam ab aap seedhe CampaignFlow me aasani se kar sakte hain</p>
              </div>
            </div>
            <div className="d-flex align-items-center gap-2">
              <button
                onClick={() => openTestModal(accounts[0]?.id)}
                className="btn btn-sm btn-primary fw-semibold d-inline-flex align-items-center gap-2 shadow-xs"
                style={{ backgroundColor: '#1877F2', borderColor: '#1877F2' }}
              >
                <i className="bi bi-send-fill"></i>
                <span>Send Test Message</span>
              </button>
              <button
                onClick={handlePingWebhook}
                disabled={pingingWebhook}
                className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
                title="Verify Webhook receiver readiness"
              >
                {pingingWebhook ? <span className="spinner-border spinner-border-sm me-1"></span> : <i className="bi bi-broadcast"></i>}
                <span>Ping Webhook</span>
              </button>
            </div>
          </div>
          <div className="card-body p-4">
            <div className="row g-3">
              {/* Tool 1: Test Messenger */}
              <div className="col-lg-4">
                <div className="p-3 border rounded-3 bg-white h-100 shadow-xs d-flex flex-column justify-content-between">
                  <div>
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <span className="badge bg-primary-subtle text-primary">Live Cloud API</span>
                      <strong className="small">Meta Test Messenger</strong>
                    </div>
                    <p className="text-secondary small mb-3">
                      Test karein official <code>hello_world</code> template ya custom text message kisi bhi mobile number par bina Meta console khole.
                    </p>
                  </div>
                  <button
                    onClick={() => openTestModal(accounts[0]?.id)}
                    className="btn btn-sm btn-outline-primary w-100 fw-semibold"
                  >
                    <i className="bi bi-send me-1"></i> Open Test Messenger
                  </button>
                </div>
              </div>

              {/* Tool 2: Webhook Credentials */}
              <div className="col-lg-4">
                <div className="p-3 border rounded-3 bg-white h-100 shadow-xs d-flex flex-column justify-content-between">
                  <div>
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <span className="badge bg-info-subtle text-info">Webhook Config</span>
                      <strong className="small">Webhook Live Status</strong>
                    </div>
                    <div className="small mb-2">
                      <span className="text-muted" style={{ fontSize: '0.75rem' }}>Callback URL:</span>
                      <div className="d-flex align-items-center justify-content-between bg-light p-1 rounded font-monospace small">
                        <span className="text-truncate me-1" style={{ maxWidth: '180px', fontSize: '0.72rem' }}>
                          {window.location.origin.replace('5173', '5000')}/api/webhooks/whatsapp
                        </span>
                        <button
                          className="btn btn-xs btn-link p-0 text-secondary"
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin.replace('5173', '5000')}/api/webhooks/whatsapp`);
                            setFeedback({ type: 'success', text: 'Webhook Callback URL copied to clipboard!' });
                          }}
                          title="Copy Callback URL"
                        >
                          <i className="bi bi-clipboard"></i>
                        </button>
                      </div>
                    </div>
                    <div className="small mb-2">
                      <span className="text-muted" style={{ fontSize: '0.75rem' }}>Verify Token:</span>
                      <div className="d-flex align-items-center justify-content-between bg-light p-1 rounded font-monospace small">
                        <span style={{ fontSize: '0.72rem' }}>campaignflow_secure_webhook_token_2026</span>
                        <button
                          className="btn btn-xs btn-link p-0 text-secondary"
                          onClick={() => {
                            navigator.clipboard.writeText('campaignflow_secure_webhook_token_2026');
                            setFeedback({ type: 'success', text: 'Verify Token copied to clipboard!' });
                          }}
                          title="Copy Verify Token"
                        >
                          <i className="bi bi-clipboard"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handlePingWebhook}
                    disabled={pingingWebhook}
                    className="btn btn-sm btn-outline-secondary w-100"
                  >
                    <i className="bi bi-broadcast me-1"></i> Verify Webhook Health
                  </button>
                </div>
              </div>

              {/* Tool 3: In-Software WhatsApp Operations */}
              <div className="col-lg-4">
                <div className="p-3 border rounded-3 bg-white h-100 shadow-xs d-flex flex-column justify-content-between">
                  <div>
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <span className="badge bg-success-subtle text-success">All-In-One</span>
                      <strong className="small">WhatsApp Operations Suite</strong>
                    </div>
                    <p className="text-secondary small mb-3">
                      Marketing campaigns bhejein, live 2-way inbox me chat karein, aur approved Meta templates sync karein.
                    </p>
                  </div>
                  <div className="d-grid gap-1">
                    <Link to="/campaigns" className="btn btn-sm btn-outline-success text-start py-1" style={{ fontSize: '0.78rem' }}>
                      <i className="bi bi-megaphone-fill me-1 text-success"></i> Launch Broadcast Campaign
                    </Link>
                    <Link to="/inbox" className="btn btn-sm btn-outline-primary text-start py-1" style={{ fontSize: '0.78rem' }}>
                      <i className="bi bi-chat-dots-fill me-1 text-primary"></i> Two-Way Live Chat Inbox
                    </Link>
                    <Link to="/templates" className="btn btn-sm btn-outline-secondary text-start py-1" style={{ fontSize: '0.78rem' }}>
                      <i className="bi bi-file-earmark-text-fill me-1 text-secondary"></i> Sync & Create Meta Templates
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Embedded Signup Onboarding Banner (If no account connected) */}
      {accounts.length === 0 && !loading && (
        <>
          {detectedMeta && (
            <div className="card border-0 shadow-sm mb-4" style={{ background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)', borderRadius: '14px', borderLeft: '6px solid #10b981' }}>
              <div className="card-body p-4 p-md-5">
                <div className="row align-items-center">
                  <div className="col-lg-8">
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <span className="badge bg-success text-white px-3 py-1 fw-bold">
                        ⚡ LIVE META ACCOUNT DETECTED
                      </span>
                      <span className="badge bg-white text-success border border-success fw-semibold">
                        Quality: {detectedMeta.qualityRating || 'GREEN'} • {detectedMeta.codeVerificationStatus || 'VERIFIED'}
                      </span>
                    </div>
                    <h3 className="fw-bold text-dark mb-2">
                      Connect {detectedMeta.displayName} ({detectedMeta.phoneNumber})
                    </h3>
                    <p className="text-secondary mb-4" style={{ maxWidth: '640px' }}>
                      Aapka Meta WhatsApp Business account aur Cloud API credentials already active hain (WABA ID: <code>{detectedMeta.wabaId}</code>). Developers Facebook par jakar manual setup karne ki zaroorat nahi hai. Seedhe 1-click me connect karein!
                    </p>
                    <div className="d-flex flex-wrap align-items-center gap-3">
                      <button
                        type="button"
                        disabled={autoConnecting}
                        onClick={handleAutoConnect}
                        className="btn btn-success btn-lg d-inline-flex align-items-center gap-2 px-4 py-3 fw-bold shadow"
                        style={{ borderRadius: '10px' }}
                      >
                        {autoConnecting ? (
                          <>
                            <span className="spinner-border spinner-border-sm" role="status"></span>
                            <span>Connecting & Syncing Meta Account...</span>
                          </>
                        ) : (
                          <>
                            <i className="bi bi-lightning-charge-fill fs-5"></i>
                            <span>⚡ 1-Click Connect & Activate ({detectedMeta.phoneNumber})</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleContinueWithFacebook}
                        className="btn btn-outline-primary py-3 px-3 fw-semibold"
                        style={{ borderRadius: '10px' }}
                      >
                        <i className="bi bi-facebook me-1"></i> Connect Another Number
                      </button>
                    </div>
                  </div>
                  <div className="col-lg-4 text-center mt-4 mt-lg-0">
                    <div className="p-4 bg-white rounded-circle shadow-sm d-inline-block border border-success-subtle">
                      <i className="bi bi-whatsapp text-success" style={{ fontSize: '4.5rem' }}></i>
                    </div>
                    <div className="mt-2 fw-bold text-success fs-5">{detectedMeta.phoneNumber}</div>
                    <div className="text-muted small">{detectedMeta.displayName} • Cloud API v21.0</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!detectedMeta && (
            <div className="card border-0 shadow-sm mb-4" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%)', borderRadius: '14px' }}>
              <div className="card-body p-4 p-md-5">
                <div className="row align-items-center">
                  <div className="col-lg-8 mb-4 mb-lg-0">
                    <span className="badge bg-success-subtle text-success border border-success-subtle mb-2 px-3 py-1 fw-bold">
                      OFFICIAL META EMBEDDED SIGNUP
                    </span>
                    <h3 className="fw-bold text-dark mb-2">Connect Your WhatsApp Business Account in 2 Minutes</h3>
                    <p className="text-secondary mb-4" style={{ maxWidth: '640px' }}>
                      No complex Facebook developer setup required. Click <strong>"Continue with Facebook"</strong> to log in, select or create your Meta Business Portfolio, register your official phone number, and start receiving customer messages and sending broadcasts instantly!
                    </p>

                    {/* 4-Step Visual Onboarding Tracker */}
                    <div className="row g-2 mb-4">
                      <div className="col-6 col-md-3">
                        <div className="p-2 bg-white rounded shadow-xs text-center border">
                          <div className="fw-bold text-primary small">1. Facebook Login</div>
                          <div className="text-muted" style={{ fontSize: '0.72rem' }}>Authenticate with Meta</div>
                        </div>
                      </div>
                      <div className="col-6 col-md-3">
                        <div className="p-2 bg-white rounded shadow-xs text-center border">
                          <div className="fw-bold text-primary small">2. Select WABA</div>
                          <div className="text-muted" style={{ fontSize: '0.72rem' }}>Choose or create account</div>
                        </div>
                      </div>
                      <div className="col-6 col-md-3">
                        <div className="p-2 bg-white rounded shadow-xs text-center border">
                          <div className="fw-bold text-primary small">3. Verify Phone</div>
                          <div className="text-muted" style={{ fontSize: '0.72rem' }}>OTP verification</div>
                        </div>
                      </div>
                      <div className="col-6 col-md-3">
                        <div className="p-2 bg-white rounded shadow-xs text-center border">
                          <div className="fw-bold text-success small">4. Live Inbox Ready</div>
                          <div className="text-muted" style={{ fontSize: '0.72rem' }}>Instant chat & campaigns</div>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleContinueWithFacebook}
                      className="btn btn-primary btn-lg d-inline-flex align-items-center gap-2 px-4 py-2 fw-bold shadow-sm"
                      style={{ backgroundColor: '#1877F2', borderColor: '#1877F2', borderRadius: '10px' }}
                    >
                      <i className="bi bi-facebook fs-5"></i>
                      <span>Continue with Facebook</span>
                    </button>
                  </div>

                  <div className="col-lg-4 text-center">
                    <div className="p-4 bg-white rounded-circle shadow-sm d-inline-block">
                      <i className="bi bi-whatsapp text-success" style={{ fontSize: '4.5rem' }}></i>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Connected Accounts Grid */}
      <div className="row g-4 mb-4">
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-success" role="status"></div>
            <div className="text-muted small mt-2">Loading WhatsApp accounts...</div>
          </div>
        ) : accounts.length === 0 ? null : (
          accounts.map((acc) => {
            const isConnected = acc.connection_status === 'CONNECTED' || acc.status === 'connected';
            const qualityColor = acc.quality_rating === 'GREEN' ? 'success' : acc.quality_rating === 'YELLOW' ? 'warning' : 'danger';

            return (
              <div key={acc.id} className="col-lg-6">
                <div className="card h-100 border shadow-sm" style={{ borderRadius: '12px' }}>
                  {/* Card Header */}
                  <div className="card-header bg-white border-bottom py-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <div className="d-flex align-items-center gap-2">
                      <div className="rounded-circle bg-success text-white p-2 d-flex align-items-center justify-content-center" style={{ width: '38px', height: '38px' }}>
                        <i className="bi bi-whatsapp fs-5"></i>
                      </div>
                      <div>
                        <div className="d-flex align-items-center gap-2">
                          <h6 className="mb-0 fw-bold">{acc.display_name || acc.verified_name || 'WhatsApp Account'}</h6>
                          {acc.is_primary && (
                            <span className="badge bg-warning text-dark border border-warning-subtle" style={{ fontSize: '0.7rem' }}>
                              <i className="bi bi-star-fill me-1 text-dark"></i>
                              Primary Default
                            </span>
                          )}
                        </div>
                        <span className="small text-muted">{acc.phone_number}</span>
                      </div>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                      {!acc.is_primary && (
                        <button
                          className="btn btn-sm btn-outline-warning text-dark py-1 px-2 d-flex align-items-center gap-1"
                          onClick={() => handleSetPrimary(acc.id)}
                          disabled={settingPrimaryId === acc.id}
                          title="Set this account as the primary default sender"
                          style={{ fontSize: '0.75rem' }}
                        >
                          {settingPrimaryId === acc.id ? (
                            <span className="spinner-border spinner-border-sm" role="status"></span>
                          ) : (
                            <i className="bi bi-star"></i>
                          )}
                          <span>Set Default</span>
                        </button>
                      )}
                      <span className={`badge ${isConnected ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-danger-subtle text-danger border border-danger-subtle'} px-3 py-1 rounded-pill`}>
                        <i className={`bi ${isConnected ? 'bi-patch-check-fill' : 'bi-x-circle-fill'} me-1`}></i>
                        {acc.connection_status || 'CONNECTED'}
                      </span>
                    </div>
                  </div>

                  {/* Card Body with Detailed Metadata */}
                  <div className="card-body">
                    <div className="row g-3 mb-3">
                      <div className="col-sm-6">
                        <label className="text-muted small text-uppercase fw-semibold" style={{ fontSize: '0.7rem' }}>WABA ID</label>
                        <div className="d-flex align-items-center justify-content-between p-2 bg-light rounded border">
                          <code className="small text-dark font-monospace">{acc.waba_id}</code>
                          <button
                            className="btn btn-sm text-secondary p-0"
                            onClick={() => navigator.clipboard.writeText(acc.waba_id)}
                            title="Copy WABA ID"
                          >
                            <i className="bi bi-clipboard"></i>
                          </button>
                        </div>
                      </div>

                      <div className="col-sm-6">
                        <label className="text-muted small text-uppercase fw-semibold" style={{ fontSize: '0.7rem' }}>Phone Number ID</label>
                        <div className="d-flex align-items-center justify-content-between p-2 bg-light rounded border">
                          <code className="small text-dark font-monospace">{acc.phone_number_id}</code>
                          <button
                            className="btn btn-sm text-secondary p-0"
                            onClick={() => navigator.clipboard.writeText(acc.phone_number_id)}
                            title="Copy Phone Number ID"
                          >
                            <i className="bi bi-clipboard"></i>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="d-flex flex-wrap gap-2 mb-3">
                      <span className={`badge bg-${qualityColor}-subtle text-${qualityColor} border border-${qualityColor}-subtle`}>
                        <i className="bi bi-shield-check me-1"></i>
                        Quality: {acc.quality_rating || 'GREEN'}
                      </span>
                      <span className="badge bg-secondary-subtle text-secondary border">
                        <i className="bi bi-speedometer2 me-1"></i>
                        Tier: {acc.messaging_limit_tier || 'STANDARD'}
                      </span>
                      <span className="badge bg-info-subtle text-info border border-info-subtle">
                        <i className="bi bi-bell-fill me-1"></i>
                        Webhook: Subscribed
                      </span>
                    </div>

                    <div className="small text-muted border-top pt-2 d-flex justify-content-between">
                      <span>Connected: {new Date(acc.created_at).toLocaleDateString()}</span>
                      <span>Verified: {acc.last_verified_at ? new Date(acc.last_verified_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live'}</span>
                    </div>
                  </div>

                  {/* Card Actions Footer */}
                  <div className="card-footer bg-light border-top py-2 d-flex flex-wrap gap-2 justify-content-between align-items-center">
                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-sm btn-outline-success"
                        onClick={() => handleVerifyAccount(acc.id)}
                        disabled={verifyingId === acc.id}
                        title="Verify connection health check with Meta"
                      >
                        {verifyingId === acc.id ? (
                          <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                        ) : (
                          <i className="bi bi-arrow-repeat me-1"></i>
                        )}
                        Verify Status
                      </button>

                      <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => handleSyncTemplates(acc.id)}
                        disabled={syncingId === acc.id}
                        title="Sync approved WhatsApp Templates"
                      >
                        {syncingId === acc.id ? (
                          <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                        ) : (
                          <i className="bi bi-card-text me-1"></i>
                        )}
                        Sync Templates
                      </button>

                      <Link to="/inbox" className="btn btn-sm btn-outline-primary" title="Go to WhatsApp Inbox">
                        <i className="bi bi-chat-dots-fill me-1"></i>
                        Inbox
                      </Link>

                      <button
                        type="button"
                        className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1 shadow-xs"
                        style={{ backgroundColor: '#1877F2', borderColor: '#1877F2' }}
                        onClick={() => openTestModal(acc.id)}
                        title="Send a live test message (Meta Cloud API Test Messenger)"
                      >
                        <i className="bi bi-send-fill"></i>
                        <span>Send Test</span>
                      </button>
                    </div>

                    <div className="d-flex align-items-center gap-1">
                      <button
                        className="btn btn-sm btn-outline-warning text-dark"
                        onClick={() => setDisconnectModal(acc)}
                        title="Disconnect WhatsApp Account (can reconnect anytime)"
                      >
                        <i className="bi bi-power me-1"></i>
                        Disconnect
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => setDeleteModal(acc)}
                        title="Permanently Delete account from database"
                      >
                        <i className="bi bi-trash3-fill me-1"></i>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Disconnect Confirmation Modal */}
      {disconnectModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold text-danger">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  Disconnect WhatsApp Account?
                </h5>
                <button type="button" className="btn-close" onClick={() => setDisconnectModal(null)}></button>
              </div>
              <div className="modal-body">
                <p>
                  Are you sure you want to disconnect <strong>{disconnectModal.display_name || disconnectModal.phone_number}</strong>?
                </p>
                <div className="alert alert-warning small">
                  Disconnecting will stop sending outbound broadcasts and free-form chat replies through this number until reconnected. Existing chat history and contact information will remain safe.
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setDisconnectModal(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={() => handleDisconnect(disconnectModal.id)}
                >
                  Yes, Disconnect Account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account From Database Modal */}
      {deleteModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '14px', overflow: 'hidden' }}>
              <div className="modal-header bg-danger text-white py-3">
                <h5 className="modal-title fw-bold d-flex align-items-center gap-2 mb-0">
                  <i className="bi bi-trash3-fill"></i>
                  Delete Account from Database
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setDeleteModal(null)}></button>
              </div>
              <div className="modal-body p-4">
                <p className="mb-3">
                  Are you sure you want to permanently delete <strong>{deleteModal.display_name || deleteModal.phone_number}</strong> ({deleteModal.phone_number}) from the database?
                </p>
                <div className="p-3 rounded-3 mb-0" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
                  <div className="d-flex gap-2">
                    <i className="bi bi-shield-exclamation text-danger fs-5 flex-shrink-0"></i>
                    <div className="small text-danger-emphasis">
                      <strong>Database Only Deletion:</strong> This action will permanently remove this account's records from our local MySQL database.
                      <div className="mt-1 text-muted" style={{ fontSize: '0.78rem' }}>
                        ✓ Your WhatsApp Business Account on Meta/Facebook will <u>not</u> be deleted and remains completely safe.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer bg-light py-2">
                <button 
                  type="button" 
                  className="btn btn-sm btn-outline-secondary px-3" 
                  onClick={() => setDeleteModal(null)}
                  disabled={deletingId === deleteModal.id}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-danger px-3 fw-semibold shadow-xs"
                  disabled={deletingId === deleteModal.id}
                  onClick={() => handleDelete(deleteModal.id)}
                >
                  {deletingId === deleteModal.id ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-trash3-fill me-1"></i>
                      Yes, Delete from Database
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Advanced Connection Modal */}
      {showManualModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <form onSubmit={handleManualConnect}>
                <div className="modal-header">
                  <h5 className="modal-title fw-bold">Manual WABA Credentials Setup</h5>
                  <button type="button" className="btn-close" onClick={() => setShowManualModal(false)}></button>
                </div>
                <div className="modal-body">
                  <div className="alert alert-secondary small mb-3">
                    Use this form only if you have custom Meta Permanent System User tokens instead of the one-click Facebook Login.
                  </div>
                  <div className="mb-2">
                    <label className="form-label small fw-semibold">Display / Channel Name</label>
                    <input
                      type="text"
                      required
                      className="form-control form-control-sm"
                      placeholder="e.g. Acme Support"
                      value={manualForm.displayName}
                      onChange={(e) => setManualForm({ ...manualForm, displayName: e.target.value })}
                    />
                  </div>
                  <div className="mb-2">
                    <label className="form-label small fw-semibold">WhatsApp Phone Number</label>
                    <input
                      type="text"
                      required
                      className="form-control form-control-sm"
                      placeholder="+91 98765 43210"
                      value={manualForm.phoneNumber}
                      onChange={(e) => setManualForm({ ...manualForm, phoneNumber: e.target.value })}
                    />
                  </div>
                  <div className="mb-2">
                    <label className="form-label small fw-semibold">Meta Phone Number ID</label>
                    <input
                      type="text"
                      required
                      className="form-control form-control-sm"
                      placeholder="e.g. 1341070215765610"
                      value={manualForm.phoneNumberId}
                      onChange={(e) => setManualForm({ ...manualForm, phoneNumberId: e.target.value })}
                    />
                  </div>
                  <div className="mb-2">
                    <label className="form-label small fw-semibold">Meta WABA ID</label>
                    <input
                      type="text"
                      required
                      className="form-control form-control-sm"
                      placeholder="e.g. 28532933229644434"
                      value={manualForm.wabaId}
                      onChange={(e) => setManualForm({ ...manualForm, wabaId: e.target.value })}
                    />
                  </div>
                  <div className="mb-2">
                    <label className="form-label small fw-semibold">Meta Access Token</label>
                    <textarea
                      required
                      className="form-control form-control-sm"
                      rows="3"
                      placeholder="EAAB..."
                      value={manualForm.accessToken}
                      onChange={(e) => setManualForm({ ...manualForm, accessToken: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShowManualModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-sm btn-success">
                    Save Account
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Meta Test Messenger Modal (In-Software Meta Developer Testing Tool) */}
      {testModal.isOpen && (
        <div className="modal show d-block" tabIndex="-1" style={{ background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px', overflow: 'hidden' }}>
              <div
                className="modal-header py-3 text-white"
                style={{ background: 'linear-gradient(135deg, #1877F2 0%, #0369a1 100%)' }}
              >
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-send-fill fs-5"></i>
                  <h5 className="modal-title fw-bold mb-0">Meta Test Messenger</h5>
                </div>
                <button type="button" className="btn-close btn-close-white" onClick={closeTestModal}></button>
              </div>

              <form onSubmit={handleSendTestMessage}>
                <div className="modal-body p-4 bg-white">
                  <p className="text-secondary small mb-3">
                    Bina Meta Developer Console khole, CampaignFlow se direct official Meta Cloud API test message send karein aur live delivery status verify karein.
                  </p>

                  {testModal.error && (
                    <div className="alert alert-danger p-2 small mb-3 d-flex align-items-center gap-2">
                      <i className="bi bi-exclamation-octagon-fill fs-5 flex-shrink-0"></i>
                      <div>{testModal.error}</div>
                    </div>
                  )}

                  {testModal.result && (
                    <div className="alert alert-success p-3 small mb-3 border border-success-subtle bg-success-subtle rounded-3">
                      <div className="d-flex align-items-center gap-2 mb-2 fw-bold text-success fs-6">
                        <i className="bi bi-check-circle-fill"></i> Message Sent Successfully via Meta Cloud API!
                      </div>
                      <div className="mb-1"><strong>Recipient:</strong> +{testModal.result.recipientPhone}</div>
                      <div className="mb-1"><strong>Sender:</strong> {testModal.result.account?.displayName} ({testModal.result.account?.phoneNumber})</div>
                      <div className="mb-1">
                        <strong>Meta Message ID:</strong> <code className="text-dark bg-white px-2 py-1 rounded font-monospace">{testModal.result.messageId}</code>
                      </div>
                      <div className="text-muted mt-2" style={{ fontSize: '0.74rem' }}>
                        <i className="bi bi-shield-check text-success me-1"></i> Verified by WhatsApp Cloud API v21.0
                      </div>
                    </div>
                  )}

                  {/* Sender Account */}
                  <div className="mb-3">
                    <label className="form-label small fw-bold">Sender WhatsApp Account</label>
                    <select
                      className="form-select form-select-sm"
                      value={testModal.accountId}
                      onChange={(e) => {
                        const nextId = e.target.value;
                        const sel = accounts.find(a => String(a.id) === String(nextId));
                        const isSand = sel?.phone_number?.includes('555-199') || sel?.phone_number?.startsWith('+1 555');
                        setTestModal(prev => ({
                          ...prev,
                          accountId: nextId,
                          templateName: isSand ? 'hello_world' : 'welcome_msg',
                          error: null,
                          result: null
                        }));
                      }}
                      required
                    >
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.display_name} ({acc.phone_number}) {acc.is_primary ? '★ Primary' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Recipient Phone */}
                  <div className="mb-3">
                    <label className="form-label small fw-bold">
                      Recipient Mobile Number <span className="text-danger">*</span>
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-light text-muted">
                        <i className="bi bi-telephone-fill"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. 918601467210 (Country code + Mobile)"
                        value={testModal.recipientPhone}
                        onChange={(e) => setTestModal({ ...testModal, recipientPhone: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-text small" style={{ fontSize: '0.74rem' }}>
                      Country code ke sath enter karein (e.g. India ke liye 91XXXXXXXXXX).
                    </div>
                  </div>

                  {/* Message Type */}
                  <div className="mb-3">
                    <label className="form-label small fw-bold">Message Format</label>
                    <div className="d-flex flex-column gap-2 bg-light p-3 rounded border">
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="testMsgType"
                          id="typeTemplate"
                          checked={testModal.messageType === 'template'}
                          onChange={() => setTestModal({ ...testModal, messageType: 'template' })}
                        />
                        <label className="form-check-label small" htmlFor="typeTemplate">
                          <strong>Approved WhatsApp Template (Recommended)</strong>
                          <div className="text-muted" style={{ fontSize: '0.74rem' }}>
                            Kisi bhi number par deliver hota hai (Real Indian numbers ke liye <code>welcome_msg</code> use karein).
                          </div>
                        </label>
                      </div>

                      {testModal.messageType === 'template' && (() => {
                        const currentAcc = accounts.find(a => String(a.id) === String(testModal.accountId)) || accounts[0];
                        const isCurrentSandbox = currentAcc?.phone_number?.includes('555-199') || currentAcc?.phone_number?.startsWith('+1 555');

                        return (
                          <div className="ms-4 mt-2">
                            <label className="form-label small fw-bold mb-1">Choose Approved Template</label>
                            <select
                              className="form-select form-select-sm"
                              value={testModal.templateName}
                              onChange={(e) => setTestModal({ ...testModal, templateName: e.target.value })}
                            >
                              <option value="welcome_msg">welcome_msg (Language: en, Approved for +91 Indian Numbers) ★ Recommended</option>
                              <option value="hello">hello (Language: en, Approved)</option>
                              <option value="autumn_flash_sale_v1">autumn_flash_sale_v1 (Language: en_US, Approved)</option>
                              {isCurrentSandbox && (
                                <option value="hello_world">hello_world (Language: en_US, Meta Sandbox Test numbers only)</option>
                              )}
                            </select>

                            {!isCurrentSandbox && (
                              <div className="alert alert-info py-1 px-2 mt-2 mb-0 small" style={{ fontSize: '0.74rem' }}>
                                <i className="bi bi-shield-check me-1 text-primary"></i>
                                <strong>Live Indian Number Selected:</strong> Real registered numbers ({currentAcc?.phone_number || '+91 86014 67210'}) send approved WABA templates like <code>welcome_msg</code>. <em>(Sandbox-only templates like <code>hello_world</code> are restricted by Meta)</em>.
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      <div className="form-check mt-2">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="testMsgType"
                          id="typeText"
                          checked={testModal.messageType === 'text'}
                          onChange={() => setTestModal({ ...testModal, messageType: 'text' })}
                        />
                        <label className="form-check-label small" htmlFor="typeText">
                          <strong>Custom Free-form Text Message</strong>
                          <div className="text-muted" style={{ fontSize: '0.74rem' }}>
                            24-hour active customer service session me text bhejne ke liye.
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>

                  {testModal.messageType === 'text' && (
                    <div className="mb-3">
                      <label className="form-label small fw-bold">Custom Text Message Body</label>
                      <textarea
                        className="form-control form-control-sm"
                        rows="2"
                        value={testModal.textBody}
                        onChange={(e) => setTestModal({ ...testModal, textBody: e.target.value })}
                        placeholder="Enter message text..."
                      />
                    </div>
                  )}
                </div>

                <div className="modal-footer bg-light py-2">
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={closeTestModal}>
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={testModal.sending}
                    className="btn btn-sm btn-primary fw-semibold shadow-xs"
                    style={{ backgroundColor: '#1877F2', borderColor: '#1877F2' }}
                  >
                    {testModal.sending ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                        Sending via Meta API...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-send-fill me-1"></i> Send Test Message
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Meta Setup Wizard Modal */}
      <MetaSetupWizardModal
        isOpen={showSetupWizard}
        onClose={() => setShowSetupWizard(false)}
        onSuccess={handleOnboardingSuccess}
      />
    </div>
  );
}
