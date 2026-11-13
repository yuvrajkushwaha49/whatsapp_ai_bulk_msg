import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../services/api';
import AiwavoHeader from '../../components/AiwavoHeader';

export default function AdminBilling() {
  const { onToggleSidebar } = useOutletContext() || {};

  const [activeTab, setActiveTab] = useState('tenants'); // 'tenants' | 'plans'
  const [tenants, setTenants] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [search, setSearch] = useState('');

  // Manage Tenant Subscription Modal
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [subForm, setSubForm] = useState({
    planId: '',
    status: 'active',
    current_period_end: ''
  });
  const [savingSub, setSavingSub] = useState(false);

  // Plan Create / Edit Modal
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null); // null = create new
  const [planForm, setPlanForm] = useState({
    name: '',
    slug: '',
    monthly_price: '',
    max_contacts: '',
    max_messages_per_month: '',
    max_campaigns_per_month: '',
    max_team_members: '',
    features: '',
    is_active: true
  });
  const [savingPlan, setSavingPlan] = useState(false);
  const [deletingPlanId, setDeletingPlanId] = useState(null);

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

  // Open Manage Tenant Subscription Modal
  const handleOpenSubModal = (tenant) => {
    setSelectedTenant(tenant);
    setSubForm({
      planId: String(tenant.plan_id || 1),
      status: tenant.subscription_status || 'active',
      current_period_end: tenant.current_period_end ? tenant.current_period_end.substring(0, 10) : ''
    });
  };

  // Submit Tenant Subscription Update
  const handleSaveSubChange = async (e) => {
    e.preventDefault();
    if (!selectedTenant || !subForm.planId) return;

    setSavingSub(true);
    setFeedback({ type: '', text: '' });
    try {
      const res = await api.patch(`/admin/billing/tenants/${selectedTenant.business_id}/subscription`, {
        planId: Number(subForm.planId),
        status: subForm.status,
        current_period_end: subForm.current_period_end || null
      });

      if (res.data?.success) {
        setFeedback({
          type: 'success',
          text: `Subscription for "${selectedTenant.business_name}" updated successfully!`
        });
        setSelectedTenant(null);
        await fetchBillingData();
      }
    } catch (err) {
      setFeedback({
        type: 'danger',
        text: err.response?.data?.message || 'Failed to update tenant subscription'
      });
    } finally {
      setSavingSub(false);
    }
  };

  // Open Create Plan Modal
  const handleOpenCreatePlan = () => {
    setEditingPlan(null);
    setPlanForm({
      name: '',
      slug: '',
      monthly_price: '49.00',
      max_contacts: '5000',
      max_messages_per_month: '25000',
      max_campaigns_per_month: '20',
      max_team_members: '5',
      features: 'WhatsApp Cloud API, Smart Broadcasts, Contact Segmentation, Real-time Delivery Reports',
      is_active: true
    });
    setShowPlanModal(true);
  };

  // Open Edit Plan Modal
  const handleOpenEditPlan = (plan) => {
    setEditingPlan(plan);
    let featText = '';
    if (Array.isArray(plan.features)) {
      featText = plan.features.join(', ');
    } else if (plan.features && typeof plan.features === 'object') {
      featText = Object.keys(plan.features).map(k => `${k}: ${plan.features[k]}`).join(', ');
    }
    setPlanForm({
      name: plan.name || '',
      slug: plan.slug || '',
      monthly_price: plan.monthly_price !== undefined ? String(plan.monthly_price) : '0',
      max_contacts: plan.max_contacts !== undefined ? String(plan.max_contacts) : '1000',
      max_messages_per_month: plan.max_messages_per_month !== undefined ? String(plan.max_messages_per_month) : '5000',
      max_campaigns_per_month: plan.max_campaigns_per_month !== undefined ? String(plan.max_campaigns_per_month) : '10',
      max_team_members: plan.max_team_members !== undefined ? String(plan.max_team_members) : '2',
      features: featText,
      is_active: Boolean(plan.is_active)
    });
    setShowPlanModal(true);
  };

  // Submit Plan Create / Update
  const handleSavePlan = async (e) => {
    e.preventDefault();
    if (!planForm.name.trim() || (!editingPlan && !planForm.slug.trim())) {
      setFeedback({ type: 'danger', text: 'Plan name and slug are required.' });
      return;
    }

    setSavingPlan(true);
    setFeedback({ type: '', text: '' });
    try {
      const featArr = planForm.features.split(',').map(s => s.trim()).filter(Boolean);
      const payload = {
        name: planForm.name.trim(),
        slug: planForm.slug.trim(),
        monthly_price: Number(planForm.monthly_price || 0),
        max_contacts: Number(planForm.max_contacts || 0),
        max_messages_per_month: Number(planForm.max_messages_per_month || 0),
        max_campaigns_per_month: Number(planForm.max_campaigns_per_month || 0),
        max_team_members: Number(planForm.max_team_members || 1),
        features: featArr,
        is_active: planForm.is_active ? 1 : 0
      };

      if (editingPlan) {
        // Update
        const res = await api.put(`/admin/billing/plans/${editingPlan.id}`, payload);
        if (res.data?.success) {
          setFeedback({ type: 'success', text: `Plan "${planForm.name}" updated successfully!` });
          setShowPlanModal(false);
          await fetchBillingData();
        }
      } else {
        // Create
        const res = await api.post('/admin/billing/plans', payload);
        if (res.data?.success) {
          setFeedback({ type: 'success', text: `🎉 New subscription plan "${planForm.name}" created!` });
          setShowPlanModal(false);
          await fetchBillingData();
        }
      }
    } catch (err) {
      setFeedback({
        type: 'danger',
        text: err.response?.data?.message || err.response?.data?.error?.message || 'Failed to save subscription plan'
      });
    } finally {
      setSavingPlan(false);
    }
  };

  // Delete Plan
  const handleDeletePlan = async (plan) => {
    if (!window.confirm(`Are you sure you want to permanently delete plan "${plan.name}"?`)) {
      return;
    }

    setDeletingPlanId(plan.id);
    setFeedback({ type: '', text: '' });
    try {
      const res = await api.delete(`/admin/billing/plans/${plan.id}`);
      if (res.data?.success) {
        setFeedback({ type: 'success', text: `Plan "${plan.name}" deleted successfully!` });
        await fetchBillingData();
      }
    } catch (err) {
      setFeedback({
        type: 'danger',
        text: err.response?.data?.message || err.response?.data?.error?.message || 'Failed to delete plan. If active tenants are subscribed, deactivate it instead.'
      });
    } finally {
      setDeletingPlanId(null);
    }
  };

  const totalMonthlyMRR = tenants.reduce((sum, t) => sum + (t.status === 'active' ? Number(t.monthly_price || 0) : 0), 0);

  const filteredTenants = tenants.filter(t => {
    const q = search.toLowerCase();
    return (
      (t.business_name && t.business_name.toLowerCase().includes(q)) ||
      (t.business_slug && t.business_slug.toLowerCase().includes(q)) ||
      (t.owner_name && t.owner_name.toLowerCase().includes(q)) ||
      (t.owner_email && t.owner_email.toLowerCase().includes(q)) ||
      (t.plan_name && t.plan_name.toLowerCase().includes(q))
    );
  });

  return (
    <div>
      <AiwavoHeader
        title="Global Billing & Subscription Control"
        subtitle="Manage Multi-Tenant Pricing Plans, Client Quotas, Subscriptions & Upgrades"
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
                <div className="stat-label">Active Plan Tiers</div>
                <div className="stat-value">{plans.filter(p => p.is_active).length} / {plans.length}</div>
                <div className="small text-muted">Configurable pricing tiers</div>
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

        {/* Tab Switcher */}
        <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
          <ul className="nav nav-pills gap-2">
            <li className="nav-item">
              <button
                className={`nav-link fw-semibold px-3 py-2 ${activeTab === 'tenants' ? 'active bg-primary text-white' : 'bg-white border text-dark'}`}
                onClick={() => setActiveTab('tenants')}
              >
                <i className="bi bi-people-fill me-2"></i>
                Client Subscriptions ({tenants.length})
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link fw-semibold px-3 py-2 ${activeTab === 'plans' ? 'active bg-primary text-white' : 'bg-white border text-dark'}`}
                onClick={() => setActiveTab('plans')}
              >
                <i className="bi bi-layers-fill me-2"></i>
                SaaS Pricing Plans ({plans.length})
              </button>
            </li>
          </ul>

          <div className="d-flex align-items-center gap-2">
            <button
              onClick={fetchBillingData}
              className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1 shadow-xs"
            >
              <i className="bi bi-arrow-clockwise"></i>
              <span>Refresh</span>
            </button>
            {activeTab === 'plans' && (
              <button
                onClick={handleOpenCreatePlan}
                className="btn btn-primary btn-sm d-flex align-items-center gap-1 shadow-xs"
              >
                <i className="bi bi-plus-circle-fill"></i>
                <span>Create New Plan</span>
              </button>
            )}
          </div>
        </div>

        {/* TAB 1: CLIENT TENANT SUBSCRIPTIONS */}
        {activeTab === 'tenants' && (
          <div className="cf-card mb-4">
            <div className="cf-card-header d-flex flex-wrap justify-content-between align-items-center gap-3">
              <div>
                <h5 className="mb-0 fw-bold">Client Subscriptions Directory</h5>
                <small className="text-muted">Directly inspect, upgrade, or suspend subscription tiers for each tenant</small>
              </div>
              <div className="input-group input-group-sm" style={{ width: 260 }}>
                <span className="input-group-text bg-white border-end-0">
                  <i className="bi bi-search text-muted"></i>
                </span>
                <input
                  type="text"
                  className="form-control border-start-0"
                  placeholder="Search client, owner, plan..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="table-responsive">
              <table className="table cf-table align-middle">
                <thead>
                  <tr>
                    <th>Client / Tenant</th>
                    <th>Primary Owner</th>
                    <th>Current Plan</th>
                    <th>Monthly Price</th>
                    <th>Quota Limits</th>
                    <th>Subscription Status</th>
                    <th>Renewal Date</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8" className="text-center py-5">
                        <div className="spinner-border text-primary" role="status"></div>
                      </td>
                    </tr>
                  ) : filteredTenants.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-5 text-muted">
                        No client subscriptions found.
                      </td>
                    </tr>
                  ) : (
                    filteredTenants.map(t => (
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
                          <div className="small text-dark fw-semibold">
                            {Number(t.max_messages_per_month).toLocaleString()} msgs/mo
                          </div>
                          <div className="small text-muted" style={{ fontSize: '0.72rem' }}>
                            {Number(t.max_contacts).toLocaleString()} contacts
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${
                            t.subscription_status === 'active' ? 'bg-success' :
                            t.subscription_status === 'trialing' ? 'bg-info text-dark' :
                            t.subscription_status === 'past_due' ? 'bg-warning text-dark' :
                            'bg-danger'
                          }`}>
                            {t.subscription_status || 'active'}
                          </span>
                        </td>
                        <td>
                          <span className="small text-muted">
                            {t.current_period_end ? new Date(t.current_period_end).toLocaleDateString() : 'Auto-renew / Lifetime'}
                          </span>
                        </td>
                        <td className="text-end">
                          <button
                            className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1 shadow-xs"
                            onClick={() => handleOpenSubModal(t)}
                          >
                            <i className="bi bi-sliders"></i>
                            <span>Manage</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: SAAS PRICING PLANS CRUD */}
        {activeTab === 'plans' && (
          <div>
            <div className="row g-4 mb-4">
              {plans.map(p => (
                <div key={p.id} className="col-12 col-md-6 col-xl-3">
                  <div className={`cf-card h-100 border ${p.is_active ? 'border-primary' : 'border-secondary'} shadow-sm d-flex flex-column justify-content-between overflow-hidden`}>
                    <div className="p-3 bg-light border-bottom d-flex justify-content-between align-items-center">
                      <div>
                        <h6 className="fw-bold text-dark mb-0">{p.name}</h6>
                        <code className="small text-muted">{p.slug}</code>
                      </div>
                      <span className={`badge ${p.is_active ? 'bg-success' : 'bg-secondary'}`}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="p-3 flex-grow-1">
                      <div className="d-flex align-items-baseline gap-1 mb-3">
                        <span className="fs-3 fw-bold text-dark">${Number(p.monthly_price).toFixed(2)}</span>
                        <span className="text-muted small">/ month</span>
                      </div>

                      <ul className="list-unstyled small mb-3">
                        <li className="d-flex align-items-center gap-2 mb-2 text-dark">
                          <i className="bi bi-check-circle-fill text-success"></i>
                          <span><strong>{Number(p.max_messages_per_month).toLocaleString()}</strong> Messages / month</span>
                        </li>
                        <li className="d-flex align-items-center gap-2 mb-2 text-dark">
                          <i className="bi bi-check-circle-fill text-success"></i>
                          <span><strong>{Number(p.max_contacts).toLocaleString()}</strong> Audience Contacts</span>
                        </li>
                        <li className="d-flex align-items-center gap-2 mb-2 text-dark">
                          <i className="bi bi-check-circle-fill text-success"></i>
                          <span><strong>{p.max_campaigns_per_month}</strong> Campaigns / month</span>
                        </li>
                        <li className="d-flex align-items-center gap-2 mb-2 text-dark">
                          <i className="bi bi-check-circle-fill text-success"></i>
                          <span><strong>{p.max_team_members}</strong> Team Members</span>
                        </li>
                      </ul>

                      {p.features && (
                        <div className="pt-2 border-top">
                          <small className="text-muted fw-bold d-block mb-1">Key Features:</small>
                          <div className="d-flex flex-wrap gap-1">
                            {(Array.isArray(p.features) ? p.features : Object.keys(p.features || {})).slice(0, 3).map((f, i) => (
                              <span key={i} className="badge bg-light text-dark border small" style={{ fontSize: '0.68rem' }}>
                                {typeof f === 'string' ? f : String(f)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="p-3 bg-light border-top d-flex justify-content-between align-items-center">
                      <button
                        className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
                        onClick={() => handleOpenEditPlan(p)}
                      >
                        <i className="bi bi-pencil-square"></i>
                        <span>Edit Plan</span>
                      </button>
                      <button
                        className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1"
                        disabled={deletingPlanId === p.id}
                        onClick={() => handleDeletePlan(p)}
                        title="Delete this subscription tier"
                      >
                        {deletingPlanId === p.id ? (
                          <span className="spinner-border spinner-border-sm"></span>
                        ) : (
                          <i className="bi bi-trash"></i>
                        )}
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Plans Table Detailed View */}
            <div className="cf-card mb-4">
              <div className="cf-card-header">
                <h5 className="mb-0 fw-bold">All Plan Configurations Matrix</h5>
              </div>
              <div className="table-responsive">
                <table className="table cf-table align-middle">
                  <thead>
                    <tr>
                      <th>Plan Name</th>
                      <th>Slug</th>
                      <th>Monthly Price</th>
                      <th>Max Contacts</th>
                      <th>Messages / Mo</th>
                      <th>Campaigns / Mo</th>
                      <th>Team Seats</th>
                      <th>Status</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map(p => (
                      <tr key={p.id}>
                        <td className="fw-bold text-dark">{p.name}</td>
                        <td><code>{p.slug}</code></td>
                        <td className="fw-bold">${Number(p.monthly_price).toFixed(2)}/mo</td>
                        <td>{Number(p.max_contacts).toLocaleString()}</td>
                        <td>{Number(p.max_messages_per_month).toLocaleString()}</td>
                        <td>{p.max_campaigns_per_month}</td>
                        <td>{p.max_team_members} Users</td>
                        <td>
                          <span className={`badge ${p.is_active ? 'bg-success' : 'bg-secondary'}`}>
                            {p.is_active ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="text-end">
                          <button
                            className="btn btn-outline-primary btn-sm me-1"
                            onClick={() => handleOpenEditPlan(p)}
                            title="Edit Plan"
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button
                            className="btn btn-outline-danger btn-sm"
                            disabled={deletingPlanId === p.id}
                            onClick={() => handleDeletePlan(p)}
                            title="Delete Plan"
                          >
                            <i className="bi bi-trash"></i>
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

      {/* MODAL 1: MANAGE TENANT SUBSCRIPTION */}
      {selectedTenant && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0 rounded-4 overflow-hidden">
              <div className="modal-header bg-primary text-white py-3 px-4">
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-credit-card-2-front-fill fs-5"></i>
                  <h5 className="modal-title fw-bold mb-0">Manage Tenant Subscription</h5>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  disabled={savingSub}
                  onClick={() => setSelectedTenant(null)}
                ></button>
              </div>

              <form onSubmit={handleSaveSubChange}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label small text-muted fw-bold">Client / Business</label>
                    <div className="form-control bg-light fw-bold text-dark">
                      {selectedTenant.business_name} ({selectedTenant.business_slug})
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small text-muted fw-bold">Subscription Plan Tier <span className="text-danger">*</span></label>
                    <select
                      className="form-select"
                      value={subForm.planId}
                      onChange={(e) => setSubForm({ ...subForm, planId: e.target.value })}
                      disabled={savingSub}
                      required
                    >
                      {plans.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} — ${Number(p.monthly_price).toFixed(2)}/mo ({Number(p.max_messages_per_month).toLocaleString()} msgs)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small text-muted fw-bold">Subscription Status</label>
                    <select
                      className="form-select"
                      value={subForm.status}
                      onChange={(e) => setSubForm({ ...subForm, status: e.target.value })}
                      disabled={savingSub}
                    >
                      <option value="active">🟢 active (Paid / Active access)</option>
                      <option value="trialing">🟡 trialing (Free trial evaluation)</option>
                      <option value="past_due">🟠 past_due (Payment retry pending)</option>
                      <option value="canceled">🔴 canceled (Access revoked)</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small text-muted fw-bold">Current Period End / Renewal Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={subForm.current_period_end}
                      onChange={(e) => setSubForm({ ...subForm, current_period_end: e.target.value })}
                      disabled={savingSub}
                    />
                    <div className="form-text small">Leave blank for auto-renewing or ongoing billing.</div>
                  </div>
                </div>

                <div className="modal-footer bg-light py-3 px-4 d-flex justify-content-between">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm px-4"
                    disabled={savingSub}
                    onClick={() => setSelectedTenant(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm px-4 d-flex align-items-center gap-2"
                    disabled={savingSub}
                  >
                    {savingSub ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status"></span>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle-fill"></i>
                        <span>Save Subscription</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CREATE / EDIT SUBSCRIPTION PLAN */}
      {showPlanModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow-lg border-0 rounded-4 overflow-hidden">
              <div className="modal-header bg-primary text-white py-3 px-4">
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-layers-fill fs-5"></i>
                  <h5 className="modal-title fw-bold mb-0">
                    {editingPlan ? `Edit Subscription Plan: ${editingPlan.name}` : 'Create New Subscription Plan'}
                  </h5>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  disabled={savingPlan}
                  onClick={() => setShowPlanModal(false)}
                ></button>
              </div>

              <form onSubmit={handleSavePlan}>
                <div className="modal-body p-4">
                  <div className="row g-3">
                    <div className="col-md-7">
                      <label className="form-label small fw-bold text-muted">Plan Name <span className="text-danger">*</span></label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Pro Automation / Growth Scale"
                        value={planForm.name}
                        onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                        required
                        disabled={savingPlan}
                      />
                    </div>

                    <div className="col-md-5">
                      <label className="form-label small fw-bold text-muted">Plan Slug <span className="text-danger">*</span></label>
                      <input
                        type="text"
                        className="form-control font-monospace"
                        placeholder="e.g. pro-automation"
                        value={planForm.slug}
                        onChange={(e) => setPlanForm({ ...planForm, slug: e.target.value })}
                        required
                        disabled={savingPlan || !!editingPlan}
                      />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-bold text-muted">Monthly Price ($ USD) <span className="text-danger">*</span></label>
                      <div className="input-group">
                        <span className="input-group-text">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="form-control"
                          placeholder="49.00"
                          value={planForm.monthly_price}
                          onChange={(e) => setPlanForm({ ...planForm, monthly_price: e.target.value })}
                          required
                          disabled={savingPlan}
                        />
                      </div>
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-bold text-muted">Max Messages / Month <span className="text-danger">*</span></label>
                      <input
                        type="number"
                        min="0"
                        className="form-control"
                        placeholder="25000"
                        value={planForm.max_messages_per_month}
                        onChange={(e) => setPlanForm({ ...planForm, max_messages_per_month: e.target.value })}
                        required
                        disabled={savingPlan}
                      />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label small fw-bold text-muted">Max Contacts Limit <span className="text-danger">*</span></label>
                      <input
                        type="number"
                        min="0"
                        className="form-control"
                        placeholder="5000"
                        value={planForm.max_contacts}
                        onChange={(e) => setPlanForm({ ...planForm, max_contacts: e.target.value })}
                        required
                        disabled={savingPlan}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-muted">Max Campaigns / Month</label>
                      <input
                        type="number"
                        min="0"
                        className="form-control"
                        placeholder="20"
                        value={planForm.max_campaigns_per_month}
                        onChange={(e) => setPlanForm({ ...planForm, max_campaigns_per_month: e.target.value })}
                        disabled={savingPlan}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-bold text-muted">Max Team Members (Seats)</label>
                      <input
                        type="number"
                        min="1"
                        className="form-control"
                        placeholder="5"
                        value={planForm.max_team_members}
                        onChange={(e) => setPlanForm({ ...planForm, max_team_members: e.target.value })}
                        disabled={savingPlan}
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label small fw-bold text-muted">Feature Highlights (Comma separated)</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Unlimited Templates, AI Assistant, Dedicated Account Manager, 24/7 Support"
                        value={planForm.features}
                        onChange={(e) => setPlanForm({ ...planForm, features: e.target.value })}
                        disabled={savingPlan}
                      />
                    </div>

                    <div className="col-12">
                      <div className="form-check form-switch mt-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          id="isPlanActive"
                          checked={planForm.is_active}
                          onChange={(e) => setPlanForm({ ...planForm, is_active: e.target.checked })}
                          disabled={savingPlan}
                        />
                        <label className="form-check-label small fw-bold" htmlFor="isPlanActive">
                          Plan Active & Available for Client Subscription
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="modal-footer bg-light py-3 px-4 d-flex justify-content-between">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm px-4"
                    disabled={savingPlan}
                    onClick={() => setShowPlanModal(false)}
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
                        <span>Saving Plan...</span>
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle-fill"></i>
                        <span>{editingPlan ? 'Save Changes' : 'Create Plan'}</span>
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
