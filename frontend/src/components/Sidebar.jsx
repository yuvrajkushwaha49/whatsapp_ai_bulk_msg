import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Sidebar({ isOpen, onClose }) {
  const { isSuperAdmin } = useAuth();

  return (
    <aside className={`sidebar ${isOpen ? 'show' : ''}`}>
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
          {/* Ambient Green Glow */}
          <rect x="0" y="0" width="260" height="380" fill="url(#greenAtmosphere)" />
          {/* Layer 1: Deep Emerald Back Curve reaching under Settings */}
          <path
            d="M-20,190 C40,240 100,160 170,190 C220,215 245,170 280,160 L280,380 L-20,380 Z"
            fill="url(#waveGradDeep)"
          />
          {/* Layer 2: Mid Glowing Wave */}
          <path
            d="M-20,235 C50,190 125,270 190,210 C230,175 255,185 280,180 L280,380 L-20,380 Z"
            fill="url(#waveGradMid)"
          />
          {/* Layer 3: Front Bright Mint Wave */}
          <path
            d="M-20,285 C45,255 115,295 175,260 C225,225 255,235 280,220 L280,380 L-20,380 Z"
            fill="url(#waveGradFront)"
          />
        </svg>
      </div>

      {/* Brand Header */}
      <div className="sidebar-brand">
        <div className="d-flex align-items-center gap-2">
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
          onClick={onClose}
          aria-label="Close sidebar"
          title="Close sidebar"
        >
          <i className="bi bi-chevron-left"></i>
        </button>
      </div>

      {/* Menu List */}
      <ul className="sidebar-menu">
        <li className="sidebar-item">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            <i className="bi bi-house-door-fill"></i>
            <span>Dashboard</span>
          </NavLink>
        </li>

        <li className="sidebar-item">
          <NavLink
            to="/whatsapp"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            <i className="bi bi-whatsapp"></i>
            <span>WhatsApp Accounts</span>
          </NavLink>
        </li>

        <li className="sidebar-item">
          <NavLink
            to="/contacts"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            <i className="bi bi-people-fill"></i>
            <span>Contacts</span>
          </NavLink>
        </li>

        <li className="sidebar-item">
          <NavLink
            to="/imports"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            <i className="bi bi-file-earmark-excel-fill"></i>
            <span>Excel Manager</span>
          </NavLink>
        </li>

        <li className="sidebar-item">
          <NavLink
            to="/campaigns"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            <i className="bi bi-megaphone-fill"></i>
            <span>Campaigns</span>
          </NavLink>
        </li>

        <li className="sidebar-item">
          <NavLink
            to="/campaigns/new"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            <i className="bi bi-diagram-3-fill"></i>
            <span>Automation</span>
            <i className="bi bi-chevron-down ms-auto sidebar-chevron"></i>
          </NavLink>
        </li>

        <li className="sidebar-item">
          <NavLink
            to="/templates"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            <i className="bi bi-chat-square-text-fill"></i>
            <span>Message Templates</span>
          </NavLink>
        </li>

        <li className="sidebar-item">
          <NavLink
            to="/inbox"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            <i className="bi bi-chat-left-dots-fill"></i>
            <span>Message Queue</span>
            <span className="badge ms-auto aiwavo-queue-badge">
              12
            </span>
          </NavLink>
        </li>

        <li className="sidebar-item">
          <NavLink
            to="/contacts/groups"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            <i className="bi bi-clock-history"></i>
            <span>Activity Logs</span>
          </NavLink>
        </li>

        <li className="sidebar-item">
          <NavLink
            to="/billing"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            <i className="bi bi-bar-chart-fill"></i>
            <span>Reports</span>
            <i className="bi bi-chevron-down ms-auto sidebar-chevron"></i>
          </NavLink>
        </li>

        <li className="sidebar-item">
          <NavLink
            to="/team"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            <i className="bi bi-people-fill"></i>
            <span>Team & Users</span>
          </NavLink>
        </li>

        <li className="sidebar-item">
          <NavLink
            to="/settings"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            <i className="bi bi-gear-fill"></i>
            <span>Settings</span>
          </NavLink>
        </li>

        {isSuperAdmin() && (
          <li className="sidebar-item">
            <NavLink
              to="/admin"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <i className="bi bi-shield-lock-fill text-warning"></i>
              <span className="text-warning">Super Admin</span>
            </NavLink>
          </li>
        )}
      </ul>

      {/* Bottom Pro Plan Card (Glassmorphic over glowing wave) */}
      <div className="sidebar-pro-card">
        <div className="sidebar-pro-header">
          <i className="bi bi-crown-fill sidebar-pro-crown"></i>
          <span>Pro Plan</span>
        </div>
        <div className="sidebar-pro-valid">Valid till: 31 Dec 2026</div>
        <div className="sidebar-pro-progress-bg">
          <div className="sidebar-pro-progress-fill" style={{ width: '82.4%' }}></div>
        </div>
        <div className="sidebar-pro-text">82,400 / 100,000 Messages</div>
        <NavLink to="/billing" className="sidebar-pro-btn" onClick={onClose}>
          <span>Upgrade Plan</span>
          <i className="bi bi-arrow-right"></i>
        </NavLink>
      </div>
    </aside>
  );
}
