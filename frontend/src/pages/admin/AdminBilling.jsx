import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../services/api';
import AiwavoHeader from '../../components/AiwavoHeader';

export default function AdminBilling() {
  const { onToggleSidebar } = useOutletContext() || {};

  const [tenants, setTenants] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Plan Change Modal
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [targetPlanId, setTargetPlanId] = useState('');
  const [savingPlan, setSavingPlan] = useState(false);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      const [tenantsRes, plansRes] = await Promise.all([
        api.get('/admin/billing/tenants'),
        api.get('/admin/billing/plans')
      ]);

      if (tenantsRes.data?.success) setTenants(tenantsRes.data.data);
      if (plansRes.data?.success) setPlans(plansRes.data.data);
    } catch (err) {
      console.error('Failed to load admin billing data', err);
      setFeedback({ type: 'danger', text: 'Failed to load billing and subscription data' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingData();
  }, []);

  const handleOpenPlanModal = (tenant) => {
    setSelectedTenant(tenant);
    setTargetPlanId(String(tenant.plan_id || 1));
  };

  const handleSavePlanChange = async (e) => {
    e.preventDefault();
    if (!selectedTenant || !targetPlanId) return;

    setSavingPlan(true);
    try {
      const res = await api.patch(`/admin/billing/tenants/${selectedTenant.business_id}/plan`, {
        planId: Number(targetPlanId)
      });

      if (res.data?.success) {
        const newPlan = plans.find(p => p.id === Number(targetPlanId));
        setFeedback({
          type: 'success',
          text: `Plan for "${selectedTenant.business_name}" updated to "${newPlan?.name || targetPlanId}"!`
        });
        setSelectedTenant(null);
        await fetchBillingData();
      }
    } catch (err) {
      setFeedback({
        type: 'danger',
        text: err.response?.data?.message || 'Failed to update tenant plan'
      });
    } finally {
      setSavingPlan(false);
    }
  };

  const totalMonthlyMRR = tenants.reduce((sum, t) => sum + (t.status === 'active' ? Number(t.monthly_price || 0) : 0), 0);

  return (
    <div>
      <AiwavoHeader
        title="Global Billing & Subscription Control"
        subtitle="Manage Multi-Tenant Pricing Plans, Client Quotas, and Upgrades"
        onToggleSidebar={onToggleSidebar}
      />

      <div className="p-4">
        {feedback.text && (
          <div className={`alert alert-${feedback.type} alert-dismissible fade show mb-4 shadow-sm`} role="alert">
            {feedback.text}
            <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
          </div>
        )}

        {/* Financial KPI Summary */}
        <div className="row g-3 mb-4">
          <div className="col-12 col-sm-6 col-xl-3">
            <div className="stat-card">
              <div className="stat-icon-wrapper stat-icon-green">
                <i className="bi bi-cash-stack"></i>
              </div>
              <div>
                <div className="stat-label">Estimated Monthly MRR</div>
                <div className="stat-value">${totalMonthlyMRR.toFixed(2)}</div>
                <div className="small text-success">From active paid subscriptions</div>
              </div>
            </div>
          </div>

          <div className="col-12 col-sm-6 col-xl-3">
            <div className="stat-card">
              <div className="stat-icon-wrapper stat-icon-blue">
                <i className="bi bi-buildings"></i>
              </div>
              <div>
                <div className="stat-label">Total Subscriptions</div>
                <div className="stat-value">{tenants.length}</div>
                <div className="small text-muted">{tenants.filter(t => Number(t.monthly_price) > 0).length} Paid Tenants</div>
              </div>
            </div>
          </div>

          <div className="col-12 col-sm-6 col-xl-3">
            <div className="stat-card">
              <div className="stat-icon-wrapper stat-icon-purple">
                <i className="bi bi-layers-fill"></i>
              </div>
              <div>
                <div className="stat-label">Available SaaS Plans</div>
                <div className="stat-value">{plans.length} Tiers</div>
                <div className="small text-muted">Free, Starter, Pro, Enterprise</div>
              </div>
            </div>
          </div>

          <div className="col-12 col-sm-6 col-xl-3">
            <div className="stat-card">
              <div className="stat-icon-wrapper stat-icon-orange">
                <i className="bi bi-gift-fill"></i>
              </div>
              <div>
                <div className="stat-label">Free Trials</div>
                <div className="stat-value">{tenants.filter(t => t.plan_name === 'Free Trial').length}</div>
                <div className="small text-muted">Eligible for upgrades</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tenant Subscriptions Table */}
        <div className="cf-card mb-4">
          <div className="cf-card-header d-flex justify-content-between align-items-center">
            <div>
              <h5 className="mb-0 fw-bold">Client Subscriptions Directory</h5>
              <small className="text-muted">Directly inspect or adjust subscription tiers for each registered business tenant</small>
            </div>
            <button
              onClick={fetchBillingData}
              className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
            >
              <i className="bi bi-arrow-clockwise"></i>
              <span>Refresh</span>
            </button>
          </div>

          <div className="table-responsive">
            <table className="table cf-table align-middle">
              <thead>
                <tr>
                  <th>Client / Tenant</th>
                  <th>Primary Owner</th>
                  <th>Current Plan</th>
                  <th>Price / Month</th>
                  <th>Message Limit</th>
                  <th>Contact Limit</th>
                  <th>Status</th>
                  <th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" className="text-center py-5">
                      <div className="spinner-border text-primary" role="status"></div>
                    </td>
                  </tr>
                ) : tenants.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-5 text-muted">
                      No tenants registered.
                    </td>
                  </tr>
                ) : (
                  tenants.map(t => (
                    <tr key={t.business_id}>
                      <td>
                        <div className="fw-bold text-dark">{t.business_name}</div>
                        <code className="small text-muted">{t.business_slug}</code>
                      </td>
                      <td>
                        <div className="fw-semibold text-dark small">{t.owner_name || 'N/A'}</div>
                        <div className="small text-muted">{t.owner_email || 'N/A'}</div>
                      </td>
                      <td>
                        <span className={`badge ${
                          t.plan_name.includes('Enterprise') ? 'bg-danger-subtle text-danger' :
                          t.plan_name.includes('Pro') ? 'bg-primary-subtle text-primary' :
                          t.plan_name.includes('Starter') ? 'bg-success-subtle text-success' :
                          'bg-secondary-subtle text-secondary'
                        } fw-bold px-2 py-1`}>
                          {t.plan_name}
                        </span>
                      </td>
                      <td>
                        <span className="fw-bold text-dark">
                          ${Number(t.monthly_price).toFixed(2)}
                        </span>
                        <span className="text-muted small">/mo</span>
                      </td>
                      <td>
                        <span className="small text-muted">
                          {Number(t.max_messages_per_month).toLocaleString()} msgs/mo
                        </span>
                      </td>
                      <td>
                        <span className="small text-muted">
                          {Number(t.max_contacts).toLocaleString()} contacts
                        </span>
                      </td>
                      <td>
                        <span className={`badge-status badge-${t.status === 'active' ? 'active' : 'suspended'}`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="text-end">
                        <button
                          className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1 shadow-xs"
                          onClick={() => handleOpenPlanModal(t)}
                        >
                          <i className="bi bi-pencil-square"></i>
                          <span>Change Plan</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Platform Subscription Plans Matrix */}
        <div className="cf-card mb-4">
          <div className="cf-card-header">
            <h5 className="mb-0 fw-bold">Platform SaaS Plan Tiers & Quota Limits</h5>
            <small className="text-muted">Standard subscription tiers offered to all clients across the platform</small>
          </div>
          <div className="cf-card-body p-0">
            <div className="table-responsive">
              <table className="table table-bordered mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th>Plan Name</th>
                    <th>Slug</th>
                    <th>Price</th>
                    <th>Max Contacts</th>
                    <th>Messages / Month</th>
                    <th>Team Members</th>
                    <th>Active</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map(p => (
                    <tr key={p.id}>
                      <td className="fw-bold text-primary">{p.name}</td>
                      <td><code>{p.slug}</code></td>
                      <td className="fw-bold">${Number(p.monthly_price).toFixed(2)}/mo</td>
                      <td>{Number(p.max_contacts).toLocaleString()}</td>
                      <td>{Number(p.max_messages_per_month).toLocaleString()}</td>
                      <td>{p.max_team_members} Users</td>
                      <td>
                        <span className={`badge ${p.is_active ? 'bg-success' : 'bg-secondary'}`}>
                          {p.is_active ? 'Active Tier' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Change Tenant Plan */}
      {selectedTenant && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0 rounded-4 overflow-hidden">
              <div className="modal-header bg-primary text-white py-3 px-4">
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-credit-card-2-front-fill fs-5"></i>
                  <h5 className="modal-title fw-bold mb-0">Modify Tenant Subscription</h5>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  disabled={savingPlan}
                  onClick={() => setSelectedTenant(null)}
                ></button>
              </div>

              <form onSubmit={handleSavePlanChange}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label small text-muted fw-bold">Client / Business</label>
                    <div className="form-control bg-light fw-bold text-dark">
                      {selectedTenant.business_name} ({selectedTenant.business_slug})
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small text-muted fw-bold">Current Active Plan</label>
                    <div className="form-control bg-light">
                      <span className="badge bg-secondary me-2">{selectedTenant.plan_name}</span>
                      <span className="text-muted small">${Number(selectedTenant.monthly_price).toFixed(2)}/mo</span>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small text-muted fw-bold">Select New Subscription Plan <span className="text-danger">*</span></label>
                    <select
                      className="form-select"
                      value={targetPlanId}
                      onChange={(e) => setTargetPlanId(e.target.value)}
                      disabled={savingPlan}
                      required
                    >
                      {plans.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} — ${Number(p.monthly_price).toFixed(2)}/mo ({Number(p.max_messages_per_month).toLocaleString()} msgs)
                        </option>
                      ))}
                    </select>
                    <div className="form-text small">
                      Upgrading or downgrading will immediately update the client's message quota and team limits.
                    </div>
                  </div>
                </div>

                <div className="modal-footer bg-light py-3 px-4 d-flex justify-content-between">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm px-4"
                    disabled={savingPlan}
                    onClick={() => setSelectedTenant(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm px-4 d-flex align-items-center gap-2"
                    disabled={savingPlan}
                  >
                    {savingPlan ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status"></span>
                        <span>Updating Plan...</span>
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle-fill"></i>
                        <span>Apply Plan Update</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
