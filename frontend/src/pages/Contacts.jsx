import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [optedInFilter, setOptedInFilter] = useState('');

  // Add Contact Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    email: '',
    consentProof: 'Explicit opt-in received from customer'
  });
  const [submitting, setSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchContacts();
    fetchTags();
  }, [selectedTag, optedInFilter]);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const params = { search, tag: selectedTag, optedIn: optedInFilter };
      const res = await api.get('/contacts', { params });
      if (res.data?.success) {
        setContacts(res.data.contacts);
      }
    } catch (err) {
      console.error('Failed to load contacts', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTags = async () => {
    try {
      const res = await api.get('/contacts/tags');
      if (res.data?.success) setTags(res.data.data);
    } catch (err) {
      console.error('Failed to load tags', err);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchContacts();
  };

  const handleCreateContact = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedbackMsg({ type: '', text: '' });

    try {
      await api.post('/contacts', newContact);
      setShowAddModal(false);
      setNewContact({ name: '', phone: '', email: '', consentProof: 'Explicit opt-in received from customer' });
      setFeedbackMsg({ type: 'success', text: 'Contact created and verifiable consent recorded!' });
      fetchContacts();
    } catch (err) {
      setFeedbackMsg({ type: 'danger', text: err.response?.data?.error?.message || 'Failed to create contact' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleConsent = async (contactId, currentStatus) => {
    const newStatus = !currentStatus;
    const confirmMsg = newStatus 
      ? 'Are you sure you want to re-subscribe this contact with fresh verified consent?' 
      : 'Are you sure you want to mark this contact as Opted Out? They will immediately be suppressed from all marketing broadcasts.';

    if (!window.confirm(confirmMsg)) return;

    try {
      await api.patch(`/contacts/${contactId}/consent`, {
        optedIn: newStatus,
        reason: newStatus ? 'Verified consent re-acquired' : 'User requested unsubscribe via dashboard'
      });
      setFeedbackMsg({ type: 'success', text: 'Consent status updated in compliance records.' });
      fetchContacts();
    } catch (err) {
      setFeedbackMsg({ type: 'danger', text: 'Failed to update consent.' });
    }
  };

  const handleDelete = async (contactId) => {
    if (!window.confirm('Delete this contact record?')) return;
    try {
      await api.delete(`/contacts/${contactId}`);
      setFeedbackMsg({ type: 'success', text: 'Contact deleted.' });
      fetchContacts();
    } catch (err) {
      setFeedbackMsg({ type: 'danger', text: 'Failed to delete contact.' });
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between mb-4 gap-3">
        <div>
          <h2 className="brand-font mb-1">Audience & Contact Management</h2>
          <p className="text-muted mb-0">E.164 verified phone numbers with auditable WhatsApp consent records</p>
        </div>
        <div className="d-flex gap-2">
          <Link to="/imports" className="btn btn-outline-secondary d-flex align-items-center gap-2">
            <i className="bi bi-file-earmark-arrow-up"></i>
            <span>Import CSV</span>
          </Link>
          <button 
            onClick={() => setShowAddModal(true)} 
            className="btn btn-cf-primary d-flex align-items-center gap-2"
          >
            <i className="bi bi-person-plus-fill"></i>
            <span>Add Contact</span>
          </button>
        </div>
      </div>

      {feedbackMsg.text && (
        <div className={`alert alert-${feedbackMsg.type} alert-dismissible fade show mb-4`} role="alert">
          {feedbackMsg.text}
          <button type="button" className="btn-close" onClick={() => setFeedbackMsg({ type: '', text: '' })}></button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="cf-card mb-4">
        <div className="cf-card-body">
          <form onSubmit={handleSearchSubmit} className="row g-3">
            <div className="col-12 col-md-5">
              <div className="input-group">
                <span className="input-group-text bg-white border-end-0">
                  <i className="bi bi-search text-muted"></i>
                </span>
                <input
                  type="text"
                  className="form-control border-start-0 ps-0"
                  placeholder="Search by phone, customer name, or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="col-6 col-md-3">
              <select 
                className="form-select"
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
              >
                <option value="">All Segment Tags</option>
                {tags.map(t => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="col-6 col-md-2">
              <select 
                className="form-select"
                value={optedInFilter}
                onChange={(e) => setOptedInFilter(e.target.value)}
              >
                <option value="">All Consent States</option>
                <option value="true">Opted In Only</option>
                <option value="false">Unsubscribed Only</option>
              </select>
            </div>

            <div className="col-12 col-md-2">
              <button type="submit" className="btn btn-dark w-100">
                Filter
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Contacts Data Table */}
      <div className="cf-card">
        <div className="cf-card-header">
          <h5 className="mb-0">Contacts ({contacts.length})</h5>
          <span className="small text-muted">Strictly scoped to your workspace</span>
        </div>
        <div className="table-responsive">
          <table className="table cf-table">
            <thead>
              <tr>
                <th>Customer / Name</th>
                <th>Phone (E.164)</th>
                <th>Tags</th>
                <th>Consent Status</th>
                <th>Marketing Eligibility</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-5">
                    <div className="spinner-border text-success" role="status"></div>
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-5 text-muted">
                    No contacts found matching your search. Add contacts manually or upload a CSV!
                  </td>
                </tr>
              ) : (
                contacts.map((c) => {
                  const isOptedIn = Boolean(c.is_opted_in);

                  return (
                    <tr key={c.id}>
                      <td>
                        <div className="fw-semibold text-dark">{c.name || 'Anonymous Customer'}</div>
                        <div className="small text-muted">{c.email || 'No email provided'}</div>
                      </td>
                      <td>
                        <code className="text-dark fw-bold">{c.phone}</code>
                      </td>
                      <td>
                        <div className="d-flex flex-wrap gap-1">
                          {c.tags && c.tags.length > 0 ? (
                            c.tags.map(t => (
                              <span 
                                key={t.id || t.name} 
                                className="badge"
                                style={{ backgroundColor: `${t.color || '#0d6efd'}20`, color: t.color || '#0d6efd' }}
                              >
                                {t.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-muted small">No tags</span>
                          )}
                        </div>
                      </td>
                      <td>
                        {isOptedIn ? (
                          <span className="badge-status badge-approved">
                            <i className="bi bi-shield-check me-1"></i> Opted In
                          </span>
                        ) : (
                          <span className="badge-status badge-unsubscribed">
                            <i className="bi bi-shield-slash me-1"></i> Unsubscribed
                          </span>
                        )}
                      </td>
                      <td>
                        {isOptedIn && c.status === 'active' ? (
                          <span className="text-success small fw-semibold">
                            <i className="bi bi-check-circle-fill me-1"></i> Eligible for Broadcast
                          </span>
                        ) : (
                          <span className="text-danger small fw-semibold">
                            <i className="bi bi-x-circle-fill me-1"></i> Suppressed (No Sends)
                          </span>
                        )}
                      </td>
                      <td className="text-end">
                        <div className="btn-group btn-group-sm">
                          <button
                            onClick={() => handleToggleConsent(c.id, isOptedIn)}
                            className={`btn ${isOptedIn ? 'btn-outline-warning' : 'btn-outline-success'}`}
                            title={isOptedIn ? 'Mark as Unsubscribed' : 'Restore Consent'}
                          >
                            {isOptedIn ? 'Opt-Out' : 'Opt-In'}
                          </button>
                          <button
                            onClick={() => handleDelete(c.id)}
                            className="btn btn-outline-danger"
                            title="Delete Contact"
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px' }}>
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold">Add Single Contact</h5>
                <button type="button" className="btn-close" onClick={() => setShowAddModal(false)}></button>
              </div>
              <form onSubmit={handleCreateContact}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Mobile Phone (e.g. 9876543210)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="9876543210 or +919876543210"
                      value={newContact.phone}
                      onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                      required
                    />
                    <div className="form-text small">Automatically normalized to standard E.164 format.</div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Customer Full Name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Vikram Malhotra"
                      value={newContact.name}
                      onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Email Address (Optional)</label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="vikram@example.com"
                      value={newContact.email}
                      onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold text-danger">Compliance Consent Evidence *</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      value={newContact.consentProof}
                      onChange={(e) => setNewContact({ ...newContact, consentProof: e.target.value })}
                      required
                    ></textarea>
                    <div className="form-text text-muted small">
                      WhatsApp rules require explicit consent evidence (e.g., website opt-in checkbox, store loyalty card).
                    </div>
                  </div>
                </div>

                <div className="modal-footer border-top bg-light">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting} className="btn btn-cf-primary">
                    {submitting ? 'Saving...' : 'Add & Verify Consent'}
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
