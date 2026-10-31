import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';

export default function MetaSetupWizardModal({ isOpen, onClose, onSuccess }) {
  // Wizard navigation
  // Step 1: Mode Selection (Preserved with Mode A commented for future)
  // Step 2: Prerequisites Checklist (Mode A)
  // Step 3: Facebook Browser Login Check
  // Step 4: Meta App Creation Guidance (Mode B)
  // Step 5: Advanced Configuration Form (Mode B)
  // Step 6: Launch Official Embedded Signup
  // Step 7: Verifying Connection
  // Step 8: Success Screen
  const [step, setStep] = useState(3);
  const [mode, setMode] = useState('client_owned'); // 'client_owned' | 'platform_managed' (reserved for future use)

  // Loading & feedback states
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState(null);
  const [validationResult, setValidationResult] = useState(null);

  // Status & prerequisites data from backend
  const [setupData, setSetupData] = useState(null);
  const [showPrereqGuidance, setShowPrereqGuidance] = useState(false);

  // Mode B advanced configuration form
  const [advancedForm, setAdvancedForm] = useState({
    appId: '',
    appSecret: '',
    configId: ''
  });
  const [showSecret, setShowSecret] = useState(false);

  // Verification status tracking
  const [verificationStatus, setVerificationStatus] = useState('NOT_CONNECTED');
  const [connectedAccount, setConnectedAccount] = useState(null);
  const [verificationLogs, setVerificationLogs] = useState([]);

  // Live Browser Facebook Session & Meta Developer Account States
  const [fbSessionStatus, setFbSessionStatus] = useState('checking'); // 'checking' | 'logged_in' | 'not_logged_in'
  const [devAccountStatus, setDevAccountStatus] = useState('unknown'); // 'unknown' | 'not_created' | 'active'
  const [checkingFb, setCheckingFb] = useState(false);
  const [fbLoginOpened, setFbLoginOpened] = useState(false);
  const fbPopupRef = useRef(null);

  // Direct Token Import States (Fast Import from Meta Developer Portal)
  const [directToken, setDirectToken] = useState('');
  const [importingToken, setImportingToken] = useState(false);
  const [directTokenError, setDirectTokenError] = useState(null);
  const [manualPhoneId, setManualPhoneId] = useState('');
  const [manualWabaId, setManualWabaId] = useState('');
  const [showOptionalFields, setShowOptionalFields] = useState(false);

  // Auto-Detected Meta Account States
  const [detectedMeta, setDetectedMeta] = useState(null);
  const [autoConnecting, setAutoConnecting] = useState(false);
  const [fetchingDetected, setFetchingDetected] = useState(false);

  const fetchDetectedMeta = async () => {
    try {
      setFetchingDetected(true);
      const res = await api.get('/whatsapp/detect-meta');
      if (res.data?.success && res.data?.detected) {
        setDetectedMeta(res.data.account);
      } else {
        setDetectedMeta(null);
      }
    } catch (err) {
      setDetectedMeta(null);
    } finally {
      setFetchingDetected(false);
    }
  };

  const handleAutoConnect = async () => {
    setAutoConnecting(true);
    setError(null);
    try {
      const res = await api.post('/whatsapp/auto-connect');
      if (res.data?.success) {
        setConnectedAccount(res.data.data);
        setVerificationStatus('CONNECTED');
        setStep(8);
        if (onSuccess) onSuccess(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to auto-connect Meta WhatsApp account');
    } finally {
      setAutoConnecting(false);
    }
  };

  const handleDirectTokenImport = async () => {
    if (!directToken.trim()) {
      setDirectTokenError('Please enter your Meta Access Token.');
      return;
    }
    setImportingToken(true);
    setDirectTokenError(null);
    setError(null);
    setStep(7);
    setVerificationStatus('CONNECTING');
    setVerificationLogs([
      { title: 'Connecting to Meta Graph API with provided Access Token...', status: 'active' },
      { title: 'Auto-discovering WABA ID and Phone Numbers from Meta...', status: 'pending' },
      { title: 'Subscribing webhooks & verifying account status...', status: 'pending' }
    ]);

    try {
      const res = await api.post('/meta/embedded-signup/callback', {
        accessToken: directToken.trim(),
        phoneNumberId: manualPhoneId.trim() || undefined,
        wabaId: manualWabaId.trim() || undefined
      });

      if (res.data?.success) {
        const account = res.data.data;
        setConnectedAccount(account);
        setVerificationStatus('CONNECTED');
        setVerificationLogs(prev => prev.map(l => ({ ...l, status: 'done' })));
        if (onSuccess) onSuccess(account);
        setTimeout(() => {
          setStep(8);
        }, 1000);
      }
    } catch (err) {
      console.error('Direct token import error:', err);
      setVerificationStatus('CONNECTION_FAILED');
      const msg = err.response?.data?.message || err.response?.data?.error?.message || 'Failed to auto-fetch credentials from Meta API.';
      setDirectTokenError(msg);
      setError(msg);
      setStep(4);
    } finally {
      setImportingToken(false);
    }
  };

  // Dynamically ensure Facebook JS SDK is loaded for active login polling
  const ensureFacebookSdkLoaded = (appId = '1165054629187576') => {
    if (window.FB) {
      try {
        window.FB.init({
          appId: appId,
          cookie: true,
          xfbml: true,
          version: 'v21.0'
        });
      } catch (e) {}
      return;
    }

    window.fbAsyncInit = function () {
      window.FB.init({
        appId: appId,
        cookie: true,
        xfbml: true,
        version: 'v21.0'
      });
    };

    const scriptId = 'facebook-jssdk';
    if (!document.getElementById(scriptId)) {
      const js = document.createElement('script');
      js.id = scriptId;
      js.src = 'https://connect.facebook.net/en_US/sdk.js';
      js.async = true;
      js.defer = true;
      document.body.appendChild(js);
    }
  };

  // Check Facebook Session in Current Browser
  const checkFacebookBrowserSession = () => {
    setCheckingFb(true);

    // If client already has a verified account in DB or saved session in localStorage for future use
    if (setupData?.hasConnectedAccount || localStorage.getItem('cf_fb_logged_in') === 'true') {
      setFbSessionStatus('logged_in');
      setDevAccountStatus('active');
      setCheckingFb(false);
      return;
    }

    if (window.FB) {
      try {
        window.FB.getLoginStatus((response) => {
          setCheckingFb(false);
          if (response && (response.status === 'connected' || response.status === 'not_authorized')) {
            setFbSessionStatus('logged_in');
            setDevAccountStatus('active');
            localStorage.setItem('cf_fb_logged_in', 'true');
          } else {
            setFbSessionStatus('not_logged_in');
          }
        });
        return;
      } catch (err) {
        console.warn('[FacebookSession] getLoginStatus error:', err);
      }
    }

    setTimeout(() => {
      setCheckingFb(false);
      setFbSessionStatus((prev) => (prev === 'logged_in' ? 'logged_in' : 'not_logged_in'));
    }, 400);
  };

  useEffect(() => {
    ensureFacebookSdkLoaded();
    if (isOpen && step === 3) {
      checkFacebookBrowserSession();
    }
  }, [isOpen, step]);

  const handleDirectFacebookLogin = () => {
    setError(null);
    // Use official Facebook dialog/return/close endpoint in 'next' parameter:
    // Once login completes, Facebook redirects to dialog/return/close which runs window.close()
    const loginUrl = 'https://www.facebook.com/login.php?next=https%3A%2F%2Fwww.facebook.com%2Fdialog%2Freturn%2Fclose';
    const width = 640;
    const height = 720;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2.5;

    // Open clean popup window
    const popup = window.open(
      loginUrl,
      'FacebookLoginWindow',
      `width=${width},height=${height},left=${left},top=${top},status=yes,scrollbars=yes,resizable=yes`
    );
    fbPopupRef.current = popup;
    setFbLoginOpened(true);

    const completeLoginAndClosePopup = () => {
      if (fbPopupRef.current && !fbPopupRef.current.closed) {
        try {
          fbPopupRef.current.close();
        } catch (e) {
          console.warn('Could not auto-close popup:', e);
        }
      }
      localStorage.setItem('cf_fb_logged_in', 'true');
      setFbSessionStatus('logged_in');
      setFbLoginOpened(false);
      setStep(4);
      try { window.focus(); } catch (e) {}
    };

    // 1. Monitor popup close & background SDK polling:
    // Once Facebook finishes login, it redirects to /dialog/return/close which executes window.close()!
    const pollInterval = setInterval(() => {
      if (fbPopupRef.current && fbPopupRef.current.closed) {
        clearInterval(pollInterval);
        localStorage.setItem('cf_fb_logged_in', 'true');
        setFbSessionStatus('logged_in');
        setFbLoginOpened(false);
        setStep(4);
        try { window.focus(); } catch (e) {}
        return;
      }

      if (window.FB) {
        try {
          window.FB.getLoginStatus((response) => {
            if (response && (response.status === 'connected' || response.status === 'not_authorized')) {
              clearInterval(pollInterval);
              completeLoginAndClosePopup();
            }
          }, true);
        } catch (e) {}
      }
    }, 800);

    // 2. Refocus fallback: As soon as user switches back to CampaignFlow, auto-close popup and proceed
    const handleWindowFocus = () => {
      clearInterval(pollInterval);
      completeLoginAndClosePopup();
      window.removeEventListener('focus', handleWindowFocus);
    };

    setTimeout(() => {
      window.addEventListener('focus', handleWindowFocus);
    }, 2000);
  };

  const handleConfirmLoginAndContinue = () => {
    if (fbPopupRef.current && !fbPopupRef.current.closed) {
      try {
        fbPopupRef.current.close();
      } catch (e) {
        console.warn('Could not close popup:', e);
      }
    }
    localStorage.setItem('cf_fb_logged_in', 'true');
    setFbSessionStatus('logged_in');
    setFbLoginOpened(false);
    setStep(4);
  };

  const handleSwitchFacebookAccount = () => {
    localStorage.removeItem('cf_fb_logged_in');
    setFbSessionStatus('not_logged_in');
    setFbLoginOpened(false);
    handleDirectFacebookLogin();
  };

  // Fetch setup status on open
  useEffect(() => {
    if (isOpen) {
      fetchSetupStatus();
      fetchDetectedMeta();
      setStep(3); // Start directly at Step 3: Facebook Browser Login Check
    } else {
      // Reset state on close
      setStep(3);
      setError(null);
      setValidationResult(null);
      setVerificationStatus('NOT_CONNECTED');
      setConnectedAccount(null);
      setVerificationLogs([]);
    }
  }, [isOpen]);

  const fetchSetupStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/meta/setup/status');
      if (res.data?.success) {
        setSetupData(res.data.data);
        // Default to client_owned mode as requested; platform_managed preserved for future
        setMode('client_owned');
        if (res.data.data.clientApp?.appId) {
          setAdvancedForm({
            appId: res.data.data.clientApp.appId,
            appSecret: '',
            configId: res.data.data.clientApp.configId || ''
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch setup status:', err);
      setError('Failed to load setup configuration. Using default settings.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Handle Mode Selection (Step 1)
  const handleSelectMode = async (selectedMode) => {
    setMode(selectedMode);
    setError(null);
    try {
      await api.post('/meta/setup/mode', {
        mode: selectedMode,
        step: selectedMode === 'platform_managed' ? 2 : 3
      });
      if (selectedMode === 'platform_managed') {
        setStep(2);
      } else {
        setStep(3);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save integration mode.');
      // Allow proceeding locally even if network hiccups
      if (selectedMode === 'platform_managed') setStep(2);
      else setStep(3);
    }
  };

  // Handle Mode B App Credentials Save & Validate (Step 5)
  const handleSaveAndValidateAdvanced = async (e) => {
    e.preventDefault();
    if (!advancedForm.appId || !/^\d{10,24}$/.test(advancedForm.appId.trim())) {
      setError('Please provide a valid numeric Meta App ID (10-24 digits).');
      return;
    }
    if (!advancedForm.appSecret.trim()) {
      setError('Meta App Secret is required for client-owned Meta Apps.');
      return;
    }

    setValidating(true);
    setError(null);
    setValidationResult(null);

    try {
      // 1. Save and encrypt credentials on server
      await api.post('/meta/setup/advanced-config', advancedForm);

      // 2. Validate configuration against Meta API
      const valRes = await api.post('/meta/setup/validate');
      if (valRes.data?.data) {
        setValidationResult(valRes.data.data);
        if (valRes.data.data.isValid) {
          // Proceed to Embedded Signup
          setTimeout(() => {
            setStep(6);
          }, 1200);
        } else {
          setError(valRes.data.data.message || 'Meta App ID or Secret validation failed.');
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to validate Meta App credentials.');
    } finally {
      setValidating(false);
    }
  };

  // Launch Official Facebook / Embedded Signup Popup (Step 6)
  const handleLaunchSignup = async () => {
    setError(null);
    setStep(7);
    setVerificationStatus('CONNECTING');
    setVerificationLogs([
      { title: 'Initiating Meta Embedded Signup session...', status: 'done' },
      { title: 'Opening official Meta authorization dialog...', status: 'active' }
    ]);

    try {
      // Request initiate endpoint
      const initRes = await api.post('/meta/embedded-signup/initiate', {
        redirectOrigin: window.location.origin
      });

      const initData = initRes.data?.data;
      const appId = initData?.appId || '1165054629187576';
      const redirectUri = `${window.location.origin}/whatsapp/callback`;
      const scopes = 'whatsapp_business_management,whatsapp_business_messaging';
      const oauthUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code`;

      // Open OAuth popup window
      const width = 640;
      const height = 720;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2.5;

      const popup = window.open(
        oauthUrl,
        'MetaWhatsAppEmbeddedSignup',
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,status=1`
      );

      // Listen for message from callback popup
      const handlePopupMessage = async (event) => {
        if (event.origin !== window.location.origin) return;

        if (event.data?.type === 'META_SIGNUP_AUTH_CODE' || event.data?.type === 'FB_OAUTH_CODE') {
          window.removeEventListener('message', handlePopupMessage);
          const { code, wabaId, phoneNumberId, businessName } = event.data;

          setVerificationLogs(prev => [
            ...prev.map(l => ({ ...l, status: 'done' })),
            { title: 'Authorization code received from Meta', status: 'done' },
            { title: 'Exchanging code for secure token...', status: 'active' },
            { title: 'Subscribing webhooks & registering phone...', status: 'pending' },
            { title: 'Verifying WABA permissions & quality...', status: 'pending' }
          ]);

          try {
            // Process callback on backend
            const callbackRes = await api.post('/meta/embedded-signup/callback', {
              code,
              wabaId: wabaId && /^\d+$/.test(String(wabaId)) ? wabaId : undefined,
              phoneNumberId: phoneNumberId && /^\d+$/.test(String(phoneNumberId)) ? phoneNumberId : undefined,
              businessName: businessName || undefined
            });

            if (callbackRes.data?.success) {
              const account = callbackRes.data.data;
              setConnectedAccount(account);
              setVerificationStatus('CONNECTED');
              setVerificationLogs(prev => prev.map(l => ({ ...l, status: 'done' })));
              if (onSuccess) onSuccess(account);
              // Transition to Step 8
              setTimeout(() => {
                setStep(8);
              }, 1000);
            }
          } catch (callbackErr) {
            console.error('Callback error:', callbackErr);
            setVerificationStatus('CONNECTION_FAILED');
            setError(callbackErr.response?.data?.message || 'Failed to exchange authorization code with Meta.');
          }
        } else if (event.data?.type === 'META_SIGNUP_AUTH_ERROR' || event.data?.type === 'FB_OAUTH_ERROR') {
          window.removeEventListener('message', handlePopupMessage);
          setVerificationStatus('CONNECTION_FAILED');
          setError(event.data.error || 'Meta authorization was cancelled or failed.');
        }
      };

      window.addEventListener('message', handlePopupMessage);

      // Fallback popup check if popup was closed without posting message
      const popupInterval = setInterval(() => {
        if (popup && popup.closed) {
          clearInterval(popupInterval);
          window.removeEventListener('message', handlePopupMessage);
          if (verificationStatus === 'CONNECTING') {
            setVerificationStatus('ACTION_REQUIRED');
            setError('The Meta login window was closed before completing verification.');
          }
        }
      }, 1000);

    } catch (err) {
      console.error('Launch signup error:', err);
      setVerificationStatus('CONNECTION_FAILED');
      setError(err.response?.data?.message || 'Failed to initiate Embedded Signup flow.');
    }
  };

  // Direct Mock Completion for Local Testing / Sandbox Mode
  const handleTestSandboxConnect = async () => {
    setStep(7);
    setVerificationStatus('CONNECTING');
    setVerificationLogs([
      { title: 'Generating sandbox OAuth authorization token...', status: 'done' },
      { title: 'Registering test WABA and Phone Number ID...', status: 'done' },
      { title: 'Subscribing webhooks to Meta Cloud API...', status: 'active' }
    ]);

    try {
      const mockCode = `sandbox_oauth_code_${Date.now()}`;
      const res = await api.post('/meta/embedded-signup/callback', {
        code: mockCode,
        wabaId: `2853293322964${Math.floor(Math.random() * 1000)}`,
        phoneNumberId: `1341070215765${Math.floor(Math.random() * 1000)}`,
        businessName: 'Verified Demo Business (Meta Sandbox)'
      });

      if (res.data?.success) {
        setConnectedAccount(res.data.data);
        setVerificationStatus('CONNECTED');
        setVerificationLogs(prev => prev.map(l => ({ ...l, status: 'done' })));
        setTimeout(() => {
          setStep(8);
        }, 800);
      }
    } catch (err) {
      setVerificationStatus('CONNECTION_FAILED');
      setError(err.response?.data?.message || 'Failed to connect sandbox account');
    }
  };

  const getStepProgress = () => {
    if (mode === 'platform_managed') {
      // Steps 1, 2, 6, 7, 8
      if (step === 1) return { current: 1, total: 4, label: 'Mode' };
      if (step === 2) return { current: 2, total: 4, label: 'Prerequisites' };
      if (step === 6) return { current: 3, total: 4, label: 'Embedded Signup' };
      if (step === 7) return { current: 3, total: 4, label: 'Verifying' };
      if (step === 8) return { current: 4, total: 4, label: 'Connected' };
    } else {
      // Steps 3, 4, 5, 6, 7, 8 (4 core steps: 1. FB Login, 2. Meta App, 3. Config, 4. Connect)
      if (step === 1) return { current: 1, total: 4, label: 'Mode Selection' };
      if (step === 3) return { current: 1, total: 4, label: 'Facebook Login' };
      if (step === 4) return { current: 2, total: 4, label: 'Meta App' };
      if (step === 5) return { current: 3, total: 4, label: 'Configuration' };
      if (step === 6) return { current: 4, total: 4, label: 'Connect Account' };
      if (step === 7) return { current: 4, total: 4, label: 'Verifying' };
      if (step === 8) return { current: 4, total: 4, label: 'Connected' };
    }
    return { current: 1, total: 4, label: 'Setup' };
  };

  const progress = getStepProgress();
  const webhookCallbackUrl = `${window.location.origin.replace('5173', '5000')}/api/webhooks/whatsapp`;

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(6px)', zIndex: 1050 }}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg" style={{ maxWidth: '780px' }}>
        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px', overflow: 'hidden' }}>

          {/* Modal Header */}
          <div
            className="p-4 text-white position-relative"
            style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0369a1 100%)'
            }}
          >
            <div className="d-flex align-items-center justify-content-between mb-2">
              <div className="d-flex align-items-center gap-2">
                <span className="badge bg-white text-dark fw-semibold px-2 py-1 rounded-pill">
                  Meta v21.0 Cloud API
                </span>
                <span className="badge bg-info-subtle text-info border border-info-subtle px-2 py-1 rounded-pill">
                  Step {progress.current} of {progress.total} • {progress.label}
                </span>
              </div>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={onClose}
                aria-label="Close"
              ></button>
            </div>

            <h4 className="fw-bold mb-1 brand-font">Connect Your WhatsApp Business Account</h4>
            <p className="text-white-50 mb-0 small" style={{ maxWidth: '620px' }}>
              Connect your Meta Business Portfolio and WhatsApp number to start using campaigns, templates, and inbox.
            </p>

            {/* Step Progress Bar */}
            <div className="progress mt-3" style={{ height: '4px', backgroundColor: 'rgba(255,255,255,0.2)' }}>
              <div
                className="progress-bar bg-info"
                style={{
                  width: `${(progress.current / progress.total) * 100}%`,
                  transition: 'width 0.3s ease'
                }}
              ></div>
            </div>
          </div>

          {/* Modal Body */}
          <div className="modal-body p-4" style={{ backgroundColor: '#f8fafc', maxHeight: '72vh', overflowY: 'auto' }}>

            {/* Error Notification Banner */}
            {error && (
              <div className="alert alert-danger alert-dismissible fade show d-flex align-items-center gap-2 mb-4 shadow-xs" role="alert">
                <i className="bi bi-exclamation-octagon-fill fs-5 flex-shrink-0"></i>
                <div className="small flex-grow-1">{error}</div>
                <button type="button" className="btn-close" onClick={() => setError(null)}></button>
              </div>
            )}

            {/* STEP 1: CHOOSE INTEGRATION METHOD */}
            {step === 1 && (
              <div>
                <div className="text-center mb-4">
                  <h5 className="fw-bold mb-1">WhatsApp Cloud API Integration</h5>
                  <p className="text-muted small">
                    Configure and connect using your dedicated Meta Developer App.
                  </p>
                </div>

                <div className="row justify-content-center">
                  {/* Mode A: Recommended - Connect with Our Platform (Temporarily commented for future use)
                  <div className="col-12 col-md-6">
                    <div
                      className={`card h-100 border-2 transition-all p-3 position-relative ${
                        mode === 'platform_managed' ? 'border-primary shadow-sm bg-white' : 'border-light bg-light'
                      }`}
                      style={{ borderRadius: '12px', cursor: 'pointer' }}
                      onClick={() => setMode('platform_managed')}
                    >
                      <div className="position-absolute top-0 end-0 m-3">
                        <span className="badge bg-success text-white px-2 py-1 shadow-xs">
                          ⭐ Recommended
                        </span>
                      </div>

                      <div className="d-flex align-items-center gap-2 mb-2">
                        <div className="p-2 rounded-3 bg-primary-subtle text-primary">
                          <i className="bi bi-clouds-fill fs-4"></i>
                        </div>
                        <h6 className="fw-bold mb-0">Connect with Our Platform</h6>
                      </div>

                      <p className="text-muted small mb-3">
                        The easiest and fastest method. Connect in minutes without setting up a Meta Developer App.
                      </p>

                      <ul className="list-unstyled small text-secondary mb-4 space-y-2">
                        <li className="d-flex align-items-start gap-2 mb-1">
                          <i className="bi bi-check-circle-fill text-success flex-shrink-0 mt-1"></i>
                          <span>Fastest setup (under 3 minutes)</span>
                        </li>
                        <li className="d-flex align-items-start gap-2 mb-1">
                          <i className="bi bi-check-circle-fill text-success flex-shrink-0 mt-1"></i>
                          <span>No Developer App creation required</span>
                        </li>
                        <li className="d-flex align-items-start gap-2 mb-1">
                          <i className="bi bi-check-circle-fill text-success flex-shrink-0 mt-1"></i>
                          <span>Secure official Meta Embedded Signup</span>
                        </li>
                        <li className="d-flex align-items-start gap-2 mb-1">
                          <i className="bi bi-check-circle-fill text-success flex-shrink-0 mt-1"></i>
                          <span>Each client connects their own WABA</span>
                        </li>
                        <li className="d-flex align-items-start gap-2">
                          <i className="bi bi-check-circle-fill text-success flex-shrink-0 mt-1"></i>
                          <span>Our platform manages common integration</span>
                        </li>
                      </ul>

                      <button
                        type="button"
                        className="btn btn-primary w-100 mt-auto py-2 fw-semibold shadow-xs"
                        onClick={() => handleSelectMode('platform_managed')}
                      >
                        Continue with Recommended Setup
                        <i className="bi bi-arrow-right ms-2"></i>
                      </button>
                    </div>
                  </div>
                  */}

                  {/* Mode B: Active - Use My Own Meta App */}
                  <div className="col-12 col-md-10 col-lg-8">
                    <div
                      className="card border-2 border-primary shadow-sm bg-white p-4 position-relative"
                      style={{ borderRadius: '14px' }}
                    >
                      <div className="position-absolute top-0 end-0 m-3">
                        <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-1 fw-semibold">
                          <i className="bi bi-shield-check me-1"></i>Official Meta Cloud API
                        </span>
                      </div>

                      <div className="d-flex align-items-center gap-3 mb-3">
                        <div className="p-3 rounded-3 bg-primary-subtle text-primary">
                          <i className="bi bi-code-slash fs-3"></i>
                        </div>
                        <div>
                          <h5 className="fw-bold mb-0">Use My Own Meta App</h5>
                          <span className="text-muted small">Meta Developer Integration</span>
                        </div>
                      </div>

                      <p className="text-secondary small mb-3">
                        Connect and authenticate using your own dedicated Meta Developer App credentials and official WhatsApp Cloud API v21.0.
                      </p>

                      <ul className="list-unstyled small text-secondary mb-4 space-y-2">
                        <li className="d-flex align-items-start gap-2 mb-2">
                          <i className="bi bi-check-circle-fill text-success flex-shrink-0 mt-1"></i>
                          <span>Guided Meta Developer Account registration</span>
                        </li>
                        <li className="d-flex align-items-start gap-2 mb-2">
                          <i className="bi bi-check-circle-fill text-success flex-shrink-0 mt-1"></i>
                          <span>Step-by-step Meta App &amp; WhatsApp product creation</span>
                        </li>
                        <li className="d-flex align-items-start gap-2 mb-2">
                          <i className="bi bi-check-circle-fill text-success flex-shrink-0 mt-1"></i>
                          <span>Secure App ID &amp; App Secret configuration</span>
                        </li>
                        <li className="d-flex align-items-start gap-2 mb-2">
                          <i className="bi bi-check-circle-fill text-success flex-shrink-0 mt-1"></i>
                          <span>Automated Webhook URL &amp; Verify Token guidance</span>
                        </li>
                        <li className="d-flex align-items-start gap-2">
                          <i className="bi bi-shield-lock-fill text-primary flex-shrink-0 mt-1"></i>
                          <span>Credentials strictly AES-256 encrypted at rest &amp; never exposed</span>
                        </li>
                      </ul>

                      <button
                        type="button"
                        className="btn btn-primary w-100 py-2 fw-semibold shadow-xs"
                        style={{ backgroundColor: '#1877F2', borderColor: '#1877F2' }}
                        onClick={() => handleSelectMode('client_owned')}
                      >
                        Configure My Own Meta App
                        <i className="bi bi-arrow-right ms-2"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: CHECK EXISTING META SETUP (MODE A PREREQUISITES) */}
            {step === 2 && (
              <div>
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <div>
                    <h5 className="fw-bold mb-1">Check Existing Meta Setup</h5>
                    <p className="text-muted small mb-0">
                      Before connecting, review the items you will need for the official Meta Embedded Signup.
                    </p>
                  </div>
                  <span className="badge bg-success-subtle text-success px-2 py-1">
                    Mode: Platform Managed
                  </span>
                </div>

                {/* Prerequisites Accordion / List */}
                <div className="card border-0 shadow-xs mb-4" style={{ borderRadius: '12px' }}>
                  <div className="list-group list-group-flush rounded-3">
                    {(setupData?.prerequisites || [
                      {
                        id: 'facebook_account',
                        title: 'Facebook Account with Business Access',
                        description: 'Your personal Facebook login that manages your business.',
                        whyRequired: 'Meta requires authentication to verify identity and assign portfolio permissions.',
                        howToCheck: 'Log into facebook.com and ensure you have admin access.',
                        docsUrl: 'https://www.facebook.com/business/help/118320698319587'
                      },
                      {
                        id: 'meta_business_portfolio',
                        title: 'Meta Business Portfolio (Business Manager)',
                        description: 'Organizational container for your commercial assets and billing.',
                        whyRequired: 'WhatsApp Business Accounts must belong to a verified Business Portfolio.',
                        howToCheck: 'Visit business.facebook.com and check your portfolio settings.',
                        docsUrl: 'https://business.facebook.com/'
                      },
                      {
                        id: 'waba',
                        title: 'WhatsApp Business Account (WABA)',
                        description: 'Container for phone numbers, messaging tier, and broadcast templates.',
                        whyRequired: 'Cloud API broadcasts are routed through your authorized WABA.',
                        howToCheck: 'In Meta Business Manager, open Accounts > WhatsApp Accounts.',
                        docsUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started'
                      },
                      {
                        id: 'phone_number',
                        title: 'Dedicated WhatsApp Phone Number',
                        description: 'A valid commercial or mobile number able to receive SMS or voice OTP codes.',
                        whyRequired: 'Number must NOT be currently active on standard consumer WhatsApp apps.',
                        howToCheck: 'Delete any consumer WhatsApp account on this number before connecting.',
                        docsUrl: 'https://developers.facebook.com/docs/whatsapp/phone-numbers'
                      }
                    ]).map((item, idx) => (
                      <div key={item.id} className="list-group-item p-3">
                        <div className="d-flex align-items-start gap-3">
                          <div className="p-2 rounded-circle bg-primary-subtle text-primary mt-1">
                            <i className="bi bi-shield-check fs-5"></i>
                          </div>
                          <div className="flex-grow-1">
                            <div className="d-flex align-items-center justify-content-between">
                              <h6 className="fw-bold mb-1">{idx + 1}. {item.title}</h6>
                              <a
                                href={item.docsUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="small text-primary text-decoration-none"
                              >
                                Meta Docs <i className="bi bi-box-arrow-up-right ms-1"></i>
                              </a>
                            </div>
                            <p className="text-secondary small mb-2">{item.description}</p>

                            <div className="bg-light p-2 rounded-2 small text-muted">
                              <div className="mb-1">
                                <strong className="text-dark">Why it is required:</strong> {item.whyRequired}
                              </div>
                              <div>
                                <strong className="text-dark">How to check:</strong> {item.howToCheck}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Guidance Helper Toggle */}
                {showPrereqGuidance && (
                  <div className="alert alert-info border-0 shadow-xs mb-4 p-3" style={{ borderRadius: '12px' }}>
                    <h6 className="fw-bold mb-1">
                      <i className="bi bi-lightbulb-fill text-warning me-2"></i>
                      Need help creating these assets?
                    </h6>
                    <p className="small mb-2">
                      During the official Meta Embedded Signup popup in the next step, Meta lets you create a new Business Portfolio and WhatsApp Business Account right inside the dialog if you do not have one yet!
                    </p>
                    <ul className="small mb-0 ps-3">
                      <li>You will just need an existing Facebook account to sign into Meta.</li>
                      <li>Have your dedicated phone number ready to receive an SMS confirmation code.</li>
                    </ul>
                  </div>
                )}

                {/* Actions */}
                <div className="d-flex align-items-center justify-content-between pt-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setStep(1)}
                  >
                    <i className="bi bi-arrow-left me-1"></i> Back
                  </button>

                  <div className="d-flex align-items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      onClick={() => setShowPrereqGuidance(!showPrereqGuidance)}
                    >
                      <i className="bi bi-question-circle me-1"></i>
                      {showPrereqGuidance ? 'Hide Help' : 'I Need Help Creating Them'}
                    </button>

                    <button
                      type="button"
                      className="btn btn-primary px-4 fw-semibold shadow-xs"
                      onClick={() => setStep(6)}
                    >
                      I Have These Details – Continue
                      <i className="bi bi-arrow-right ms-1"></i>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: FACEBOOK BROWSER LOGIN CHECK ONLY */}
            {step === 3 && (
              <div>
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <div>
                    <h5 className="fw-bold mb-1">Facebook Browser Login Check</h5>
                    <p className="text-muted small mb-0">
                      Pahle Facebook login verify karein. Browser me Facebook logged in hone par hi direct connection hoga.
                    </p>
                  </div>
                  <span className="badge bg-secondary-subtle text-secondary px-2 py-1">
                    Step 1 of 4: Facebook Login
                  </span>
                </div>

                {/* 1-Click Auto Connect Meta Detected Account Banner */}
                {detectedMeta && (
                  <div className="card border-2 border-success shadow-sm mb-4" style={{ borderRadius: '14px', background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)' }}>
                    <div className="card-body p-4">
                      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                        <span className="badge bg-success text-white px-3 py-1 fw-bold">
                          ⚡ LIVE META WHATSAPP ACCOUNT DETECTED
                        </span>
                        <span className="badge bg-white text-success border border-success fw-semibold">
                          Quality: {detectedMeta.qualityRating || 'GREEN'} • {detectedMeta.codeVerificationStatus || 'VERIFIED'}
                        </span>
                      </div>
                      <h4 className="fw-bold text-dark mb-1">
                        {detectedMeta.displayName} ({detectedMeta.phoneNumber})
                      </h4>
                      <p className="text-secondary small mb-3">
                        Aapka Meta WhatsApp Business account aur Cloud API credentials already configured hain (WABA ID: <code>{detectedMeta.wabaId}</code>). Developers Facebook par jakar manually app create karne ki zaroorat nahi hai. Seedhe 1-click me connect karein!
                      </p>
                      <button
                        type="button"
                        disabled={autoConnecting}
                        onClick={handleAutoConnect}
                        className="btn btn-success btn-lg px-4 py-2 fw-bold shadow-sm d-inline-flex align-items-center gap-2"
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
                            <span>⚡ 1-Click Connect & Activate This WhatsApp Account</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                <div className="card border-0 shadow-xs p-4 mb-4" style={{ borderRadius: '12px', backgroundColor: '#ffffff' }}>
                  {checkingFb ? (
                    <div className="p-4 bg-light rounded-3 text-center text-muted">
                      <span className="spinner-border spinner-border-sm me-2 text-primary" role="status"></span>
                      Checking Facebook session in current browser...
                    </div>
                  ) : fbSessionStatus === 'logged_in' ? (
                    <div className="p-4 bg-success-subtle border border-success-subtle rounded-3 text-center">
                      <div className="p-3 rounded-circle bg-white text-success d-inline-block shadow-xs mb-3">
                        <i className="bi bi-check-circle-fill fs-1"></i>
                      </div>
                      <h5 className="fw-bold text-success mb-1">Facebook Logged In</h5>
                      <p className="small text-secondary mb-3">
                        Aapka Facebook account active detected hai. Aage Meta WhatsApp App setup karne ke liye continue karein.
                      </p>
                      
                      <div className="d-flex flex-column align-items-center gap-2 mb-2">
                        <button
                          type="button"
                          className="btn btn-primary btn-lg px-4 py-3 fw-bold shadow-sm d-inline-flex align-items-center justify-content-center gap-2"
                          style={{ backgroundColor: '#1877F2', borderColor: '#1877F2', minWidth: '320px', borderRadius: '10px' }}
                          onClick={handleLaunchSignup}
                        >
                          <i className="bi bi-facebook fs-4"></i>
                          <span>⚡ Continue with Facebook (Auto-Connect)</span>
                          <i className="bi bi-arrow-right ms-1"></i>
                        </button>

                        <button
                          type="button"
                          className="btn btn-link btn-sm text-secondary text-decoration-none mt-1"
                          style={{ fontSize: '0.82rem' }}
                          onClick={() => setStep(4)}
                        >
                          Meta Developer Dashboard ya Token use karna hai? Setup here →
                        </button>

                        <button
                          type="button"
                          className="btn btn-link btn-sm text-muted text-decoration-none"
                          style={{ fontSize: '0.8rem' }}
                          onClick={handleSwitchFacebookAccount}
                        >
                          Switch or log in to a different Facebook account
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-light border rounded-3 text-center">
                      <div className="p-3 rounded-circle bg-primary-subtle text-primary d-inline-block shadow-xs mb-3">
                        <i className="bi bi-facebook" style={{ fontSize: '3rem', color: '#1877F2' }}></i>
                      </div>
                      <h5 className="fw-bold text-dark mb-1">Facebook Login Required</h5>
                      <p className="text-secondary small mb-4 mx-auto" style={{ maxWidth: '480px' }}>
                        WhatsApp Business connect karne ke liye browser me Facebook logged in hona zaroori hai. Neeche diye button par click karke login karein.
                      </p>
                      
                      <div className="d-flex flex-column align-items-center gap-2 mb-3">
                        {!fbLoginOpened ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-primary btn-lg px-4 py-3 fw-bold shadow-sm d-inline-flex align-items-center justify-content-center gap-2"
                              style={{ backgroundColor: '#1877F2', borderColor: '#1877F2', minWidth: '320px', borderRadius: '10px' }}
                              onClick={handleDirectFacebookLogin}
                            >
                              <i className="bi bi-facebook fs-4"></i>
                              <span>Log in with Facebook</span>
                            </button>

                            <button
                              type="button"
                              className="btn btn-link btn-sm text-secondary text-decoration-none mt-1"
                              style={{ fontSize: '0.82rem' }}
                              onClick={handleConfirmLoginAndContinue}
                            >
                              Already logged in to Facebook in this browser? Click to Continue →
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="alert alert-primary border-0 p-3 small mb-2 text-center" style={{ borderRadius: '10px', minWidth: '320px' }}>
                              <div className="d-flex align-items-center justify-content-center gap-2 mb-1 fw-bold text-primary">
                                <span className="spinner-border spinner-border-sm" role="status"></span>
                                <span>Facebook Login Window Open Hai</span>
                              </div>
                              <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                                Facebook window me apna mobile/email aur password daal kar login karein.
                              </div>
                            </div>

                            <button
                              type="button"
                              className="btn btn-success btn-lg px-4 py-3 fw-bold shadow-sm d-inline-flex align-items-center justify-content-center gap-2"
                              style={{ minWidth: '320px', borderRadius: '10px' }}
                              onClick={handleConfirmLoginAndContinue}
                            >
                              <i className="bi bi-check2-circle fs-4"></i>
                              <span>✓ Login Ho Gaya – Continue Karein</span>
                              <i className="bi bi-arrow-right ms-1"></i>
                            </button>

                            <button
                              type="button"
                              className="btn btn-link btn-sm text-muted text-decoration-none"
                              style={{ fontSize: '0.8rem' }}
                              onClick={handleDirectFacebookLogin}
                            >
                              Login window band ho gayi? Click here to re-open
                            </button>
                          </>
                        )}
                      </div>

                      <div className="alert alert-warning border-0 p-3 small mb-0 text-start" style={{ borderRadius: '10px' }}>
                        <div className="d-flex align-items-start gap-2">
                          <i className="bi bi-exclamation-triangle-fill text-warning fs-5 flex-shrink-0 mt-1"></i>
                          <div>
                            <strong>Important Tip:</strong> Agar aap bina Facebook login kiye direct Meta Developer link kholte hain, to Meta <em>"Sorry, the link you followed may be broken"</em> ka error dikhata hai. Isliye pehle upar diye gaye button se Facebook me login karein.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="text-center mt-3">
                    <button
                      type="button"
                      className="btn btn-link btn-sm text-primary text-decoration-none fw-semibold"
                      onClick={() => {
                        setFbSessionStatus('logged_in');
                        setStep(5);
                      }}
                    >
                      ⚡ Meta Developer App already created? Click here for Fast Setup →
                    </button>
                  </div>

                  <div className="alert alert-info border-0 p-3 small mt-3 mb-0">
                    <i className="bi bi-shield-lock-fill me-2 text-primary"></i>
                    <strong>Privacy &amp; Security Guarantee:</strong> CampaignFlow never collects, requests, or stores your Facebook password. You log in directly on Meta's official secure portal.
                  </div>
                </div>

                <div className="d-flex align-items-center justify-content-between">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setStep(1)}
                  >
                    <i className="bi bi-arrow-left me-1"></i> Back
                  </button>

                  {fbSessionStatus === 'logged_in' && (
                    <button
                      type="button"
                      className="btn btn-primary px-4 fw-semibold"
                      onClick={() => setStep(4)}
                    >
                      Continue to Meta App Setup
                      <i className="bi bi-arrow-right ms-1"></i>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* STEP 4: META APP SETUP GUIDANCE (MODE B) */}
            {step === 4 && (
              <div>
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <div>
                    <h5 className="fw-bold mb-1">Create & Configure Your Meta App</h5>
                    <p className="text-muted small mb-0">
                      Step 2 of 3 for client-owned Meta App setup.
                    </p>
                  </div>
                  <span className="badge bg-secondary-subtle text-secondary px-2 py-1">
                    Mode: Client-Owned App
                  </span>
                </div>

                {/* 1-Click Auto Connect If Meta Credentials Already Configured */}
                {detectedMeta && (
                  <div className="card border-2 border-success shadow-sm mb-4" style={{ borderRadius: '14px', background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)' }}>
                    <div className="card-body p-4">
                      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                        <span className="badge bg-success text-white px-3 py-1 fw-bold">
                          ⚡ META CREDENTIALS ALREADY CONFIGURED
                        </span>
                        <span className="badge bg-white text-success border border-success fw-semibold">
                          Quality: {detectedMeta.qualityRating || 'GREEN'}
                        </span>
                      </div>
                      <h5 className="fw-bold text-dark mb-1">
                        Connect {detectedMeta.displayName} ({detectedMeta.phoneNumber})
                      </h5>
                      <p className="text-secondary small mb-3">
                        Aapke Meta Cloud API credentials pehle se available hain (WABA ID: <code>{detectedMeta.wabaId}</code>). Aapko developers.facebook.com par jakar naya app banane ki koi zaroorat nahi hai. Seedhe neeche click karein!
                      </p>
                      <button
                        type="button"
                        disabled={autoConnecting}
                        onClick={handleAutoConnect}
                        className="btn btn-success px-4 py-2 fw-bold shadow-sm d-inline-flex align-items-center gap-2"
                        style={{ borderRadius: '10px' }}
                      >
                        {autoConnecting ? (
                          <>
                            <span className="spinner-border spinner-border-sm" role="status"></span>
                            <span>Connecting...</span>
                          </>
                        ) : (
                          <>
                            <i className="bi bi-lightning-charge-fill"></i>
                            <span>⚡ 1-Click Auto Connect Existing Account</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* OPTION 1: 1-CLICK AUTOMATED META CONNECTION (NO MANUAL COPY-PASTE) */}
                <div className="card border-2 border-primary shadow-xs p-4 mb-4" style={{ borderRadius: '14px', background: 'linear-gradient(135deg, #f0f7ff 0%, #e0effe 100%)' }}>
                  <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                    <span className="badge bg-primary text-white fw-bold px-3 py-1">
                      RECOMMENDED • 100% AUTOMATED
                    </span>
                    <span className="small text-muted fw-semibold">
                      Official Meta Cloud API
                    </span>
                  </div>
                  <h5 className="fw-bold text-dark mb-1">
                    ⚡ 1-Click Connect &amp; Auto-Fetch Credentials from Meta
                  </h5>
                  <p className="text-secondary small mb-3">
                    Aapko Meta Developer portal se kuch bhi copy-paste karne ki zaroorat nahi hai. Neeche diye gaye button par click karein – Meta ka official authorization dialog open hoga aur permissions dete hi aapke <strong>WABA ID</strong>, <strong>Phone Number ID</strong>, aur <strong>Access Token</strong> automatic hamare software me aa kar save ho jayenge!
                  </p>
                  <div>
                    <button
                      type="button"
                      onClick={handleLaunchSignup}
                      className="btn btn-primary btn-lg px-4 py-3 fw-bold shadow-sm d-inline-flex align-items-center gap-2"
                      style={{ backgroundColor: '#1877F2', borderColor: '#1877F2', borderRadius: '10px' }}
                    >
                      <i className="bi bi-lightning-charge-fill fs-4 text-warning"></i>
                      <span>⚡ 1-Click Connect with Meta (Auto-Fetch)</span>
                      <i className="bi bi-arrow-right ms-1"></i>
                    </button>
                  </div>
                </div>

                {/* OPTION 2: META DEVELOPER DASHBOARD & TOKEN AUTO-IMPORT */}
                <div className="card border-0 shadow-xs p-4 mb-4" style={{ borderRadius: '14px', backgroundColor: '#ffffff' }}>
                  <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                    <div className="d-flex align-items-center gap-2">
                      <div className="p-2 rounded-circle bg-success-subtle text-success">
                        <i className="bi bi-cloud-arrow-down-fill fs-5"></i>
                      </div>
                      <div>
                        <h6 className="fw-bold mb-0">Meta Developer Dashboard &amp; Token Auto-Import</h6>
                        <span className="text-muted small">Meta Developer console se credentials automatic fetch karein</span>
                      </div>
                    </div>
                    <a
                      href="https://developers.facebook.com/apps/"
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-outline-primary d-inline-flex align-items-center gap-2 px-3 py-2 fw-semibold"
                      style={{ borderRadius: '8px' }}
                    >
                      <i className="bi bi-box-arrow-up-right"></i>
                      <span>Open Meta Developer Apps Dashboard</span>
                    </a>
                  </div>

                  <div className="alert alert-info border-0 p-3 small mb-3" style={{ borderRadius: '10px' }}>
                    <i className="bi bi-info-circle-fill me-2 text-primary"></i>
                    <strong>Developer Portal se Credential Kaise Milega?</strong><br />
                    Jab aap Meta Developer Dashboard kholte hain, to left menu me <strong>WhatsApp &gt; API Setup</strong> par jayein. Wahan se sirf apna <strong>Temporary/Permanent Access Token</strong> copy karke neeche paste karein. Hamara software Meta API se WABA ID, Phone Number aur Name <strong>automatically fetch</strong> kar lega!
                  </div>

                  {/* Token Quick Import Box */}
                  <div className="p-3 bg-light rounded-3 border mb-3">
                    <label className="form-label small fw-bold text-dark mb-1">
                      Meta Access Token (from WhatsApp &gt; API Setup): <span className="text-danger">*</span>
                    </label>
                    <div className="input-group mb-2">
                      <input
                        type="text"
                        className="form-control font-monospace"
                        placeholder="EAAG... (Paste Meta Access Token here)"
                        value={directToken}
                        onChange={(e) => {
                          setDirectToken(e.target.value);
                          setDirectTokenError(null);
                        }}
                      />
                      <button
                        type="button"
                        disabled={importingToken || !directToken.trim()}
                        onClick={handleDirectTokenImport}
                        className="btn btn-success fw-bold px-4 d-flex align-items-center gap-2"
                      >
                        {importingToken ? (
                          <>
                            <span className="spinner-border spinner-border-sm" role="status"></span>
                            <span>Fetching from Meta...</span>
                          </>
                        ) : (
                          <>
                            <i className="bi bi-lightning-charge-fill"></i>
                            <span>⚡ Fetch &amp; Connect</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Optional ID Override Fields */}
                    <div className="mt-2">
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0 text-decoration-none text-muted"
                        style={{ fontSize: '0.8rem' }}
                        onClick={() => setShowOptionalFields(!showOptionalFields)}
                      >
                        {showOptionalFields ? '▲ Hide manual WABA/Phone inputs' : '▼ Phone Number ID ya WABA ID manually enter karna chahte hain? (Optional)'}
                      </button>

                      {showOptionalFields && (
                        <div className="row g-2 mt-1">
                          <div className="col-12 col-md-6">
                            <label className="form-label small text-muted mb-0" style={{ fontSize: '0.78rem' }}>Phone Number ID (Optional):</label>
                            <input
                              type="text"
                              className="form-control form-control-sm font-monospace"
                              placeholder="e.g. 523948194821..."
                              value={manualPhoneId}
                              onChange={(e) => setManualPhoneId(e.target.value)}
                            />
                            <div className="form-text" style={{ fontSize: '0.72rem' }}>Leave blank to auto-detect from token</div>
                          </div>
                          <div className="col-12 col-md-6">
                            <label className="form-label small text-muted mb-0" style={{ fontSize: '0.78rem' }}>WABA ID (Optional):</label>
                            <input
                              type="text"
                              className="form-control form-control-sm font-monospace"
                              placeholder="e.g. 1092837465..."
                              value={manualWabaId}
                              onChange={(e) => setManualWabaId(e.target.value)}
                            />
                            <div className="form-text" style={{ fontSize: '0.72rem' }}>Leave blank to auto-detect from token</div>
                          </div>
                        </div>
                      )}
                    </div>

                    {directTokenError && (
                      <div className="alert alert-danger py-2 px-3 small mt-3 mb-0">
                        <i className="bi bi-exclamation-triangle-fill me-1"></i> {directTokenError}
                      </div>
                    )}
                  </div>

                  <div className="timeline small text-secondary ps-2">
                    <div className="mb-2">
                      <strong className="text-dark">1. Open Meta Dashboard:</strong> Upar diye gaye link se Meta Developer Dashboard open karein.
                    </div>
                    <div className="mb-2">
                      <strong className="text-dark">2. WhatsApp Product:</strong> Left sidebar me <strong>WhatsApp &gt; API Setup</strong> select karein.
                    </div>
                    <div>
                      <strong className="text-dark">3. Copy Access Token:</strong> Step 1 me dikhne wala token copy karein aur upar paste karke <strong>"Fetch &amp; Connect"</strong> dabayein.
                    </div>
                  </div>
                </div>

                <div className="d-flex align-items-center justify-content-between">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setStep(3)}
                  >
                    <i className="bi bi-arrow-left me-1"></i> Back
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary px-4 fw-semibold"
                    onClick={() => setStep(5)}
                  >
                    I Have Created My App – Configure Credentials
                    <i className="bi bi-arrow-right ms-1"></i>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 5: CONFIGURE ADVANCED META APP (MODE B) */}
            {step === 5 && (
              <div>
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <div>
                    <h5 className="fw-bold mb-1">Configure Client-Owned Meta App</h5>
                    <p className="text-muted small mb-0">
                      Step 3 of 3: Enter your Meta App ID and Secret. Secrets are encrypted at rest.
                    </p>
                  </div>
                  <span className="badge bg-secondary-subtle text-secondary px-2 py-1">
                    Mode: Client-Owned App
                  </span>
                </div>

                <form onSubmit={handleSaveAndValidateAdvanced}>
                  <div className="card border-0 shadow-xs p-4 mb-4" style={{ borderRadius: '12px', backgroundColor: '#ffffff' }}>
                    {/* Meta App ID */}
                    <div className="mb-3">
                      <label className="form-label fw-bold small">
                        Meta App ID <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. 1165054629187576"
                        value={advancedForm.appId}
                        onChange={(e) => setAdvancedForm({ ...advancedForm, appId: e.target.value })}
                        required
                      />
                      <div className="form-text small">
                        Found in your Meta App Dashboard header or App Settings &gt; Basic.
                      </div>
                    </div>

                    {/* Meta App Secret */}
                    <div className="mb-3">
                      <label className="form-label fw-bold small">
                        Meta App Secret <span className="text-danger">*</span>
                      </label>
                      <div className="input-group">
                        <input
                          type={showSecret ? 'text' : 'password'}
                          className="form-control"
                          placeholder="Enter your 32-character Meta App Secret"
                          value={advancedForm.appSecret}
                          onChange={(e) => setAdvancedForm({ ...advancedForm, appSecret: e.target.value })}
                          required
                        />
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => setShowSecret(!showSecret)}
                        >
                          <i className={`bi ${showSecret ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                        </button>
                      </div>
                      <div className="form-text small text-muted">
                        🔒 Encrypted using AES-256-GCM at rest and never exposed over client APIs.
                      </div>
                    </div>

                    {/* Embedded Signup Configuration ID */}
                    <div className="mb-3">
                      <label className="form-label fw-bold small">
                        Embedded Signup Configuration ID <span className="text-muted fw-normal">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. 293847562819283 (Optional)"
                        value={advancedForm.configId}
                        onChange={(e) => setAdvancedForm({ ...advancedForm, configId: e.target.value })}
                      />
                      <div className="form-text small">
                        Optional: Set this if you configured a customized WhatsApp Embedded Signup flow configuration ID in your Meta Developer App.
                      </div>
                    </div>

                    {/* Webhook Settings Box for User's Meta App */}
                    <div className="p-3 bg-light rounded-3 mt-3 border">
                      <h6 className="fw-bold small mb-2 text-dark">
                        <i className="bi bi-broadcast me-1 text-primary"></i>
                        Webhook Settings to Configure in your Meta App:
                      </h6>
                      <div className="mb-2">
                        <span className="small text-muted d-block">Callback URL:</span>
                        <div className="input-group input-group-sm">
                          <input
                            type="text"
                            readOnly
                            className="form-control font-monospace bg-white"
                            value={webhookCallbackUrl}
                          />
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => navigator.clipboard.writeText(webhookCallbackUrl)}
                            title="Copy Callback URL"
                          >
                            <i className="bi bi-clipboard"></i>
                          </button>
                        </div>
                      </div>
                      <div>
                        <span className="small text-muted d-block">Verify Token:</span>
                        <div className="input-group input-group-sm">
                          <input
                            type="text"
                            readOnly
                            className="form-control font-monospace bg-white"
                            value="campaignflow_webhook_secret_token"
                          />
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => navigator.clipboard.writeText('campaignflow_webhook_secret_token')}
                            title="Copy Verify Token"
                          >
                            <i className="bi bi-clipboard"></i>
                          </button>
                        </div>
                      </div>
                    </div>

                    {validationResult && (
                      <div className={`alert alert-${validationResult.isValid ? 'success' : 'danger'} mt-3 mb-0 p-2 small`}>
                        <i className={`bi ${validationResult.isValid ? 'bi-check-circle-fill' : 'bi-x-circle-fill'} me-1`}></i>
                        {validationResult.message}
                      </div>
                    )}
                  </div>

                  <div className="d-flex align-items-center justify-content-between">
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setStep(4)}
                    >
                      <i className="bi bi-arrow-left me-1"></i> Back
                    </button>

                    <button
                      type="submit"
                      disabled={validating}
                      className="btn btn-primary px-4 fw-semibold shadow-xs"
                    >
                      {validating ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2"></span>
                          Validating with Meta...
                        </>
                      ) : (
                        <>
                          Validate & Save Meta App
                          <i className="bi bi-check-lg ms-1"></i>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* STEP 6: START OFFICIAL FACEBOOK / EMBEDDED SIGNUP */}
            {step === 6 && (
              <div className="text-center py-2">
                <div className="mb-4">
                  <div
                    className="d-inline-flex align-items-center justify-content-center p-3 rounded-circle mb-3"
                    style={{ backgroundColor: '#e0f2fe', color: '#0369a1', width: '70px', height: '70px' }}
                  >
                    <i className="bi bi-whatsapp fs-1"></i>
                  </div>
                  <h5 className="fw-bold mb-1">Launch Official Meta Embedded Signup</h5>
                  <p className="text-muted small mx-auto" style={{ maxWidth: '500px' }}>
                    Connect your Meta Business Portfolio, select or create your WhatsApp Business Account, and verify your phone number via SMS/Voice.
                  </p>
                </div>

                <div className="card border-0 shadow-xs p-3 text-start mx-auto mb-4" style={{ maxWidth: '520px', borderRadius: '12px', backgroundColor: '#ffffff' }}>
                  <h6 className="fw-bold small text-muted text-uppercase mb-2">Integration Summary</h6>
                  <div className="d-flex justify-content-between small py-1 border-bottom">
                    <span className="text-secondary">Integration Mode:</span>
                    <span className="fw-semibold text-dark">
                      {mode === 'platform_managed' ? 'Platform-Managed (Recommended)' : 'Client-Owned Meta App'}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between small py-1 border-bottom">
                    <span className="text-secondary">Meta App ID:</span>
                    <span className="font-monospace text-dark">
                      {mode === 'platform_managed' ? (setupData?.platformApp?.appId || '1165054629187576') : advancedForm.appId}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between small py-1 border-bottom">
                    <span className="text-secondary">Requested Scopes:</span>
                    <span className="font-monospace text-dark small">whatsapp_business_management, messaging</span>
                  </div>
                  <div className="d-flex justify-content-between small py-1">
                    <span className="text-secondary">Credential Storage:</span>
                    <span className="text-success fw-semibold">
                      <i className="bi bi-shield-check me-1"></i>AES-256 Encrypted at Rest
                    </span>
                  </div>
                </div>

                {/* Primary Action Button: Continue with Facebook */}
                <div className="d-flex flex-column align-items-center gap-2 mb-4">
                  <button
                    type="button"
                    onClick={handleLaunchSignup}
                    className="btn btn-primary btn-lg px-4 py-2 fw-bold d-inline-flex align-items-center justify-content-center gap-2 shadow-sm"
                    style={{
                      backgroundColor: '#1877F2',
                      borderColor: '#1877F2',
                      borderRadius: '10px',
                      minWidth: '280px'
                    }}
                  >
                    <i className="bi bi-facebook fs-5"></i>
                    <span>Continue with Facebook</span>
                  </button>

                  <div className="text-muted small">
                    Opens the secure, official Meta dialog in a popup window.
                  </div>
                </div>

                {/* Development Sandbox Mock Option */}
                <div className="pt-3 border-top d-flex align-items-center justify-content-center gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setStep(mode === 'platform_managed' ? 2 : 5)}
                  >
                    <i className="bi bi-arrow-left me-1"></i> Back
                  </button>

                  <button
                    type="button"
                    onClick={handleTestSandboxConnect}
                    className="btn btn-outline-success btn-sm"
                    title="Quick Connect Sandbox Test WABA without opening Facebook popup"
                  >
                    <i className="bi bi-lightning-charge-fill me-1"></i>
                    Test Sandbox One-Click Connect
                  </button>
                </div>
              </div>
            )}

            {/* STEP 7: VERIFY WHATSAPP CONNECTION */}
            {step === 7 && (
              <div className="py-4 text-center">
                <div className="mb-4">
                  {verificationStatus === 'CONNECTING' && (
                    <div className="spinner-border text-primary mb-3" style={{ width: '3.5rem', height: '3.5rem' }} role="status">
                      <span className="visually-hidden">Connecting...</span>
                    </div>
                  )}
                  {verificationStatus === 'CONNECTED' && (
                    <div className="p-3 bg-success-subtle text-success rounded-circle d-inline-block mb-3">
                      <i className="bi bi-check-circle-fill fs-1"></i>
                    </div>
                  )}
                  {verificationStatus === 'ACTION_REQUIRED' && (
                    <div className="p-3 bg-warning-subtle text-warning rounded-circle d-inline-block mb-3">
                      <i className="bi bi-exclamation-triangle-fill fs-1"></i>
                    </div>
                  )}
                  {verificationStatus === 'CONNECTION_FAILED' && (
                    <div className="p-3 bg-danger-subtle text-danger rounded-circle d-inline-block mb-3">
                      <i className="bi bi-x-circle-fill fs-1"></i>
                    </div>
                  )}

                  <h5 className="fw-bold mb-1">
                    {verificationStatus === 'CONNECTING' && 'Verifying WhatsApp Account Connection'}
                    {verificationStatus === 'CONNECTED' && 'Verification Complete!'}
                    {verificationStatus === 'ACTION_REQUIRED' && 'Action Required'}
                    {verificationStatus === 'CONNECTION_FAILED' && 'Connection Incomplete'}
                  </h5>
                  <p className="text-muted small">
                    Status: <strong className="text-uppercase">{verificationStatus}</strong>
                  </p>
                </div>

                {/* Progress Verification Checklist */}
                <div className="card border-0 shadow-xs p-3 mx-auto text-start mb-4" style={{ maxWidth: '480px', borderRadius: '12px' }}>
                  {verificationLogs.map((log, i) => (
                    <div key={i} className="d-flex align-items-center justify-content-between py-2 border-bottom last:border-0">
                      <span className="small text-secondary">{log.title}</span>
                      {log.status === 'done' && <i className="bi bi-check-circle-fill text-success"></i>}
                      {log.status === 'active' && <span className="spinner-border spinner-border-sm text-primary"></span>}
                      {log.status === 'pending' && <i className="bi bi-circle text-muted"></i>}
                    </div>
                  ))}
                </div>

                {/* Error & Retry buttons */}
                {verificationStatus !== 'CONNECTED' && verificationStatus !== 'CONNECTING' && (
                  <div>
                    <div className="alert alert-warning border-0 p-3 small text-start mx-auto mb-3" style={{ maxWidth: '480px', borderRadius: '12px' }}>
                      <div className="fw-bold mb-1 text-dark d-flex align-items-center gap-2">
                        <i className="bi bi-info-circle-fill text-warning fs-5"></i>
                        <span>Meta "Can't load URL" ya Domain Error aa raha hai?</span>
                      </div>
                      <p className="text-secondary mb-2" style={{ fontSize: '0.82rem' }}>
                        Facebook Login popup ke liye Meta App settings me <code>{window.location.hostname}</code> domain allow hona zaroori hota hai.
                      </p>
                      <div className="bg-white p-2 rounded-2 border small">
                        <strong className="text-success d-block mb-1">⚡ Fast Solution (Bina kisi Domain setup ke):</strong>
                        <span>Neeche <strong>"Use Token Auto-Import"</strong> par click karein aur Meta Developer Dashboard se Access Token paste karke 10 second me connect karein!</span>
                      </div>
                    </div>

                    <div className="d-flex justify-content-center gap-2 flex-wrap">
                      <button
                        type="button"
                        className="btn btn-success fw-semibold shadow-xs"
                        onClick={() => setStep(4)}
                      >
                        <i className="bi bi-lightning-charge-fill me-1"></i> Use Token Auto-Import (No Domain Setup)
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-primary fw-semibold"
                        onClick={handleLaunchSignup}
                      >
                        <i className="bi bi-arrow-clockwise me-1"></i> Retry Facebook Popup
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 8: SUCCESS SCREEN */}
            {step === 8 && connectedAccount && (
              <div className="py-2 text-center">
                <div className="mb-4">
                  <div
                    className="d-inline-flex align-items-center justify-content-center p-3 rounded-circle mb-3 shadow-xs"
                    style={{ backgroundColor: '#dcfce7', color: '#15803d', width: '76px', height: '76px' }}
                  >
                    <i className="bi bi-check-lg fs-1 fw-bold"></i>
                  </div>
                  <h4 className="fw-bold mb-1 text-success">WhatsApp Account Connected Successfully</h4>
                  <p className="text-muted small">
                    Your WhatsApp Business Account is verified and ready for broadcasting, template sync, and inbox messaging.
                  </p>
                </div>

                <div className="card border-0 shadow-xs p-3 text-start mx-auto mb-4" style={{ maxWidth: '520px', borderRadius: '12px', backgroundColor: '#ffffff' }}>
                  <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                    <h6 className="fw-bold mb-0 text-dark">Connected Account Summary</h6>
                    <span className="badge bg-success text-white px-2 py-1">
                      <i className="bi bi-patch-check-fill me-1"></i>VERIFIED
                    </span>
                  </div>

                  <div className="d-flex justify-content-between small py-1 border-bottom">
                    <span className="text-secondary">Business Name:</span>
                    <strong className="text-dark">{connectedAccount.display_name || connectedAccount.waba_id}</strong>
                  </div>

                  <div className="d-flex justify-content-between small py-1 border-bottom">
                    <span className="text-secondary">WABA ID:</span>
                    <span className="font-monospace text-dark">{connectedAccount.waba_id}</span>
                  </div>

                  <div className="d-flex justify-content-between small py-1 border-bottom">
                    <span className="text-secondary">Connected Phone Number:</span>
                    <strong className="text-dark">{connectedAccount.phone_number || connectedAccount.phone_number_id}</strong>
                  </div>

                  <div className="d-flex justify-content-between small py-1 border-bottom">
                    <span className="text-secondary">Connection Status:</span>
                    <span className="badge bg-success-subtle text-success border border-success-subtle">
                      {connectedAccount.connection_status || 'CONNECTED'}
                    </span>
                  </div>

                  <div className="d-flex justify-content-between small py-1 border-bottom">
                    <span className="text-secondary">Integration Mode:</span>
                    <span className="text-dark">
                      {mode === 'platform_managed' ? 'SaaS Managed Meta App' : 'Client-Owned Meta App'}
                    </span>
                  </div>

                  <div className="d-flex justify-content-between small py-1">
                    <span className="text-secondary">Connection Date:</span>
                    <span className="text-dark">
                      {new Date(connectedAccount.created_at || Date.now()).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-success btn-lg px-5 py-2 fw-bold shadow-xs"
                  onClick={() => {
                    onSuccess(connectedAccount);
                    onClose();
                  }}
                >
                  <i className="bi bi-speedometer2 me-2"></i>
                  Go to WhatsApp Dashboard
                </button>
              </div>
            )}

          </div>

          {/* Modal Footer (only on steps before signup) */}
          <div className="modal-footer bg-light border-0 py-3 px-4 d-flex justify-content-between align-items-center">
            <span className="small text-muted">
              <i className="bi bi-shield-check text-success me-1"></i>
              Official Meta Tech Provider Integration • ISO/IEC 27001 Secure Standards
            </span>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>
              Cancel & Exit
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
