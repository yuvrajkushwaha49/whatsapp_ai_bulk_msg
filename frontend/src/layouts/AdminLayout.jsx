import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import AdminSidebar from '../components/AdminSidebar';
import '../styles/adminDashboard.css';

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('cf_admin_sidebar_open');
    if (saved !== null) {
      return saved === 'true';
    }
    return typeof window !== 'undefined' ? window.innerWidth >= 992 : true;
  });

  const location = useLocation();

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem('cf_admin_sidebar_open', String(next));
      return next;
    });
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
    localStorage.setItem('cf_admin_sidebar_open', 'false');
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 992) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  return (
    <div className={`app-wrapper ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop d-lg-none"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Dedicated SuperAdmin Sidebar */}
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={closeSidebar}
        onToggle={toggleSidebar}
      />

      {/* Main Content Area */}
      <div className="main-content">
        <main className="content-container p-0 border-0 bg-transparent">
          <Outlet context={{ onToggleSidebar: toggleSidebar, sidebarOpen }} />
        </main>
      </div>
    </div>
  );
}

