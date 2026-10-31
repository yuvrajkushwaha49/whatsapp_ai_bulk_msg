import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';

// Layouts
import AppLayout from './layouts/AppLayout';
import AuthLayout from './layouts/AuthLayout';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Contacts from './pages/Contacts';
import CsvImport from './pages/CsvImport';
import WhatsAppAccounts from './pages/WhatsAppAccounts';
import Templates from './pages/Templates';
import Inbox from './pages/Inbox';
import CampaignList from './pages/CampaignList';
import CampaignBuilder from './pages/CampaignBuilder';
import CampaignReport from './pages/CampaignReport';
import AiAssistant from './pages/AiAssistant';
import TeamManagement from './pages/TeamManagement';
import Billing from './pages/Billing';
import Settings from './pages/Settings';
import SuperAdminDashboard from './pages/SuperAdminDashboard';

import WhatsAppOAuthCallback from './pages/WhatsAppOAuthCallback';

// Protected Route Guard
function ProtectedRoute({ children, requireSuperAdmin = false }) {
  const { user, loading, isSuperAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center">
        <div className="spinner-border text-success" role="status"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireSuperAdmin && !isSuperAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      {/* Public Auth Routes & OAuth Callbacks */}
      <Route path="/whatsapp/callback" element={<WhatsAppOAuthCallback />} />
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      {/* Protected SaaS App Routes */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/imports" element={<CsvImport />} />
        <Route path="/whatsapp" element={<WhatsAppAccounts />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/campaigns" element={<CampaignList />} />
        <Route path="/campaigns/new" element={<CampaignBuilder />} />
        <Route path="/campaigns/:id" element={<CampaignReport />} />
        <Route path="/ai-assistant" element={<AiAssistant />} />
        <Route path="/team" element={<TeamManagement />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/settings" element={<Settings />} />

        {/* SuperAdmin Only */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requireSuperAdmin={true}>
              <SuperAdminDashboard />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
