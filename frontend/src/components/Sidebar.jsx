import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Sidebar({ isOpen, onClose, onToggle }) {
  const { isSuperAdmin } = useAuth();
  const location = useLocation();

  const menuItems = [
    { to: '/dashboard', icon: 'bi-house-door-fill', name: 'Dashboard', shortName: 'Dashboard' },
    { to: '/whatsapp', icon: 'bi-whatsapp', name: 'WhatsApp Accounts', shortName: 'Accounts' },
    { to: '/contacts', icon: 'bi-people-fill', name: 'Contacts', shortName: 'Contacts' },
    // { to: '/imports', icon: 'bi-file-earmark-excel-fill', name: 'Excel Manager', shortName: 'Excel' },
    { to: '/campaigns', icon: 'bi-megaphone-fill', name: 'Campaigns', shortName: 'Campaigns' },
    // { to: '/campaigns/new', icon: 'bi-diagram-3-fill', name: 'Automation', shortName: 'Automation', hasChevron: true },
    { to: '/templates', icon: 'bi-chat-square-text-fill', name: 'Message Templates', shortName: 'Templates' },
    { to: '/inbox', icon: 'bi-chat-left-dots-fill', name: 'Message Queue', shortName: 'Queue', badge: '12' },
    { to: '/activity-logs', icon: 'bi-clock-history', name: 'Activity Logs', shortName: 'Logs' },
    { to: '/billing', icon: 'bi-bar-chart-fill', name: 'Reports', shortName: 'Reports', hasChevron: true },
    { to: '/team', icon: 'bi-people-fill', name: 'Team & Users', shortName: 'Team' },
    { to: '/settings', icon: 'bi-gear-fill', name: 'Settings', shortName: 'Settings' }
  ];

  const handleLinkClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 992 && onClose) {
      onClose();
    }
  };

  return (
    <aside className={`sidebar ${isOpen ? 'show' : 'collapsed'}`}>
      {/* Background Organic Green Waves (Matches AIWAVO design) */}
      <div className="sidebar-wave-container" aria-hidden="true">
        <svg
          className="sidebar-wave-svg"
          viewBox="0 0 260 380"
          preserveAspectRatio="none"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="waveGradDeep" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#059669" stopOpacity="0.75" />
              <stop offset="50%" stopColor="#047857" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#022c22" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="waveGradMid" x1="0%" y1="100%" x2="100%" y2="10%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.7" />
              <stop offset="50%" stopColor="#059669" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#047857" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="waveGradFront" x1="10%" y1="90%" x2="90%" y2="0%">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.6" />
              <stop offset="45%" stopColor="#10b981" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.02" />
            </linearGradient>
            <radialGradient id="greenAtmosphere" cx="45%" cy="85%" r="65%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.42" />
              <stop offset="50%" stopColor="#047857" stopOpacity="0.2" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect x="0" y="0" width="260" height="380" fill="url(#greenAtmosphere)" />
          <path
            d="M-20,190 C40,240 100,160 170,190 C220,215 245,170 280,160 L280,380 L-20,380 Z"
            fill="url(#waveGradDeep)"
          />
          <path
            d="M-20,235 C50,190 125,270 190,210 C230,175 255,185 280,180 L280,380 L-20,380 Z"
            fill="url(#waveGradMid)"
          />
          <path
            d="M-20,285 C45,255 115,295 175,260 C225,225 255,235 280,220 L280,380 L-20,380 Z"
            fill="url(#waveGradFront)"
          />
        </svg>
      </div>

      {/* Brand Header (Sticky at top of sidebar) */}
      <div className="sidebar-brand">
        <div
          className="sidebar-brand-inner d-flex align-items-center gap-2"
          onClick={!isOpen ? onToggle : undefined}
          title={!isOpen ? 'Click to expand sidebar' : undefined}
          style={{ cursor: !isOpen ? 'pointer' : 'default' }}
        >
          <div className="sidebar-brand-icon">
            <i className="bi bi-whatsapp"></i>
          </div>
          <div className="sidebar-brand-text">
            <div className="brand-font fs-5 text-white fw-bold tracking-wide">AIWAVO</div>
            <div className="sidebar-brand-subtitle">
              WhatsApp Automation Platform
            </div>
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

      {/* Scrollable Body: Menu items and Pro Plan card scroll together */}
      <div className="sidebar-body">
        {/* Menu List */}
        <ul className="sidebar-menu">
          {menuItems.map((item) => (
            <li key={item.to} className="sidebar-item">
              <NavLink
                to={item.to}
                className={({ isActive }) => {
                  const active =
                    isActive ||
                    (item.to === '/contacts' &&
                      (location.pathname.startsWith('/contacts') || location.pathname.startsWith('/imports'))) ||
                    (item.to === '/campaigns' && location.pathname.startsWith('/campaigns'));
                  return `sidebar-link ${active ? 'active' : ''}`;
                }}
                onClick={handleLinkClick}
                title={!isOpen ? item.name : undefined}
              >
                <div className="sidebar-link-icon-wrap">
                  <i className={`bi ${item.icon}`}></i>
                  {item.badge && (
                    <span className="badge aiwavo-mini-badge">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="sidebar-link-full-text">{item.name}</span>
                <span className="sidebar-link-mini-text">{item.shortName}</span>

                {item.hasChevron && (
                  <i className="bi bi-chevron-down ms-auto sidebar-chevron"></i>
                )}
                {item.badge && (
                  <span className="badge ms-auto aiwavo-queue-badge sidebar-link-full-badge">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            </li>
          ))}

          {isSuperAdmin && isSuperAdmin() && (
            <li className="sidebar-item">
              <NavLink
                to="/admin"
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                onClick={handleLinkClick}
                title={!isOpen ? 'Super Admin' : undefined}
              >
                <div className="sidebar-link-icon-wrap">
                  <i className="bi bi-shield-lock-fill text-warning"></i>
                </div>
                <span className="sidebar-link-full-text text-warning">Super Admin</span>
                <span className="sidebar-link-mini-text text-warning">Admin</span>
              </NavLink>
            </li>
          )}
        </ul>

        {/* Pro Plan Card (Scrolls together with Navbar items) */}
        <div className="sidebar-pro-card">
          {/* Full View when Expanded */}
          <div className="sidebar-pro-full">
            <div className="sidebar-pro-header">
              <i className="bi bi-crown-fill sidebar-pro-crown"></i>
              <span>Pro Plan</span>
            </div>
            <div className="sidebar-pro-valid">Valid till: 31 Dec 2026</div>
            <div className="sidebar-pro-progress-bg">
              <div className="sidebar-pro-progress-fill" style={{ width: '82.4%' }}></div>
            </div>
            <div className="sidebar-pro-text">82,400 / 100,000 Messages</div>
            <NavLink to="/billing" className="sidebar-pro-btn" onClick={handleLinkClick}>
              <span>Upgrade Plan</span>
              <i className="bi bi-arrow-right"></i>
            </NavLink>
          </div>

          {/* Mini View when Collapsed */}
          <div className="sidebar-pro-mini" title="Pro Plan (82,400 / 100,000 Messages)">
            <NavLink to="/billing" className="sidebar-pro-mini-btn" onClick={handleLinkClick}>
              <i className="bi bi-crown-fill sidebar-pro-crown"></i>
              <span className="sidebar-pro-mini-label">PRO</span>
            </NavLink>
          </div>
        </div>
      </div>
    </aside>
  );
}
