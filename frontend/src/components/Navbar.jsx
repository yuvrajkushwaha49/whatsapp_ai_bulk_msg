import React from 'react';
import { useAuth } from '../hooks/useAuth';

export default function Navbar({ onToggleSidebar }) {
  const { user, business, logout, isSuperAdmin } = useAuth();

  return (
    <header className="top-navbar">
      <div className="d-flex align-items-center gap-3">
        <button 
          className="btn btn-sm btn-outline-secondary d-lg-none" 
          onClick={onToggleSidebar}
          aria-label="Toggle navigation"
        >
          <i className="bi bi-list fs-5"></i>
        </button>

        <div className="d-flex align-items-center gap-2">
          <i className="bi bi-buildings text-muted"></i>
          <span className="fw-semibold text-dark">
            {isSuperAdmin() ? 'Platform SuperAdmin Console' : (business?.name || 'Workspace')}
          </span>
          {!isSuperAdmin() && (
            <span className="badge bg-success-subtle text-success border border-success-subtle ms-2">
              <i className="bi bi-check-circle-fill me-1"></i> Live Tenant
            </span>
          )}
        </div>
      </div>

      <div className="d-flex align-items-center gap-3">
        <div className="text-end d-none d-sm-block">
          <div className="fw-semibold text-dark small">{user?.name}</div>
          <span className="badge bg-secondary-subtle text-secondary text-uppercase" style={{ fontSize: '0.65rem' }}>
            {user?.role}
          </span>
        </div>

        <div 
          className="rounded-circle bg-dark text-white d-flex align-items-center justify-content-center fw-bold"
          style={{ width: '38px', height: '38px', fontSize: '0.9rem' }}
        >
          {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
        </div>

        <button 
          onClick={logout}
          className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1"
          title="Sign Out"
        >
          <i className="bi bi-box-arrow-right"></i>
          <span className="d-none d-md-inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
