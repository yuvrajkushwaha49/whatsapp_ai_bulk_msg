import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const isInbox = location.pathname.startsWith('/inbox');
  const isDashboard = location.pathname === '/' || location.pathname === '/dashboard';

  return (
    <div className="app-wrapper">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        {!isDashboard && <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />}
        <main className={`content-container ${isInbox ? 'inbox-container-reset' : ''} ${isDashboard ? 'p-0 border-0 bg-transparent' : ''}`}>
          <Outlet context={{ onToggleSidebar: () => setSidebarOpen(!sidebarOpen) }} />
        </main>
      </div>
    </div>
  );
}
