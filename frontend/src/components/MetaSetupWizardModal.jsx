import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';

/**
 * AiSensy-Style WhatsApp Business Onboarding Wizard
 * 
 * Flow:
 * 1. Checks platform Meta readiness (/api/meta/setup/client-readiness)
 * 2. Welcome screen highlighting official WhatsApp Cloud API benefits
 * 3. 1-Click "Continue with Facebook" (launches official Meta Embedded Signup with CSRF state)
 * 4. Popup callback handler receives code & state
 * 5. Backend verification, token exchange, phone registration, and webhook subscription
 * 6. Live verification stepper -> Success summary
 */
export default function MetaSetupWizardModal({ isOpen, onClose, onSuccess }) {
  const { isSuperAdmin } = useAuth();

  // Wizard Steps: 'welcome' | 'verifying' | 'success'
  const [screen, setScreen] = useState('welcome');

  // Platform Readiness state
  const [readiness, setReadiness] = useState(null);
  const [checkingReadiness, setCheckingReadiness] = useState(true);

  // Connection & Verification states
  const [error, setError] = useState(null);
  const [connectedAccount, setConnectedAccount] = useState(null);
  const [verificationLogs, setVerificationLogs] = useState([]);
  const [waitingSeconds, setWaitingSeconds] = useState(0);
  const popupRef = useRef(null);
  const isConnectingRef = useRef(false);
  const lastWabaRef = useRef(null);
  const lastPhoneRef = useRef(null);

  // Developer Testing Accordion states
  const [showDevTools, setShowDevTools] = useState(false);
  const [directToken, setDirectToken] = useState('');
  const [directPhoneId, setDirectPhoneId] = useState('');
  const [directWabaId, setDirectWabaId] = useState('');
  const [devImporting, setDevImporting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setScreen('welcome');
      setError(null);
      setConnectedAccount(null);
      checkPlatformReadiness();
    } else {
      setScreen('welcome');
      setError(null);
      setConnectedAccount(null);
      setVerificationLogs([]);
    }
  }, [isOpen]);

  const checkPlatformReadiness = async () => {
    try {
      setCheckingReadiness(true);
      setError(null);
      const res = await api.get('/meta/setup/client-readiness');
      if (res.data?.success) {
        setReadiness(res.data.data);
      }
    } catch (err) {
      console.warn('Readiness check error:', err);
      setReadiness({
        isReady: false,
        message: 'WhatsApp connection is currently being configured by our platform administrator. Please try again later.'
      });
    } finally {
      setCheckingReadiness(false);
    }
  };

  const handleCancelConnection = () => {
    isConnectingRef.current = false;
    if (popupRef.current && !popupRef.current.closed) {
      try {
        popupRef.current.close();
      } catch (e) { }
    }
    setScreen('welcome');
    setWaitingSeconds(0);
    setError(null);
  };

  /**
   * Launch Official Meta Facebook Login for Business / Embedded Signup
   */
  const handleContinueWithFacebook = async () => {
    setError(null);
    setWaitingSeconds(0);
    isConnectingRef.current = true;
    setScreen('verifying');
    setVerificationLogs([
      { id: 1, title: 'Initiating secure Meta Embedded Signup session...', status: 'active' },
      { id: 2, title: 'Waiting for Facebook Login & WhatsApp Business authorization...', status: 'pending' },
      { id: 3, title: 'Exchanging authorization code & verifying WABA permissions...', status: 'pending' },
      { id: 4, title: 'Registering phone number & subscribing to Meta Cloud API webhooks...', status: 'pending' }
    ]);

    try {
      // 1. Request secure initiate session with CSRF state from backend
      const initRes = await api.post('/meta/embedded-signup/initiate', {
        redirectOrigin: window.location.origin
      });

      const initData = initRes.data?.data;
      const appId = initData?.appId || '1165054629187576';
      const configId = initData?.configId || '';
      const state = initData?.state || '';
      const redirectUri = `${window.location.origin}/whatsapp/callback`;
      const scopes = 'whatsapp_business_management,whatsapp_business_messaging';

      let oauthUrl = '';
      if (configId && configId !== 'your_embedded_signup_config_id') {
        oauthUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&config_id=${encodeURIComponent(configId)}&response_type=code&state=${encodeURIComponent(state)}`;
      } else {
        oauthUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code&state=${encodeURIComponent(state)}`;
      }

      setVerificationLogs(prev => prev.map(l => l.id === 1 ? { ...l, status: 'done' } : (l.id === 2 ? { ...l, status: 'active' } : l)));

      // 2. Open official Meta OAuth popup
      const width = 640;
      const height = 720;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2.5;

      const popup = window.open(
        oauthUrl,
        'MetaWhatsAppEmbeddedSignup',
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,status=1`
      );
      popupRef.current = popup;

      // Start elapsed timer for user guidance
      const timerInterval = setInterval(() => {
        if (isConnectingRef.current) {
          setWaitingSeconds(s => s + 1);
        } else {
          clearInterval(timerInterval);
        }
      }, 1000);

      // 3. Listen for postMessage from /whatsapp/callback popup & Meta Embedded Signup iframe
      const handlePopupMessage = async (event) => {
        // Capture official Meta Embedded Signup sessionInfoListener events from facebook.com
        if (event.origin && (event.origin.includes('facebook.com') || event.origin.includes('fb.com'))) {
          try {
            const parsed = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
            if (parsed?.type === 'WA_EMBEDDED_SIGNUP') {
              console.log('[MetaEmbeddedSignup:WA_EMBEDDED_SIGNUP]', parsed);
              if (parsed.event === 'FINISH' && parsed.data) {
                if (parsed.data.waba_id) lastWabaRef.current = String(parsed.data.waba_id);
                if (parsed.data.phone_number_id) lastPhoneRef.current = String(parsed.data.phone_number_id);
              }
            }
          } catch (_) { }
          return;
        }

        if (event.origin !== window.location.origin) return;

        if (event.data?.type === 'META_SIGNUP_AUTH_CODE' || event.data?.type === 'FB_OAUTH_CODE') {
          isConnectingRef.current = false;
          clearInterval(timerInterval);
          window.removeEventListener('message', handlePopupMessage);
          const { code, state: returnedState, wabaId, phoneNumberId, businessName } = event.data;

          const finalWabaId = wabaId || lastWabaRef.current || undefined;
          const finalPhoneId = phoneNumberId || lastPhoneRef.current || undefined;

          setVerificationLogs(prev => prev.map(l => {
            if (l.id === 1 || l.id === 2) return { ...l, status: 'done' };
            if (l.id === 3) return { ...l, status: 'active' };
            return l;
          }));

          try {
            // Process authorization on backend
            const callbackRes = await api.post('/meta/embedded-signup/callback', {
              code,
              state: returnedState || state,
              redirectUri: `${window.location.origin}/whatsapp/callback`,
              wabaId: finalWabaId && /^\d+$/.test(String(finalWabaId)) ? finalWabaId : undefined,
              phoneNumberId: finalPhoneId && /^\d+$/.test(String(finalPhoneId)) ? finalPhoneId : undefined,
              businessName: businessName || undefined
            });

            if (callbackRes.data?.success) {
              const account = callbackRes.data.data;
              setConnectedAccount(account);
              setVerificationLogs(prev => prev.map(l => ({ ...l, status: 'done' })));

              if (onSuccess) onSuccess(account);
              setTimeout(() => {
                setScreen('success');
              }, 800);
            }
          } catch (callbackErr) {
            console.error('Callback error:', callbackErr);
            console.error('Callback error response data:', callbackErr.response?.data);
            const msg = callbackErr.response?.data?.error?.message ||
              callbackErr.response?.data?.message ||
              'Failed to exchange authorization code with Meta Cloud API.';
            setError(msg);
            setScreen('welcome');
          }
        } else if (event.data?.type === 'META_SIGNUP_AUTH_ERROR' || event.data?.type === 'FB_OAUTH_ERROR') {
          isConnectingRef.current = false;
          clearInterval(timerInterval);
          window.removeEventListener('message', handlePopupMessage);
          setError(event.data.error || 'Meta authorization was cancelled or failed.');
          setScreen('welcome');
        }
      };

      window.addEventListener('message', handlePopupMessage);

      // 4. Actively monitor if user closed popup
      const checkClosedInterval = setInterval(() => {
        try {
          if (popup && popup.closed) {
            clearInterval(checkClosedInterval);
            clearInterval(timerInterval);
            window.removeEventListener('message', handlePopupMessage);
            if (isConnectingRef.current) {
              isConnectingRef.current = false;
              setScreen('welcome');
              setError('The Facebook pop-up window has closed. If you saw "This content isn\'t available" there, please set your Meta Developer App to \'Live\' or add your Facebook account under \'App Roles\'.');
            }
          }
        } catch (_) { }
      }, 500);

    } catch (err) {
      isConnectingRef.current = false;
      console.error('Launch signup error:', err);
      const msg = err.response?.data?.message || 'Failed to initiate Embedded Signup session.';
      setError(msg);
      setScreen('welcome');
    }
  };

  const handleOpenMetaHostedOnboarding = async () => {
    setError(null);
    try {
      const initRes = await api.post('/meta/embedded-signup/initiate', {
        redirectOrigin: window.location.origin
      });
      const initData = initRes.data?.data;
      const appId = initData?.appId || '1165054629187576';
      const configId = initData?.configId || '1153688433853632';
      const metaHostedUrl = initData?.metaHostedUrl || `https://business.facebook.com/messaging/whatsapp/onboard/?app_id=${appId}&config_id=${configId}&extras=%7B%22sessionInfoVersion%22%3A%223%22%7D`;
      window.open(metaHostedUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      const fallbackUrl = 'https://business.facebook.com/messaging/whatsapp/onboard/?app_id=1165054629187576&config_id=1153688433853632&extras=%7B%22sessionInfoVersion%22%3A%223%22%7D';
      window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
    }
  };

  /**
   * Developer Direct Token Import (Sandbox or Direct System Token)
   */
  const handleDirectTokenSubmit = async (e) => {
    e.preventDefault();
    if (!directToken.trim()) {
      setError('Please provide a valid Meta Access Token.');
      return;
    }
    setDevImporting(true);
    setError(null);
    setScreen('verifying');
    setVerificationLogs([
      { id: 1, title: 'Validating provided Meta Access Token...', status: 'done' },
      { id: 2, title: 'Auto-discovering WABA and Phone Number ID from Meta Cloud API...', status: 'active' },
      { id: 3, title: 'Subscribing webhooks & registering phone number...', status: 'pending' },
      { id: 4, title: 'Encrypting credentials & isolating tenant account...', status: 'pending' }
    ]);

    try {
      const res = await api.post('/meta/embedded-signup/callback', {
        accessToken: directToken.trim(),
        phoneNumberId: directPhoneId.trim() || undefined,
        wabaId: directWabaId.trim() || undefined
      });

      if (res.data?.success) {
        const account = res.data.data;
        setConnectedAccount(account);
        setVerificationLogs(prev => prev.map(l => ({ ...l, status: 'done' })));
        if (onSuccess) onSuccess(account);
        setTimeout(() => setScreen('success'), 600);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to import account via token.';
      setError(msg);
      setScreen('welcome');
    } finally {
      setDevImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(6px)', zIndex: 1050 }}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg" style={{ maxWidth: '720px' }}>
        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px', overflow: 'hidden' }}>

          {/* Modal Header */}
          <div
            className="p-4 text-white position-relative"
            style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0284c7 100%)'
            }}
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <div className="d-flex align-items-center gap-2">
                <span className="badge bg-white text-dark fw-semibold px-2 py-1 rounded-pill">
                  Meta WhatsApp Cloud API v21.0
                </span>
                <span className="badge bg-info-subtle text-info border border-info-subtle px-2 py-1 rounded-pill">
                  AiSensy-Style 1-Click Connect
                </span>
              </div>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={onClose}
                aria-label="Close"
              ></button>
            </div>
            <h4 className="fw-bold mb-1 text-white">Connect Your WhatsApp Business Account</h4>
            <p className="text-light opacity-75 small mb-0">
              Connect your official WhatsApp Business number to send campaigns, manage customer conversations, and automate customer communication.
            </p>
          </div>

          {/* Modal Body */}
          <div className="modal-body p-4 bg-light">

            {/* Error Notification */}
            {error && (
              <div className="alert alert-danger alert-dismissible fade show d-flex align-items-start gap-2 shadow-xs mb-3" role="alert">
                <i className="bi bi-exclamation-triangle-fill fs-5 mt-1 flex-shrink-0"></i>
                <div className="flex-grow-1">
                  <strong>Connection Error:</strong>
                  <div className="small mt-1">{error}</div>
                </div>
                <button type="button" className="btn-close" onClick={() => setError(null)}></button>
              </div>
            )}

            {/* SCREEN 1: WELCOME & PLATFORM READINESS */}
            {screen === 'welcome' && (
              <div>
                {/* Platform Readiness Incomplete Notice */}
                {!checkingReadiness && readiness && !readiness.isReady && (
                  <div className="alert alert-warning border-warning-subtle shadow-xs mb-4">
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <i className="bi bi-info-circle-fill fs-5 text-warning"></i>
                      <h6 className="mb-0 fw-bold">Platform Configuration in Progress</h6>
                    </div>
                    <p className="small mb-2 text-dark">
                      {readiness.message || 'WhatsApp connection is currently being configured by our platform administrator. Please try again later.'}
                    </p>
                    {isSuperAdmin && isSuperAdmin() && (
                      <div className="mt-2 pt-2 border-top border-warning-subtle d-flex align-items-center justify-content-between">
                        <span className="small text-muted">Super Admin notice: Meta Developer App credentials needed.</span>
                        <a href="/superadmin" className="btn btn-sm btn-dark">
                          Go to SuperAdmin Settings
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* Benefits Showcase Cards */}
                <div className="row g-3 mb-4">
                  <div className="col-12 col-md-4">
                    <div className="p-3 bg-white rounded-3 border h-100 shadow-xs">
                      <div className="text-success fs-4 mb-2">
                        <i className="bi bi-patch-check-fill"></i>
                      </div>
                      <h6 className="fw-bold mb-1">Official Cloud API</h6>
                      <p className="text-muted small mb-0">Official Meta WhatsApp Business Cloud API with 99.9% uptime and zero number bans.</p>
                    </div>
                  </div>
                  <div className="col-12 col-md-4">
                    <div className="p-3 bg-white rounded-3 border h-100 shadow-xs">
                      <div className="text-primary fs-4 mb-2">
                        <i className="bi bi-send-fill"></i>
                      </div>
                      <h6 className="fw-bold mb-1">Campaigns & Templates</h6>
                      <p className="text-muted small mb-0">Send high-converting broadcast campaigns using verified rich media WhatsApp templates.</p>
                    </div>
                  </div>
                  <div className="col-12 col-md-4">
                    <div className="p-3 bg-white rounded-3 border h-100 shadow-xs">
                      <div className="text-purple fs-4 mb-2" style={{ color: '#8b5cf6' }}>
                        <i className="bi bi-chat-dots-fill"></i>
                      </div>
                      <h6 className="fw-bold mb-1">Team Inbox & Analytics</h6>
                      <p className="text-muted small mb-0">Collaborative team inbox with live read receipts, delivery tracking, and analytics.</p>
                    </div>
                  </div>
                </div>

                {/* Primary CTA Box */}
                <div className="card border-0 shadow-sm p-4 text-center bg-white mb-3" style={{ borderRadius: '14px' }}>
                  <div className="mb-3">
                    <span className="badge bg-success-subtle text-success px-3 py-2 rounded-pill fw-semibold">
                      <i className="bi bi-shield-lock-fill me-1"></i> Tech Provider Secure OAuth
                    </span>
                  </div>

                  <h5 className="fw-bold text-dark mb-2">Ready to connect your WhatsApp Business number?</h5>
                  <p className="text-muted small mb-4 mx-auto" style={{ maxWidth: '520px' }}>
                    Click <strong>Continue with Facebook</strong> to log into your Facebook account, select your Meta Business Portfolio, and link your official WhatsApp number in under 60 seconds.
                  </p>

                  <div className="d-flex flex-column align-items-center justify-content-center gap-3">
                    <button
                      type="button"
                      disabled={checkingReadiness || (readiness && !readiness.isReady)}
                      onClick={handleContinueWithFacebook}
                      className="btn btn-lg d-flex align-items-center justify-content-center gap-2 px-4 py-3 fw-bold text-white shadow-sm"
                      style={{
                        backgroundColor: '#1877F2',
                        borderColor: '#1877F2',
                        borderRadius: '10px',
                        minWidth: '290px',
                        fontSize: '1.05rem'
                      }}
                    >
                      {checkingReadiness ? (
                        <>
                          <span className="spinner-border spinner-border-sm" role="status"></span>
                          <span>Checking Platform Readiness...</span>
                        </>
                      ) : (
                        <>
                          <i className="bi bi-facebook fs-4"></i>
                          <span>Continue with Facebook (Popup)</span>
                        </>
                      )}
                    </button>

                    <div className="d-flex align-items-center gap-2 w-100 my-1" style={{ maxWidth: '320px' }}>
                      <hr className="flex-grow-1 my-0 text-muted" />
                      <span className="text-muted small fw-semibold text-uppercase" style={{ fontSize: '0.75rem' }}>or use direct portal</span>
                      <hr className="flex-grow-1 my-0 text-muted" />
                    </div>

                    <button
                      type="button"
                      onClick={handleOpenMetaHostedOnboarding}
                      className="btn btn-outline-primary d-flex align-items-center justify-content-center gap-2 px-4 py-2 fw-semibold"
                      style={{
                        borderRadius: '10px',
                        minWidth: '290px',
                        fontSize: '0.95rem'
                      }}
                    >
                      <i className="bi bi-box-arrow-up-right"></i>
                      <span>Open Official Meta Onboarding Page ↗</span>
                    </button>

                    <small className="text-muted">
                      Direct Meta-hosted link: No developer account needed. Recommended if popups are blocked or connecting external personal accounts.
                    </small>
                  </div>
                </div>

                {/* Collapsible Developer Sandbox / Direct Token Option */}
                <div className="border rounded-3 bg-white p-3">
                  <div
                    className="d-flex align-items-center justify-content-between cursor-pointer"
                    onClick={() => setShowDevTools(!showDevTools)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <i className="bi bi-code-slash text-secondary"></i>
                      <span className="fw-semibold small text-secondary">
                        Developer Testing & Direct Token Entry (Optional)
                      </span>
                    </div>
                    <i className={`bi bi-chevron-${showDevTools ? 'up' : 'down'} text-muted`}></i>
                  </div>

                  {showDevTools && (
                    <form onSubmit={handleDirectTokenSubmit} className="mt-3 pt-3 border-top">
                      <div className="mb-2">
                        <label className="form-label small fw-semibold text-muted">Meta Permanent / System Access Token</label>
                        <input
                          type="password"
                          className="form-control form-control-sm font-monospace"
                          placeholder="EAAG..."
                          value={directToken}
                          onChange={(e) => setDirectToken(e.target.value)}
                        />
                      </div>
                      <div className="row g-2 mb-3">
                        <div className="col-6">
                          <label className="form-label small text-muted">Phone Number ID (Optional)</label>
                          <input
                            type="text"
                            className="form-control form-control-sm font-monospace"
                            placeholder="Auto-discovered if blank"
                            value={directPhoneId}
                            onChange={(e) => setDirectPhoneId(e.target.value)}
                          />
                        </div>
                        <div className="col-6">
                          <label className="form-label small text-muted">WABA ID (Optional)</label>
                          <input
                            type="text"
                            className="form-control form-control-sm font-monospace"
                            placeholder="Auto-discovered if blank"
                            value={directWabaId}
                            onChange={(e) => setDirectWabaId(e.target.value)}
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={devImporting || !directToken.trim()}
                        className="btn btn-outline-primary btn-sm"
                      >
                        {devImporting ? 'Importing...' : 'Import Account Directly'}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}

            {/* SCREEN 2: VERIFYING IN PROGRESS */}
            {screen === 'verifying' && (
              <div className="py-4 text-center">
                <div className="spinner-border text-primary mb-3" style={{ width: '3.5rem', height: '3.5rem' }} role="status"></div>
                <h5 className="fw-bold mb-1">Verifying WhatsApp Business Account</h5>
                <p className="text-muted small mb-4">Please complete the authorization in the Facebook popup window...</p>

                {/* Progress Checklist */}
                <div className="card border-0 shadow-xs bg-white text-start p-3 mx-auto" style={{ maxWidth: '520px', borderRadius: '12px' }}>
                  {verificationLogs.map((log) => (
                    <div key={log.id} className="d-flex align-items-center gap-3 py-2 border-bottom last:border-0">
                      {log.status === 'done' && (
                        <i className="bi bi-check-circle-fill text-success fs-5"></i>
                      )}
                      {log.status === 'active' && (
                        <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                      )}
                      {log.status === 'pending' && (
                        <i className="bi bi-circle text-muted fs-5"></i>
                      )}
                      <span className={`small ${log.status === 'active' ? 'fw-bold text-primary' : (log.status === 'done' ? 'text-dark' : 'text-muted')}`}>
                        {log.title}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Live Troubleshooting Banner if Meta shows "This content isn't available" */}
                {waitingSeconds >= 5 && (
                  <div className="card border-warning-subtle text-start p-3 mx-auto mt-3 shadow-xs" style={{ maxWidth: '520px', backgroundColor: '#fffbeb', borderRadius: '12px' }}>
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <i className="bi bi-exclamation-triangle-fill text-warning fs-5"></i>
                      <strong className="text-dark small">Facebook popup me "This content isn't available at the moment" dikh raha hai?</strong>
                    </div>
                    <p className="small text-muted mb-2">
                      Yeh Meta ka standard error hai. Iska matlab aapka Meta Developer App (<code>{readiness?.appId || '1165054629187576'}</code>)
                      abhi <strong>"In development"</strong> mode me hai aur jis Facebook ID se aap login hain wo Meta App me registered nahi hai.
                    </p>
                    <div className="small fw-semibold text-dark mb-1">Isko 2 minute me kaise theek karein:</div>
                    <ul className="small text-muted ps-3 mb-3">
                      <li className="mb-1">
                        <strong>Solution 1 (Live Mode - Recommended):</strong> Meta Developer Console me sabse upar App Mode ko <strong>"In development"</strong> se <strong>"Live"</strong> toggle karein. Uske baad koi bhi Facebook user 1-click connect kar sakega!
                      </li>
                      <li>
                        <strong>Solution 2 (Testing Roles):</strong> Meta Console me <strong>App roles → Roles</strong> me jakar apna Facebook profile <strong>Tester / Developer</strong> me Add kar lein.
                      </li>
                    </ul>
                    <div className="d-flex flex-wrap align-items-center gap-2 pt-2 border-top">
                      <button
                        type="button"
                        className="btn btn-sm btn-dark"
                        onClick={handleCancelConnection}
                      >
                        <i className="bi bi-x-circle me-1"></i> Close Popup & Reset
                      </button>
                      <a
                        href="https://developers.facebook.com/apps/1165054629187576/roles/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-outline-primary"
                      >
                        <i className="bi bi-box-arrow-up-right me-1"></i> Open Meta Roles
                      </a>
                    </div>
                  </div>
                )}

                <div className="mt-3">
                  <button
                    type="button"
                    onClick={handleCancelConnection}
                    className="btn btn-link text-muted btn-sm"
                  >
                    Cancel Connection
                  </button>
                </div>
              </div>
            )}

            {/* SCREEN 3: SUCCESS SUMMARY */}
            {screen === 'success' && connectedAccount && (
              <div className="py-3 text-center">
                <div className="text-success display-4 mb-2">
                  <i className="bi bi-check-circle-fill"></i>
                </div>
                <h4 className="fw-bold text-dark mb-1">WhatsApp Business Account Connected!</h4>
                <p className="text-muted small mb-4">
                  Your WhatsApp number has been verified with Meta Cloud API and registered to your workspace.
                </p>

                <div className="card border-0 shadow-sm bg-white p-4 mx-auto text-start mb-4" style={{ maxWidth: '520px', borderRadius: '14px' }}>
                  <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                    <span className="text-muted small">Display Name:</span>
                    <strong className="text-dark">{connectedAccount.display_name || connectedAccount.verified_name || 'Official WhatsApp Account'}</strong>
                  </div>
                  <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                    <span className="text-muted small">WhatsApp Number:</span>
                    <strong className="text-success font-monospace">{connectedAccount.phone_number || connectedAccount.display_phone_number}</strong>
                  </div>
                  <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                    <span className="text-muted small">WABA ID:</span>
                    <code className="text-muted">{connectedAccount.waba_id}</code>
                  </div>
                  <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                    <span className="text-muted small">Phone Number ID:</span>
                    <code className="text-muted">{connectedAccount.phone_number_id}</code>
                  </div>
                  <div className="d-flex align-items-center justify-content-between">
                    <span className="text-muted small">Quality Rating:</span>
                    <span className="badge bg-success-subtle text-success">
                      {connectedAccount.quality_rating || 'GREEN'} (Verified)
                    </span>
                  </div>
                </div>

                <div className="d-flex align-items-center justify-content-center gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn btn-primary px-4 py-2 fw-semibold shadow-xs"
                  >
                    Done & View Accounts
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Modal Footer */}
          <div className="modal-footer bg-white border-top py-3 px-4 d-flex align-items-center justify-content-between">
            <span className="text-muted small">
              Strict Multi-Tenant Isolation • AES-256 Token Encryption
            </span>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>
              Close
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
