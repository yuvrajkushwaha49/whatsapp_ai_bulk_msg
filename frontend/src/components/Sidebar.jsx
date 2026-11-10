import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Sidebar({ isOpen, onClose }) {
  const { isSuperAdmin } = useAuth();

  return (
    <aside className={`sidebar ${isOpen ? 'show' : ''}`}>
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <i className="bi bi-whatsapp"></i>
        </div>
        <div>
          <div className="brand-font fs-5 text-white fw-bold">AIWAVO</div>
          <div className="text-muted" style={{ fontSize: '0.68rem', letterSpacing: '0.02em' }}>
            WhatsApp Automation Platform
          </div>
        </div>
      </div>

      {/* Menu List */}
      <ul className="sidebar-menu">
        <li className="sidebar-item">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            <i className="bi bi-speedometer2"></i>
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
            <i className="bi bi-chevron-down ms-auto" style={{ fontSize: '0.75rem' }}></i>
          </NavLink>
        </li>

        <li className="sidebar-item">
          <NavLink
            to="/templates"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            <i className="bi bi-card-text"></i>
            <span>Message Templates</span>
          </NavLink>
        </li>

        <li className="sidebar-item">
          <NavLink
            to="/inbox"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            <i className="bi bi-chat-left-text-fill"></i>
            <span>Message Queue</span>
            <span
              className="badge ms-auto"
              style={{
                fontSize: '0.7rem',
                backgroundColor: '#10b981',
                color: '#ffffff',
                borderRadius: '9999px',
                padding: '0.2rem 0.55rem'
              }}
            >
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
            <i className="bi bi-chevron-down ms-auto" style={{ fontSize: '0.75rem' }}></i>
          </NavLink>
        </li>

        <li className="sidebar-item">
          <NavLink
            to="/team"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            <i className="bi bi-person-badge-fill"></i>
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

      {/* Bottom Pro Plan Card */}
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
