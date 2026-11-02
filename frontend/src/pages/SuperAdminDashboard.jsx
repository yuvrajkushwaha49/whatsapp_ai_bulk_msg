import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function SuperAdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'meta_integration' | 'meta_monitoring' | 'whatsapp_accounts'
  const [stats, setStats] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [whatsappAccounts, setWhatsappAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Platform Meta Integration state
  const [metaConfig, setMetaConfig] = useState({
    metaAppId: '',
    metaAppSecret: '',
    embeddedSignupConfigId: '',
    graphApiVersion: 'v21.0',
    webhookVerifyToken: 'campaignflow_secure_webhook_token_2026',
    isEnabled: true
  });
  const [metaConfigStatus, setMetaConfigStatus] = useState(null);
  const [savingMeta, setSavingMeta] = useState(false);
  const [testingMeta, setTestingMeta] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [showSecret, setShowSecret] = useState(false);

  // Meta Integration Monitoring state
  const [monitoring, setMonitoring] = useState(null);
  const [loadingMonitoring, setLoadingMonitoring] = useState(false);

  // Number Allocation & Approval Matrix state
  const [matrixData, setMatrixData] = useState({ businesses: [], unassignedAccounts: [] });
  const [loadingMatrix, setLoadingMatrix] = useState(false);
  const [matrixSearch, setMatrixSearch] = useState('');
  const [selectedClientDetail, setSelectedClientDetail] = useState(null);
  const [togglingAccountId, setTogglingAccountId] = useState(null);
  const [reassigningAccountId, setReassigningAccountId] = useState(null);
  const [targetBusinessMap, setTargetBusinessMap] = useState({});
  const [poolAllotBusinessId, setPoolAllotBusinessId] = useState({});
  const [newAllowedNumberInput, setNewAllowedNumberInput] = useState('');
  const [savingAllowedNumbers, setSavingAllowedNumbers] = useState(false);

  useEffect(() => {
    fetchAdminData();
    fetchPlatformMetaConfig();
    fetchMonitoring();
    fetchMatrixData();
  }, []);

  const fetchMatrixData = async () => {
    try {
      setLoadingMatrix(true);
      const res = await api.get('/admin/number-allocation-matrix');
      if (res.data?.success) {
        setMatrixData(res.data.data);
        setSelectedClientDetail(prev => {
          if (!prev) return null;
          return res.data.data.businesses.find(b => b.id === prev.id) || prev;
        });
      }
    } catch (err) {
      console.error('Failed to load Number Allocation Matrix', err);
    } finally {
      setLoadingMatrix(false);
    }
  };

  const handleToggleAdminStatus = async (accountId, newStatus) => {
    try {
      setTogglingAccountId(accountId);
      const res = await api.patch(`/admin/whatsapp-accounts/${accountId}/admin-status`, {
        adminStatus: newStatus,
        admin_status: newStatus
      });
      if (res.data?.success) {
        setFeedback({
          type: 'success',
          text: `WhatsApp number status changed to ${newStatus}. ${newStatus === 'ACTIVE' ? '🟢 It is now VISIBLE to the client.' : '🔴 It is now DEACTIVATED and hidden from the client.'}`
        });

        // Instant local state update for immediate UI feedback
        setSelectedClientDetail(prev => {
          if (!prev) return null;
          const updateAccs = (accs) => (accs || []).map(a => a.id === accountId ? { ...a, admin_status: newStatus } : a);
          return {
            ...prev,
            whatsapp_accounts: updateAccs(prev.whatsapp_accounts),
            accounts: updateAccs(prev.accounts)
          };
        });

        setMatrixData(prev => {
          if (!prev || !prev.businesses) return prev;
          const updateAccs = (accs) => (accs || []).map(a => a.id === accountId ? { ...a, admin_status: newStatus } : a);
          const updatedBusinesses = prev.businesses.map(b => ({
            ...b,
            whatsapp_accounts: updateAccs(b.whatsapp_accounts),
            accounts: updateAccs(b.accounts)
          }));
          return { ...prev, businesses: updatedBusinesses };
        });

        await fetchMatrixData();
        await fetchAdminData();
      }
    } catch (err) {
      setFeedback({
        type: 'danger',
        text: err.response?.data?.message || 'Failed to update WhatsApp number status'
      });
    } finally {
      setTogglingAccountId(null);
    }
  };

  const handleReassignAccount = async (accountId, targetBizId) => {
    try {
      setReassigningAccountId(accountId);
      const res = await api.patch(`/admin/whatsapp-accounts/${accountId}/reassign`, {
        targetBusinessId: targetBizId ? Number(targetBizId) : null,
        business_id: targetBizId ? Number(targetBizId) : null
      });
      if (res.data?.success) {
        setFeedback({
          type: 'success',
          text: res.data.message || 'WhatsApp number successfully reassigned!'
        });
        setTargetBusinessMap(prev => {
          const next = { ...prev };
          delete next[accountId];
          return next;
        });
        await fetchMatrixData();
        await fetchAdminData();
      }
    } catch (err) {
      setFeedback({
        type: 'danger',
        text: err.response?.data?.message || 'Failed to reassign WhatsApp account'
      });
    } finally {
      setReassigningAccountId(null);
    }
  };

  const handleAddAllowedNumber = async (bizId) => {
    if (!newAllowedNumberInput.trim()) return;
    const cleanNum = newAllowedNumberInput.trim();
    const currentList = selectedClientDetail?.allowed_phone_numbers || [];
    if (currentList.includes(cleanNum)) {
      setFeedback({ type: 'warning', text: 'This number is already in the approved allowed list.' });
      return;
    }
    const updatedList = [...currentList, cleanNum];
    await saveAllowedNumbersList(bizId, updatedList);
    setNewAllowedNumberInput('');
  };

  const handleRemoveAllowedNumber = async (bizId, numToRemove) => {
    const biz = (matrixData?.businesses || []).find(b => b.id === bizId) || selectedClientDetail;
    const currentList = Array.isArray(biz?.allowed_phone_numbers) ? biz.allowed_phone_numbers : [];
    const cleanToRemove = String(numToRemove).replace(/\D/g, '').slice(-10);
    const updatedList = currentList.filter(n => {
      if (n === numToRemove) return false;
      const clean = String(n).replace(/\D/g, '').slice(-10);
      return clean !== cleanToRemove;
    });
    await saveAllowedNumbersList(bizId, updatedList);
  };

  const handleQuickRemoveApprovedNumber = async (biz, phoneToRemove) => {
    if (!biz || !phoneToRemove) return;
    const cleanToRemove = String(phoneToRemove).replace(/\D/g, '').slice(-10);
    const currentList = Array.isArray(biz.allowed_phone_numbers) ? [...biz.allowed_phone_numbers] : [];

    let updatedList;
    if (currentList.includes('*')) {
      // Wildcard was active: convert to explicit list excluding this phone
      const remaining = [];
      const seen = new Set();

      // Keep existing specific numbers
      currentList.filter(n => n !== '*').forEach(n => {
        const clean = String(n).replace(/\D/g, '').slice(-10);
        if (clean && clean !== cleanToRemove && !seen.has(clean)) {
          seen.add(clean);
          remaining.push(n);
        }
      });

      // Keep other connected accounts
      (biz.whatsapp_accounts || []).forEach(acc => {
        const raw = acc.display_phone_number || acc.phone_number;
        if (raw) {
          const clean = String(raw).replace(/\D/g, '').slice(-10);
          if (clean && clean !== cleanToRemove && !seen.has(clean)) {
            seen.add(clean);
            remaining.push(raw);
          }
        }
      });

      updatedList = remaining;
    } else {
      updatedList = currentList.filter(n => {
        const clean = String(n).replace(/\D/g, '').slice(-10);
        return clean !== cleanToRemove && n !== phoneToRemove;
      });
    }

    await saveAllowedNumbersList(biz.id, updatedList);
  };

  const handleQuickRemoveWildcard = async (biz) => {
    if (!biz) return;
    const currentList = Array.isArray(biz.allowed_phone_numbers) ? [...biz.allowed_phone_numbers] : [];
    const updatedList = currentList.filter(n => n !== '*');
    await saveAllowedNumbersList(biz.id, updatedList);
  };

  const handleToggleAllowAllNumbers = async (bizId) => {
    const biz = (matrixData?.businesses || []).find(b => b.id === bizId) || selectedClientDetail;
    const currentList = Array.isArray(biz?.allowed_phone_numbers) ? biz.allowed_phone_numbers : [];
    const isAllowAll = currentList.includes('*');
    const updatedList = isAllowAll ? currentList.filter(n => n !== '*') : ['*'];
    await saveAllowedNumbersList(bizId, updatedList);
  };

  const saveAllowedNumbersList = async (bizId, list) => {
    try {
      setSavingAllowedNumbers(true);
      const res = await api.patch(`/admin/businesses/${bizId}/allowed-numbers`, {
        allowedNumbers: list
      });
      if (res.data?.success) {
        setFeedback({
          type: 'success',
          text: `Pre-Approved discovery numbers updated successfully!`
        });
        setSelectedClientDetail(prev => prev && prev.id === bizId ? { ...prev, allowed_phone_numbers: list } : prev);
        setMatrixData(prev => {
          if (!prev?.businesses) return prev;
          return {
            ...prev,
            businesses: prev.businesses.map(b => b.id === bizId ? { ...b, allowed_phone_numbers: list } : b)
          };
        });
        await fetchMatrixData();
      }
    } catch (err) {
      setFeedback({
        type: 'danger',
        text: err.response?.data?.message || 'Failed to update allowed numbers'
      });
    } finally {
      setSavingAllowedNumbers(false);
    }
  };

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [statsRes, bizRes, waRes] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/admin/businesses'),
        api.get('/admin/whatsapp-accounts').catch(() => ({ data: { success: true, data: [] } }))
      ]);

      if (statsRes.data?.success) setStats(statsRes.data.data);
      if (bizRes.data?.success) setBusinesses(bizRes.data.data);
      if (waRes.data?.success) setWhatsappAccounts(waRes.data.data || []);
    } catch (err) {
      console.error('Failed to load SuperAdmin data', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlatformMetaConfig = async () => {
    try {
      const res = await api.get('/admin/meta-integration');
      if (res.data?.success && res.data?.data) {
        const d = res.data.data;
        setMetaConfigStatus(d);
        setMetaConfig({
          metaAppId: d.metaAppId || '',
          metaAppSecret: '', // Secret remains masked on client
          embeddedSignupConfigId: d.embeddedSignupConfigId || '',
          graphApiVersion: d.graphApiVersion || 'v21.0',
          webhookVerifyToken: d.webhookVerifyToken || 'campaignflow_secure_webhook_token_2026',
          isEnabled: d.isEnabled !== undefined ? d.isEnabled : true
        });
      }
    } catch (err) {
      console.warn('Failed to load platform meta config', err);
    }
  };

  const fetchMonitoring = async () => {
    try {
      setLoadingMonitoring(true);
      const res = await api.get('/admin/meta-integration/monitoring');
      if (res.data?.success) {
        setMonitoring(res.data.data);
      }
    } catch (err) {
      console.warn('Failed to load monitoring metrics', err);
    } finally {
      setLoadingMonitoring(false);
    }
  };

  const handleSaveMetaConfig = async (e) => {
    e.preventDefault();
    setSavingMeta(true);
    setFeedback({ type: '', text: '' });
    try {
      const res = await api.post('/admin/meta-integration', metaConfig);
      if (res.data?.success) {
        setFeedback({ type: 'success', text: 'Platform Meta Developer App configuration saved and encrypted at rest!' });
        fetchPlatformMetaConfig();
        fetchMonitoring();
      }
    } catch (err) {
      setFeedback({ type: 'danger', text: err.response?.data?.message || 'Failed to save Meta configuration.' });
    } finally {
      setSavingMeta(false);
    }
  };

  const handleTestMetaConnection = async () => {
    setTestingMeta(true);
    setTestResult(null);
    setFeedback({ type: '', text: '' });
    try {
      const res = await api.post('/admin/meta-integration/test');
      setTestResult(res.data?.data);
      if (res.data?.data?.success) {
        setFeedback({ type: 'success', text: `✅ Meta Graph API connection verified! Connected as "${res.data.data.appName}".` });
      } else {
        setFeedback({ type: 'warning', text: `Verification failed: ${res.data?.data?.message}` });
      }
      fetchPlatformMetaConfig();
    } catch (err) {
      const msg = err.response?.data?.message || 'Meta API verification failed';
      setTestResult({ success: false, message: msg });
      setFeedback({ type: 'danger', text: msg });
    } finally {
      setTestingMeta(false);
    }
  };

  const handleToggleStatus = async (bizId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    if (!window.confirm(`Are you sure you want to change tenant status to "${newStatus}"?`)) return;

    try {
      await api.patch(`/admin/businesses/${bizId}/status`, { status: newStatus });
      setFeedback({ type: 'success', text: `Tenant status updated to ${newStatus}` });
      fetchAdminData();
    } catch (err) {
      setFeedback({ type: 'danger', text: 'Failed to update tenant status' });
    }
  };

  const webhookCallbackUrl = `${window.location.origin.replace('5173', '5000')}/api/webhooks/whatsapp`;

  return (
    <div>
      {/* Top Header */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between mb-4 gap-3">
        <div>
          <span className="badge bg-warning text-dark mb-1">Super Administrator Control Panel</span>
          <h2 className="brand-font mb-0">Platform Overview & Meta SaaS Governance</h2>
        </div>
        <div className="d-flex align-items-center gap-2">
          <button
            onClick={() => { fetchAdminData(); fetchPlatformMetaConfig(); fetchMonitoring(); fetchMatrixData(); }}
            className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
          >
            <i className="bi bi-arrow-clockwise"></i>
            <span>Refresh All</span>
          </button>
        </div>
      </div>

      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show mb-4 shadow-sm`} role="alert">
          {feedback.text}
          <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      {/* Navigation Tabs */}
      <ul className="nav nav-pills mb-4 gap-2 border-bottom pb-3">
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold px-3 py-2 ${activeTab === 'overview' ? 'active' : 'text-dark'}`}
            onClick={() => setActiveTab('overview')}
          >
            <i className="bi bi-grid-fill me-2"></i>Platform Overview
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold px-3 py-2 ${activeTab === 'number_matrix' ? 'active bg-primary text-white' : 'text-dark'}`}
            onClick={() => { setActiveTab('number_matrix'); fetchMatrixData(); }}
          >
            <i className="bi bi-diagram-3-fill me-2 text-warning"></i>
            Number Allocation & Approval Matrix
            {matrixData?.businesses?.length > 0 && (
              <span className={`badge ms-2 ${activeTab === 'number_matrix' ? 'bg-light text-primary' : 'bg-primary text-white'}`}>
                {matrixData.businesses.reduce((sum, b) => sum + (b.whatsapp_accounts?.length || 0), 0)} Allotted
              </span>
            )}
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold px-3 py-2 ${activeTab === 'meta_integration' ? 'active' : 'text-dark'}`}
            onClick={() => setActiveTab('meta_integration')}
          >
            <i className="bi bi-gear-wide-connected me-2"></i>Meta Platform Integration
            {metaConfigStatus?.readinessStatus === 'ready' ? (
              <span className="badge bg-success ms-2">Ready</span>
            ) : (
              <span className="badge bg-warning text-dark ms-2">Action Required</span>
            )}
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold px-3 py-2 ${activeTab === 'meta_monitoring' ? 'active' : 'text-dark'}`}
            onClick={() => setActiveTab('meta_monitoring')}
          >
            <i className="bi bi-activity me-2"></i>Meta Integration Monitoring
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold px-3 py-2 ${activeTab === 'whatsapp_accounts' ? 'active' : 'text-dark'}`}
            onClick={() => setActiveTab('whatsapp_accounts')}
          >
            <i className="bi bi-whatsapp me-2"></i>Raw Accounts ({whatsappAccounts.length})
          </button>
        </li>
      </ul>

      {/* TAB 1: PLATFORM OVERVIEW */}
      {activeTab === 'overview' && (
        <div>
          {/* Global Stat Cards */}
          <div className="row g-3 mb-4">
            <div className="col-12 col-sm-6 col-xl-3">
              <div className="stat-card">
                <div className="stat-icon-wrapper stat-icon-blue">
                  <i className="bi bi-buildings"></i>
                </div>
                <div>
                  <div className="stat-label">Total Businesses</div>
                  <div className="stat-value">{stats?.totalBusinesses || 0}</div>
                  <div className="small text-success">
                    {stats?.activeBusinesses || 0} Active Tenants
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-xl-3">
              <div className="stat-card">
                <div className="stat-icon-wrapper stat-icon-green">
                  <i className="bi bi-send-check"></i>
                </div>
                <div>
                  <div className="stat-label">Platform Messages</div>
                  <div className="stat-value">{stats?.totalMessagesSent || 0}</div>
                  <div className="small text-muted">{stats?.totalCampaigns || 0} Campaigns total</div>
                </div>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-xl-3">
              <div className="stat-card">
                <div className="stat-icon-wrapper stat-icon-purple">
                  <i className="bi bi-person-badge"></i>
                </div>
                <div>
                  <div className="stat-label">Total Users</div>
                  <div className="stat-value">{stats?.totalUsers || 0}</div>
                  <div className="small text-muted">Across all tenants</div>
                </div>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-xl-3">
              <div className="stat-card">
                <div className="stat-icon-wrapper stat-icon-orange">
                  <i className="bi bi-currency-dollar"></i>
                </div>
                <div>
                  <div className="stat-label">MRR Revenue</div>
                  <div className="stat-value">${stats?.totalRevenueEstimated || 0}</div>
                  <div className="small text-success">Active Subscriptions</div>
                </div>
              </div>
            </div>
          </div>

          {/* Infrastructure Health Status */}
          <div className="cf-card mb-4">
            <div className="cf-card-header bg-dark text-white">
              <h5 className="mb-0 text-white">
                <i className="bi bi-activity text-success me-2"></i> Infrastructure & Integration Health
              </h5>
            </div>
            <div className="cf-card-body">
              <div className="row g-3">
                <div className="col-sm-6 col-md-3">
                  <div className="p-3 border rounded-3 bg-light">
                    <div className="text-muted small">REST API Gateway</div>
                    <div className="fw-bold text-success d-flex align-items-center gap-1">
                      <span className="badge bg-success rounded-circle" style={{ width: 8, height: 8 }}></span>
                      {stats?.systemHealth?.apiStatus || 'HEALTHY'}
                    </div>
                  </div>
                </div>
                <div className="col-sm-6 col-md-3">
                  <div className="p-3 border rounded-3 bg-light">
                    <div className="text-muted small">Database Storage</div>
                    <div className="fw-bold text-success d-flex align-items-center gap-1">
                      <span className="badge bg-success rounded-circle" style={{ width: 8, height: 8 }}></span>
                      OPERATIONAL
                    </div>
                  </div>
                </div>
                <div className="col-sm-6 col-md-3">
                  <div className="p-3 border rounded-3 bg-light">
                    <div className="text-muted small">BullMQ Queue Engine</div>
                    <div className="fw-bold text-success d-flex align-items-center gap-1">
                      <span className="badge bg-success rounded-circle" style={{ width: 8, height: 8 }}></span>
                      {stats?.systemHealth?.queueStatus || 'ACTIVE'}
                    </div>
                  </div>
                </div>
                <div className="col-sm-6 col-md-3">
                  <div className="p-3 border rounded-3 bg-light">
                    <div className="text-muted small">Platform Meta Integration</div>
                    <div className={`fw-bold d-flex align-items-center gap-1 ${metaConfigStatus?.readinessStatus === 'ready' ? 'text-success' : 'text-warning'}`}>
                      <span className={`badge ${metaConfigStatus?.readinessStatus === 'ready' ? 'bg-success' : 'bg-warning'} rounded-circle`} style={{ width: 8, height: 8 }}></span>
                      {metaConfigStatus?.readinessStatus === 'ready' ? 'READY (v21.0)' : 'CONFIG NEEDED'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tenant Governance Table */}
          <div className="cf-card">
            <div className="cf-card-header">
              <h5 className="mb-0">Tenant Directory ({businesses.length})</h5>
            </div>
            <div className="table-responsive">
              <table className="table cf-table">
                <thead>
                  <tr>
                    <th>Tenant Name / Slug</th>
                    <th>Users</th>
                    <th>Subscription Plan</th>
                    <th>Timezone</th>
                    <th>Status</th>
                    <th>Joined Date</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="text-center py-5">
                        <div className="spinner-border text-success" role="status"></div>
                      </td>
                    </tr>
                  ) : (
                    businesses.map(b => (
                      <tr key={b.id}>
                        <td>
                          <div className="fw-bold text-dark">{b.name}</div>
                          <code className="small text-muted">{b.slug}</code>
                        </td>
                        <td>
                          <span className="badge bg-light text-dark border">
                            {b.userCount || 1} Users
                          </span>
                        </td>
                        <td>
                          <span className="badge bg-primary-subtle text-primary">
                            {b.planName}
                          </span>
                        </td>
                        <td className="small text-muted">{b.timezone}</td>
                        <td>
                          <span className={`badge-status badge-${b.status}`}>
                            {b.status}
                          </span>
                        </td>
                        <td className="small text-muted">
                          {new Date(b.created_at).toLocaleDateString()}
                        </td>
                        <td className="text-end">
                          <button
                            onClick={() => handleToggleStatus(b.id, b.status)}
                            className={`btn btn-sm ${b.status === 'active' ? 'btn-outline-danger' : 'btn-outline-success'}`}
                          >
                            {b.status === 'active' ? 'Suspend Tenant' : 'Activate Tenant'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: META PLATFORM INTEGRATION (Section 2) */}
      {activeTab === 'meta_integration' && (
        <div className="row g-4">
          <div className="col-12 col-lg-7">
            <div className="cf-card">
              <div className="cf-card-header d-flex align-items-center justify-content-between">
                <div>
                  <h5 className="mb-0">Platform Meta Developer App Configuration</h5>
                  <p className="text-muted small mb-0">Common Meta App shared across all SaaS clients for Embedded Signup</p>
                </div>
                <span className={`badge ${metaConfigStatus?.readinessStatus === 'ready' ? 'bg-success' : 'bg-warning text-dark'}`}>
                  {metaConfigStatus?.readinessStatus === 'ready' ? 'READY FOR CLIENTS' : 'ACTION REQUIRED'}
                </span>
              </div>
              <div className="cf-card-body">
                <form onSubmit={handleSaveMetaConfig}>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">Meta App ID <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control font-monospace"
                      placeholder="e.g. 1165054629187576"
                      value={metaConfig.metaAppId}
                      onChange={(e) => setMetaConfig({ ...metaConfig, metaAppId: e.target.value })}
                      required
                    />
                    <div className="form-text small">Meta Developer Dashboard → App Settings → Basic → App ID</div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">Meta App Secret <span className="text-danger">*</span></label>
                    <div className="input-group">
                      <input
                        type={showSecret ? 'text' : 'password'}
                        className="form-control font-monospace"
                        placeholder={metaConfigStatus?.appSecretConfigured ? '•••••••••••••••••••••••• (Encrypted at Rest)' : 'Paste 32-character Meta App Secret'}
                        value={metaConfig.metaAppSecret}
                        onChange={(e) => setMetaConfig({ ...metaConfig, metaAppSecret: e.target.value })}
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => setShowSecret(!showSecret)}
                      >
                        <i className={`bi bi-eye${showSecret ? '-slash' : ''}`}></i>
                      </button>
                    </div>
                    <div className="form-text small">Encrypted using AES-256 at rest. Never sent in plain text to the browser.</div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">Embedded Signup Configuration ID (Optional)</label>
                    <input
                      type="text"
                      className="form-control font-monospace"
                      placeholder="e.g. 987654321098765"
                      value={metaConfig.embeddedSignupConfigId}
                      onChange={(e) => setMetaConfig({ ...metaConfig, embeddedSignupConfigId: e.target.value })}
                    />
                    <div className="form-text small">Configured inside Meta Developer Portal WhatsApp product for customized onboarding screens.</div>
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Graph API Version</label>
                      <input
                        type="text"
                        className="form-control font-monospace"
                        value={metaConfig.graphApiVersion}
                        onChange={(e) => setMetaConfig({ ...metaConfig, graphApiVersion: e.target.value })}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-bold">Webhook Verify Token</label>
                      <input
                        type="text"
                        className="form-control font-monospace"
                        value={metaConfig.webhookVerifyToken}
                        onChange={(e) => setMetaConfig({ ...metaConfig, webhookVerifyToken: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="mb-4 form-check form-switch">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="enableMetaSwitch"
                      checked={metaConfig.isEnabled}
                      onChange={(e) => setMetaConfig({ ...metaConfig, isEnabled: e.target.checked })}
                    />
                    <label className="form-check-label small fw-bold" htmlFor="enableMetaSwitch">
                      Enable Client WhatsApp Onboarding via this App
                    </label>
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <button type="submit" disabled={savingMeta} className="btn btn-primary px-4 fw-semibold">
                      {savingMeta ? 'Saving...' : 'Save Configuration'}
                    </button>
                    <button
                      type="button"
                      disabled={testingMeta}
                      onClick={handleTestMetaConnection}
                      className="btn btn-outline-success px-3 fw-semibold d-flex align-items-center gap-1"
                    >
                      {testingMeta ? (
                        <>
                          <span className="spinner-border spinner-border-sm" role="status"></span>
                          <span>Testing...</span>
                        </>
                      ) : (
                        <>
                          <i className="bi bi-shield-check"></i>
                          <span>Test Meta Connection</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* Meta Developer Portal Setup Checklist */}
          <div className="col-12 col-lg-5">
            <div className="cf-card h-100">
              <div className="cf-card-header">
                <h5 className="mb-0">Meta Developer Portal Requirements</h5>
              </div>
              <div className="cf-card-body">
                <p className="text-muted small">
                  In your Meta Developer App (<strong>{metaConfig.metaAppId || 'App ID'}</strong>), ensure these URLs are whitelisted:
                </p>

                <div className="mb-3">
                  <label className="small text-muted fw-bold">1. App Domains (Settings → Basic)</label>
                  <div className="p-2 bg-light rounded font-monospace small border">
                    bhaktisong.fun, whatsapp.bhaktisong.fun
                  </div>
                </div>

                <div className="mb-3">
                  <label className="small text-muted fw-bold">2. Valid OAuth Redirect URIs (Facebook Login → Settings)</label>
                  <div className="p-2 bg-light rounded font-monospace small border">
                    https://whatsapp.bhaktisong.fun/whatsapp/callback
                  </div>
                </div>

                <div className="mb-3">
                  <label className="small text-muted fw-bold">3. Webhook Callback URL (WhatsApp → Configuration)</label>
                  <div className="p-2 bg-light rounded font-monospace small border">
                    {webhookCallbackUrl}
                  </div>
                </div>

                <div className="alert alert-info border-info-subtle small mb-0">
                  <i className="bi bi-info-circle me-1"></i>
                  <strong>AiSensy-Style Architecture:</strong> Clients do not need to create developer accounts. When they click "Continue with Facebook", Meta verifies their business and returns their independent WABA ID and Phone Number ID to our SaaS platform.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: META INTEGRATION MONITORING (Section 12) */}
      {activeTab === 'meta_monitoring' && (
        <div>
          <div className="row g-3 mb-4">
            <div className="col-12 col-sm-6 col-xl-3">
              <div className="stat-card border-success-subtle">
                <div className="stat-icon-wrapper stat-icon-green">
                  <i className="bi bi-diagram-3-fill"></i>
                </div>
                <div>
                  <div className="stat-label">Connected Tenants</div>
                  <div className="stat-value">{monitoring?.totalTenantsConnected || 0}</div>
                  <div className="small text-muted">Active SaaS Workspaces</div>
                </div>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-xl-3">
              <div className="stat-card border-primary-subtle">
                <div className="stat-icon-wrapper stat-icon-blue">
                  <i className="bi bi-meta"></i>
                </div>
                <div>
                  <div className="stat-label">Unique WABAs</div>
                  <div className="stat-value">{monitoring?.totalConnectedWABAs || 0}</div>
                  <div className="small text-muted">Meta Business Accounts</div>
                </div>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-xl-3">
              <div className="stat-card">
                <div className="stat-icon-wrapper stat-icon-purple">
                  <i className="bi bi-telephone-fill"></i>
                </div>
                <div>
                  <div className="stat-label">Active Phone Numbers</div>
                  <div className="stat-value">{monitoring?.totalConnectedPhoneNumbers || 0}</div>
                  <div className="small text-success">Verified Cloud Senders</div>
                </div>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-xl-3">
              <div className="stat-card">
                <div className="stat-icon-wrapper stat-icon-orange">
                  <i className="bi bi-exclamation-triangle-fill"></i>
                </div>
                <div>
                  <div className="stat-label">Needs Reconnect</div>
                  <div className="stat-value text-warning">{monitoring?.requiresAttention || 0}</div>
                  <div className="small text-muted">Token expired / action required</div>
                </div>
              </div>
            </div>
          </div>

          <div className="cf-card mb-4">
            <div className="cf-card-header d-flex align-items-center justify-content-between">
              <h5 className="mb-0">
                <i className="bi bi-shield-check text-success me-2"></i> Multi-Tenant Account Isolation Verification
              </h5>
              <span className="badge bg-success-subtle text-success">Strict Isolation Active</span>
            </div>
            <div className="cf-card-body">
              <div className="row g-3">
                <div className="col-md-4">
                  <div className="p-3 border rounded-3 bg-light">
                    <div className="fw-bold small text-dark mb-1">AES-256 Token Encryption</div>
                    <div className="text-muted small">Every client access token is encrypted with AES-256-CBC before storing in the database.</div>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="p-3 border rounded-3 bg-light">
                    <div className="fw-bold small text-dark mb-1">Tenant ID Scoped Queries</div>
                    <div className="text-muted small">All campaigns, contacts, templates, and chats are strictly filtered by <code>business_id</code>.</div>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="p-3 border rounded-3 bg-light">
                    <div className="fw-bold small text-dark mb-1">Webhook Inbound Routing</div>
                    <div className="text-muted small">Incoming webhook messages are dynamically routed to the matching tenant based on <code>phone_number_id</code> and <code>waba_id</code>.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CLIENT WHATSAPP BUSINESS ACCOUNTS TABLE */}
      {activeTab === 'whatsapp_accounts' && (
        <div className="cf-card mb-4">
          <div className="cf-card-header d-flex align-items-center justify-content-between">
            <h5 className="mb-0">
              <i className="bi bi-whatsapp text-success me-2"></i> Client WhatsApp Business Accounts ({whatsappAccounts.length})
            </h5>
            <span className="badge bg-light text-dark border">Strict Token Isolation Active</span>
          </div>
          <div className="table-responsive">
            <table className="table cf-table">
              <thead>
                <tr>
                  <th>Tenant / Business</th>
                  <th>Display Name & Phone</th>
                  <th>Phone Number ID</th>
                  <th>WABA ID</th>
                  <th>Quality</th>
                  <th>Status</th>
                  <th>Last Verified</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-4">
                      <div className="spinner-border text-success" role="status"></div>
                    </td>
                  </tr>
                ) : whatsappAccounts.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center text-muted py-4">
                      No client WhatsApp accounts registered yet.
                    </td>
                  </tr>
                ) : (
                  whatsappAccounts.map(wa => (
                    <tr key={wa.id}>
                      <td>
                        <div className="fw-bold text-dark">{wa.tenant_name || `Tenant #${wa.business_id}`}</div>
                        <code className="small text-muted">{wa.business_slug || `tenant-${wa.business_id}`}</code>
                      </td>
                      <td>
                        <div className="fw-bold">{wa.verified_name || wa.account_name}</div>
                        <div className="small text-muted">{wa.display_phone_number || 'No phone verified'}</div>
                      </td>
                      <td>
                        <code className="small text-muted">{wa.phone_number_id || '—'}</code>
                      </td>
                      <td>
                        <code className="small text-muted">{wa.waba_id}</code>
                      </td>
                      <td>
                        <span className={`badge ${
                          wa.quality_rating === 'GREEN' ? 'bg-success-subtle text-success' :
                          wa.quality_rating === 'YELLOW' ? 'bg-warning-subtle text-warning' :
                          wa.quality_rating === 'RED' ? 'bg-danger-subtle text-danger' :
                          'bg-light text-muted'
                        }`}>
                          {wa.quality_rating || 'UNKNOWN'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${
                          wa.status === 'connected' ? 'bg-success text-white' :
                          wa.status === 'action_required' ? 'bg-warning text-dark' :
                          wa.status === 'token_expired' ? 'bg-danger text-white' :
                          'bg-secondary text-white'
                        }`}>
                          {wa.status}
                        </span>
                      </td>
                      <td className="small text-muted">
                        {wa.last_verified_at ? new Date(wa.last_verified_at).toLocaleString() : 'Pending'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: NUMBER ALLOCATION & APPROVAL MATRIX */}
      {activeTab === 'number_matrix' && (
        <div>
          {/* Summary KPI Cards */}
          <div className="row g-3 mb-4">
            <div className="col-12 col-sm-6 col-xl-3">
              <div className="stat-card">
                <div className="stat-icon-wrapper stat-icon-blue">
                  <i className="bi bi-people-fill"></i>
                </div>
                <div>
                  <div className="stat-label">Total Clients / Businesses</div>
                  <div className="stat-value">{matrixData.businesses?.length || 0}</div>
                  <div className="small text-muted">Active tenants with matrix rules</div>
                </div>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-xl-3">
              <div className="stat-card">
                <div className="stat-icon-wrapper stat-icon-green">
                  <i className="bi bi-whatsapp"></i>
                </div>
                <div>
                  <div className="stat-label">Allotted Numbers</div>
                  <div className="stat-value">
                    {(matrixData.businesses || []).reduce((acc, b) => acc + (b.whatsapp_accounts?.length || 0), 0)}
                  </div>
                  <div className="small text-success">Assigned across all clients</div>
                  <div className="small text-primary fw-semibold mt-1" style={{ fontSize: '0.72rem' }}>
                    <i className="bi bi-lightning-charge-fill text-warning me-1"></i>
                    {(matrixData.businesses || []).reduce((acc, b) => acc + (b.allowed_phone_numbers?.length || 0), 0)} Discovery Pre-Approved
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-xl-3">
              <div className="stat-card">
                <div className="stat-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                  <i className="bi bi-check-circle-fill"></i>
                </div>
                <div>
                  <div className="stat-label">Active & Approved</div>
                  <div className="stat-value text-success">
                    {(matrixData.businesses || []).flatMap(b => b.whatsapp_accounts || []).filter(a => a.admin_status !== 'DEACTIVE').length}
                  </div>
                  <div className="small text-muted">Visible in client dashboards</div>
                </div>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-xl-3">
              <div className="stat-card">
                <div className="stat-icon-wrapper" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                  <i className="bi bi-eye-slash-fill"></i>
                </div>
                <div>
                  <div className="stat-label">Deactive / Hidden</div>
                  <div className="stat-value text-danger">
                    {(matrixData.businesses || []).flatMap(b => b.whatsapp_accounts || []).filter(a => a.admin_status === 'DEACTIVE').length}
                  </div>
                  <div className="small text-danger">Completely blocked from tenants</div>
                </div>
              </div>
            </div>
          </div>

          {/* Matrix Main Card */}
          <div className="cf-card mb-4">
            <div className="cf-card-header d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
              <div>
                <h5 className="mb-1 d-flex align-items-center gap-2">
                  <i className="bi bi-diagram-3-fill text-primary"></i>
                  <span>WhatsApp Number Allocation & Approval Matrix</span>
                </h5>
                <p className="text-muted small mb-0">
                  SuperAdmin controls which WhatsApp numbers each client can see and use. Open the Detail Page to activate, deactivate, or reassign numbers.
                </p>
              </div>
              <div className="d-flex align-items-center gap-2">
                <div className="input-group input-group-sm" style={{ width: '280px' }}>
                  <span className="input-group-text bg-white border-end-0">
                    <i className="bi bi-search text-muted"></i>
                  </span>
                  <input
                    type="text"
                    className="form-control border-start-0 ps-0"
                    placeholder="Search name, business, phone..."
                    value={matrixSearch}
                    onChange={(e) => setMatrixSearch(e.target.value)}
                  />
                  {matrixSearch && (
                    <button className="btn btn-outline-secondary" onClick={() => setMatrixSearch('')}>
                      <i className="bi bi-x"></i>
                    </button>
                  )}
                </div>
                <button
                  className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
                  onClick={fetchMatrixData}
                  disabled={loadingMatrix}
                >
                  <i className={`bi bi-arrow-clockwise ${loadingMatrix ? 'spin' : ''}`}></i>
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table cf-table align-middle">
                <thead>
                  <tr>
                    <th style={{ width: '25%' }}>Client & Business</th>
                    <th style={{ width: '43%' }}>Allotted & 1-Click Discovery Approved Numbers</th>
                    <th style={{ width: '16%' }}>Allocation Status</th>
                    <th style={{ width: '16%' }} className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingMatrix ? (
                    <tr>
                      <td colSpan="4" className="text-center py-5">
                        <div className="spinner-border text-primary" role="status"></div>
                        <div className="small text-muted mt-2">Loading Allocation Matrix...</div>
                      </td>
                    </tr>
                  ) : matrixData.businesses?.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-center text-muted py-5">
                        No clients registered yet.
                      </td>
                    </tr>
                  ) : (
                    (matrixData.businesses || [])
                      .filter(b => {
                        if (!matrixSearch.trim()) return true;
                        const q = matrixSearch.toLowerCase();
                        const matchesOwner = (b.owner_name || '').toLowerCase().includes(q);
                        const matchesEmail = (b.owner_email || '').toLowerCase().includes(q);
                        const matchesBiz = (b.name || '').toLowerCase().includes(q);
                        const matchesPhone = (b.whatsapp_accounts || []).some(wa =>
                          (wa.display_phone_number || '').toLowerCase().includes(q) ||
                          (wa.account_name || '').toLowerCase().includes(q) ||
                          (wa.verified_name || '').toLowerCase().includes(q)
                        );
                        const matchesAllowed = (b.allowed_phone_numbers || []).some(num =>
                          String(num).toLowerCase().includes(q)
                        );
                        return matchesOwner || matchesEmail || matchesBiz || matchesPhone || matchesAllowed;
                      })
                      .map(biz => {
                        const totalAccounts = biz.whatsapp_accounts?.length || 0;
                        const activeAccounts = (biz.whatsapp_accounts || []).filter(a => a.admin_status !== 'DEACTIVE').length;
                        const deactiveAccounts = totalAccounts - activeAccounts;
                        const allowedList = Array.isArray(biz.allowed_phone_numbers) ? biz.allowed_phone_numbers : [];
                        const allowsAll = allowedList.includes('*');
                        const specificAllowed = allowedList.filter(n => n !== '*');

                        // Build complete list of approved numbers to visibly display
                        const displayedApprovedNumbers = [];
                        const seenNums = new Set();

                        // 1. Add all specifically configured pre-approved numbers
                        specificAllowed.forEach(num => {
                          const clean = String(num).trim();
                          if (clean) {
                            const last10 = clean.replace(/\D/g, '').slice(-10);
                            seenNums.add(last10 || clean);
                            displayedApprovedNumbers.push({
                              phone: clean,
                              source: 'explicit'
                            });
                          }
                        });

                        // 2. If wildcard (*) is active or if accounts exist, also include the client's connected numbers as approved numbers so the user sees the real phone numbers!
                        if (allowsAll) {
                          (biz.whatsapp_accounts || []).forEach(acc => {
                            const rawPhone = acc.display_phone_number || acc.phone_number;
                            if (rawPhone) {
                              const last10 = String(rawPhone).replace(/\D/g, '').slice(-10);
                              if (!seenNums.has(last10)) {
                                seenNums.add(last10);
                                displayedApprovedNumbers.push({
                                  phone: rawPhone,
                                  name: acc.verified_name || acc.account_name,
                                  source: 'wildcard_account'
                                });
                              }
                            }
                          });
                        }

                        return (
                          <tr key={biz.id}>
                            <td>
                              <div className="d-flex align-items-center gap-2">
                                <div
                                  className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold shadow-sm"
                                  style={{
                                    width: '38px',
                                    height: '38px',
                                    backgroundColor: '#4f46e5',
                                    flexShrink: 0
                                  }}
                                >
                                  {(biz.owner_name || biz.name || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="fw-bold text-dark d-flex align-items-center gap-2">
                                    <span>{biz.owner_name || 'No Owner Name'}</span>
                                    {biz.owner_role && (
                                      <span className="badge bg-light text-secondary border small">
                                        {biz.owner_role}
                                      </span>
                                    )}
                                  </div>
                                  <div className="small text-muted">{biz.owner_email || 'No email registered'}</div>
                                  <div className="small text-primary fw-medium">
                                    <i className="bi bi-building me-1"></i>
                                    {biz.name} <code className="text-muted small">#{biz.id}</code>
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td>
                              {totalAccounts === 0 && allowedList.length === 0 ? (
                                <span className="badge bg-light text-muted border py-2 px-3 fst-italic">
                                  <i className="bi bi-info-circle me-1"></i> No WhatsApp numbers allotted or pre-approved yet
                                </span>
                              ) : (
                                <div className="d-flex flex-column gap-2">
                                  {/* Section 1: Connected WhatsApp Numbers */}
                                  {totalAccounts > 0 && (
                                    <div>
                                      <div className="d-flex align-items-center justify-content-between mb-1">
                                        <span className="small text-muted fw-semibold text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.5px' }}>
                                          <i className="bi bi-link-45deg text-success fw-bold me-1"></i>
                                          Connected Numbers ({totalAccounts})
                                        </span>
                                      </div>
                                      <div className="d-flex flex-wrap gap-2">
                                        {biz.whatsapp_accounts.map(acc => {
                                          const isDeactive = acc.admin_status === 'DEACTIVE';
                                          const cleanAccNum = (acc.display_phone_number || acc.phone_number || '').replace(/\D/g, '').slice(-10);
                                          const isPreApproved = allowsAll || specificAllowed.some(num => {
                                            const cleanAllowed = String(num).replace(/\D/g, '').slice(-10);
                                            return cleanAllowed && cleanAccNum && cleanAccNum === cleanAllowed;
                                          });

                                          return (
                                            <div
                                              key={acc.id}
                                              className={`p-2 rounded-2 border d-inline-flex align-items-center gap-2 shadow-sm ${
                                                isDeactive
                                                  ? 'bg-danger-subtle border-danger text-danger'
                                                  : 'bg-success-subtle border-success text-success'
                                              }`}
                                              style={{ fontSize: '0.82rem' }}
                                            >
                                              <i className={`bi ${isDeactive ? 'bi-eye-slash-fill text-danger' : 'bi-whatsapp text-success'}`}></i>
                                              <div>
                                                <div className="fw-bold lh-1 text-dark">
                                                  {acc.display_phone_number || acc.account_name || 'Unset phone'}
                                                </div>
                                                <div className="small opacity-75" style={{ fontSize: '0.70rem' }}>
                                                  {acc.verified_name || acc.account_name || 'WhatsApp'}
                                                </div>
                                              </div>
                                              <div className="d-flex flex-column gap-1 ms-1 align-items-end">
                                                <span
                                                  className={`badge ${
                                                    isDeactive ? 'bg-danger text-white' : 'bg-success text-white'
                                                  }`}
                                                  style={{ fontSize: '0.65rem' }}
                                                >
                                                  {isDeactive ? 'DEACTIVE' : 'ACTIVE'}
                                                </span>
                                                {isPreApproved && (
                                                  <span className="badge bg-primary-subtle text-primary border border-primary-subtle" style={{ fontSize: '0.60rem' }} title="Pre-Approved for 1-Click Discovery">
                                                    ⚡ Discovery OK
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Section 2: Pre-Approved for 1-Click Multi-App Discovery */}
                                  {(allowedList.length > 0 || displayedApprovedNumbers.length > 0) ? (
                                    <div className={totalAccounts > 0 ? 'pt-2 border-top' : ''}>
                                      <div className="d-flex align-items-center justify-content-between mb-1">
                                        <span className="small text-primary fw-semibold text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.5px' }}>
                                          <i className="bi bi-shield-check me-1"></i>
                                          Pre-Approved for 1-Click Discovery ({displayedApprovedNumbers.length > 0 ? `${displayedApprovedNumbers.length} Numbers` : ''}{allowsAll ? (displayedApprovedNumbers.length > 0 ? ' + Wildcard (*)' : 'All (*)') : ''})
                                        </span>
                                      </div>
                                      <div className="d-flex flex-wrap gap-2">
                                        {/* Render every approved phone number as a distinct badge/card */}
                                        {displayedApprovedNumbers.map((item, idx) => {
                                          const cleanAllowed = String(item.phone).replace(/\D/g, '').slice(-10);
                                          const matchingAcc = (biz.whatsapp_accounts || []).find(acc => {
                                            const cleanAcc = String(acc.display_phone_number || acc.phone_number || '').replace(/\D/g, '').slice(-10);
                                            return cleanAllowed && cleanAcc && cleanAcc === cleanAllowed;
                                          });
                                          const isAlreadyConnected = !!matchingAcc;
                                          const displayName = item.name || matchingAcc?.verified_name || matchingAcc?.account_name;

                                          return (
                                            <div
                                              key={idx}
                                              className="p-2 rounded-2 border d-inline-flex align-items-center gap-2 shadow-sm"
                                              style={{
                                                backgroundColor: isAlreadyConnected ? '#eef2ff' : '#faf5ff',
                                                borderColor: isAlreadyConnected ? '#818cf8' : '#d8b4fe',
                                                color: '#1e1b4b',
                                                fontSize: '0.82rem'
                                              }}
                                              title={isAlreadyConnected ? 'Pre-Approved number is connected in client panel' : 'Pre-Approved number is awaiting 1-Click Multi-App Discovery import by client'}
                                            >
                                              <i className={`bi ${isAlreadyConnected ? 'bi-shield-fill-check text-primary' : 'bi-lightning-charge-fill text-warning'}`}></i>
                                              <div>
                                                <div className="fw-bold lh-1 font-monospace" style={{ color: '#3730a3' }}>
                                                  {item.phone}
                                                </div>
                                                <div className="small text-muted" style={{ fontSize: '0.68rem' }}>
                                                  {displayName ? `${displayName} • ` : ''}1-Click Pre-Approved
                                                </div>
                                              </div>
                                              <span
                                                className={`badge ms-1 ${
                                                  isAlreadyConnected
                                                    ? 'bg-primary text-white'
                                                    : 'bg-warning-subtle text-warning-emphasis border border-warning'
                                                }`}
                                                style={{ fontSize: '0.65rem' }}
                                              >
                                                {isAlreadyConnected ? '🟢 Connected' : '⏳ Awaiting Scan'}
                                              </span>
                                              <button
                                                type="button"
                                                className="btn btn-outline-danger btn-xs py-0 px-1 border-0 ms-1"
                                                style={{ fontSize: '0.78rem', lineHeight: '1', borderRadius: '4px' }}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (window.confirm(`Remove "${item.phone}" from pre-approved discovery numbers for ${biz.name}?`)) {
                                                    handleQuickRemoveApprovedNumber(biz, item.phone);
                                                  }
                                                }}
                                                disabled={savingAllowedNumbers}
                                                title={`Remove ${item.phone} from Pre-Approved list`}
                                              >
                                                <i className="bi bi-x-circle-fill text-danger"></i>
                                              </button>
                                            </div>
                                          );
                                        })}

                                        {/* Wildcard indicator if wildcard is active */}
                                        {allowsAll && (
                                          <div
                                            className="p-2 rounded-2 border border-dashed d-inline-flex align-items-center gap-2 shadow-sm"
                                            style={{ backgroundColor: '#f5f3ff', borderColor: '#a78bfa', color: '#4c1d95', fontSize: '0.80rem' }}
                                            title="Wildcard (*) allows this client to discover and import any other phone number from their Meta account"
                                          >
                                            <i className="bi bi-asterisk text-primary fs-6"></i>
                                            <div>
                                              <div className="fw-bold lh-1">Any Meta Number Allowed</div>
                                              <div className="small text-muted" style={{ fontSize: '0.68rem' }}>
                                                Wildcard (*) active
                                              </div>
                                            </div>
                                            <span className="badge bg-primary text-white ms-1" style={{ fontSize: '0.65rem' }}>
                                              WILDCARD (*)
                                            </span>
                                            <button
                                              type="button"
                                              className="btn btn-outline-danger btn-xs py-0 px-1 border-0 ms-1"
                                              style={{ fontSize: '0.78rem', lineHeight: '1', borderRadius: '4px' }}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (window.confirm(`Remove Wildcard (*) rule for ${biz.name}? Only specific pre-approved numbers will be allowed.`)) {
                                                  handleQuickRemoveWildcard(biz);
                                                }
                                              }}
                                              disabled={savingAllowedNumbers}
                                              title="Remove Wildcard (*) rule"
                                            >
                                              <i className="bi bi-x-circle-fill text-danger"></i>
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className={totalAccounts > 0 ? 'pt-2 border-top' : ''}>
                                      <div className="d-flex align-items-center justify-content-between mb-1">
                                        <span className="small text-secondary fw-semibold text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.5px' }}>
                                          <i className="bi bi-shield-slash me-1"></i>
                                          Pre-Approved for 1-Click Discovery (None)
                                        </span>
                                      </div>
                                      <div className="d-flex align-items-center gap-2">
                                        <span className="badge bg-light text-secondary border small py-1 px-2">
                                          <i className="bi bi-exclamation-triangle text-warning me-1"></i> No discovery rules set
                                        </span>
                                        <button
                                          type="button"
                                          className="btn btn-outline-primary btn-xs py-0 px-2"
                                          style={{ fontSize: '0.70rem' }}
                                          onClick={() => setSelectedClientDetail(biz)}
                                        >
                                          <i className="bi bi-plus-circle me-1"></i> Configure Pre-Approved
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>

                            <td>
                              <div>
                                <span className="fw-bold">{totalAccounts}</span> Allotted
                              </div>
                              <div className="small d-flex gap-2 mt-1">
                                <span className="text-success fw-medium">
                                  <i className="bi bi-check-circle-fill me-1"></i>{activeAccounts} Active
                                </span>
                                {deactiveAccounts > 0 && (
                                  <span className="text-danger fw-medium">
                                    <i className="bi bi-eye-slash-fill me-1"></i>{deactiveAccounts} Deactive
                                  </span>
                                )}
                              </div>
                              {biz.allowed_phone_numbers?.length > 0 && (
                                <div className="mt-1">
                                  <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1" style={{ fontSize: '0.72rem' }}>
                                    <i className="bi bi-shield-check me-1"></i>
                                    {biz.allowed_phone_numbers.includes('*') ? 'All Discovered Allowed (*)' : `${biz.allowed_phone_numbers.length} Discovery Approved`}
                                  </span>
                                </div>
                              )}
                            </td>

                            <td className="text-end">
                              <button
                                className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1 shadow-sm px-3"
                                onClick={() => setSelectedClientDetail(biz)}
                              >
                                <i className="bi bi-sliders2-vertical"></i>
                                <span>Detail & Control</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Unassigned Pool Numbers Section (if any) */}
          {matrixData.unassignedAccounts?.length > 0 && (
            <div className="cf-card mb-4 border-warning">
              <div className="cf-card-header bg-warning-subtle d-flex align-items-center justify-content-between">
                <h6 className="mb-0 text-dark fw-bold d-flex align-items-center gap-2">
                  <i className="bi bi-exclamation-triangle-fill text-warning"></i>
                  Unassigned Numbers in System Pool ({matrixData.unassignedAccounts.length})
                </h6>
                <span className="badge bg-warning text-dark">Awaiting Business Allotment</span>
              </div>
              <div className="p-3">
                <p className="small text-muted mb-3">
                  These numbers are registered in the platform database but currently not assigned to any client business. SuperAdmin can assign them below.
                </p>
                <div className="table-responsive">
                  <table className="table cf-table align-middle">
                    <thead>
                      <tr>
                        <th>Display Name & Phone</th>
                        <th>Phone ID / WABA</th>
                        <th>Quality</th>
                        <th>Allot to Client</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matrixData.unassignedAccounts.map(unacc => (
                        <tr key={unacc.id}>
                          <td>
                            <div className="fw-bold">{unacc.display_phone_number || unacc.account_name}</div>
                            <div className="small text-muted">{unacc.verified_name}</div>
                          </td>
                          <td>
                            <code className="small">{unacc.phone_number_id}</code>
                          </td>
                          <td>
                            <span className="badge bg-light text-dark border">{unacc.quality_rating || 'UNKNOWN'}</span>
                          </td>
                          <td>
                            <select
                              className="form-select form-select-sm"
                              value={poolAllotBusinessId[unacc.id] || ''}
                              onChange={(e) => setPoolAllotBusinessId(prev => ({ ...prev, [unacc.id]: e.target.value }))}
                              style={{ maxWidth: '240px' }}
                            >
                              <option value="">Select Client / Business...</option>
                              {(matrixData.businesses || []).map(b => (
                                <option key={b.id} value={b.id}>
                                  {b.owner_name ? `${b.owner_name} (${b.name})` : b.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <button
                              className="btn btn-success btn-sm d-flex align-items-center gap-1"
                              disabled={!poolAllotBusinessId[unacc.id] || reassigningAccountId === unacc.id}
                              onClick={() => handleReassignAccount(unacc.id, poolAllotBusinessId[unacc.id])}
                            >
                              {reassigningAccountId === unacc.id ? (
                                <span className="spinner-border spinner-border-sm"></span>
                              ) : (
                                <i className="bi bi-check2-circle"></i>
                              )}
                              <span>Allot Number</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CLIENT NUMBER ALLOCATION DETAIL MODAL */}
      {selectedClientDetail && (
        <div
          className="modal show d-block"
          tabIndex="-1"
          style={{ background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(5px)', zIndex: 1060 }}
        >
          <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px', overflow: 'hidden' }}>
              <div className="modal-header bg-light border-bottom py-3">
                <div className="d-flex align-items-center gap-3">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold shadow-sm"
                    style={{
                      width: '46px',
                      height: '46px',
                      backgroundColor: '#4f46e5',
                      fontSize: '1.2rem'
                    }}
                  >
                    {(selectedClientDetail.owner_name || selectedClientDetail.name || 'C').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                      <span>{selectedClientDetail.owner_name || 'Client Details'}</span>
                      {selectedClientDetail.owner_role && (
                        <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                          {selectedClientDetail.owner_role}
                        </span>
                      )}
                    </h5>
                    <div className="small text-muted">
                      <span><i className="bi bi-envelope me-1"></i>{selectedClientDetail.owner_email || 'No email'}</span>
                      <span className="mx-2">•</span>
                      <span><i className="bi bi-building me-1"></i>{selectedClientDetail.name} (Tenant #{selectedClientDetail.id})</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setSelectedClientDetail(null)}
                ></button>
              </div>

              <div className="modal-body p-4 bg-white">
                {/* Information banner on how Active/Deactive governs tenant visibility */}
                <div className="alert alert-info border-info-subtle d-flex align-items-start gap-3 mb-4 shadow-sm">
                  <i className="bi bi-shield-check fs-4 text-info mt-1"></i>
                  <div>
                    <div className="fw-bold mb-1">SuperAdmin Visibility & Approval Rules:</div>
                    <div className="small text-muted">
                      • 🟢 <strong>ACTIVE Numbers:</strong> Fully approved, visible, and selectable inside <strong>{selectedClientDetail.owner_name || selectedClientDetail.name}'s</strong> dashboard, inbox, and campaign launcher.<br />
                      • 🔴 <strong>DEACTIVE Numbers:</strong> Instantly blocked and completely hidden from this client. Even if connected via Multi-App scan, clients will NEVER see deactivated numbers.<br />
                      • 🎯 <strong>1-Click Multi-App Discovery:</strong> Meta se sare numbers fetch honge, par client ko Step 2 me sirf wahi numbers show honge jo aapne yahan Pre-Approve kiye hain!
                    </div>
                  </div>
                </div>

                {/* Pre-Approved / Allowed Numbers for 1-Click Discovery */}
                <div className="card border rounded-3 p-3 mb-4 shadow-sm" style={{ backgroundColor: '#fbfcfd' }}>
                  <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 mb-2">
                    <div>
                      <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                        <i className="bi bi-shield-lock-fill text-success"></i>
                        <span>Pre-Approved Numbers for 1-Click Discovery</span>
                        <span className="badge bg-secondary-subtle text-secondary small fw-normal">
                          {selectedClientDetail.allowed_phone_numbers?.includes('*') ? 'All Discovered Allowed (*)' : `${selectedClientDetail.allowed_phone_numbers?.length || 0} Allowed`}
                        </span>
                      </h6>
                      <div className="small text-muted">
                        When this client scans Meta, only numbers matching these approved numbers will appear in their "Select Numbers" list.
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <button
                        type="button"
                        className={`btn btn-sm ${selectedClientDetail.allowed_phone_numbers?.includes('*') ? 'btn-success' : 'btn-outline-secondary'}`}
                        onClick={() => handleToggleAllowAllNumbers(selectedClientDetail.id)}
                        disabled={savingAllowedNumbers}
                        title="Toggle whether all discovered numbers are allowed or only specific numbers"
                      >
                        <i className="bi bi-asterisk me-1"></i>
                        {selectedClientDetail.allowed_phone_numbers?.includes('*') ? 'All Numbers Allowed (*)' : 'Allow All Numbers'}
                      </button>
                      {selectedClientDetail.allowed_phone_numbers?.length > 0 && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to remove ALL pre-approved discovery rules for ${selectedClientDetail.name}?`)) {
                              saveAllowedNumbersList(selectedClientDetail.id, []);
                            }
                          }}
                          disabled={savingAllowedNumbers}
                          title="Clear all allowed discovery numbers"
                        >
                          <i className="bi bi-trash3 me-1"></i>
                          Clear All
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Badges of current allowed numbers */}
                  <div className="d-flex flex-wrap gap-2 align-items-center mb-3 pt-1">
                    {(!selectedClientDetail.allowed_phone_numbers || selectedClientDetail.allowed_phone_numbers.length === 0) ? (
                      <span className="small text-muted fst-italic">
                        <i className="bi bi-info-circle me-1"></i>
                        No specific pre-approved numbers set. (Only active already-allotted accounts below will be allowed).
                      </span>
                    ) : (
                      selectedClientDetail.allowed_phone_numbers.map((num, idx) => (
                        <span
                          key={idx}
                          className={`badge border px-3 py-2 d-flex align-items-center gap-2 font-monospace fs-6 ${
                            num === '*'
                              ? 'bg-success-subtle text-success border-success-subtle'
                              : 'bg-primary-subtle text-primary border-primary-subtle'
                          }`}
                        >
                          <i className="bi bi-whatsapp"></i>
                          <span>{num === '*' ? 'ALL META NUMBERS (*)' : num}</span>
                          <button
                            type="button"
                            className="btn-close btn-close-xs ms-1"
                            style={{ fontSize: '0.65rem' }}
                            onClick={() => handleRemoveAllowedNumber(selectedClientDetail.id, num)}
                            disabled={savingAllowedNumbers}
                            title="Remove from allowed list"
                          ></button>
                        </span>
                      ))
                    )}
                  </div>

                  {/* Input to add a new allowed number */}
                  <div className="d-flex flex-column flex-sm-row align-items-sm-center gap-2">
                    <div className="input-group input-group-sm" style={{ maxWidth: '380px' }}>
                      <span className="input-group-text bg-white">
                        <i className="bi bi-telephone-plus text-primary"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. +91 86014 67210 or 8601467210"
                        value={newAllowedNumberInput}
                        onChange={(e) => setNewAllowedNumberInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddAllowedNumber(selectedClientDetail.id);
                          }
                        }}
                        disabled={savingAllowedNumbers}
                      />
                      <button
                        className="btn btn-primary fw-semibold"
                        type="button"
                        onClick={() => handleAddAllowedNumber(selectedClientDetail.id)}
                        disabled={savingAllowedNumbers || !newAllowedNumberInput.trim()}
                      >
                        {savingAllowedNumbers ? (
                          <span className="spinner-border spinner-border-sm"></span>
                        ) : (
                          <>
                            <i className="bi bi-plus-lg me-1"></i>
                            Approve
                          </>
                        )}
                      </button>
                    </div>
                    <span className="small text-muted" style={{ fontSize: '0.75rem' }}>
                      Tip: Enter with or without country code (+91). Exact or last-10-digits will match.
                    </span>
                  </div>

                  {/* Quick 1-click approve suggestions from client's WhatsApp numbers */}
                  {selectedClientDetail.whatsapp_accounts?.length > 0 && (
                    <div className="mt-3 pt-3 border-top">
                      <div className="small text-muted mb-2 fw-semibold d-flex align-items-center gap-1" style={{ fontSize: '0.75rem' }}>
                        <i className="bi bi-lightning-charge-fill text-warning"></i>
                        <span>1-Click Approve Client's Existing WhatsApp Numbers:</span>
                      </div>
                      <div className="d-flex flex-wrap gap-2">
                        {selectedClientDetail.whatsapp_accounts.map(acc => {
                          const rawPhone = acc.display_phone_number || acc.phone_number;
                          if (!rawPhone) return null;
                          const cleanAcc = String(rawPhone).replace(/\D/g, '').slice(-10);
                          const isAlreadyApproved = (selectedClientDetail.allowed_phone_numbers || []).some(n =>
                            String(n).replace(/\D/g, '').slice(-10) === cleanAcc
                          );

                          return (
                            <div key={acc.id} className="btn-group btn-group-sm" role="group">
                              <button
                                type="button"
                                className={`btn btn-xs py-1 px-2 font-monospace d-inline-flex align-items-center gap-1 ${
                                  isAlreadyApproved ? 'btn-success' : 'btn-outline-primary'
                                }`}
                                style={{ fontSize: '0.75rem' }}
                                disabled={savingAllowedNumbers || isAlreadyApproved}
                                onClick={async () => {
                                  const currentList = selectedClientDetail?.allowed_phone_numbers || [];
                                  const updatedList = [...currentList, rawPhone];
                                  await saveAllowedNumbersList(selectedClientDetail.id, updatedList);
                                }}
                                title={isAlreadyApproved ? 'Number is pre-approved' : `Add ${rawPhone} to approved list`}
                              >
                                <i className={`bi ${isAlreadyApproved ? 'bi-check-circle-fill' : 'bi-plus-circle'}`}></i>
                                <span>{rawPhone}</span>
                                <span className="small opacity-75 ms-1">({acc.verified_name || acc.account_name})</span>
                                {isAlreadyApproved && <span className="badge bg-white text-success ms-1 small">Approved</span>}
                              </button>
                              {isAlreadyApproved && (
                                <button
                                  type="button"
                                  className="btn btn-xs btn-outline-danger py-1 px-2"
                                  style={{ fontSize: '0.75rem' }}
                                  disabled={savingAllowedNumbers}
                                  onClick={() => handleRemoveAllowedNumber(selectedClientDetail.id, rawPhone)}
                                  title={`Remove ${rawPhone} from approved list`}
                                >
                                  <i className="bi bi-x-lg"></i>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="d-flex align-items-center justify-content-between mb-3">
                  <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                    <i className="bi bi-phone text-primary"></i>
                    Allotted WhatsApp Numbers ({selectedClientDetail.whatsapp_accounts?.length || 0})
                  </h6>
                  <button
                    className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                    onClick={fetchMatrixData}
                    disabled={loadingMatrix}
                  >
                    <i className="bi bi-arrow-clockwise"></i>
                    <span>Refresh</span>
                  </button>
                </div>

                {(!selectedClientDetail.whatsapp_accounts || selectedClientDetail.whatsapp_accounts.length === 0) ? (
                  <div className="text-center py-5 bg-light rounded-3 border">
                    <i className="bi bi-whatsapp fs-1 text-muted"></i>
                    <p className="mt-2 text-muted fw-medium">No WhatsApp numbers are currently allotted to this client.</p>
                  </div>
                ) : (
                  <div className="table-responsive border rounded-3">
                    <table className="table table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Number & Verified Name</th>
                          <th>IDs (Phone / WABA)</th>
                          <th>Quality & Status</th>
                          <th>Visibility Status</th>
                          <th>Toggle Active / Deactive</th>
                          <th>Reassign / Transfer</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedClientDetail.whatsapp_accounts.map(acc => {
                          const isDeactive = acc.admin_status === 'DEACTIVE';
                          const isToggling = togglingAccountId === acc.id;
                          const isReassigning = reassigningAccountId === acc.id;

                          return (
                            <tr key={acc.id} className={isDeactive ? 'table-danger-subtle' : ''}>
                              <td>
                                <div className="fw-bold text-dark d-flex align-items-center gap-2 flex-wrap">
                                  <i className={`bi ${isDeactive ? 'bi-slash-circle text-danger' : 'bi-whatsapp text-success'}`}></i>
                                  <span>{acc.display_phone_number || acc.account_name}</span>
                                  {((selectedClientDetail.allowed_phone_numbers || []).includes('*') ||
                                    (selectedClientDetail.allowed_phone_numbers || []).some(n =>
                                      String(n).replace(/\D/g, '').slice(-10) === String(acc.display_phone_number || '').replace(/\D/g, '').slice(-10)
                                    )) && (
                                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle" style={{ fontSize: '0.68rem' }} title="Pre-Approved for 1-Click Multi-App Discovery">
                                      <i className="bi bi-shield-check me-1"></i> 1-Click Approved
                                    </span>
                                  )}
                                </div>
                                <div className="small text-muted">{acc.verified_name || acc.account_name}</div>
                              </td>

                              <td>
                                <div className="small">
                                  <span className="text-muted">PID: </span>
                                  <code>{acc.phone_number_id || '—'}</code>
                                </div>
                                <div className="small">
                                  <span className="text-muted">WABA: </span>
                                  <code>{acc.waba_id}</code>
                                </div>
                              </td>

                              <td>
                                <div>
                                  <span className={`badge ${
                                    acc.quality_rating === 'GREEN' ? 'bg-success-subtle text-success' :
                                    acc.quality_rating === 'YELLOW' ? 'bg-warning-subtle text-warning' :
                                    acc.quality_rating === 'RED' ? 'bg-danger-subtle text-danger' :
                                    'bg-light text-muted'
                                  }`}>
                                    {acc.quality_rating || 'UNKNOWN'}
                                  </span>
                                </div>
                                <div className="small text-muted mt-1">{acc.status}</div>
                              </td>

                              <td>
                                {isDeactive ? (
                                  <span className="badge bg-danger text-white px-2 py-1 shadow-sm">
                                    <i className="bi bi-eye-slash-fill me-1"></i> DEACTIVE (Hidden)
                                  </span>
                                ) : (
                                  <span className="badge bg-success text-white px-2 py-1 shadow-sm">
                                    <i className="bi bi-check-circle-fill me-1"></i> ACTIVE (Visible)
                                  </span>
                                )}
                              </td>

                              <td>
                                {isDeactive ? (
                                  <button
                                    className="btn btn-success btn-sm d-flex align-items-center gap-1 shadow-sm px-3"
                                    onClick={() => handleToggleAdminStatus(acc.id, 'ACTIVE')}
                                    disabled={isToggling}
                                    title="Make this number active and visible in client panel"
                                  >
                                    {isToggling ? (
                                      <span className="spinner-border spinner-border-sm"></span>
                                    ) : (
                                      <i className="bi bi-play-circle-fill"></i>
                                    )}
                                    <span>Make Active</span>
                                  </button>
                                ) : (
                                  <button
                                    className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1 shadow-sm px-3"
                                    onClick={() => handleToggleAdminStatus(acc.id, 'DEACTIVE')}
                                    disabled={isToggling}
                                    title="Deactivate and instantly hide this number from client"
                                  >
                                    {isToggling ? (
                                      <span className="spinner-border spinner-border-sm"></span>
                                    ) : (
                                      <i className="bi bi-pause-circle-fill"></i>
                                    )}
                                    <span>Deactivate</span>
                                  </button>
                                )}
                              </td>

                              <td>
                                <div className="d-flex align-items-center gap-1">
                                  <select
                                    className="form-select form-select-sm"
                                    style={{ width: '170px' }}
                                    value={targetBusinessMap[acc.id] || ''}
                                    onChange={(e) => setTargetBusinessMap(prev => ({ ...prev, [acc.id]: e.target.value }))}
                                  >
                                    <option value="">Transfer to...</option>
                                    <option value="unassign">⚠️ Unassign Number</option>
                                    {(matrixData.businesses || [])
                                      .filter(b => b.id !== selectedClientDetail.id)
                                      .map(b => (
                                        <option key={b.id} value={b.id}>
                                          {b.owner_name ? `${b.owner_name} (${b.name})` : b.name}
                                        </option>
                                      ))}
                                  </select>
                                  <button
                                    className="btn btn-outline-secondary btn-sm"
                                    disabled={!targetBusinessMap[acc.id] || isReassigning}
                                    onClick={() => handleReassignAccount(
                                      acc.id,
                                      targetBusinessMap[acc.id] === 'unassign' ? null : targetBusinessMap[acc.id]
                                    )}
                                    title="Execute transfer"
                                  >
                                    {isReassigning ? (
                                      <span className="spinner-border spinner-border-sm"></span>
                                    ) : (
                                      <i className="bi bi-arrow-right-short"></i>
                                    )}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pool Allocation inside Modal */}
                {matrixData.unassignedAccounts?.length > 0 && (
                  <div className="mt-4 p-3 bg-light rounded-3 border">
                    <h6 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
                      <i className="bi bi-plus-circle-fill text-success"></i>
                      Allot an Unassigned Pool Number to {selectedClientDetail.owner_name || selectedClientDetail.name}
                    </h6>
                    <div className="d-flex flex-wrap gap-2">
                      {matrixData.unassignedAccounts.map(unacc => (
                        <button
                          key={unacc.id}
                          className="btn btn-outline-primary btn-sm d-flex align-items-center gap-2"
                          disabled={reassigningAccountId === unacc.id}
                          onClick={() => handleReassignAccount(unacc.id, selectedClientDetail.id)}
                        >
                          <i className="bi bi-plus-lg"></i>
                          <span>{unacc.display_phone_number || unacc.account_name}</span>
                          <span className="badge bg-secondary">{unacc.verified_name || 'Pool'}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer bg-light py-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm px-4"
                  onClick={() => setSelectedClientDetail(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
