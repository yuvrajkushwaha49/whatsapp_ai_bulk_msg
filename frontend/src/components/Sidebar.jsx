import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Sidebar({ isOpen, onClose }) {
  const { isSuperAdmin, hasRole } = useAuth();

  return (
    <aside className={`sidebar ${isOpen ? 'show' : ''}`}>
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <i className="bi bi-whatsapp"></i>
        </div>
        <div>
          <div className="brand-font fs-5 text-white">CampaignFlow</div>
          <div className="small text-muted" style={{ fontSize: '0.65rem', letterSpacing: '0.05em' }}>
            WHATSAPP SAAS AUTOMATION
          </div>
        </div>
      </div>

      <ul className="sidebar-menu">
        <li className="sidebar-heading">Core Marketing</li>
        <li className="sidebar-item">
          <NavLink to="/dashboard" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <i className="bi bi-grid-1x2-fill"></i>
            <span>Overview Dashboard</span>
          </NavLink>
        </li>
        <li className="sidebar-item">
          <NavLink to="/campaigns" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <i className="bi bi-send-fill"></i>
            <span>Campaigns</span>
          </NavLink>
        </li>
        <li className="sidebar-item">
          <NavLink to="/campaigns/new" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <i className="bi bi-plus-circle-fill"></i>
            <span>Create Campaign</span>
          </NavLink>
        </li>
        <li className="sidebar-item">
          <NavLink to="/ai-assistant" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <i className="bi bi-stars"></i>
            <span>AI Copy Generator</span>
          </NavLink>
        </li>

        <li className="sidebar-heading">Audience & Consent</li>
        <li className="sidebar-item">
          <NavLink to="/contacts" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <i className="bi bi-people-fill"></i>
            <span>Audience & Contacts</span>
          </NavLink>
        </li>
        <li className="sidebar-item">
          <NavLink to="/imports" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <i className="bi bi-file-earmark-arrow-up-fill"></i>
            <span>CSV Import Wizard</span>
          </NavLink>
        </li>

        <li className="sidebar-heading">Meta Platform</li>
        <li className="sidebar-item">
          <NavLink to="/whatsapp" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <i className="bi bi-patch-check-fill"></i>
            <span>WhatsApp Accounts</span>
          </NavLink>
        </li>
        <li className="sidebar-item">
          <NavLink to="/templates" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <i className="bi bi-card-text"></i>
            <span>Approved Templates</span>
          </NavLink>
        </li>

        <li className="sidebar-heading">Workspace & Settings</li>
        <li className="sidebar-item">
          <NavLink to="/team" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <i className="bi bi-person-badge-fill"></i>
            <span>Team Members</span>
          </NavLink>
        </li>
        <li className="sidebar-item">
          <NavLink to="/billing" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <i className="bi bi-credit-card-fill"></i>
            <span>Subscription & Quotas</span>
          </NavLink>
        </li>
        <li className="sidebar-item">
          <NavLink to="/settings" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <i className="bi bi-gear-fill"></i>
            <span>Settings & Webhook</span>
          </NavLink>
        </li>

        {isSuperAdmin() && (
          <>
            <li className="sidebar-heading text-warning">Platform Administration</li>
            <li className="sidebar-item">
              <NavLink to="/admin" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onClose}>
                <i className="bi bi-shield-lock-fill text-warning"></i>
                <span className="text-warning">Super Admin Panel</span>
              </NavLink>
            </li>
          </>
        )}
      </ul>

      <div className="sidebar-footer">
        <div className="d-flex align-items-center justify-content-between">
          <div className="small text-muted" style={{ fontSize: '0.75rem' }}>
            Cloud API: <span className="text-success fw-semibold">v21.0</span>
          </div>
          <span className="badge bg-success-subtle text-success">Active</span>
        </div>
      </div>
    </aside>
  );
}
