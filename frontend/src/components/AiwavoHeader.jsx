import React from 'react';
import { useAuth } from '../hooks/useAuth';
import '../styles/dashboard.css';

export default function AiwavoHeader({
  title,
  subtitle,
  children,
  badge,
  onToggleSidebar,
  showUserInfo = true
}) {
  const { user, logout } = useAuth();
  const userInitials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  return (
    <div className="aiwavo-header">
      <div className="aiwavo-header-left">
        <div className="aiwavo-header-title-row">
          {onToggleSidebar && (
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary d-lg-none d-flex align-items-center justify-content-center me-2"
              style={{ width: '36px', height: '36px', borderRadius: '8px' }}
              onClick={onToggleSidebar}
              aria-label="Toggle navigation"
            >
              <i className="bi bi-list fs-5"></i>
            </button>
          )}
          <h1 className="aiwavo-header-title">{title}</h1>
          {badge && <div className="ms-2">{badge}</div>}
        </div>
        {subtitle && <p className="aiwavo-header-subtitle">{subtitle}</p>}
      </div>

      <div className="aiwavo-header-right">
        {children}

        {showUserInfo && (
          <div className="d-flex align-items-center gap-2 ms-2 ps-2 border-start">
            <div
              className="aiwavo-avatar-circle"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: '#16a34a',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}
              title={`${user?.name || 'User'} (${user?.role || 'user'})`}
            >
              <span>{userInitials}</span>
            </div>
            <button
              type="button"
              onClick={logout}
              className="btn btn-sm btn-outline-danger d-flex align-items-center justify-content-center"
              style={{ width: '34px', height: '34px', borderRadius: '50%' }}
              title="Sign Out"
            >
              <i className="bi bi-box-arrow-right"></i>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
