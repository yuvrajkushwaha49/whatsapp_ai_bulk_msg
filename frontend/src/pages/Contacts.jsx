import React, { useState, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import api from '../services/api';
import AiwavoHeader from '../components/AiwavoHeader';

export default function Contacts() {
  const outletContext = useOutletContext();
  const onToggleSidebar = outletContext?.onToggleSidebar;
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

  const totalContacts = contacts.length;
  const optedInCount = contacts.filter((c) => Boolean(c.is_opted_in)).length;
  const unsubscribedCount = contacts.filter((c) => !Boolean(c.is_opted_in)).length;
  const suppressedCount = contacts.filter((c) => !Boolean(c.is_opted_in) || c.status !== 'active').length;

  const getAvatarStyle = (name) => {
    const firstLetter = (name || 'A').trim()[0]?.toUpperCase() || 'A';
    const palette = [
      { bg: '#dcfce7', text: '#16a34a' }, // green
      { bg: '#f3e8ff', text: '#9333ea' }, // purple
      { bg: '#e0f2fe', text: '#0284c7' }, // blue
      { bg: '#ffedd5', text: '#ea580c' }, // orange
      { bg: '#fce7f3', text: '#db2777' }, // pink
      { bg: '#fef3c7', text: '#d97706' }  // amber
    ];
    const charCode = firstLetter.charCodeAt(0);
    return {
      letter: firstLetter,
      style: palette[charCode % palette.length]
    };
  };

  return (
    <div>
      <AiwavoHeader
        title="Contacts"
        subtitle="E.164 verified phone numbers with auditable WhatsApp consent records"
        onToggleSidebar={onToggleSidebar}
      />

      <div className="cnt-page-container">
        {/* Feedback Alert */}
        {feedbackMsg.text && (
          <div className={`alert alert-${feedbackMsg.type} alert-dismissible fade show mb-4 shadow-sm`} role="alert">
            <div className="d-flex align-items-center gap-2">
              <i className={`bi ${feedbackMsg.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} fs-5`}></i>
              <div>{feedbackMsg.text}</div>
            </div>
            <button type="button" className="btn-close" onClick={() => setFeedbackMsg({ type: '', text: '' })}></button>
          </div>
        )}

        {/* 1. Manage Your Contacts Hero Banner (Matching Reference Image) */}
        <div className="cnt-hero-banner">
          <div className="cnt-hero-left">
            <div className="cnt-hero-icon">
              <i className="bi bi-people-fill"></i>
            </div>
            <div>
              <h1 className="cnt-hero-title">Manage Your Contacts</h1>
              <p className="cnt-hero-subtitle">
                Add, import and manage your verified WhatsApp contacts with consent records.
              </p>
            </div>
          </div>

          <div className="cnt-hero-actions">
            <Link to="/contacts/groups" className="cnt-hero-btn-green-outline" title="Manage Contact Groups">
              <i className="bi bi-folder-fill"></i>
              <span>Contact Groups</span>
            </Link>

            <Link to="/imports" className="cnt-hero-btn-outline" title="Bulk Import Contacts from CSV / Excel">
              <i className="bi bi-file-earmark-text"></i>
              <span>Import CSV</span>
            </Link>

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="cnt-hero-btn-green-solid"
              title="Add Single Contact"
            >
              <i className="bi bi-person-plus-fill"></i>
              <span>Add Contact</span>
            </button>
          </div>
        </div>

        {/* 2. Four KPI Metric Cards (Matching Reference Image) */}
        <div className="cnt-kpi-grid">
          {/* Card 1: Total Contacts */}
          <div className="cnt-kpi-card">
            <div className="cnt-kpi-icon-circle" style={{ background: '#ecfdf5', color: '#10b981' }}>
              <i className="bi bi-people-fill"></i>
            </div>
            <div className="cnt-kpi-info">
              <div className="cnt-kpi-val-row">
                <span className="cnt-kpi-value">{totalContacts.toLocaleString()}</span>
                <span className="cnt-kpi-trend">↑ +6.2%</span>
              </div>
              <span className="cnt-kpi-label">Total Contacts</span>
            </div>
          </div>

          {/* Card 2: Opted-in Contacts */}
          <div className="cnt-kpi-card">
            <div className="cnt-kpi-icon-circle" style={{ background: '#f5f3ff', color: '#8b5cf6' }}>
              <i className="bi bi-people-fill"></i>
            </div>
            <div className="cnt-kpi-info">
              <div className="cnt-kpi-val-row">
                <span className="cnt-kpi-value">{optedInCount.toLocaleString()}</span>
              </div>
              <span className="cnt-kpi-label">Opted-in Contacts</span>
            </div>
          </div>

          {/* Card 3: Unsubscribed */}
          <div className="cnt-kpi-card">
            <div className="cnt-kpi-icon-circle" style={{ background: '#eff6ff', color: '#3b82f6' }}>
              <i className="bi bi-person-slash"></i>
            </div>
            <div className="cnt-kpi-info">
              <div className="cnt-kpi-val-row">
                <span className="cnt-kpi-value">{unsubscribedCount.toLocaleString()}</span>
              </div>
              <span className="cnt-kpi-label">Unsubscribed</span>
            </div>
          </div>

          {/* Card 4: Suppressed (Do Not Contact) */}
          <div className="cnt-kpi-card">
            <div className="cnt-kpi-icon-circle" style={{ background: '#fef2f2', color: '#ef4444' }}>
              <i className="bi bi-shield-x"></i>
            </div>
            <div className="cnt-kpi-info">
              <div className="cnt-kpi-val-row">
                <span className="cnt-kpi-value">{suppressedCount.toLocaleString()}</span>
              </div>
              <span className="cnt-kpi-label">Suppressed (Do Not Contact)</span>
            </div>
          </div>
        </div>

        {/* 3. Search and Filter Bar (Matching Reference Image) */}
        <div className="cnt-search-card">
          <form onSubmit={handleSearchSubmit} className="cnt-filter-form">
            <div className="cnt-search-input-wrap">
              <i className="bi bi-search text-muted"></i>
              <input
                type="text"
                placeholder="Search by phone, customer name, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select
              className="cnt-select"
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
            >
              <option value="">All Segment Tags</option>
              {tags.map((t) => (
                <option key={t.id || t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>

            <select
              className="cnt-select"
              value={optedInFilter}
              onChange={(e) => setOptedInFilter(e.target.value)}
            >
              <option value="">All Consent Status</option>
              <option value="true">Opted In Only</option>
              <option value="false">Unsubscribed Only</option>
            </select>

            <button type="submit" className="cnt-btn-filter">
              <i className="bi bi-funnel-fill"></i>
              <span>Filter</span>
            </button>
          </form>
        </div>

        {/* 4. Contacts Data Table Card (Matching Reference Image) */}
        <div className="cnt-table-card mb-4">
          <div className="cnt-table-header-row">
            <h5 className="cnt-table-title">Contacts ({contacts.length})</h5>
            <span className="cnt-table-subtext">Strictly scoped to your workspace</span>
          </div>

          <div className="table-responsive">
            <table className="cnt-table">
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
                      <div className="text-muted small mt-2">Loading contacts...</div>
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
                    const { letter, style: avatarStyle } = getAvatarStyle(c.name);

                    return (
                      <tr key={c.id}>
                        <td>
                          <div className="cnt-customer-col">
                            <div
                              className="cnt-avatar-circle"
                              style={{ backgroundColor: avatarStyle.bg, color: avatarStyle.text }}
                            >
                              {letter}
                            </div>
                            <div>
                              <div className="cnt-customer-name">
                                {c.name || 'Anonymous Customer'}
                              </div>
                              <div className="cnt-customer-email">
                                {c.email || 'No email provided'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="cnt-phone-val">
                            +{String(c.phone || '').replace(/^\+/, '')}
                          </span>
                        </td>
                        <td>
                          <div className="d-flex flex-wrap gap-1">
                            {c.tags && c.tags.length > 0 ? (
                              c.tags.map((t) => (
                                <span
                                  key={t.id || t.name}
                                  className="badge"
                                  style={{
                                    backgroundColor: `${t.color || '#0d6efd'}20`,
                                    color: t.color || '#0d6efd',
                                    fontWeight: 600,
                                    borderRadius: '6px'
                                  }}
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
                            <span className="cnt-pill-opted">
                              <i className="bi bi-check-circle"></i> OPTED IN
                            </span>
                          ) : (
                            <span className="cnt-pill-unsub">
                              <i className="bi bi-slash-circle"></i> UNSUBSCRIBED
                            </span>
                          )}
                        </td>
                        <td>
                          {isOptedIn && c.status === 'active' ? (
                            <span className="cnt-eligibility-eligible">
                              <i className="bi bi-circle-fill" style={{ fontSize: '7px' }}></i>
                              Eligible for Broadcast
                            </span>
                          ) : (
                            <span className="cnt-eligibility-suppressed">
                              <i className="bi bi-circle-fill" style={{ fontSize: '7px' }}></i>
                              Suppressed (No Send)
                            </span>
                          )}
                        </td>
                        <td className="text-end">
                          <div className="cnt-actions-wrap">
                            <Link
                              to={`/contacts/${c.id}`}
                              className="cnt-btn-view"
                              title="View Contact Profile & History"
                            >
                              <i className="bi bi-eye"></i>
                            </Link>

                            <button
                              type="button"
                              onClick={() => handleToggleConsent(c.id, isOptedIn)}
                              className={isOptedIn ? 'cnt-btn-optout' : 'cnt-btn-optin'}
                              title={isOptedIn ? 'Mark as Unsubscribed' : 'Restore Consent'}
                            >
                              {isOptedIn ? 'Opt-Out' : 'Opt-In'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(c.id)}
                              className="cnt-btn-delete"
                              title="Delete Contact"
                            >
                              <i className="bi bi-trash3"></i>
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
    </div>
  );
}
