import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import iconImg from '../assets/icon.png';
import logoImg from '../assets/logo.png';
import SwitchClientModal from './SwitchClientModal';
import '../styles/adminDashboard.css';

export default function AdminSidebar({ isOpen, onClose, onToggle }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showSwitchModal, setShowSwitchModal] = useState(false);

  const adminMenuItems = [
    { to: '/admin', icon: 'bi-grid-fill', name: 'Platform Overview', shortName: 'Overview', exact: true },
    { to: '/admin/tenants', icon: 'bi-buildings-fill', name: 'Businesses & Owners', shortName: 'Businesses' },
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
      className={`sidebar ${isOpen ? 'show' : 'collapsed'}`}
      aria-label="Super Admin Navigation Sidebar"
    >
      {/* Background Organic Green Waves (Matches Owner & AIWAVO design) */}
      <div className="sidebar-wave-container" aria-hidden="true">
        <svg
          className="sidebar-wave-svg"
          viewBox="0 0 260 380"
          preserveAspectRatio="none"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="adminWaveGradDeep" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#059669" stopOpacity="0.75" />
              <stop offset="50%" stopColor="#047857" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#022c22" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="adminWaveGradMid" x1="0%" y1="100%" x2="100%" y2="10%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.7" />
              <stop offset="50%" stopColor="#059669" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#047857" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="adminWaveGradFront" x1="10%" y1="90%" x2="90%" y2="0%">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.6" />
              <stop offset="45%" stopColor="#10b981" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.02" />
            </linearGradient>
            <radialGradient id="adminGreenAtmosphere" cx="45%" cy="85%" r="65%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.42" />
              <stop offset="50%" stopColor="#047857" stopOpacity="0.2" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect x="0" y="0" width="260" height="380" fill="url(#adminGreenAtmosphere)" />
          <path
            d="M-20,190 C40,240 100,160 170,190 C220,215 245,170 280,160 L280,380 L-20,380 Z"
            fill="url(#adminWaveGradDeep)"
          />
          <path
            d="M-20,235 C50,190 125,270 190,210 C230,175 255,185 280,180 L280,380 L-20,380 Z"
            fill="url(#adminWaveGradMid)"
          />
          <path
            d="M-20,285 C45,255 115,295 175,260 C225,225 255,235 280,220 L280,380 L-20,380 Z"
            fill="url(#adminWaveGradFront)"
          />
        </svg>
      </div>
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div
          className={`sidebar-brand-inner d-flex align-items-center ${!isOpen ? 'admin-sidebar-cursor-expand' : 'admin-sidebar-cursor-default'}`}
          onClick={!isOpen ? onToggle : undefined}
          title={!isOpen ? 'Click to expand sidebar' : undefined}
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
              <span className="badge bg-warning text-dark fw-bold px-2 py-0 admin-sidebar-badge-admin">
                ADMIN
              </span>
            </div>
            <span className="small text-white-50 admin-sidebar-brand-subtitle">
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
          <small className="text-white-50 text-uppercase fw-bold admin-sidebar-section-heading">
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
          <div className="p-3 rounded-3 admin-sidebar-workspace-card">
            <div className="d-flex align-items-center gap-2 mb-2">
              <i className="bi bi-person-workspace text-info fs-5"></i>
              {isOpen && (
                <div>
                  <div className="text-white small fw-bold">Client Workspace</div>
                  <div className="text-white-50 admin-sidebar-workspace-sub">Switch to Owner / User view</div>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowSwitchModal(true)}
              className="btn btn-outline-light btn-sm w-100 d-flex align-items-center justify-content-center gap-2 admin-sidebar-workspace-btn"
              title="Switch to Client Workspace (Owner View)"
            >
              <i className="bi bi-box-arrow-up-right"></i>
              {isOpen && <span>Open Client View</span>}
            </button>
          </div>

          {/* Current Logged In Admin */}
          <div className="d-flex align-items-center justify-content-between mt-3 pt-3 border-top border-secondary border-opacity-25">
            <div className="d-flex align-items-center gap-2 overflow-hidden">
              <div className="rounded-circle bg-warning text-dark fw-bold d-flex align-items-center justify-content-center flex-shrink-0 admin-sidebar-user-avatar">
                SA
              </div>
              {isOpen && (
                <div className="overflow-hidden">
                  <div className="text-white small text-truncate fw-semibold">SuperAdmin</div>
                  <div className="text-white-50 text-truncate admin-sidebar-user-email">{user?.email}</div>
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="btn btn-link text-white-50 p-1 hover-text-white admin-sidebar-logout-btn"
              title="Logout"
            >
              <i className="bi bi-box-arrow-right fs-5"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Switch Client Impersonation Modal */}
      <SwitchClientModal
        isOpen={showSwitchModal}
        onClose={() => setShowSwitchModal(false)}
      />
    </aside>
  );
}

