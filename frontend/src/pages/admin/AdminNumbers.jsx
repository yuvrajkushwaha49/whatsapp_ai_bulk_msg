import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../services/api';
import AiwavoHeader from '../../components/AiwavoHeader';

export default function AdminNumbers() {
  const { onToggleSidebar } = useOutletContext() || {};

  const [matrixData, setMatrixData] = useState({ businesses: [], unassignedAccounts: [] });
  const [loading, setLoading] = useState(true);
  const [matrixSearch, setMatrixSearch] = useState('');
  const [selectedClientDetail, setSelectedClientDetail] = useState(null);
  const [togglingAccountId, setTogglingAccountId] = useState(null);
  const [reassigningAccountId, setReassigningAccountId] = useState(null);
  const [targetBusinessMap, setTargetBusinessMap] = useState({});
  const [newAllowedNumberInput, setNewAllowedNumberInput] = useState('');
  const [savingAllowedNumbers, setSavingAllowedNumbers] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const fetchMatrixData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/number-allocation-matrix');
      if (res.data?.success) {
        setMatrixData(res.data.data);
        setSelectedClientDetail(prev => {
          if (!prev) return null;
          return res.data.data.businesses.find(b => b.id === prev.id) || prev;
        });
      }
    } catch (err) {
      console.error('Failed to load matrix data', err);
      setFeedback({ type: 'danger', text: 'Failed to load number allocation matrix' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatrixData();
  }, []);

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

        // Instant local state update
        setSelectedClientDetail(prev => {
          if (!prev) return null;
          const updateAccs = (accs) => (accs || []).map(a => a.id === accountId ? { ...a, admin_status: newStatus } : a);
          return {
            ...prev,
            whatsapp_accounts: updateAccs(prev.whatsapp_accounts),
            accounts: updateAccs(prev.accounts)
          };
        });

        await fetchMatrixData();
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
    try {
      setSavingAllowedNumbers(true);
      const biz = matrixData.businesses.find(b => b.id === bizId);
      const currentList = Array.isArray(biz?.allowed_phone_numbers) ? [...biz.allowed_phone_numbers] : [];
      const cleanNum = newAllowedNumberInput.trim();

      if (!currentList.includes(cleanNum)) {
        currentList.push(cleanNum);
      }

      const res = await api.patch(`/admin/businesses/${bizId}/allowed-numbers`, {
        allowedNumbers: currentList
      });

      if (res.data?.success) {
        setFeedback({
          type: 'success',
          text: `Number ${cleanNum} pre-approved for 1-Click Discovery!`
        });
        setNewAllowedNumberInput('');
        await fetchMatrixData();
      }
    } catch (err) {
      setFeedback({
        type: 'danger',
        text: err.response?.data?.message || 'Failed to update pre-approved numbers'
      });
    } finally {
      setSavingAllowedNumbers(false);
    }
  };

  const handleRemoveAllowedNumber = async (bizId, numToRemove) => {
    try {
      setSavingAllowedNumbers(true);
      const biz = matrixData.businesses.find(b => b.id === bizId);
      const currentList = (biz?.allowed_phone_numbers || []).filter(n => n !== numToRemove);

      const res = await api.patch(`/admin/businesses/${bizId}/allowed-numbers`, {
        allowedNumbers: currentList
      });

      if (res.data?.success) {
        setFeedback({
          type: 'success',
          text: `Removed ${numToRemove} from pre-approved discovery list`
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

  return (
    <div>
      <AiwavoHeader
        title="Number Allocation & Approval Matrix"
        subtitle="Manage Multi-Tenant WhatsApp Business Phone Numbers, Visibility & Allocation"
        onToggleSidebar={onToggleSidebar}
      />

      <div className="p-4">
        {feedback.text && (
          <div className={`alert alert-${feedback.type} alert-dismissible fade show mb-4 shadow-sm`} role="alert">
            {feedback.text}
            <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
          </div>
        )}

        {/* Summary KPI Cards */}
        <div className="row g-3 mb-4">
          <div className="col-12 col-sm-6 col-xl-3">
            <div className="stat-card">
              <div className="stat-icon-wrapper stat-icon-blue">
                <i className="bi bi-people-fill"></i>
              </div>
              <div>
                <div className="stat-label">Total Clients</div>
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
              <h5 className="mb-1 d-flex align-items-center gap-2 fw-bold">
                <i className="bi bi-diagram-3-fill text-primary"></i>
                <span>Client Number Allocation & Approval Matrix</span>
              </h5>
              <p className="text-muted small mb-0">
                SuperAdmin controls which WhatsApp numbers each client can see and use. Open the Detail modal to activate, deactivate, or reassign numbers.
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
                disabled={loading}
              >
                <i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''}`}></i>
                <span>Refresh</span>
              </button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table cf-table align-middle">
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Client & Business</th>
                  <th style={{ width: '43%' }}>Allotted WhatsApp Numbers</th>
                  <th style={{ width: '16%' }}>Allocation Status</th>
                  <th style={{ width: '16%' }} className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
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
                      return (
                        (b.owner_name || '').toLowerCase().includes(q) ||
                        (b.owner_email || '').toLowerCase().includes(q) ||
                        (b.name || '').toLowerCase().includes(q) ||
                        (b.whatsapp_accounts || []).some(wa =>
                          (wa.display_phone_number || '').toLowerCase().includes(q) ||
                          (wa.account_name || '').toLowerCase().includes(q)
                        )
                      );
                    })
                    .map(biz => {
                      const totalAccounts = biz.whatsapp_accounts?.length || 0;
                      const activeAccounts = (biz.whatsapp_accounts || []).filter(a => a.admin_status !== 'DEACTIVE').length;

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
                                <div className="small text-muted">{biz.name} ({biz.slug})</div>
                                <div className="small text-muted" style={{ fontSize: '0.75rem' }}>
                                  <i className="bi bi-envelope me-1"></i>{biz.owner_email || 'No Email'}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td>
                            <div className="d-flex flex-wrap gap-2 align-items-center">
                              {totalAccounts === 0 ? (
                                <span className="badge bg-light text-muted border py-2 px-3">
                                  <i className="bi bi-exclamation-circle me-1"></i> No Numbers Allotted
                                </span>
                              ) : (
                                (biz.whatsapp_accounts || []).map(acc => {
                                  const isDeactive = acc.admin_status === 'DEACTIVE';
                                  return (
                                    <span
                                      key={acc.id}
                                      className={`badge px-2 py-1 d-inline-flex align-items-center gap-1 border ${
                                        isDeactive
                                          ? 'bg-danger-subtle text-danger border-danger'
                                          : 'bg-success-subtle text-success border-success'
                                      }`}
                                      style={{ fontSize: '0.8rem' }}
                                    >
                                      <i className={`bi ${isDeactive ? 'bi-eye-slash-fill' : 'bi-check-circle-fill'}`}></i>
                                      <span>{acc.display_phone_number || acc.account_name}</span>
                                      {acc.verified_name && (
                                        <small className="opacity-75">({acc.verified_name})</small>
                                      )}
                                      <span className="ms-1 fw-bold" style={{ fontSize: '0.65rem' }}>
                                        {isDeactive ? 'DEACTIVE' : 'ACTIVE'}
                                      </span>
                                    </span>
                                  );
                                })
                              )}
                            </div>
                          </td>

                          <td>
                            <div className="d-flex flex-column gap-1">
                              <span className="badge bg-light text-dark border">
                                {totalAccounts} Total Allotted
                              </span>
                              <span className="small text-success">
                                <i className="bi bi-dot"></i>{activeAccounts} Active & Visible
                              </span>
                            </div>
                          </td>

                          <td className="text-end">
                            <button
                              className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1 shadow-xs"
                              onClick={() => setSelectedClientDetail(biz)}
                            >
                              <i className="bi bi-sliders"></i>
                              <span>Manage Allocation</span>
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

        {/* Unassigned Pool Section */}
        {matrixData.unassignedAccounts?.length > 0 && (
          <div className="cf-card mb-4 border-warning">
            <div className="cf-card-header bg-warning bg-opacity-10 d-flex justify-content-between align-items-center">
              <h6 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2">
                <i className="bi bi-inbox-fill text-warning"></i>
                <span>Platform Number Pool ({matrixData.unassignedAccounts.length} Unassigned Numbers)</span>
              </h6>
              <span className="badge bg-warning text-dark">Available to Allot</span>
            </div>
            <div className="cf-card-body">
              <p className="text-muted small">
                These WhatsApp accounts are connected to the platform but currently not allotted to any client tenant.
              </p>
              <div className="table-responsive">
                <table className="table table-sm align-middle">
                  <thead>
                    <tr>
                      <th>Account Name</th>
                      <th>Phone Number</th>
                      <th>Verified Name</th>
                      <th>Allot to Tenant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrixData.unassignedAccounts.map(acc => (
                      <tr key={acc.id}>
                        <td className="fw-semibold">{acc.account_name}</td>
                        <td><code>{acc.display_phone_number || acc.phone_number}</code></td>
                        <td>{acc.verified_name || 'N/A'}</td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <select
                              className="form-select form-select-sm"
                              style={{ maxWidth: 220 }}
                              value={targetBusinessMap[acc.id] || ''}
                              onChange={(e) => setTargetBusinessMap(prev => ({ ...prev, [acc.id]: e.target.value }))}
                            >
                              <option value="">Select Tenant...</option>
                              {(matrixData.businesses || []).map(b => (
                                <option key={b.id} value={b.id}>
                                  {b.owner_name ? `${b.owner_name} (${b.name})` : b.name}
                                </option>
                              ))}
                            </select>
                            <button
                              className="btn btn-primary btn-sm"
                              disabled={!targetBusinessMap[acc.id] || reassigningAccountId === acc.id}
                              onClick={() => handleReassignAccount(acc.id, targetBusinessMap[acc.id])}
                            >
                              {reassigningAccountId === acc.id ? 'Allotting...' : 'Allot Number'}
                            </button>
                          </div>
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

      {/* Client Detail Modal */}
      {selectedClientDetail && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered modal-xl">
            <div className="modal-content shadow-lg border-0 rounded-4 overflow-hidden">
              <div className="modal-header bg-primary text-white py-3 px-4">
                <div className="d-flex align-items-center gap-3">
                  <div
                    className="rounded-circle bg-white text-primary fw-bold d-flex align-items-center justify-content-center"
                    style={{ width: '42px', height: '42px' }}
                  >
                    {(selectedClientDetail.owner_name || selectedClientDetail.name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold mb-0">
                      Manage Numbers for {selectedClientDetail.owner_name || selectedClientDetail.name}
                    </h5>
                    <div className="small text-white-50">
                      Company: {selectedClientDetail.name} ({selectedClientDetail.slug}) • {selectedClientDetail.owner_email}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setSelectedClientDetail(null)}
                ></button>
              </div>

              <div className="modal-body p-4">
                <h6 className="fw-bold text-dark mb-3">Allotted WhatsApp Numbers</h6>
                {(!selectedClientDetail.whatsapp_accounts || selectedClientDetail.whatsapp_accounts.length === 0) ? (
                  <div className="alert alert-light border text-center py-4">
                    No WhatsApp numbers are currently allotted to this business.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-bordered align-middle">
                      <thead className="table-light">
                        <tr>
                          <th>Number / Name</th>
                          <th>Verified Name</th>
                          <th>Status</th>
                          <th>Toggle Visibility</th>
                          <th>Transfer Number</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedClientDetail.whatsapp_accounts.map(acc => {
                          const isDeactive = acc.admin_status === 'DEACTIVE';
                          const isToggling = togglingAccountId === acc.id;
                          return (
                            <tr key={acc.id}>
                              <td>
                                <div className="fw-bold">{acc.display_phone_number || acc.account_name}</div>
                                <code className="small text-muted">{acc.phone_number_id || acc.id}</code>
                              </td>
                              <td>{acc.verified_name || 'N/A'}</td>
                              <td>
                                <span className={`badge ${isDeactive ? 'bg-danger' : 'bg-success'}`}>
                                  {isDeactive ? 'DEACTIVE (Hidden)' : 'ACTIVE (Visible)'}
                                </span>
                              </td>
                              <td>
                                <button
                                  className={`btn btn-sm ${isDeactive ? 'btn-success' : 'btn-outline-danger'}`}
                                  disabled={isToggling}
                                  onClick={() => handleToggleAdminStatus(acc.id, isDeactive ? 'ACTIVE' : 'DEACTIVE')}
                                >
                                  {isToggling ? 'Updating...' : isDeactive ? 'Make Active' : 'Deactivate'}
                                </button>
                              </td>
                              <td>
                                <div className="d-flex align-items-center gap-1">
                                  <select
                                    className="form-select form-select-sm"
                                    style={{ width: 170 }}
                                    value={targetBusinessMap[acc.id] || ''}
                                    onChange={(e) => setTargetBusinessMap(prev => ({ ...prev, [acc.id]: e.target.value }))}
                                  >
                                    <option value="">Transfer to...</option>
                                    <option value="unassign">Unassign to Pool</option>
                                    {(matrixData.businesses || [])
                                      .filter(b => b.id !== selectedClientDetail.id)
                                      .map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                      ))}
                                  </select>
                                  <button
                                    className="btn btn-outline-secondary btn-sm"
                                    disabled={!targetBusinessMap[acc.id] || reassigningAccountId === acc.id}
                                    onClick={() => handleReassignAccount(
                                      acc.id,
                                      targetBusinessMap[acc.id] === 'unassign' ? null : targetBusinessMap[acc.id]
                                    )}
                                  >
                                    Transfer
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

                {/* Pre-approved numbers editor */}
                <div className="mt-4 p-3 bg-light rounded-3 border">
                  <h6 className="fw-bold text-dark mb-2">Pre-Approved Discovery Numbers</h6>
                  <p className="text-muted small mb-3">
                    Allow this client to automatically connect these phone numbers via 1-Click Discovery.
                  </p>
                  <div className="d-flex flex-wrap gap-2 mb-3">
                    {(selectedClientDetail.allowed_phone_numbers || []).map((num, i) => (
                      <span key={i} className="badge bg-white text-dark border px-2 py-1 d-flex align-items-center gap-1">
                        <code>{num}</code>
                        <button
                          type="button"
                          className="btn-close btn-close-sm"
                          style={{ fontSize: '0.6rem' }}
                          onClick={() => handleRemoveAllowedNumber(selectedClientDetail.id, num)}
                        ></button>
                      </span>
                    ))}
                  </div>

                  <div className="input-group input-group-sm" style={{ maxWidth: 350 }}>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. +91 98765 43210 or *"
                      value={newAllowedNumberInput}
                      onChange={(e) => setNewAllowedNumberInput(e.target.value)}
                    />
                    <button
                      className="btn btn-primary"
                      disabled={savingAllowedNumbers || !newAllowedNumberInput.trim()}
                      onClick={() => handleAddAllowedNumber(selectedClientDetail.id)}
                    >
                      {savingAllowedNumbers ? 'Saving...' : 'Add Allowed Number'}
                    </button>
                  </div>
                </div>
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
