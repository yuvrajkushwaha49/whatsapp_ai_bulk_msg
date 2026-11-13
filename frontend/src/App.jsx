import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';

// Layouts
import AppLayout from './layouts/AppLayout';
import AuthLayout from './layouts/AuthLayout';
import AdminLayout from './layouts/AdminLayout';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Contacts from './pages/Contacts';
import ContactDetail from './pages/ContactDetail';
import ContactGroups from './pages/ContactGroups';
import CsvImport from './pages/CsvImport';
import WhatsAppAccounts from './pages/WhatsAppAccounts';
import WhatsAppAccountDetail from './pages/WhatsAppAccountDetail';
import Templates from './pages/Templates';
import TemplateDetail from './pages/TemplateDetail';
import Inbox from './pages/Inbox';
import CampaignList from './pages/CampaignList';
import CampaignBuilder from './pages/CampaignBuilder';
import CampaignDetail from './pages/CampaignDetail';
import CampaignReport from './pages/CampaignReport';
import AiAssistant from './pages/AiAssistant';
import TeamManagement from './pages/TeamManagement';
import Billing from './pages/Billing';
import ActivityLogs from './pages/ActivityLogs';
import Settings from './pages/Settings';
import SuperAdminDashboard from './pages/SuperAdminDashboard';

// Super Admin Suite Pages
import AdminOverview from './pages/admin/AdminOverview';
import AdminTenants from './pages/admin/AdminTenants';
import AdminNumbers from './pages/admin/AdminNumbers';
import AdminBilling from './pages/admin/AdminBilling';
import AdminLogs from './pages/admin/AdminLogs';
import AdminMeta from './pages/admin/AdminMeta';
import AdminMetaMonitoring from './pages/admin/AdminMetaMonitoring';
import AdminAccounts from './pages/admin/AdminAccounts';

import WhatsAppOAuthCallback from './pages/WhatsAppOAuthCallback';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';

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
      {/* Public Legal & Compliance Pages */}
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfService />} />

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
        <Route path="/contacts/groups" element={<ContactGroups />} />
        <Route path="/contacts/:id" element={<ContactDetail />} />
        <Route path="/imports" element={<CsvImport />} />
        <Route path="/whatsapp" element={<WhatsAppAccounts />} />
        <Route path="/whatsapp/accounts/:id" element={<WhatsAppAccountDetail />} />
        <Route path="/whatsapp/:id" element={<WhatsAppAccountDetail />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/templates/:id" element={<TemplateDetail />} />
        <Route path="/campaigns" element={<CampaignList />} />
        <Route path="/campaigns/new" element={<CampaignBuilder />} />
        <Route path="/campaigns/:id" element={<CampaignDetail />} />
        <Route path="/campaigns/:id/report" element={<CampaignReport />} />
        <Route path="/ai-assistant" element={<AiAssistant />} />
        <Route path="/team" element={<TeamManagement />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/activity-logs" element={<ActivityLogs />} />
        <Route path="/settings" element={<Settings />} />

        {/* SuperAdmin Legacy Console inside client layout */}
        <Route
          path="/superadmin"
          element={
            <ProtectedRoute requireSuperAdmin={true}>
              <SuperAdminDashboard />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Dedicated SuperAdmin Platform Management Suite */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute requireSuperAdmin={true}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminOverview />} />
        <Route path="dashboard" element={<AdminOverview />} />
        <Route path="tenants" element={<AdminTenants />} />
        <Route path="numbers" element={<AdminNumbers />} />
        <Route path="billing" element={<AdminBilling />} />
        <Route path="logs" element={<AdminLogs />} />
        <Route path="meta" element={<AdminMeta />} />
        <Route path="meta-monitoring" element={<AdminMetaMonitoring />} />
        <Route path="accounts" element={<AdminAccounts />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
