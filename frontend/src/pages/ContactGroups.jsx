import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const PRESET_COLORS = [
  '#0d6efd', // Blue
  '#198754', // Green
  '#6f42c1', // Purple
  '#fd7e14', // Orange
  '#d63384', // Pink
  '#20c997', // Teal
  '#ffc107', // Yellow
  '#0dcaf0'  // Cyan
];

export default function ContactGroups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [toastMsg, setToastMsg] = useState(null);

  // Create / Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#0d6efd'
  });
  const [saving, setSaving] = useState(false);

  // Delete Confirm Modal State
  const [deletingGroup, setDeletingGroup] = useState(null);

  // Group Details Modal / View Members Modal
  const [activeGroupDetail, setActiveGroupDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Add Contacts to Group Modal
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [availableContacts, setAvailableContacts] = useState([]);
  const [selectedContactIds, setSelectedContactIds] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [addingMembers, setAddingMembers] = useState(false);

  useEffect(() => {
    fetchGroups();
  }, []);

  const showToast = (type, text) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const res = await api.get('/contact-groups');
      if (res.data?.success) {
        setGroups(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load contact groups:', err);
      showToast('danger', err.response?.data?.message || 'Failed to load contact groups');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingGroup(null);
    setFormData({ name: '', description: '', color: '#0d6efd' });
    setShowModal(true);
  };

  const openEditModal = (group) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      description: group.description || '',
      color: group.color || '#0d6efd'
    });
    setShowModal(true);
  };

  const handleSaveGroup = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      setSaving(true);
      if (editingGroup) {
        const res = await api.put(`/contact-groups/${editingGroup.id}`, formData);
        if (res.data?.success) {
          showToast('success', 'Contact group updated successfully!');
          setShowModal(false);
          fetchGroups();
        }
      } else {
        const res = await api.post('/contact-groups', formData);
        if (res.data?.success) {
          showToast('success', 'Contact group created successfully!');
          setShowModal(false);
          fetchGroups();
        }
      }
    } catch (err) {
      showToast('danger', err.response?.data?.message || 'Failed to save group');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!deletingGroup) return;
    try {
      setSaving(true);
      const res = await api.delete(`/contact-groups/${deletingGroup.id}`);
      if (res.data?.success) {
        showToast('success', `Group "${deletingGroup.name}" deleted successfully.`);
        setDeletingGroup(null);
        fetchGroups();
        if (activeGroupDetail?.group?.id === deletingGroup.id) {
          setActiveGroupDetail(null);
        }
      }
    } catch (err) {
      showToast('danger', err.response?.data?.message || 'Failed to delete group');
    } finally {
      setSaving(false);
    }
  };

  const openGroupDetail = async (groupId) => {
    try {
      setLoadingDetail(true);
      const res = await api.get(`/contact-groups/${groupId}`);
      if (res.data?.success) {
        setActiveGroupDetail(res.data.data);
      }
    } catch (err) {
      showToast('danger', 'Failed to load group members');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleRemoveMember = async (groupId, contactId, contactName) => {
    if (!window.confirm(`Remove ${contactName || 'this contact'} from the group?`)) return;
    try {
      const res = await api.delete(`/contact-groups/${groupId}/members/${contactId}`);
      if (res.data?.success) {
        showToast('success', 'Contact removed from group.');
        setActiveGroupDetail(res.data.data);
        fetchGroups();
      }
    } catch (err) {
      showToast('danger', err.response?.data?.message || 'Failed to remove member');
    }
  };

  const openAddMembersModal = async () => {
    if (!activeGroupDetail?.group) return;
    try {
      setLoadingContacts(true);
      setSelectedContactIds([]);
      setShowAddMembersModal(true);
      const res = await api.get('/contacts?limit=100');
      if (res.data?.success) {
        const currentMemberIds = (activeGroupDetail.members || []).map(m => m.id);
        const unassigned = (res.data.contacts || []).filter(c => !currentMemberIds.includes(c.id));
        setAvailableContacts(unassigned);
      }
    } catch (err) {
      showToast('danger', 'Failed to load contacts list');
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleAddMembersSubmit = async () => {
    if (!selectedContactIds.length || !activeGroupDetail?.group) return;
    try {
      setAddingMembers(true);
      const res = await api.post(`/contact-groups/${activeGroupDetail.group.id}/members`, {
        contactIds: selectedContactIds
      });
      if (res.data?.success) {
        showToast('success', `${selectedContactIds.length} contact(s) added to group!`);
        setShowAddMembersModal(false);
        setActiveGroupDetail(res.data.data);
        fetchGroups();
      }
    } catch (err) {
      showToast('danger', err.response?.data?.message || 'Failed to add contacts');
    } finally {
      setAddingMembers(false);
    }
  };

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (g.description && g.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="contact-groups-page pb-5">
      {/* Toast Alert */}
      {toastMsg && (
        <div
          className={`alert alert-${toastMsg.type} alert-dismissible fade show shadow-sm position-fixed top-0 end-0 m-3 z-3`}
          role="alert"
          style={{ maxWidth: '420px', zIndex: 1080 }}
        >
          <div className="d-flex align-items-center gap-2">
            <i className={`bi ${toastMsg.type === 'success' ? 'bi-check-circle-fill' : 'bi-info-circle-fill'}`}></i>
            <span>{toastMsg.text}</span>
          </div>
          <button type="button" className="btn-close" onClick={() => setToastMsg(null)}></button>
        </div>
      )}

      {/* Top Header */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between mb-4 gap-3">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <Link to="/contacts" className="text-muted text-decoration-none small">
              <i className="bi bi-arrow-left me-1"></i> Audience & Contacts
            </Link>
            <span className="text-muted small">/</span>
            <span className="text-muted small fw-semibold">Groups</span>
          </div>
          <h2 className="brand-font mb-0 text-dark fw-bold">Contact Groups & Segments</h2>
          <span className="text-muted small">
            Organize contacts into targeted groups for bulk WhatsApp broadcasts and automations
          </span>
        </div>

        <div className="d-flex align-items-center gap-2">
          <button
            onClick={fetchGroups}
            className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1 shadow-xs"
            title="Refresh groups list"
          >
            <i className="bi bi-arrow-clockwise"></i>
            <span>Refresh</span>
          </button>
          <button
            onClick={openCreateModal}
            className="btn btn-cf-primary btn-sm d-flex align-items-center gap-1 shadow-sm"
          >
            <i className="bi bi-plus-lg"></i>
            <span>Create New Group</span>
          </button>
        </div>
      </div>

      {/* Search & Statistics Bar */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-md-4">
          <div className="cf-card p-3 d-flex align-items-center gap-3">
            <div className="rounded-3 p-3 bg-primary-subtle text-primary">
              <i className="bi bi-folder-fill fs-3"></i>
            </div>
            <div>
              <div className="text-muted small">Total Groups</div>
              <div className="fs-4 fw-bold text-dark">{groups.length}</div>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="cf-card p-3 d-flex align-items-center gap-3">
            <div className="rounded-3 p-3 bg-success-subtle text-success">
              <i className="bi bi-people-fill fs-3"></i>
            </div>
            <div>
              <div className="text-muted small">Total Group Memberships</div>
              <div className="fs-4 fw-bold text-success">
                {groups.reduce((acc, g) => acc + (g.member_count || 0), 0)}
              </div>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="cf-card p-3 d-flex align-items-center gap-3">
            <div className="rounded-3 p-3 bg-info-subtle text-info">
              <i className="bi bi-send-check-fill fs-3"></i>
            </div>
            <div>
              <div className="text-muted small">Broadcast Ready</div>
              <div className="fs-4 fw-bold text-info">100%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Groups Grid with Search Bar */}
      <div className="cf-card mb-4">
        <div className="cf-card-header d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div className="d-flex align-items-center gap-2">
            <h5 className="mb-0 fw-bold">All Contact Groups ({filteredGroups.length})</h5>
          </div>

          <div className="input-group input-group-sm" style={{ maxWidth: '300px' }}>
            <span className="input-group-text bg-white border-end-0">
              <i className="bi bi-search text-muted"></i>
            </span>
            <input
              type="text"
              className="form-control border-start-0"
              placeholder="Search groups..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="cf-card-body p-4">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-success" role="status"></div>
              <div className="text-muted small mt-2">Loading contact groups...</div>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-folder2-open fs-1 text-secondary d-block mb-2"></i>
              <h5>No Contact Groups Found</h5>
              <p className="small mb-3">Group your contacts to easily target them in marketing campaigns.</p>
              <button onClick={openCreateModal} className="btn btn-cf-primary btn-sm">
                <i className="bi bi-plus-lg me-1"></i> Create Your First Group
              </button>
            </div>
          ) : (
            <div className="row g-3">
              {filteredGroups.map(group => (
                <div key={group.id} className="col-12 col-md-6 col-lg-4">
                  <div
                    className="card h-100 border shadow-xs transition-all"
                    style={{
                      borderRadius: '12px',
                      borderLeft: `5px solid ${group.color || '#0d6efd'}`
                    }}
                  >
                    <div className="card-body p-3 d-flex flex-column justify-content-between">
                      <div>
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <h6 className="fw-bold text-dark mb-0 text-truncate" title={group.name}>
                            {group.name}
                          </h6>
                          <span
                            className="badge rounded-pill"
                            style={{
                              backgroundColor: `${group.color || '#0d6efd'}15`,
                              color: group.color || '#0d6efd',
                              fontSize: '0.75rem'
                            }}
                          >
                            <i className="bi bi-person-fill me-1"></i>
                            {group.member_count || 0} Contacts
                          </span>
                        </div>
                        <p className="text-muted small mb-3" style={{ minHeight: '38px', fontSize: '0.82rem' }}>
                          {group.description || 'No description provided.'}
                        </p>
                      </div>

                      <div className="d-flex align-items-center justify-content-between border-top pt-2 mt-2">
                        <button
                          onClick={() => openGroupDetail(group.id)}
                          className="btn btn-sm btn-outline-success d-flex align-items-center gap-1"
                        >
                          <i className="bi bi-people"></i>
                          <span>Manage ({group.member_count || 0})</span>
                        </button>

                        <div className="btn-group btn-group-sm">
                          <button
                            onClick={() => openEditModal(group)}
                            className="btn btn-outline-secondary"
                            title="Edit Group"
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button
                            onClick={() => setDeletingGroup(group)}
                            className="btn btn-outline-danger"
                            title="Delete Group"
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Selected Group Drawer / Detail Section */}
      {activeGroupDetail && (
        <div className="cf-card mb-4 border-success">
          <div className="cf-card-header bg-success-subtle py-3 d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-2">
              <span
                className="rounded-circle d-inline-block"
                style={{ width: '14px', height: '14px', backgroundColor: activeGroupDetail.group.color }}
              ></span>
              <h5 className="mb-0 fw-bold text-dark">
                {activeGroupDetail.group.name} ({activeGroupDetail.members.length} Members)
              </h5>
            </div>
            <div className="d-flex align-items-center gap-2">
              <button
                onClick={openAddMembersModal}
                className="btn btn-sm btn-success d-flex align-items-center gap-1"
              >
                <i className="bi bi-person-plus-fill"></i>
                <span>Add Contacts to Group</span>
              </button>
              <button
                onClick={() => setActiveGroupDetail(null)}
                className="btn-close"
                title="Close member view"
              ></button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table cf-table mb-0 align-middle">
              <thead>
                <tr>
                  <th>Contact Name</th>
                  <th>Phone Number</th>
                  <th>Email</th>
                  <th>Consent Status</th>
                  <th>Joined Group At</th>
                  <th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {activeGroupDetail.members.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-4 text-muted">
                      No contacts in this group yet. Click <strong>"Add Contacts to Group"</strong> above to assign contacts!
                    </td>
                  </tr>
                ) : (
                  activeGroupDetail.members.map(member => (
                    <tr key={member.id}>
                      <td>
                        <Link to={`/contacts/${member.id}`} className="fw-semibold text-dark text-decoration-none">
                          {member.name || 'Anonymous Customer'}
                        </Link>
                      </td>
                      <td>
                        <code className="text-dark fw-bold">{member.phone}</code>
                      </td>
                      <td className="small text-muted">{member.email || '-'}</td>
                      <td>
                        {member.is_opted_in ? (
                          <span className="badge bg-success-subtle text-success border border-success-subtle">
                            Opted In
                          </span>
                        ) : (
                          <span className="badge bg-secondary-subtle text-secondary border">
                            Opted Out
                          </span>
                        )}
                      </td>
                      <td className="small text-muted">
                        {member.joined_at ? new Date(member.joined_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="text-end">
                        <button
                          onClick={() => handleRemoveMember(activeGroupDetail.group.id, member.id, member.name)}
                          className="btn btn-sm btn-outline-danger py-0 px-2"
                          title="Remove from group"
                        >
                          <i className="bi bi-x-lg"></i>
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

      {/* Create / Edit Group Modal */}
      {showModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <form onSubmit={handleSaveGroup}>
                <div className="modal-header">
                  <h5 className="modal-title fw-bold">
                    {editingGroup ? 'Edit Contact Group' : 'Create New Contact Group'}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowModal(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Group Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. VIP Customers, Diwali Sale Leads, Wholesale"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Description</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      placeholder="Brief note about the purpose of this group"
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                    ></textarea>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Group Color Tag</label>
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      {PRESET_COLORS.map(c => (
                        <button
                          key={c}
                          type="button"
                          className="rounded-circle border-0 d-inline-block"
                          style={{
                            width: '28px',
                            height: '28px',
                            backgroundColor: c,
                            outline: formData.color === c ? '3px solid #000' : 'none',
                            outlineOffset: '2px',
                            cursor: 'pointer'
                          }}
                          onClick={() => setFormData({ ...formData, color: c })}
                        ></button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn btn-cf-primary d-flex align-items-center gap-1"
                  >
                    <i className="bi bi-save"></i>
                    <span>{saving ? 'Saving...' : (editingGroup ? 'Update Group' : 'Create Group')}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingGroup && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header">
                <h5 className="modal-title fw-bold text-danger">Delete Contact Group</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setDeletingGroup(null)}
                ></button>
              </div>
              <div className="modal-body">
                <p className="text-muted mb-2">
                  Are you sure you want to delete the group <strong>"{deletingGroup.name}"</strong>?
                </p>
                <div className="small text-danger">
                  <i className="bi bi-exclamation-triangle-fill me-1"></i>
                  The group itself will be removed. Contacts belonging to this group will <strong>not</strong> be deleted from your database.
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setDeletingGroup(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleDeleteGroup}
                  className="btn btn-danger"
                >
                  {saving ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Contacts Modal */}
      {showAddMembersModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow">
              <div className="modal-header">
                <h5 className="modal-title fw-bold">
                  Add Contacts to "{activeGroupDetail?.group?.name}"
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowAddMembersModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                {loadingContacts ? (
                  <div className="text-center py-4">
                    <div className="spinner-border text-success" role="status"></div>
                    <div className="text-muted small mt-2">Loading available contacts...</div>
                  </div>
                ) : availableContacts.length === 0 ? (
                  <div className="text-center py-4 text-muted">
                    All contacts in your workspace are already in this group or no contacts exist.
                  </div>
                ) : (
                  <div>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="small text-muted">Select contacts to assign:</span>
                      <button
                        type="button"
                        className="btn btn-xs btn-link text-decoration-none"
                        onClick={() => {
                          if (selectedContactIds.length === availableContacts.length) {
                            setSelectedContactIds([]);
                          } else {
                            setSelectedContactIds(availableContacts.map(c => c.id));
                          }
                        }}
                      >
                        {selectedContactIds.length === availableContacts.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>

                    <div style={{ maxHeight: '320px', overflowY: 'auto' }} className="border rounded p-2">
                      {availableContacts.map(c => (
                        <div
                          key={c.id}
                          className="d-flex align-items-center justify-content-between p-2 border-bottom cursor-pointer hover-bg-light"
                          onClick={() => {
                            setSelectedContactIds(prev =>
                              prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id]
                            );
                          }}
                        >
                          <div className="d-flex align-items-center gap-2">
                            <input
                              type="checkbox"
                              className="form-check-input mt-0"
                              checked={selectedContactIds.includes(c.id)}
                              onChange={() => {}}
                            />
                            <div>
                              <div className="fw-semibold text-dark">{c.name || 'Anonymous Customer'}</div>
                              <div className="small text-muted">{c.phone}</div>
                            </div>
                          </div>
                          <span className={`badge ${c.is_opted_in ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'}`}>
                            {c.is_opted_in ? 'Opted In' : 'Opted Out'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setShowAddMembersModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={addingMembers || selectedContactIds.length === 0}
                  onClick={handleAddMembersSubmit}
                  className="btn btn-success d-flex align-items-center gap-1"
                >
                  <i className="bi bi-check-lg"></i>
                  <span>{addingMembers ? 'Adding...' : `Add Selected (${selectedContactIds.length})`}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

