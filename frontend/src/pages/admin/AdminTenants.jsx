import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../../services/api';
import AiwavoHeader from '../../components/AiwavoHeader';

export default function AdminTenants() {
  const { onToggleSidebar } = useOutletContext() || {};

  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Create Business & Owner modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBusinessForm, setNewBusinessForm] = useState({
    businessName: '',
    name: '',
    email: '',
    password: '',
    timezone: 'Asia/Kolkata'
  });
  const [creating, setCreating] = useState(false);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/businesses');
      if (res.data?.success) {
        setBusinesses(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load tenants', err);
      setFeedback({ type: 'danger', text: 'Failed to load business tenants' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleToggleStatus = async (bizId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    if (!window.confirm(`Are you sure you want to change tenant status to "${newStatus}"?`)) return;

    try {
      await api.patch(`/admin/businesses/${bizId}/status`, { status: newStatus });
      setFeedback({ type: 'success', text: `Tenant status updated to ${newStatus}` });
      fetchTenants();
    } catch (err) {
      setFeedback({ type: 'danger', text: 'Failed to update tenant status' });
    }
  };

  const handleCreateBusiness = async (e) => {
    e.preventDefault();
    if (!newBusinessForm.businessName.trim() || !newBusinessForm.name.trim() || !newBusinessForm.email.trim() || !newBusinessForm.password.trim()) {
      setFeedback({ type: 'danger', text: 'Please fill in all required fields.' });
      return;
    }

    setCreating(true);
    setFeedback({ type: '', text: '' });
    try {
      const res = await api.post('/admin/businesses', newBusinessForm);
      if (res.data?.success) {
        setFeedback({
          type: 'success',
          text: `🎉 Business "${newBusinessForm.businessName}" created! Owner: ${newBusinessForm.email}`
        });
        setShowAddModal(false);
        setNewBusinessForm({
          businessName: '',
          name: '',
          email: '',
          password: '',
          timezone: 'Asia/Kolkata'
        });
        await fetchTenants();
      }
    } catch (err) {
      setFeedback({
        type: 'danger',
        text: err.response?.data?.message || 'Failed to create business and owner account.'
      });
    } finally {
      setCreating(false);
    }
  };

  const filteredBusinesses = businesses.filter(b => {
    const q = search.toLowerCase();
    return (
      (b.name && b.name.toLowerCase().includes(q)) ||
      (b.slug && b.slug.toLowerCase().includes(q)) ||
      (b.owner_name && b.owner_name.toLowerCase().includes(q)) ||
      (b.owner_email && b.owner_email.toLowerCase().includes(q))
    );
  });

  return (
    <div>
      <AiwavoHeader
        title="Tenant Governance & Businesses"
        subtitle="Master Multi-Tenant Directory, Client Owners, and Account Provisioning"
        onToggleSidebar={onToggleSidebar}
      />

      <div className="p-4">
        {feedback.text && (
          <div className={`alert alert-${feedback.type} alert-dismissible fade show mb-4 shadow-sm`} role="alert">
            {feedback.text}
            <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
          </div>
        )}

        <div className="cf-card">
          <div className="cf-card-header d-flex flex-wrap justify-content-between align-items-center gap-3">
            <div>
              <h5 className="mb-0 fw-bold">Tenant Directory ({businesses.length})</h5>
              <small className="text-muted">Manage all registered client businesses, tenant owners, and account access</small>
            </div>
            <div className="d-flex align-items-center gap-2">
              <div className="input-group input-group-sm" style={{ width: 250 }}>
                <span className="input-group-text bg-white border-end-0">
                  <i className="bi bi-search text-muted"></i>
                </span>
                <input
                  type="text"
                  className="form-control border-start-0"
                  placeholder="Search tenants or owners..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={fetchTenants}
                title="Refresh"
              >
                <i className="bi bi-arrow-clockwise"></i>
              </button>
              <button
                className="btn btn-primary btn-sm d-flex align-items-center gap-2 shadow-xs"
                onClick={() => setShowAddModal(true)}
              >
                <i className="bi bi-plus-circle-fill"></i>
                <span>Add Business & Owner</span>
              </button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table cf-table align-middle">
              <thead>
                <tr>
                  <th>Tenant / Business Name</th>
                  <th>Primary Owner</th>
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
                    <td colSpan="8" className="text-center py-5">
                      <div className="spinner-border text-primary" role="status"></div>
                    </td>
                  </tr>
                ) : filteredBusinesses.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-5 text-muted">
                      No businesses found matching "{search}"
                    </td>
                  </tr>
                ) : (
                  filteredBusinesses.map(b => (
                    <tr key={b.id}>
                      <td>
                        <div className="fw-bold text-dark">{b.name}</div>
                        <code className="small text-muted">{b.slug}</code>
                      </td>
                      <td>
                        <div className="fw-semibold text-dark small">{b.owner_name || 'N/A'}</div>
                        <div className="small text-muted">{b.owner_email || 'N/A'}</div>
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
                      <td className="small text-muted">{b.timezone || 'UTC'}</td>
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

      {/* Modal: Create Business & Owner */}
      {showAddModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow-lg border-0 rounded-4 overflow-hidden">
              <div className="modal-header bg-primary text-white py-3 px-4">
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-buildings-fill fs-5"></i>
                  <div>
                    <h5 className="modal-title fw-bold mb-0">Create New Business & Tenant Owner</h5>
                    <small className="text-white-50">Registers a new tenant with dedicated Owner account & free trial</small>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  disabled={creating}
                  onClick={() => setShowAddModal(false)}
                ></button>
              </div>

              <form onSubmit={handleCreateBusiness}>
                <div className="modal-body p-4">
                  <div className="row g-4">
                    {/* Business Details */}
                    <div className="col-12">
                      <div className="d-flex align-items-center gap-2 text-primary fw-bold pb-2 border-bottom">
                        <i className="bi bi-building"></i>
                        <span>Business Information</span>
                      </div>
                    </div>

                    <div className="col-md-7">
                      <label className="form-label fw-semibold small text-muted">
                        Business / Company Name <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Acme Corp / Rahul Enterprises"
                        value={newBusinessForm.businessName}
                        onChange={(e) => setNewBusinessForm({ ...newBusinessForm, businessName: e.target.value })}
                        required
                        disabled={creating}
                      />
                    </div>

                    <div className="col-md-5">
                      <label className="form-label fw-semibold small text-muted">Timezone</label>
                      <select
                        className="form-select"
                        value={newBusinessForm.timezone}
                        onChange={(e) => setNewBusinessForm({ ...newBusinessForm, timezone: e.target.value })}
                        disabled={creating}
                      >
                        <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                        <option value="Asia/Dubai">Asia/Dubai (GST +4:00)</option>
                        <option value="Europe/London">Europe/London (GMT/BST)</option>
                        <option value="America/New_York">America/New_York (EST/EDT)</option>
                        <option value="UTC">UTC</option>
                      </select>
                    </div>

                    {/* Owner Account Details */}
                    <div className="col-12 mt-3">
                      <div className="d-flex align-items-center gap-2 text-primary fw-bold pb-2 border-bottom">
                        <i className="bi bi-person-badge"></i>
                        <span>Owner Credentials (Primary Tenant Administrator)</span>
                      </div>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label fw-semibold small text-muted">
                        Owner Full Name <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Rahul Sharma"
                        value={newBusinessForm.name}
                        onChange={(e) => setNewBusinessForm({ ...newBusinessForm, name: e.target.value })}
                        required
                        disabled={creating}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label fw-semibold small text-muted">
                        Owner Email Address <span className="text-danger">*</span>
                      </label>
                      <input
                        type="email"
                        className="form-control"
                        placeholder="e.g. rahul@acmecorp.com"
                        value={newBusinessForm.email}
                        onChange={(e) => setNewBusinessForm({ ...newBusinessForm, email: e.target.value })}
                        required
                        disabled={creating}
                      />
                      <small className="text-muted">This will be the login email for the owner.</small>
                    </div>

                    <div className="col-12">
                      <label className="form-label fw-semibold small text-muted">
                        Initial Login Password <span className="text-danger">*</span>
                      </label>
                      <div className="input-group">
                        <input
                          type="text"
                          className="form-control font-monospace"
                          placeholder="Set password (e.g. Rahul@12345)"
                          value={newBusinessForm.password}
                          onChange={(e) => setNewBusinessForm({ ...newBusinessForm, password: e.target.value })}
                          required
                          disabled={creating}
                        />
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          disabled={creating}
                          onClick={() => {
                            const gen = 'Pass@' + Math.random().toString(36).slice(-6) + '!';
                            setNewBusinessForm({ ...newBusinessForm, password: gen });
                          }}
                        >
                          Generate Random
                        </button>
                      </div>
                      <small className="text-muted">You can share these credentials with the owner to let them sign in.</small>
                    </div>
                  </div>
                </div>

                <div className="modal-footer bg-light py-3 px-4 d-flex justify-content-between">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm px-4"
                    disabled={creating}
                    onClick={() => setShowAddModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm px-4 d-flex align-items-center gap-2"
                    disabled={creating}
                  >
                    {creating ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status"></span>
                        <span>Creating Tenant & Owner...</span>
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle-fill"></i>
                        <span>Create Business & Owner</span>
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
