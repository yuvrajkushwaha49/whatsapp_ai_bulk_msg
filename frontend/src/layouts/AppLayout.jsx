import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';

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
      <div className="main-content">
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
