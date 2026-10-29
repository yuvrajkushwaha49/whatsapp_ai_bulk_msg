import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';

export default function TeamManagement() {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const [inviteData, setInviteData] = useState({
    name: '',
    email: '',
    role: 'marketer',
    password: 'TempPassword123!'
  });

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users');
      if (res.data?.success) setMembers(res.data.data);
    } catch (err) {
      console.error('Failed to load team', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    try {
      await api.post('/users/invite', inviteData);
      setShowInviteModal(false);
      setInviteData({ name: '', email: '', role: 'marketer', password: 'TempPassword123!' });
      setFeedback({ type: 'success', text: 'Team member invited successfully!' });
      fetchMembers();
    } catch (err) {
      setFeedback({ type: 'danger', text: err.response?.data?.error?.message || 'Failed to invite member' });
    }
  };

  const handleRoleChange = async (targetId, newRole) => {
    try {
      await api.patch(`/users/${targetId}/role`, { role: newRole });
      setFeedback({ type: 'success', text: 'Member role updated.' });
      fetchMembers();
    } catch (err) {
      setFeedback({ type: 'danger', text: 'Failed to update member role' });
    }
  };

  const handleRemove = async (targetId) => {
    if (!window.confirm('Remove this team member from workspace?')) return;
    try {
      await api.delete(`/users/${targetId}`);
      setFeedback({ type: 'success', text: 'Team member removed.' });
      fetchMembers();
    } catch (err) {
      setFeedback({ type: 'danger', text: 'Failed to remove member' });
    }
  };

  return (
    <div>
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between mb-4 gap-3">
        <div>
          <h2 className="brand-font mb-1">Team & Role-Based Access</h2>
          <p className="text-muted mb-0">Manage workspace collaborators and granular RBAC permissions</p>
        </div>
        {['owner', 'admin', 'superadmin'].includes(user?.role) && (
          <button onClick={() => setShowInviteModal(true)} className="btn btn-cf-primary d-flex align-items-center gap-2">
            <i className="bi bi-person-plus-fill"></i>
            <span>Invite Team Member</span>
          </button>
        )}
      </div>

      {feedback.text && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show mb-4`} role="alert">
          {feedback.text}
          <button type="button" className="btn-close" onClick={() => setFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      {/* Permission Matrix Info Card */}
      <div className="cf-card mb-4">
        <div className="cf-card-header">
          <h5 className="mb-0">Role Permission Matrix</h5>
        </div>
        <div className="cf-card-body p-0">
          <div className="table-responsive">
            <table className="table cf-table mb-0">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Campaigns</th>
                  <th>Contacts & Imports</th>
                  <th>WhatsApp Accounts</th>
                  <th>Billing & Team</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><span className="badge bg-dark">Owner</span></td>
                  <td className="text-success">Full Access</td>
                  <td className="text-success">Full Access</td>
                  <td className="text-success">Full Access</td>
                  <td className="text-success">Full Access</td>
                </tr>
                <tr>
                  <td><span className="badge bg-primary">Admin</span></td>
                  <td className="text-success">Full Access</td>
                  <td className="text-success">Full Access</td>
                  <td className="text-success">Full Access</td>
                  <td className="text-muted">Invite only</td>
                </tr>
                <tr>
                  <td><span className="badge bg-info text-dark">Marketer</span></td>
                  <td className="text-success">Create & Launch</td>
                  <td className="text-success">Import & Manage</td>
                  <td className="text-muted">Sync Templates</td>
                  <td className="text-danger">No Access</td>
                </tr>
                <tr>
                  <td><span className="badge bg-secondary">Agent</span></td>
                  <td className="text-muted">View Only</td>
                  <td className="text-muted">View Only</td>
                  <td className="text-danger">No Access</td>
                  <td className="text-danger">No Access</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Team Members Table */}
      <div className="cf-card">
        <div className="cf-card-header">
          <h5 className="mb-0">Workspace Collaborators ({members.length})</h5>
        </div>
        <div className="table-responsive">
          <table className="table cf-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined Date</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="text-center py-5">
                    <div className="spinner-border text-success" role="status"></div>
                  </td>
                </tr>
              ) : (
                members.map(m => (
                  <tr key={m.id}>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <div 
                          className="rounded-circle bg-light border text-dark d-flex align-items-center justify-content-center fw-bold"
                          style={{ width: 36, height: 36 }}
                        >
                          {m.name.charAt(0)}
                        </div>
                        <div>
                          <div className="fw-semibold text-dark">{m.name}</div>
                          <div className="small text-muted">{m.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {user?.role === 'owner' && m.role !== 'owner' ? (
                        <select
                          className="form-select form-select-sm w-auto"
                          value={m.role}
                          onChange={(e) => handleRoleChange(m.id, e.target.value)}
                        >
                          <option value="admin">Admin</option>
                          <option value="marketer">Marketer</option>
                          <option value="agent">Agent</option>
                        </select>
                      ) : (
                        <span className="badge bg-light text-dark border text-uppercase">
                          {m.role}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="badge-status badge-approved">{m.status}</span>
                    </td>
                    <td className="small text-muted">
                      {new Date(m.created_at).toLocaleDateString()}
                    </td>
                    <td className="text-end">
                      {user?.role === 'owner' && m.role !== 'owner' && (
                        <button
                          onClick={() => handleRemove(m.id)}
                          className="btn btn-sm btn-outline-danger"
                          title="Remove user"
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px' }}>
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold">Invite Workspace Member</h5>
                <button type="button" className="btn-close" onClick={() => setShowInviteModal(false)}></button>
              </div>
              <form onSubmit={handleInvite}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Full Name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Priya Sharma"
                      value={inviteData.name}
                      onChange={(e) => setInviteData({ ...inviteData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Work Email</label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="priya@company.com"
                      value={inviteData.email}
                      onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Assign Role</label>
                    <select
                      className="form-select"
                      value={inviteData.role}
                      onChange={(e) => setInviteData({ ...inviteData, role: e.target.value })}
                    >
                      <option value="admin">Admin (Manage integrations & campaigns)</option>
                      <option value="marketer">Marketer (Create & launch campaigns)</option>
                      <option value="agent">Support Agent (Read-only audience & reports)</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Temporary Password</label>
                    <input
                      type="text"
                      className="form-control font-monospace"
                      value={inviteData.password}
                      onChange={(e) => setInviteData({ ...inviteData, password: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="modal-footer border-top bg-light">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowInviteModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-cf-primary">
                    Send Invitation
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
