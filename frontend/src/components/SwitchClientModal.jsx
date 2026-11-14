import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/switchClientModal.css';

export default function SwitchClientModal({ isOpen, onClose }) {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [switchingId, setSwitchingId] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) return;

    const fetchBusinesses = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem('cf_token');
        const res = await axios.get('/api/admin/businesses', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data?.success && res.data?.data) {
          setBusinesses(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load businesses for switching:', err);
        setError('Failed to fetch businesses. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchBusinesses();
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredBusinesses = businesses.filter(b => {
    const q = search.toLowerCase();
    const nameMatch = b.name?.toLowerCase().includes(q);
    const slugMatch = b.slug?.toLowerCase().includes(q);
    const emailMatch = b.owner_email?.toLowerCase().includes(q);
    return nameMatch || slugMatch || emailMatch;
  });

  const handleSwitchClient = async (biz) => {
    try {
      setSwitchingId(biz.id);
      setError(null);
      const currentToken = localStorage.getItem('cf_token');

      const res = await axios.post(`/api/admin/impersonate/${biz.id}`, {}, {
        headers: { Authorization: `Bearer ${currentToken}` }
      });

      if (res.data?.success && res.data?.data?.token) {
        // Backup superadmin token
        if (!localStorage.getItem('cf_superadmin_token')) {
          localStorage.setItem('cf_superadmin_token', currentToken);
        }
        localStorage.setItem('cf_impersonating', 'true');
        localStorage.setItem('cf_impersonated_biz', biz.name || 'Client Workspace');
        localStorage.setItem('cf_token', res.data.data.token);

        onClose();
        // Redirect to Client Workspace Dashboard
        window.location.href = '/dashboard';
      } else {
        setError(res.data?.message || 'Failed to switch into client workspace.');
      }
    } catch (err) {
      console.error('Impersonation error:', err);
      setError(err.response?.data?.message || 'Error launching client session.');
    } finally {
      setSwitchingId(null);
    }
  };

  return createPortal(
    <div className="switch-client-backdrop" onClick={onClose}>
      <div className="switch-client-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="switch-client-header">
          <div>
            <div className="switch-client-badge">
              <i className="bi bi-shield-lock-fill"></i>
              <span>Client Impersonation</span>
            </div>
            <h2 className="switch-client-title">Kis Client ka Login karna hai?</h2>
            <p className="switch-client-subtitle">
              Select any registered business below to switch directly into their client workspace.
            </p>
          </div>
          <button
            type="button"
            className="switch-client-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {/* Search Wrap */}
        <div className="switch-client-search-wrap">
          <div className="switch-client-search-box">
            <i className="bi bi-search switch-client-search-icon"></i>
            <input
              type="text"
              className="switch-client-search-input"
              placeholder="Search by business name, slug, or owner email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
            {search && (
              <button
                type="button"
                className="switch-client-clear-btn"
                onClick={() => setSearch('')}
                title="Clear search"
              >
                <i className="bi bi-x-circle-fill"></i>
              </button>
            )}
          </div>
        </div>

        {/* Body / Client List */}
        <div className="switch-client-body">
          {error && (
            <div className="alert alert-danger py-2 small mb-3">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              {error}
            </div>
          )}

          {loading ? (
            <div className="switch-client-loading">
              <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
              <span>Fetching registered clients...</span>
            </div>
          ) : filteredBusinesses.length === 0 ? (
            <div className="switch-client-empty">
              <div className="switch-client-empty-icon">
                <i className="bi bi-buildings"></i>
              </div>
              <div>No businesses found matching &ldquo;{search}&rdquo;</div>
            </div>
          ) : (
            filteredBusinesses.map(biz => {
              const isSwitching = switchingId === biz.id;
              const initial = (biz.name || 'B').charAt(0).toUpperCase();
              const planClass = biz.plan_name ? `plan-${biz.plan_name.toLowerCase()}` : '';

              return (
                <div
                  key={biz.id}
                  className="switch-client-card"
                  onClick={() => !isSwitching && handleSwitchClient(biz)}
                >
                  <div className="switch-client-card-left">
                    <div className="switch-client-avatar">{initial}</div>
                    <div className="switch-client-info">
                      <div className="switch-client-biz-name">
                        <span>{biz.name}</span>
                        {biz.plan_name && (
                          <span className={`switch-client-plan-badge ${planClass}`}>
                            {biz.plan_name}
                          </span>
                        )}
                      </div>
                      <div className="switch-client-biz-meta">
                        <span className="switch-client-meta-item">
                          <i className="bi bi-envelope"></i>
                          <span>{biz.owner_email || 'No email'}</span>
                        </span>
                        <span className="switch-client-meta-item">
                          <i className="bi bi-whatsapp"></i>
                          <span>{biz.wa_count || 0} numbers</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="switch-client-action-btn"
                    disabled={isSwitching}
                    onClick={e => {
                      e.stopPropagation();
                      handleSwitchClient(biz);
                    }}
                  >
                    {isSwitching ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status"></span>
                        <span>Logging in...</span>
                      </>
                    ) : (
                      <>
                        <span>Login as Client</span>
                        <i className="bi bi-box-arrow-in-right"></i>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="switch-client-footer">
          <span>
            <i className="bi bi-info-circle me-1"></i>
            You can return to Super Admin Suite anytime via the top banner.
          </span>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
