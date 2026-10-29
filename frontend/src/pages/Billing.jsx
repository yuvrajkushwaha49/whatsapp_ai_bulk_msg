import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function Billing() {
  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upgradingId, setUpgradingId] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      const [plansRes, subRes, usageRes] = await Promise.all([
        api.get('/billing/plans'),
        api.get('/billing/subscription'),
        api.get('/billing/usage')
      ]);

      if (plansRes.data?.success) setPlans(plansRes.data.data);
      if (subRes.data?.success) setSubscription(subRes.data.data);
      if (usageRes.data?.success) setUsage(usageRes.data.data);
    } catch (err) {
      console.error('Failed to load billing details', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planId) => {
    setUpgradingId(planId);
    setFeedback({ type: '', text: '' });

    try {
      await api.post('/billing/upgrade', { planId });
      setFeedback({ type: 'success', text: 'Plan upgraded successfully!' });
      fetchBillingData();
    } catch (err) {
      setFeedback({ type: 'danger', text: 'Failed to change plan' });
    } finally {
      setUpgradingId(null);
    }
  };

  return (
    <div>
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between mb-4 gap-3">
        <div>
          <h2 className="brand-font mb-1">Subscription & Usage Quotas</h2>
          <p className="text-muted mb-0">Manage workspace tiers, contact limits, and monthly broadcast allowances</p>
        </div>
      </div>

      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show mb-4`} role="alert">
          {feedback.text}
          <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      {/* Usage Progress Cards */}
      <div className="row g-4 mb-4">
        <div className="col-12 col-md-4">
          <div className="cf-card h-100">
            <div className="cf-card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="fw-bold text-dark">Stored Audience Contacts</span>
                <span className="small text-muted">
                  {usage?.metrics?.contacts?.current || 0} / {usage?.metrics?.contacts?.limit || 15000}
                </span>
              </div>
              <div className="progress mb-2" style={{ height: 8 }}>
                <div
                  className="progress-bar bg-success"
                  style={{ width: `${Math.min(100, usage?.metrics?.contacts?.percentage || 0)}%` }}
                ></div>
              </div>
              <div className="small text-muted">{usage?.metrics?.contacts?.percentage || 0}% of contact quota used</div>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-4">
          <div className="cf-card h-100">
            <div className="cf-card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="fw-bold text-dark">Monthly Messages Dispatched</span>
                <span className="small text-muted">
                  {usage?.metrics?.messages?.current || 0} / {usage?.metrics?.messages?.limit || 75000}
                </span>
              </div>
              <div className="progress mb-2" style={{ height: 8 }}>
                <div
                  className="progress-bar bg-primary"
                  style={{ width: `${Math.min(100, usage?.metrics?.messages?.percentage || 0)}%` }}
                ></div>
              </div>
              <div className="small text-muted">Period: {usage?.periodMonth}</div>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-4">
          <div className="cf-card h-100">
            <div className="cf-card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="fw-bold text-dark">Campaigns Executed</span>
                <span className="small text-muted">
                  {usage?.metrics?.campaigns?.current || 0} / {usage?.metrics?.campaigns?.limit || 50}
                </span>
              </div>
              <div className="progress mb-2" style={{ height: 8 }}>
                <div
                  className="progress-bar bg-warning"
                  style={{ width: `${Math.min(100, usage?.metrics?.campaigns?.percentage || 0)}%` }}
                ></div>
              </div>
              <div className="small text-muted">{usage?.metrics?.campaigns?.percentage || 0}% of campaign quota</div>
            </div>
          </div>
        </div>
      </div>

      {/* Plan Comparison Grid */}
      <div className="cf-card">
        <div className="cf-card-header">
          <h5 className="mb-0">Subscription Tiers</h5>
          <span className="badge bg-success-subtle text-success">
            Current: {subscription?.plan_name || 'Pro Automation'}
          </span>
        </div>
        <div className="cf-card-body">
          <div className="row g-4">
            {plans.map(p => {
              const isCurrent = subscription?.plan_id === p.id;

              return (
                <div key={p.id} className="col-12 col-md-6 col-xl-3">
                  <div className={`p-4 rounded-3 border h-100 d-flex flex-column ${isCurrent ? 'border-success border-2 bg-success-subtle bg-opacity-10' : 'bg-white'}`}>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h5 className="fw-bold text-dark mb-0">{p.name}</h5>
                      {isCurrent && <span className="badge bg-success">Current</span>}
                    </div>

                    <div className="mb-3">
                      <span className="fs-2 fw-bold text-dark">${p.monthly_price}</span>
                      <span className="text-muted small">/month</span>
                    </div>

                    <ul className="list-unstyled small text-muted d-flex flex-column gap-2 mb-4 flex-grow-1">
                      <li><i className="bi bi-check text-success me-1"></i> Up to <strong>{p.max_contacts.toLocaleString()}</strong> Contacts</li>
                      <li><i className="bi bi-check text-success me-1"></i> <strong>{p.max_messages_per_month.toLocaleString()}</strong> WhatsApp Messages /mo</li>
                      <li><i className="bi bi-check text-success me-1"></i> <strong>{p.max_campaigns_per_month}</strong> Campaigns /mo</li>
                      <li><i className="bi bi-check text-success me-1"></i> <strong>{p.max_team_members}</strong> Team Seats</li>
                      <li><i className="bi bi-check text-success me-1"></i> Official Meta Cloud API</li>
                    </ul>

                    <button
                      onClick={() => handleUpgrade(p.id)}
                      disabled={isCurrent || upgradingId === p.id}
                      className={`btn w-100 ${isCurrent ? 'btn-outline-success' : 'btn-dark'}`}
                    >
                      {isCurrent ? 'Current Plan' : upgradingId === p.id ? 'Upgrading...' : 'Switch Plan'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 bg-light rounded-3 mt-4 text-muted small border">
            <i className="bi bi-info-circle me-1 text-primary"></i>
            <strong>Pricing Transparency:</strong> Platform subscription covers software quotas and automation workers. 
            Official WhatsApp utility and marketing conversation fees are billed directly through your linked Meta Payment Method as per Meta rate cards.
          </div>
        </div>
      </div>
    </div>
  );
}
