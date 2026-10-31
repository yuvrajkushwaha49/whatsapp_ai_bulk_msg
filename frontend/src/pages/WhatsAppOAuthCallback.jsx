import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

/**
 * WhatsAppOAuthCallback — Handles Facebook Login OAuth Redirects
 * Captures `code` from query params, notifies parent popup or completes onboarding directly
 */
export default function WhatsAppOAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Connecting your Meta WhatsApp Business Account...');

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error_message') || searchParams.get('error_description') || searchParams.get('error');

    if (error) {
      setStatus('error');
      setMessage(`Facebook Login Error: ${error}`);
      if (window.opener) {
        window.opener.postMessage({ type: 'FB_OAUTH_ERROR', error }, window.location.origin);
        setTimeout(() => window.close(), 2500);
      }
      return;
    }

    if (!code) {
      setStatus('error');
      setMessage('No authorization code received from Facebook.');
      return;
    }

    // If opened inside a popup window, transmit code to the opener tab and close
    if (window.opener && !window.opener.closed) {
      setStatus('success');
      setMessage('Authenticated! Returning to CampaignFlow...');
      window.opener.postMessage({ type: 'FB_OAUTH_CODE', code }, window.location.origin);
      setTimeout(() => {
        window.close();
      }, 1000);
      return;
    }

    // If opened directly in a new tab (not popup): Complete onboarding via backend API directly
    async function completeDirectly() {
      try {
        const res = await api.post('/whatsapp/accounts/connect/complete', { code });
        if (res.data?.success) {
          setStatus('success');
          setMessage('WhatsApp Business Account connected successfully! Redirecting...');
          setTimeout(() => navigate('/whatsapp'), 1500);
        }
      } catch (err) {
        setStatus('error');
        setMessage(err.response?.data?.message || 'Failed to complete Meta onboarding');
      }
    }

    completeDirectly();
  }, [searchParams, navigate]);

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light p-4">
      <div className="card border-0 shadow-lg p-4 text-center" style={{ maxWidth: '440px', borderRadius: '16px' }}>
        <div className="mb-3">
          {status === 'processing' && (
            <div className="spinner-border text-success" style={{ width: '3rem', height: '3rem' }} role="status"></div>
          )}
          {status === 'success' && (
            <div className="text-success display-4">
              <i className="bi bi-check-circle-fill"></i>
            </div>
          )}
          {status === 'error' && (
            <div className="text-danger display-4">
              <i className="bi bi-x-circle-fill"></i>
            </div>
          )}
        </div>

        <h5 className="fw-bold text-dark mb-2">Meta WhatsApp Onboarding</h5>
        <p className="text-muted small mb-4">{message}</p>

        {status === 'error' && (
          <button onClick={() => navigate('/whatsapp')} className="btn btn-primary btn-sm">
            Back to WhatsApp Accounts
          </button>
        )}
      </div>
    </div>
  );
}
