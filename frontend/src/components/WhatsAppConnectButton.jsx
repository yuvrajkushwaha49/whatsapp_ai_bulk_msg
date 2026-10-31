import React, { useState, useEffect } from 'react';
import api from '../services/api';

/**
 * WhatsAppConnectButton — Official Meta WhatsApp Embedded Signup Flow
 * Launches Facebook Login for Business with WhatsApp Configuration ID
 */
export default function WhatsAppConnectButton({ onSuccess, onError, className = '', buttonText = 'Continue with Facebook' }) {
  const [loading, setLoading] = useState(false);
  const [fbConfig, setFbConfig] = useState(null);
  const [fbSdkReady, setFbSdkReady] = useState(false);
  const [sessionData, setSessionData] = useState({});

  // 1. Fetch Meta App ID & Embedded Signup Config ID from backend
  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await api.get('/whatsapp/accounts/connect/start');
        if (res.data?.success) {
          setFbConfig(res.data.data);
          loadFacebookSdk(res.data.data.appId, res.data.data.version);
        }
      } catch (err) {
        console.warn('[WhatsAppConnect] Failed to fetch connect configuration:', err);
      }
    }
    loadConfig();

    // 2. Setup Meta Embedded Signup Session Info & Popup OAuth Listener
    const handlePostMessage = (event) => {
      // Handle OAuth callback from popup window
      if (event.data?.type === 'FB_OAUTH_CODE' && event.data.code) {
        console.log('[MetaEmbeddedSignup] Received OAuth code from popup window:', event.data.code);
        handleCompleteSignup(event.data.code);
        return;
      }
      if (event.data?.type === 'FB_OAUTH_ERROR') {
        console.warn('[MetaEmbeddedSignup] Received OAuth error from popup window:', event.data.error);
        setLoading(false);
        if (onError) onError(event.data.error);
        return;
      }

      // Handle standard Meta Embedded Signup iframe postMessages
      if (typeof event.data === 'string') {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'WA_EMBEDDED_SIGNUP') {
            console.log('[MetaEmbeddedSignup:PostMessage]', parsed);
            if (parsed.event === 'FINISH') {
              const { phone_number_id, waba_id, current_step } = parsed.data || {};
              setSessionData(prev => ({
                ...prev,
                phoneNumberId: phone_number_id,
                wabaId: waba_id,
                currentStep: current_step
              }));
            } else if (parsed.event === 'CANCEL') {
              setLoading(false);
            }
          }
        } catch (e) {
          // Non-JSON postMessage, ignore
        }
      }
    };

    window.addEventListener('message', handlePostMessage);
    return () => window.removeEventListener('message', handlePostMessage);
  }, []);

  // Dynamically load official Facebook JavaScript SDK
  const loadFacebookSdk = (appId, version = 'v21.0') => {
    if (window.FB) {
      setFbSdkReady(true);
      return;
    }

    window.fbAsyncInit = function () {
      window.FB.init({
        appId: appId || '1165054629187576',
        cookie: true,
        xfbml: true,
        version: version || 'v21.0'
      });
      setFbSdkReady(true);
    };

    // Inject SDK script tag
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

  // Launch official Meta Embedded Signup / Facebook Login
  const handleLaunchSignup = () => {
    setLoading(true);

    const appId = fbConfig?.appId || '1165054629187576';
    const configId = fbConfig?.configId;
    const hasConfig = fbConfig?.hasConfigId;
    const redirectUri = window.location.origin + '/whatsapp/callback';

    const isHttps = window.location.protocol === 'https:';

    // 1. If HTTPS and window.FB is initialized with Embedded Signup config_id, use official FB.login
    if (isHttps && window.FB && hasConfig) {
      window.FB.login(
        (response) => {
          if (response.authResponse?.code) {
            handleCompleteSignup(response.authResponse.code);
          } else {
            setLoading(false);
            if (response.status !== 'connected') {
              console.info('[MetaEmbeddedSignup] User cancelled Facebook Login.');
            }
          }
        },
        {
          config_id: configId,
          response_type: 'code',
          override_default_response_type: true,
          extras: {
            setup: {},
            featureType: '',
            sessionInfoVersion: '3'
          }
        }
      );
    } else {
      // 2. Direct Popup Window: Works everywhere including http://localhost without SDK HTTP blocks
      const fbDialogUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=whatsapp_business_management,whatsapp_business_messaging&response_type=code`;
      
      const width = 640;
      const height = 750;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const popup = window.open(
        fbDialogUrl,
        'FacebookLogin',
        `toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=yes, resizable=yes, copyhistory=no, width=${width}, height=${height}, top=${top}, left=${left}`
      );

      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        // Fallback if browser blocks popups: Open in new tab
        window.open(fbDialogUrl, '_blank');
      }
    }
  };

  // Send authorization code and session metadata to backend
  const handleCompleteSignup = async (authCode) => {
    try {
      const payload = {
        code: authCode,
        wabaId: sessionData.wabaId,
        phoneNumberId: sessionData.phoneNumberId
      };

      const res = await api.post('/whatsapp/accounts/connect/complete', payload);
      if (res.data?.success) {
        if (onSuccess) onSuccess(res.data.data);
      }
    } catch (err) {
      console.error('[MetaEmbeddedSignup] Backend onboarding failed:', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to complete WhatsApp onboarding';
      if (onError) onError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      className={`btn btn-primary d-inline-flex align-items-center gap-2 fw-semibold shadow-sm ${className}`}
      style={{
        backgroundColor: '#1877F2',
        borderColor: '#1877F2',
        padding: '9px 18px',
        borderRadius: '8px'
      }}
      onClick={handleLaunchSignup}
      disabled={loading}
    >
      {loading ? (
        <>
          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
          <span>Connecting to Meta...</span>
        </>
      ) : (
        <>
          <i className="bi bi-facebook fs-5"></i>
          <span>{buttonText}</span>
        </>
      )}
    </button>
  );
}
