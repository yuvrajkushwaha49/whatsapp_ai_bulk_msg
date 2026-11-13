import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import iconImg from '../assets/icon.png';
import logoImg from '../assets/logo.png';

export default function AdminSidebar({ isOpen, onClose, onToggle }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const adminMenuItems = [
    { to: '/admin', icon: 'bi-grid-fill', name: 'Platform Overview', shortName: 'Overview', exact: true },
    { to: '/admin/tenants', icon: 'bi-buildings-fill', name: 'Tenants & Owners', shortName: 'Tenants' },
    { to: '/admin/numbers', icon: 'bi-diagram-3-fill', name: 'Number Allocation', shortName: 'Numbers' },
    { to: '/admin/billing', icon: 'bi-credit-card-2-front-fill', name: 'Global Billing & Plans', shortName: 'Billing' },
    { to: '/admin/logs', icon: 'bi-clock-history', name: 'Global Activity Logs', shortName: 'Audit Logs' },
    { to: '/admin/meta', icon: 'bi-gear-wide-connected', name: 'Meta Platform App', shortName: 'Meta App' },
    { to: '/admin/meta-monitoring', icon: 'bi-activity', name: 'Meta Monitoring', shortName: 'Health' },
    { to: '/admin/accounts', icon: 'bi-whatsapp', name: 'Raw Accounts', shortName: 'Raw Accs' }
  ];

  const handleLinkClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 992 && onClose) {
      onClose();
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (_) {
      navigate('/login');
    }
  };

  return (
    <aside
      className={`sidebar ${isOpen ? 'show' : ''}`}
      aria-label="Super Admin Navigation Sidebar"
    >
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div
          className="sidebar-brand-inner d-flex align-items-center"
          onClick={!isOpen ? onToggle : undefined}
          title={!isOpen ? 'Click to expand sidebar' : undefined}
          style={{ cursor: !isOpen ? 'pointer' : 'default' }}
        >
          <div className="sidebar-brand-icon position-relative">
            <img
              src={iconImg}
              alt="AIWAVO Icon"
              className="sidebar-brand-icon-img"
            />
          </div>
          <div className="sidebar-brand-text d-flex flex-column">
            <div className="d-flex align-items-center gap-2">
              <img
                src={logoImg}
                alt="AIWAVO"
                className="sidebar-brand-logo"
              />
              <span className="badge bg-warning text-dark fw-bold px-2 py-0" style={{ fontSize: '0.65rem' }}>
                ADMIN
              </span>
            </div>
            <span className="small text-white-50" style={{ fontSize: '0.7rem', marginTop: -2 }}>
              Platform SuperAdmin
            </span>
          </div>
        </div>

        {/* Close / Collapse Toggle Button */}
        <button
          type="button"
          className="sidebar-close-btn"
          onClick={onToggle || onClose}
          aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          title={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <i className={`bi ${isOpen ? 'bi-chevron-left' : 'bi-chevron-right'}`}></i>
        </button>
      </div>

      {/* Body: SuperAdmin Menus */}
      <div className="sidebar-body">
        <div className="px-3 pt-2 pb-1">
          <small className="text-white-50 text-uppercase fw-bold" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>
            {isOpen ? 'Platform Administration' : 'ADMIN'}
          </small>
        </div>

        <ul className="sidebar-menu">
          {adminMenuItems.map((item) => (
            <li key={item.to} className="sidebar-item">
              <NavLink
                to={item.to}
                end={item.exact}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                onClick={handleLinkClick}
                title={!isOpen ? item.name : undefined}
              >
                <div className="sidebar-link-icon-wrap">
                  <i className={`bi ${item.icon}`}></i>
                </div>
                <span className="sidebar-link-full-text">{item.name}</span>
                <span className="sidebar-link-mini-text">{item.shortName}</span>
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Client Portal Switcher Card */}
        <div className="mt-auto p-3">
          <div className="p-3 rounded-3" style={{ background: 'rgba(255, 255, 255, 0.07)', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
            <div className="d-flex align-items-center gap-2 mb-2">
              <i className="bi bi-person-workspace text-info fs-5"></i>
              {isOpen && (
                <div>
                  <div className="text-white small fw-bold">Client Workspace</div>
                  <div className="text-white-50" style={{ fontSize: '0.72rem' }}>Switch to Owner / User view</div>
                </div>
              )}
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="btn btn-outline-light btn-sm w-100 d-flex align-items-center justify-content-center gap-2"
              style={{ fontSize: '0.75rem', borderColor: 'rgba(255, 255, 255, 0.25)' }}
              title="Switch to Client Workspace (Owner View)"
            >
              <i className="bi bi-box-arrow-up-right"></i>
              {isOpen && <span>Open Client View</span>}
            </button>
          </div>

          {/* Current Logged In Admin */}
          <div className="d-flex align-items-center justify-content-between mt-3 pt-3 border-top border-secondary border-opacity-25">
            <div className="d-flex align-items-center gap-2 overflow-hidden">
              <div className="rounded-circle bg-warning text-dark fw-bold d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 28, height: 28, fontSize: '0.8rem' }}>
                SA
              </div>
              {isOpen && (
                <div className="overflow-hidden">
                  <div className="text-white small text-truncate fw-semibold">SuperAdmin</div>
                  <div className="text-white-50 text-truncate" style={{ fontSize: '0.7rem' }}>{user?.email}</div>
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="btn btn-link text-white-50 p-1 hover-text-white"
              title="Logout"
              style={{ textDecoration: 'none' }}
            >
              <i className="bi bi-box-arrow-right fs-5"></i>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
