import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import '../styles/switchClientModal.css';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('cf_sidebar_open');
    if (saved !== null) {
      return saved === 'true';
    }
    return typeof window !== 'undefined' ? window.innerWidth >= 992 : true;
  });

  const location = useLocation();
  const isInbox = location.pathname.startsWith('/inbox');
  const isDashboard = location.pathname === '/' || location.pathname === '/dashboard';

  const isImpersonating = localStorage.getItem('cf_impersonating') === 'true';
  const impersonatedBiz = localStorage.getItem('cf_impersonated_biz');

  const handleReturnToAdmin = () => {
    const superAdminToken = localStorage.getItem('cf_superadmin_token');
    if (superAdminToken) {
      localStorage.setItem('cf_token', superAdminToken);
      localStorage.removeItem('cf_superadmin_token');
    }
    localStorage.removeItem('cf_impersonating');
    localStorage.removeItem('cf_impersonated_biz');
    window.location.href = '/admin';
  };

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem('cf_sidebar_open', String(next));
      return next;
    });
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
    localStorage.setItem('cf_sidebar_open', 'false');
  };

  const openSidebar = () => {
    setSidebarOpen(true);
    localStorage.setItem('cf_sidebar_open', 'true');
  };

  // Close sidebar on mobile route navigation
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 992) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  return (
    <div className={`app-wrapper ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
      {/* Mobile Backdrop overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop d-lg-none"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Component with onToggle support */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={closeSidebar}
        onToggle={toggleSidebar}
      />

      {/* Main Content Area */}
      <div className={`main-content ${isInbox ? 'main-content-inbox' : ''}`}>
        {/* SuperAdmin Client View Banner */}
        {isImpersonating && (
          <div className="admin-impersonation-bar">
            <div className="admin-impersonation-content">
              <i className="bi bi-shield-shaded me-2"></i>
              <span>
                Viewing as <strong>{impersonatedBiz || 'Client'}</strong> (Super Admin Client View Mode)
              </span>
            </div>
            <button
              onClick={handleReturnToAdmin}
              className="btn btn-sm btn-light text-dark fw-bold admin-impersonation-exit-btn"
            >
              <i className="bi bi-box-arrow-left me-1"></i> Return to Super Admin Suite
            </button>
          </div>
        )}
        <main
          className={`content-container ${
            isInbox ? 'inbox-container-reset' : ''
          } p-0 border-0 bg-transparent`}
        >
          <Outlet context={{ onToggleSidebar: toggleSidebar, sidebarOpen }} />
        </main>
      </div>
    </div>
  );
}
