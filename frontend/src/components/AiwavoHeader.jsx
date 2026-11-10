import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import '../styles/dashboard.css';

export default function AiwavoHeader({
  title,
  subtitle,
  onToggleSidebar,
  showDateSelector = false,
  timeRange,
  setTimeRange,
  onNotificationClick,
  onHelpClick
}) {
  const { user, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showDropdown]);

  const userInitials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'RS';

  return (
    <div className="aiwavo-header">
      <div className="aiwavo-header-left">
        <div className="aiwavo-header-title-row">
          {onToggleSidebar && (
            <button
              type="button"
              className="aiwavo-mobile-toggle d-lg-none me-2"
              onClick={onToggleSidebar}
              aria-label="Toggle navigation"
            >
              <i className="bi bi-list fs-5"></i>
            </button>
          )}
          <h1 className="aiwavo-header-title">{title}</h1>
        </div>
        {subtitle && <p className="aiwavo-header-subtitle">{subtitle}</p>}
      </div>

      <div className="aiwavo-header-right">
        {/* Date Selector (optional for pages like Dashboard / Analytics) */}
        {showDateSelector && (
          <div className="aiwavo-date-dropdown">
            <i className="bi bi-calendar3 aiwavo-date-icon"></i>
            <select
              className="aiwavo-date-select"
              value={timeRange || 'Last 30 Days'}
              onChange={(e) => setTimeRange && setTimeRange(e.target.value)}
            >
              <option value="Last 30 Days">Last 30 Days</option>
              <option value="Today">Today</option>
              <option value="Last 7 Days">Last 7 Days</option>
              <option value="This Month">This Month</option>
              <option value="All Time">All Time</option>
            </select>
          </div>
        )}

        {/* Notification Button */}
        <button
          type="button"
          className="aiwavo-circle-btn"
          title="Notifications"
          onClick={onNotificationClick}
          aria-label="Notifications"
        >
          <i className="bi bi-bell"></i>
          <span className="aiwavo-notification-dot"></span>
        </button>

        {/* Help Button */}
        <button
          type="button"
          className="aiwavo-circle-btn"
          title="Help & Documentation"
          onClick={onHelpClick}
          aria-label="Help"
        >
          <i className="bi bi-question-circle"></i>
        </button>

        {/* Profile Badge (Exact same as Dashboard) */}
        <div
          ref={dropdownRef}
          className="aiwavo-profile-badge position-relative"
          style={{ cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setShowDropdown((prev) => !prev)}
          title="Account profile & sign out"
        >
          <div className="aiwavo-profile-avatar">{userInitials}</div>
          <div className="aiwavo-profile-info">
            <span className="aiwavo-profile-name">{user?.name || 'Rahul Sharma'}</span>
            <span className="aiwavo-profile-role text-capitalize">
              ({user?.role || 'Owner'})
            </span>
          </div>

          {showDropdown && (
            <div
              className="dropdown-menu dropdown-menu-end show shadow"
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                minWidth: '200px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                padding: '0.5rem',
                zIndex: 1060,
                backgroundColor: '#ffffff'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-3 py-2 border-bottom mb-1">
                <div className="fw-bold small text-dark">{user?.name || 'User'}</div>
                <div className="text-muted text-truncate" style={{ fontSize: '0.75rem' }}>{user?.email}</div>
                <div className="badge bg-success-subtle text-success mt-1 text-capitalize" style={{ fontSize: '0.7rem' }}>
                  {user?.role || 'Member'}
                </div>
              </div>
              <button
                type="button"
                className="dropdown-item text-danger d-flex align-items-center gap-2 py-2 rounded-2"
                onClick={logout}
              >
                <i className="bi bi-box-arrow-right"></i>
                <span className="fw-semibold small">Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
