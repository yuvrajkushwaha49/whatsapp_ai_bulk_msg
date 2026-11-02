import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';

/**
 * SystemUserBulkConnectModal
 * Multi-App & Multi-Number Discovery & Bulk Connect
 * 
 * Supports two seamless paths:
 * 1. Tareeqa 2 (Recommended): "Log in with Facebook" (0% Token - No copy-paste, 1-click popup OAuth)
 * 2. Tareeqa 1: "Permanent System User Token" (Direct paste for custom/manual tokens)
 */
export default function SystemUserBulkConnectModal({ isOpen, onClose, onSuccess, detectedToken }) {
  const [step, setStep] = useState(1); // 1: Connect / Scan, 2: Select Numbers, 3: Connecting / Results
  const [activeTab, setActiveTab] = useState('facebook'); // 'facebook' | 'token'
  const [token, setToken] = useState(detectedToken || '');
  const [showToken, setShowToken] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [connectError, setConnectError] = useState(null);

  // Discovered WABAs & Numbers
  const [discoveryData, setDiscoveryData] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkResult, setBulkResult] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [connectProgress, setConnectProgress] = useState({ current: 0, total: 0 });

  // Guide accordion
  const [showGuide, setShowGuide] = useState(false);

  // Popup reference
  const popupRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setActiveTab('facebook');
      setScanError(null);
      setConnectError(null);
      setBulkResult(null);
      setConnectProgress({ current: 0, total: 0 });
      if (detectedToken) {
        setToken(detectedToken);
      }
    }
  }, [isOpen, detectedToken]);

  // Cleanup listener on unmount
  useEffect(() => {
    return () => {
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
    };
  }, []);

  if (!isOpen) return null;

  /**
   * Tareeqa 2: Log in with Facebook (0% Token copy-paste)
   */
  const handleFacebookLoginScan = async () => {
    setScanning(true);
    setScanError(null);

    try {
      // 1. Get Platform Meta App ID
      let appId = '1165054629187576';
      try {
        const readinessRes = await api.get('/meta/setup/client-readiness');
        if (readinessRes.data?.data?.platformApp?.appId) {
          appId = readinessRes.data.data.platformApp.appId;
        }
      } catch (_) {}

      const redirectUri = `${window.location.origin}/whatsapp/callback`;
      const scopes = 'whatsapp_business_management,whatsapp_business_messaging,business_management';
      const state = `multi_scan_${Date.now()}`;

      const oauthUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code&state=${encodeURIComponent(state)}`;

      // 2. Open official Meta popup
      const width = 640;
      const height = 720;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2.5;

      const popup = window.open(
        oauthUrl,
        'MetaMultiAppDiscoveryPopup',
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,status=1`
      );
      popupRef.current = popup;

      // 3. Listen for postMessage from /whatsapp/callback
      const handlePopupMessage = async (event) => {
        if (event.origin !== window.location.origin) return;

        if (event.data?.type === 'FB_OAUTH_CODE' || event.data?.type === 'META_SIGNUP_AUTH_CODE') {
          window.removeEventListener('message', handlePopupMessage);
          const { code } = event.data;

          try {
            // Exchange code on backend & discover all WABAs and phone numbers
            const res = await api.post('/whatsapp/system-user/discover', {
              code,
              redirectUri
            });

            if (res.data?.success) {
              const data = res.data.data;
              setDiscoveryData(data);
              if (data.accessToken) {
                setToken(data.accessToken);
              }

              // Auto-select all numbers (prioritize new numbers, or all numbers if all already connected)
              const initialSelected = new Set();
              let newCount = 0;
              (data.wabas || []).forEach(waba => {
                (waba.phoneNumbers || []).forEach(phone => {
                  if (!phone.isAlreadyConnected) {
                    initialSelected.add(String(phone.id));
                    newCount++;
                  }
                });
              });
              if (newCount === 0) {
                (data.wabas || []).forEach(waba => {
                  (waba.phoneNumbers || []).forEach(phone => {
                    initialSelected.add(String(phone.id));
                  });
                });
              }
              setSelectedIds(initialSelected);
              setStep(2);
            }
          } catch (discoverErr) {
            const msg = discoverErr.response?.data?.message || discoverErr.response?.data?.error?.message || discoverErr.message || 'Failed to scan Meta Business accounts.';
            setScanError(msg);
          } finally {
            setScanning(false);
          }
        } else if (event.data?.type === 'FB_OAUTH_ERROR') {
          window.removeEventListener('message', handlePopupMessage);
          setScanError(`Facebook Login cancelled or failed: ${event.data.error}`);
          setScanning(false);
        }
      };

      window.addEventListener('message', handlePopupMessage);

    } catch (err) {
      setScanError(err.message || 'Failed to initialize Facebook Login popup.');
      setScanning(false);
    }
  };

  /**
   * Tareeqa 1: Permanent System User Token Scan
   */
  const handleTokenScan = async (e) => {
    if (e) e.preventDefault();
    if (!token.trim()) {
      setScanError('Please enter a valid Meta System User Permanent Access Token.');
      return;
    }

    setScanning(true);
    setScanError(null);

    try {
      const res = await api.post('/whatsapp/system-user/discover', { accessToken: token.trim() });
      if (res.data?.success) {
        const data = res.data.data;
        setDiscoveryData(data);

        // Auto-select all numbers (prioritize new numbers, or all numbers if all already connected)
        const initialSelected = new Set();
        let newCount = 0;
        (data.wabas || []).forEach(waba => {
          (waba.phoneNumbers || []).forEach(phone => {
            if (!phone.isAlreadyConnected) {
              initialSelected.add(String(phone.id));
              newCount++;
            }
          });
        });
        if (newCount === 0) {
          (data.wabas || []).forEach(waba => {
            (waba.phoneNumbers || []).forEach(phone => {
              initialSelected.add(String(phone.id));
            });
          });
        }
        setSelectedIds(initialSelected);
        setStep(2);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error?.message || err.message || 'Failed to scan Meta Business Manager.';
      setScanError(msg);
    } finally {
      setScanning(false);
    }
  };

  // Toggle selection for a single number
  const toggleSelectPhone = (phoneId) => {
    const updated = new Set(selectedIds);
    if (updated.has(String(phoneId))) {
      updated.delete(String(phoneId));
    } else {
      updated.add(String(phoneId));
    }
    setSelectedIds(updated);
  };

  // Select all numbers (new and existing)
  const handleSelectAll = () => {
    const updated = new Set();
    (discoveryData?.wabas || []).forEach(waba => {
      (waba.phoneNumbers || []).forEach(phone => {
        updated.add(String(phone.id));
      });
    });
    setSelectedIds(updated);
  };

  // Select only new numbers
  const handleSelectAllNew = () => {
    const updated = new Set();
    (discoveryData?.wabas || []).forEach(waba => {
      (waba.phoneNumbers || []).forEach(phone => {
        if (!phone.isAlreadyConnected) {
          updated.add(String(phone.id));
        }
      });
    });
    setSelectedIds(updated);
  };

  // Deselect all
  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  // Handle Bulk Connect (with client-side resilient chunking to prevent 504 Gateway Timeout)
  const handleBulkConnect = async () => {
    if (selectedIds.size === 0) {
      setConnectError('Please select at least one WhatsApp phone number to connect.');
      return;
    }

    setConnecting(true);
    setConnectError(null);
    setStep(3);

    // Prepare payload
    const selectedPayload = [];
    (discoveryData?.wabas || []).forEach(waba => {
      (waba.phoneNumbers || []).forEach(phone => {
        if (selectedIds.has(String(phone.id))) {
          selectedPayload.push({
            phoneNumberId: String(phone.id),
            wabaId: String(waba.id),
            displayName: phone.verifiedName || phone.displayPhoneNumber,
            phoneNumber: phone.displayPhoneNumber
          });
        }
      });
    });

    const total = selectedPayload.length;
    setConnectProgress({ current: 0, total });

    // Client-side batching (3 numbers per request) to prevent any 504 Gateway Timeout
    const batchSize = 3;
    const allResults = [];
    let totalConnected = 0;

    try {
      for (let i = 0; i < selectedPayload.length; i += batchSize) {
        const batch = selectedPayload.slice(i, i + batchSize);
        setConnectProgress({ current: i, total });

        try {
          const res = await api.post('/whatsapp/system-user/bulk-connect', {
            accessToken: token.trim(),
            selectedPhoneNumbers: batch
          });
          if (res.data?.success) {
            totalConnected += (res.data.data?.connectedCount || 0);
            (res.data.data?.results || []).forEach(r => allResults.push(r));
          }
        } catch (batchErr) {
          batch.forEach(item => {
            allResults.push({
              success: false,
              phoneNumberId: item.phoneNumberId,
              displayName: item.displayName,
              error: batchErr.response?.data?.message || batchErr.message || 'Connection timeout or error'
            });
          });
        }

        setConnectProgress({ current: Math.min(i + batch.length, total), total });
      }

      setBulkResult({
        totalRequested: total,
        connectedCount: totalConnected,
        results: allResults
      });
    } catch (err) {
      setConnectError(err.response?.data?.message || err.message || 'Bulk connection encountered an error.');
    } finally {
      setConnecting(false);
    }
  };

  // Filtered phone numbers
  const getFilteredWabas = () => {
    if (!discoveryData?.wabas) return [];
    if (!searchFilter.trim()) return discoveryData.wabas;

    const query = searchFilter.toLowerCase();
    return discoveryData.wabas.map(waba => {
      const matchingPhones = (waba.phoneNumbers || []).filter(p =>
        (p.displayPhoneNumber && p.displayPhoneNumber.toLowerCase().includes(query)) ||
        (p.verifiedName && p.verifiedName.toLowerCase().includes(query)) ||
        (p.id && String(p.id).includes(query))
      );
      return {
        ...waba,
        phoneNumbers: matchingPhones
      };
    }).filter(waba =>
      waba.name?.toLowerCase().includes(query) ||
      waba.id?.includes(query) ||
      waba.phoneNumbers.length > 0
    );
  };

  return (
    <div
      className="modal fade show d-block"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', zIndex: 1060, backdropFilter: 'blur(4px)' }}
      tabIndex="-1"
    >
      <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content shadow-lg border-0 rounded-4 overflow-hidden">
          
          {/* Header */}
          <div className="modal-header border-bottom px-4 py-3 bg-gradient" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#fff' }}>
            <div className="d-flex align-items-center gap-3">
              <div
                className="rounded-3 d-flex align-items-center justify-content-center shadow-sm"
                style={{ width: '44px', height: '44px', backgroundColor: '#1877F2', color: '#fff', fontSize: '1.4rem' }}
              >
                <i className="bi bi-diagram-3-fill"></i>
              </div>
              <div>
                <h5 className="modal-title fw-bold mb-0 text-white d-flex align-items-center gap-2">
                  <span>1-Click Multi-App Number Discovery</span>
                  <span className="badge bg-primary bg-opacity-25 text-primary border border-primary border-opacity-25 fs-xs fw-normal px-2 py-1">
                    Meta Business Portfolio
                  </span>
                </h5>
                <p className="text-secondary mb-0 small" style={{ color: '#94a3b8' }}>
                  Discover and connect all WhatsApp numbers across multiple Meta Apps & WABAs in your Business Portfolio
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
              disabled={scanning || connecting}
            ></button>
          </div>

          {/* Stepper Progress */}
          <div className="bg-light border-bottom px-4 py-2">
            <div className="d-flex align-items-center justify-content-between small">
              <div className={`d-flex align-items-center gap-2 ${step >= 1 ? 'fw-bold text-primary' : 'text-muted'}`}>
                <span className={`badge rounded-pill ${step >= 1 ? 'bg-primary' : 'bg-secondary'}`}>1</span>
                <span>Discover Numbers</span>
              </div>
              <i className="bi bi-chevron-right text-muted"></i>
              <div className={`d-flex align-items-center gap-2 ${step >= 2 ? 'fw-bold text-primary' : 'text-muted'}`}>
                <span className={`badge rounded-pill ${step >= 2 ? 'bg-primary' : 'bg-secondary'}`}>2</span>
                <span>Select Numbers ({selectedIds.size})</span>
              </div>
              <i className="bi bi-chevron-right text-muted"></i>
              <div className={`d-flex align-items-center gap-2 ${step >= 3 ? 'fw-bold text-primary' : 'text-muted'}`}>
                <span className={`badge rounded-pill ${step >= 3 ? 'bg-primary' : 'bg-secondary'}`}>3</span>
                <span>Connect & Finish</span>
              </div>
            </div>
          </div>

          {/* Modal Body */}
          <div className="modal-body p-4">
            
            {/* STEP 1: DISCOVER (Facebook Login vs System User Token) */}
            {step === 1 && (
              <div>
                {scanError && (
                  <div className="alert alert-danger rounded-3 mb-4 d-flex align-items-center gap-2">
                    <i className="bi bi-exclamation-triangle-fill fs-5"></i>
                    <div>{scanError}</div>
                  </div>
                )}

                {/* Tabs to Choose Method */}
                <ul className="nav nav-pills nav-fill mb-4 p-1 bg-light rounded-3 border">
                  <li className="nav-item">
                    <button
                      type="button"
                      className={`nav-link py-2 fw-semibold d-flex align-items-center justify-content-center gap-2 ${activeTab === 'facebook' ? 'active shadow-sm' : ''}`}
                      onClick={() => { setActiveTab('facebook'); setScanError(null); }}
                      style={activeTab === 'facebook' ? { backgroundColor: '#1877F2' } : {}}
                    >
                      <i className="bi bi-facebook fs-5"></i>
                      <span>Tareeqa 2: Log in with Facebook (0% Token - No Copy-Paste)</span>
                      <span className="badge bg-warning text-dark ms-1">Recommended</span>
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      type="button"
                      className={`nav-link py-2 fw-semibold d-flex align-items-center justify-content-center gap-2 ${activeTab === 'token' ? 'active shadow-sm' : ''}`}
                      onClick={() => { setActiveTab('token'); setScanError(null); }}
                    >
                      <i className="bi bi-key-fill"></i>
                      <span>Tareeqa 1: System User Permanent Token</span>
                    </button>
                  </li>
                </ul>

                {/* TAB 1: FACEBOOK LOGIN (ZERO TOKEN) */}
                {activeTab === 'facebook' && (
                  <div className="text-center py-4 px-2">
                    <div className="rounded-circle d-inline-flex p-4 bg-primary bg-opacity-10 text-primary mb-3 shadow-xs">
                      <i className="bi bi-facebook" style={{ fontSize: '3rem', color: '#1877F2' }}></i>
                    </div>

                    <h4 className="fw-bold mb-2">1-Click Meta Business Portfolio Scan</h4>
                    <p className="text-muted mx-auto mb-4" style={{ maxWidth: '580px' }}>
                      Koi bhi token copy-paste karne ki zaroorat nahi hai. Niche diye gaye button par click karein, official Facebook popup me login karein, aur aapke sabhi Apps aur WABAs ke saare WhatsApp numbers automatic screen par aa jayenge!
                    </p>

                    <div className="d-flex justify-content-center mb-4">
                      <button
                        type="button"
                        disabled={scanning}
                        onClick={handleFacebookLoginScan}
                        className="btn btn-primary btn-lg px-5 py-3 fw-bold shadow d-flex align-items-center gap-3 rounded-3"
                        style={{ backgroundColor: '#1877F2', borderColor: '#1877F2', fontSize: '1.15rem' }}
                      >
                        {scanning ? (
                          <>
                            <span className="spinner-border spinner-border-sm" role="status"></span>
                            <span>Opening Facebook Login & Scanning...</span>
                          </>
                        ) : (
                          <>
                            <i className="bi bi-facebook fs-4"></i>
                            <span>Continue with Facebook to Scan All Numbers</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="d-flex justify-content-center align-items-center gap-4 text-muted small">
                      <div className="d-flex align-items-center gap-1">
                        <i className="bi bi-shield-lock-fill text-success"></i>
                        <span>Zero Token Copy-Paste</span>
                      </div>
                      <div className="d-flex align-items-center gap-1">
                        <i className="bi bi-check-circle-fill text-success"></i>
                        <span>All Meta Apps Scanned</span>
                      </div>
                      <div className="d-flex align-items-center gap-1">
                        <i className="bi bi-lightning-charge-fill text-warning"></i>
                        <span>100% Automated</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: SYSTEM USER TOKEN (TAREEQA 1) */}
                {activeTab === 'token' && (
                  <div>
                    <div className="alert alert-info border-info border-opacity-25 bg-info bg-opacity-10 rounded-3 mb-4">
                      <div className="d-flex gap-2">
                        <i className="bi bi-info-circle-fill text-info fs-5 mt-1"></i>
                        <div>
                          <strong className="d-block mb-1">System User Permanent Token:</strong>
                          <span className="small text-muted">
                            Agar aapke paas Meta Business Manager ka Permanent System User Token hai, toh yahan paste karein. Yeh token kabhi expire nahi hota aur sabhi Apps ke numbers ko scan karta hai.
                          </span>
                        </div>
                      </div>
                    </div>

                    <form onSubmit={handleTokenScan}>
                      <div className="mb-3">
                        <label className="form-label fw-bold d-flex justify-content-between align-items-center">
                          <span>Meta Permanent System User Access Token</span>
                          {detectedToken && (
                            <button
                              type="button"
                              className="btn btn-sm btn-link p-0 text-decoration-none"
                              onClick={() => setToken(detectedToken)}
                            >
                              Use Server Config Token
                            </button>
                          )}
                        </label>
                        <div className="input-group">
                          <span className="input-group-text bg-light text-muted">
                            <i className="bi bi-key-fill"></i>
                          </span>
                          <input
                            type={showToken ? 'text' : 'password'}
                            className="form-control font-monospace"
                            placeholder="EAAG... (Permanent System User Token)"
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            disabled={scanning}
                          />
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => setShowToken(!showToken)}
                            tabIndex="-1"
                          >
                            <i className={`bi ${showToken ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`}></i>
                          </button>
                        </div>
                        <div className="form-text">
                          Required scopes: <code>whatsapp_business_messaging</code> and <code>whatsapp_business_management</code>.
                        </div>
                      </div>

                      <div className="d-flex justify-content-between align-items-center pt-2">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => setShowGuide(!showGuide)}
                        >
                          <i className="bi bi-question-circle me-1"></i>
                          {showGuide ? 'Hide Instructions' : 'How to get System User Token? (Help)'}
                        </button>

                        <button
                          type="submit"
                          disabled={scanning || !token.trim()}
                          className="btn btn-success px-4 py-2 fw-semibold d-flex align-items-center gap-2 shadow-sm"
                        >
                          {scanning ? (
                            <>
                              <span className="spinner-border spinner-border-sm" role="status"></span>
                              <span>Scanning Business Manager...</span>
                            </>
                          ) : (
                            <>
                              <i className="bi bi-search"></i>
                              <span>Scan With This Token</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>

                    {/* Guide Accordion */}
                    {showGuide && (
                      <div className="mt-4 p-3 bg-light rounded-3 border">
                        <h6 className="fw-bold mb-2">
                          <i className="bi bi-book-half me-1 text-primary"></i>
                          System User Token Kaise Banayein:
                        </h6>
                        <ol className="small mb-0 ps-3">
                          <li className="mb-1">
                            Meta Business Settings me jayein: 
                            <a href="https://business.facebook.com/settings/system-users" target="_blank" rel="noreferrer" className="ms-1 fw-semibold text-decoration-none">
                              business.facebook.com/settings/system-users <i className="bi bi-box-arrow-up-right"></i>
                            </a>
                          </li>
                          <li className="mb-1"><strong>Add System User</strong> par click karein aur Role <strong>Admin</strong> chunein.</li>
                          <li className="mb-1"><strong>Assign Assets</strong> me WhatsApp Accounts ko <strong>Full Control</strong> dein.</li>
                          <li className="mb-1"><strong>Generate New Token</strong> me Never Expiration aur permissions select karein.</li>
                          <li>Token copy karke yahan upar paste karein aur Scan karein!</li>
                        </ol>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: SELECT NUMBERS */}
            {step === 2 && discoveryData && (
              <div>
                {connectError && (
                  <div className="alert alert-danger rounded-3 mb-3 d-flex align-items-center gap-2">
                    <i className="bi bi-exclamation-triangle-fill fs-5"></i>
                    <div>{connectError}</div>
                  </div>
                )}

                {discoveryData.isFilteredBySuperAdmin && (
                  <div className="alert alert-info py-2 px-3 rounded-3 mb-3 d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2 border-0 shadow-sm" style={{ backgroundColor: 'rgba(13, 110, 253, 0.08)' }}>
                    <div className="d-flex align-items-center gap-2 small">
                      <i className="bi bi-shield-check text-primary fs-5"></i>
                      <span>
                        <strong>SuperAdmin Matrix Filter Active:</strong> Showing only WhatsApp numbers allocated and approved for your business ({discoveryData.totalPhoneNumbers} allowed of {discoveryData.totalDiscoveredFromMeta || discoveryData.totalPhoneNumbers} numbers in Meta Business Manager).
                      </span>
                    </div>
                    <span className="badge bg-primary text-white text-nowrap">SuperAdmin Approved</span>
                  </div>
                )}

                {discoveryData.totalPhoneNumbers === 0 && (
                  <div className="alert alert-warning rounded-3 p-4 text-center my-3 border shadow-sm">
                    <i className="bi bi-shield-lock-fill text-warning fs-1 d-block mb-2"></i>
                    <h6 className="fw-bold mb-1">No WhatsApp Numbers Allocated by SuperAdmin</h6>
                    <p className="text-muted small mb-3">
                      {discoveryData.totalDiscoveredFromMeta > 0
                        ? `Meta Business Manager contains ${discoveryData.totalDiscoveredFromMeta} numbers, but SuperAdmin has not allotted or approved any number for your account yet.`
                        : 'No WhatsApp numbers were discovered in your Meta Business portfolio.'}
                    </p>
                    <div className="small text-muted">
                      Please contact your platform SuperAdmin to approve and allocate your WhatsApp numbers in the <strong>SuperAdmin Number Allocation Matrix</strong>.
                    </div>
                  </div>
                )}

                {/* Summary Strip */}
                <div className="row g-3 mb-4">
                  <div className="col-md-4">
                    <div className="p-3 bg-light rounded-3 border d-flex align-items-center gap-3">
                      <div className="rounded-circle p-2 bg-primary bg-opacity-10 text-primary fs-4">
                        <i className="bi bi-building"></i>
                      </div>
                      <div>
                        <div className="text-muted small">WABAs Discovered</div>
                        <div className="fs-5 fw-bold">{discoveryData.totalWabas} Accounts</div>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="p-3 bg-light rounded-3 border d-flex align-items-center gap-3">
                      <div className="rounded-circle p-2 bg-success bg-opacity-10 text-success fs-4">
                        <i className="bi bi-telephone-fill"></i>
                      </div>
                      <div>
                        <div className="text-muted small">Total Phone Numbers</div>
                        <div className="fs-5 fw-bold">{discoveryData.totalPhoneNumbers} Numbers</div>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="p-3 bg-light rounded-3 border d-flex align-items-center gap-3">
                      <div className="rounded-circle p-2 bg-info bg-opacity-10 text-info fs-4">
                        <i className="bi bi-check2-circle"></i>
                      </div>
                      <div>
                        <div className="text-muted small">Selected for Import</div>
                        <div className="fs-5 fw-bold text-primary">{selectedIds.size} Selected</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Controls Bar */}
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 mb-3">
                  <div className="d-flex align-items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary fw-semibold"
                      onClick={handleSelectAll}
                    >
                      <i className="bi bi-check-all me-1"></i> Select All
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-success"
                      onClick={handleSelectAllNew}
                    >
                      <i className="bi bi-plus-circle me-1"></i> Select New Only
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={handleDeselectAll}
                    >
                      <i className="bi bi-x-circle me-1"></i> Deselect All
                    </button>
                  </div>
                  <div className="input-group input-group-sm" style={{ maxWidth: '280px' }}>
                    <span className="input-group-text bg-light text-muted">
                      <i className="bi bi-search"></i>
                    </span>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Filter by name or phone..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                    />
                  </div>
                </div>

                {/* WABAs and Numbers List */}
                <div className="discovery-list" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                  {getFilteredWabas().length === 0 ? (
                    <div className="text-center py-5 text-muted">
                      <i className="bi bi-telephone-x fs-1 mb-2 d-block"></i>
                      <p>No phone numbers matched your search or were found in this Meta portfolio.</p>
                    </div>
                  ) : (
                    getFilteredWabas().map(waba => (
                      <div key={waba.id} className="card border mb-3 rounded-3 shadow-none overflow-hidden">
                        <div className="card-header bg-light py-2 px-3 d-flex justify-content-between align-items-center">
                          <div className="d-flex align-items-center gap-2">
                            <i className="bi bi-folder2-open text-primary"></i>
                            <span className="fw-bold">{waba.name}</span>
                            <span className="text-muted small font-monospace">({waba.id})</span>
                          </div>
                          <span className="badge bg-secondary bg-opacity-25 text-dark fw-normal">
                            {waba.phoneNumbers?.length || 0} numbers
                          </span>
                        </div>
                        <div className="card-body p-0">
                          {(!waba.phoneNumbers || waba.phoneNumbers.length === 0) ? (
                            <div className="p-3 text-muted small text-center">
                              No phone numbers registered under this WABA yet.
                            </div>
                          ) : (
                            <div className="table-responsive">
                              <table className="table table-hover align-middle mb-0 small">
                                <thead className="table-light">
                                  <tr>
                                    <th style={{ width: '40px' }} className="text-center">Select</th>
                                    <th>Display Name & Phone</th>
                                    <th>Phone ID</th>
                                    <th>Quality</th>
                                    <th>Limit Tier</th>
                                    <th>Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {waba.phoneNumbers.map(phone => {
                                    const isSelected = selectedIds.has(String(phone.id));
                                    const isAlready = phone.isAlreadyConnected;

                                    return (
                                      <tr
                                        key={phone.id}
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => toggleSelectPhone(phone.id)}
                                        className={isSelected ? 'table-primary table-opacity-10' : ''}
                                      >
                                        <td className="text-center" onClick={(e) => e.stopPropagation()}>
                                          <input
                                            type="checkbox"
                                            className="form-check-input"
                                            checked={isSelected}
                                            onChange={() => toggleSelectPhone(phone.id)}
                                            style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                                          />
                                        </td>
                                        <td>
                                          <div className="fw-bold d-flex align-items-center gap-1">
                                            <span>{phone.verifiedName || 'WhatsApp Account'}</span>
                                            {phone.codeVerificationStatus === 'VERIFIED' && (
                                              <i className="bi bi-patch-check-fill text-success" title="Verified Name"></i>
                                            )}
                                          </div>
                                          <div className="text-muted font-monospace">{phone.displayPhoneNumber}</div>
                                        </td>
                                        <td>
                                          <span className="font-monospace text-muted">{phone.id}</span>
                                        </td>
                                        <td>
                                          <span className={`badge ${
                                            phone.qualityRating === 'GREEN' ? 'bg-success' :
                                            phone.qualityRating === 'YELLOW' ? 'bg-warning text-dark' : 'bg-danger'
                                          }`}>
                                            {phone.qualityRating}
                                          </span>
                                        </td>
                                        <td>
                                          <span className="badge bg-light text-dark border">
                                            {phone.messagingLimitTier || 'TIER_10K'}
                                          </span>
                                        </td>
                                        <td>
                                          {isAlready ? (
                                            <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25">
                                              <i className="bi bi-check-circle-fill me-1"></i> Already Connected
                                            </span>
                                          ) : (
                                            <span className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25">
                                              Ready to Connect
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* STEP 3: CONNECTING / BULK RESULTS */}
            {step === 3 && (
              <div className="py-4">
                {connecting ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary mb-3" style={{ width: '3.5rem', height: '3.5rem' }} role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <h5 className="fw-bold mb-2">Connecting Selected WhatsApp Numbers...</h5>
                    <p className="text-muted small mb-4">
                      Subscribing webhooks, registering phone numbers, and syncing templates with Meta Cloud API.
                    </p>

                    {connectProgress.total > 0 && (
                      <div className="mx-auto" style={{ maxWidth: '420px' }}>
                        <div className="d-flex justify-content-between small text-muted mb-1">
                          <span>Connection Progress</span>
                          <span className="fw-bold text-primary">{connectProgress.current} of {connectProgress.total} Numbers Processed</span>
                        </div>
                        <div className="progress" style={{ height: '10px', borderRadius: '6px' }}>
                          <div
                            className="progress-bar progress-bar-striped progress-bar-animated bg-success"
                            role="progressbar"
                            style={{ width: `${Math.round((connectProgress.current / connectProgress.total) * 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : bulkResult ? (
                  <div>
                    <div className="text-center mb-4">
                      <div className="rounded-circle d-inline-flex p-3 bg-success bg-opacity-10 text-success mb-2">
                        <i className="bi bi-check-circle-fill fs-1"></i>
                      </div>
                      <h4 className="fw-bold text-success">
                        Successfully Connected {bulkResult.connectedCount} of {bulkResult.totalRequested} Numbers!
                      </h4>
                      <p className="text-muted small">
                        All numbers have been saved to your business tenant and are ready for campaigns & inbox messaging.
                      </p>
                    </div>

                    <div className="card border rounded-3 p-3 mb-4">
                      <h6 className="fw-bold mb-3">Connection Details:</h6>
                      <div className="list-group list-group-flush">
                        {(bulkResult.results || []).map((res, idx) => (
                          <div key={idx} className="list-group-item d-flex justify-content-between align-items-center px-0 py-2">
                            <div className="d-flex align-items-center gap-2">
                              <i className={`bi ${res.success ? 'bi-check-circle-fill text-success' : 'bi-x-circle-fill text-danger'} fs-5`}></i>
                              <div>
                                <div className="fw-bold">{res.displayName || res.phoneNumber || res.phoneNumberId}</div>
                                <div className="text-muted small font-monospace">{res.phoneNumber || res.phoneNumberId}</div>
                              </div>
                            </div>
                            <div>
                              {res.success ? (
                                <span className="badge bg-success">Connected</span>
                              ) : (
                                <span className="badge bg-danger" title={res.error}>Failed: {res.error}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : connectError ? (
                  <div className="text-center py-4">
                    <div className="rounded-circle d-inline-flex p-3 bg-danger bg-opacity-10 text-danger mb-2">
                      <i className="bi bi-exclamation-triangle-fill fs-1"></i>
                    </div>
                    <h5 className="fw-bold text-danger">Connection Encountered An Error</h5>
                    <p className="text-muted">{connectError}</p>
                    <button
                      type="button"
                      className="btn btn-outline-secondary mt-2"
                      onClick={() => setStep(2)}
                    >
                      <i className="bi bi-arrow-left me-1"></i> Back to Selection
                    </button>
                  </div>
                ) : null}
              </div>
            )}

          </div>

          {/* Modal Footer */}
          <div className="modal-footer bg-light px-4 py-3 border-top d-flex justify-content-between align-items-center">
            {step === 1 && (
              <>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={onClose}
                  disabled={scanning}
                >
                  Cancel
                </button>
                <span className="small text-muted">
                  <i className="bi bi-shield-check text-success me-1"></i>
                  Encrypted & stored securely per tenant.
                </span>
              </>
            )}

            {step === 2 && (
              <>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setStep(1)}
                >
                  <i className="bi bi-arrow-left me-1"></i> Rescan Accounts
                </button>
                <div className="d-flex align-items-center gap-2">
                  <span className="text-muted small me-2">
                    {selectedIds.size} numbers selected
                  </span>
                  <button
                    type="button"
                    disabled={selectedIds.size === 0}
                    onClick={handleBulkConnect}
                    className="btn btn-success px-4 fw-semibold d-flex align-items-center gap-2 shadow-sm"
                  >
                    <i className="bi bi-lightning-charge-fill"></i>
                    <span>Connect Selected ({selectedIds.size}) Numbers</span>
                  </button>
                </div>
              </>
            )}

            {step === 3 && bulkResult && (
              <div className="w-100 d-flex justify-content-end">
                <button
                  type="button"
                  className="btn btn-primary px-4 fw-semibold"
                  onClick={() => {
                    onClose();
                    if (onSuccess) onSuccess();
                  }}
                >
                  Done & View In Accounts
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
