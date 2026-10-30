import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function CampaignBuilder() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [campaignName, setCampaignName] = useState('');
  const [purpose, setPurpose] = useState('Festive & Promotional Broadcast');
  const [selectedAccountIds, setSelectedAccountIds] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [templateId, setTemplateId] = useState('');
  const [variableMappings, setVariableMappings] = useState({
    var_1: 'contact.name',
    var_2: '30',
    var_3: 'FESTIVE30'
  });

  // Audience Targeting Mode: 'tags' (Segment Tags / All), 'specific' (Pick Specific Contacts), 'csv' (Upload CSV Audience)
  const [audienceMode, setAudienceMode] = useState('tags');
  const [selectedContactIds, setSelectedContactIds] = useState([]);
  const [availableContacts, setAvailableContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [optedInOnly, setOptedInOnly] = useState(true);

  // CSV Upload, Validation & Review State
  const [csvFileName, setCsvFileName] = useState('');
  const [csvRawText, setCsvRawText] = useState('');
  const [csvReviewRows, setCsvReviewRows] = useState([]);
  const [csvStats, setCsvStats] = useState({ total: 0, valid: 0, duplicates: 0, invalid: 0 });
  const [csvFilterTab, setCsvFilterTab] = useState('all'); // 'all' | 'valid' | 'duplicates' | 'invalid'
  const [csvSearchTerm, setCsvSearchTerm] = useState('');
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const [csvAppliedMessage, setCsvAppliedMessage] = useState(null);
  const [csvColumnMapping, setCsvColumnMapping] = useState({ phone: '', name: '', email: '', tag: '' });

  // Resources
  const [accounts, setAccounts] = useState([]);
  const [tags, setTags] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [audienceEstimate, setAudienceEstimate] = useState(null);
  const [preflightData, setPreflightData] = useState(null);

  // Manual WhatsApp Account Modal State
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [manualAccount, setManualAccount] = useState({
    displayName: '',
    phoneNumber: '',
    phoneNumberId: '',
    wabaId: '',
    accessToken: ''
  });
  const [addingAccount, setAddingAccount] = useState(false);
  const [accountFeedback, setAccountFeedback] = useState({ type: '', text: '' });

  useEffect(() => {
    loadPrerequisites();
  }, []);

  const loadPrerequisites = async () => {
    try {
      setLoadingContacts(true);
      const [accRes, tagRes, tplRes, contactRes] = await Promise.all([
        api.get('/whatsapp/accounts'),
        api.get('/contacts/tags'),
        api.get('/whatsapp/templates?status=APPROVED'),
        api.get('/contacts?limit=500')
      ]);

      if (accRes.data?.success && accRes.data.data.length > 0) {
        setAccounts(accRes.data.data);
        setSelectedAccountIds([accRes.data.data[0].id]);
      }
      if (tagRes.data?.success) setTags(tagRes.data.data);
      if (tplRes.data?.success && tplRes.data.data.length > 0) {
        setTemplates(tplRes.data.data);
        setTemplateId(tplRes.data.data[0].id);
      }
      if (contactRes.data?.contacts) {
        setAvailableContacts(contactRes.data.contacts);
      }
    } catch (err) {
      console.error('Failed to load prerequisites', err);
    } finally {
      setLoadingContacts(false);
    }
  };

  const toggleAccountSelection = (accountId) => {
    const id = Number(accountId);
    if (selectedAccountIds.includes(id)) {
      if (selectedAccountIds.length === 1) {
        setError('At least one sending WhatsApp account must remain selected.');
        return;
      }
      setError('');
      setSelectedAccountIds(selectedAccountIds.filter(x => x !== id));
    } else {
      setError('');
      setSelectedAccountIds([...selectedAccountIds, id]);
    }
  };

  const toggleContactSelection = (contactId) => {
    const id = Number(contactId);
    setError('');
    if (selectedContactIds.includes(id)) {
      setSelectedContactIds(selectedContactIds.filter(x => x !== id));
    } else {
      setSelectedContactIds([...selectedContactIds, id]);
    }
  };

  const handleSelectAllContacts = (filteredList) => {
    const idsToSelect = filteredList.map(c => Number(c.id));
    const merged = Array.from(new Set([...selectedContactIds, ...idsToSelect]));
    setSelectedContactIds(merged);
    setError('');
  };

  const handleDeselectAllContacts = (filteredList) => {
    const idsToRemove = new Set(filteredList.map(c => Number(c.id)));
    setSelectedContactIds(selectedContactIds.filter(id => !idsToRemove.has(id)));
  };

  const handleAddManualAccount = async (e) => {
    e.preventDefault();
    setAddingAccount(true);
    setAccountFeedback({ type: '', text: '' });

    try {
      const res = await api.post('/whatsapp/connect', manualAccount);
      if (res.data?.success) {
        const newAcc = res.data.data;
        // Add to state and auto-select
        setAccounts((prev) => [...prev, newAcc]);
        setSelectedAccountIds((prev) => [...prev, newAcc.id]);
        setShowAddAccountModal(false);
        setManualAccount({ displayName: '', phoneNumber: '', phoneNumberId: '', wabaId: '', accessToken: '' });
        setAccountFeedback({ type: 'success', text: `Connected ${newAcc.display_name} successfully!` });
      }
    } catch (err) {
      setAccountFeedback({
        type: 'danger',
        text: err.response?.data?.error?.message || 'Failed to connect WhatsApp account'
      });
    } finally {
      setAddingAccount(false);
    }
  };

  // Download CSV Template
  const handleDownloadCsvTemplate = () => {
    const headers = 'Phone,Name,Email,City,Tag\n';
    const sampleRows = [
      '+919565763089,Yuvraj Kushwaha,yuvi@example.com,Lucknow,VIP',
      '+918601467210,Rahul Sharma,rahul@example.com,Delhi,Customer',
      '+919876543210,Pooja Verma,pooja@example.com,Mumbai,FestiveLead',
      '+919123456780,Amit Patel,amit@example.com,Bangalore,Retail',
      '+919988776655,Sneha Gupta,sneha@example.com,Pune,NewLead'
    ].join('\n');
    const blob = new Blob([headers + sampleRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'campaignflow_audience_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Helper to parse line with quotes
  const parseCsvLine = (line) => {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  };

  // Phone normalizer for Indian & International numbers
  const normalizePhoneNumber = (raw) => {
    if (!raw) return { isValid: false, phone: '', error: 'Empty phone number' };
    const cleaned = String(raw).replace(/[^\d+]/g, '');
    if (!cleaned) return { isValid: false, phone: '', error: 'Invalid characters in phone' };

    let formatted = cleaned;
    if (formatted.startsWith('+')) {
      // E.164 already
    } else if (formatted.startsWith('00')) {
      formatted = '+' + formatted.slice(2);
    } else if (formatted.length === 10 && /^[6-9]/.test(formatted)) {
      formatted = '+91' + formatted;
    } else if (formatted.length === 12 && formatted.startsWith('91')) {
      formatted = '+' + formatted;
    } else if (formatted.length >= 10 && formatted.length <= 15) {
      formatted = '+' + formatted;
    }

    const isValid = /^\+[1-9]\d{9,14}$/.test(formatted);
    return {
      isValid,
      phone: formatted,
      error: isValid ? null : 'Invalid phone format (must be 10-15 digits E.164, e.g. +919565763089)'
    };
  };

  // Process raw CSV text into review rows & stats
  const processCsvText = (text, fileName = 'contacts.csv') => {
    setCsvRawText(text);
    setCsvFileName(fileName);
    setCsvAppliedMessage(null);
    setError('');

    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) {
      setCsvReviewRows([]);
      setCsvStats({ total: 0, valid: 0, duplicates: 0, invalid: 0 });
      return;
    }

    const headers = parseCsvLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
    
    // Auto-detect columns
    let phoneCol = headers.find(h => /phone|mobile|contact|number|whatsapp/i.test(h)) || headers[0];
    let nameCol = headers.find(h => /name|customer|full_name/i.test(h)) || '';
    let emailCol = headers.find(h => /email|mail/i.test(h)) || '';
    let tagCol = headers.find(h => /tag|segment|group|city/i.test(h)) || '';

    setCsvColumnMapping({ phone: phoneCol, name: nameCol, email: emailCol, tag: tagCol });

    const seenPhones = new Set();
    const rows = [];
    let validCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const vals = parseCsvLine(lines[i]);
      const rowObj = {};
      headers.forEach((h, idx) => {
        rowObj[h] = vals[idx] !== undefined ? vals[idx] : '';
      });

      const rawPhone = rowObj[phoneCol] || '';
      const name = nameCol ? rowObj[nameCol] : '';
      const email = emailCol ? rowObj[emailCol] : '';
      const tag = tagCol ? rowObj[tagCol] : '';

      const norm = normalizePhoneNumber(rawPhone);
      let status = 'valid';
      let note = 'Ready for broadcast';

      if (!norm.isValid) {
        status = 'invalid';
        note = norm.error || 'Invalid phone format';
        invalidCount++;
      } else if (seenPhones.has(norm.phone)) {
        status = 'duplicate';
        note = 'Duplicate phone number in file';
        duplicateCount++;
      } else {
        seenPhones.add(norm.phone);
        validCount++;
      }

      rows.push({
        id: i,
        rowNumber: i,
        rawPhone,
        phone: norm.phone || rawPhone,
        name: name || '—',
        email: email || '—',
        tag: tag || '—',
        status,
        note
      });
    }

    setCsvReviewRows(rows);
    setCsvStats({
      total: rows.length,
      valid: validCount,
      duplicates: duplicateCount,
      invalid: invalidCount
    });
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target.result;
      processCsvText(content, file.name);
    };
    reader.readAsText(file);
  };

  const handleLoadDemoCsv = () => {
    const demoData = `Phone,Name,Email,City,Tag
+919565763089,Yuvraj Kushwaha,yuvi@example.com,Lucknow,VIP
+918601467210,Rahul Sharma,rahul@example.com,Delhi,Customer
+919876543210,Pooja Patel,pooja@example.com,Mumbai,FestiveLead
+919876543210,Pooja Duplicate,pooja.dup@example.com,Mumbai,FestiveLead
9811223344,Amit Verma,amit@example.com,Bangalore,Retail
9988776655,Sneha Rao,sneha@example.com,Pune,NewLead
12345,Invalid Entry,invalid@example.com,Goa,Test`;
    processCsvText(demoData, 'festive_demo_audience.csv');
  };

  // Import and attach CSV contacts to campaign
  const handleApplyCsvContacts = async () => {
    if (!csvRawText || csvStats.valid === 0) {
      setError('Please upload a valid CSV file with at least one valid phone number.');
      return;
    }

    try {
      setIsImportingCsv(true);
      setError('');
      setCsvAppliedMessage(null);

      const res = await api.post('/imports/execute', {
        csvText: csvRawText,
        fileName: csvFileName || 'campaign_audience.csv',
        columnMapping: {
          phone: csvColumnMapping.phone,
          name: csvColumnMapping.name || undefined,
          email: csvColumnMapping.email || undefined,
          tag: csvColumnMapping.tag || undefined,
          consent: 'consent'
        },
        consentSource: 'csv_campaign_audience_builder',
        defaultCountryCode: '91'
      });

      if (res.data?.success) {
        const importData = res.data.data;
        const importedIds = importData.contactIds || [];

        // Refresh available contacts in workspace
        const contactsRes = await api.get('/contacts?limit=500');
        if (contactsRes.data?.contacts) {
          setAvailableContacts(contactsRes.data.contacts);
        }

        // Set selected contacts to the imported ones
        if (importedIds.length > 0) {
          setSelectedContactIds(importedIds);
        }

        setCsvAppliedMessage({
          type: 'success',
          text: `Successfully verified and imported ${importData.successful} contact(s) (${importData.duplicates} duplicates skipped, ${importData.failed} invalid). They are now applied to this campaign broadcast! You can proceed to Next: Select Template.`
        });
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to import and apply CSV audience.');
    } finally {
      setIsImportingCsv(false);
    }
  };

  const handleAudiencePreview = async () => {
    try {
      setLoading(true);
      setError('');

      if (audienceMode === 'specific') {
        if (selectedContactIds.length === 0) {
          setError('Please select at least one contact (single or multiple) to target.');
          setLoading(false);
          return;
        }
      }

      if (audienceMode === 'csv') {
        if (selectedContactIds.length === 0) {
          setError('Please click "Confirm & Apply CSV Contacts to Campaign" to verify and target your audience before proceeding.');
          setLoading(false);
          return;
        }
      }

      const payload = (audienceMode === 'specific' || audienceMode === 'csv')
        ? { contactIds: selectedContactIds }
        : { tagIds: selectedTagIds };

      const res = await api.post('/campaigns/preview', payload);
      if (res.data?.success) {
        setAudienceEstimate(res.data.data);
        setStep(3);
      }
    } catch (err) {
      setError('Failed to estimate audience');
    } finally {
      setLoading(false);
    }
  };

  const handleRunPreflight = async () => {
    try {
      setLoading(true);
      setError('');
      const payload = {
        whatsappAccountId: selectedAccountIds[0],
        templateId,
        ...((audienceMode === 'specific' || audienceMode === 'csv')
          ? { contactIds: selectedContactIds }
          : { tagIds: selectedTagIds })
      };
      const res = await api.post('/campaigns/preflight', payload);
      if (res.data?.success) {
        setPreflightData(res.data.data);
        setStep(4);
      }
    } catch (err) {
      setError('Preflight validation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLaunchCampaign = async () => {
    try {
      setLoading(true);
      setError('');

      // 1. Create campaign record with multi-sender account IDs and audience selection
      const payload = {
        name: campaignName,
        purpose,
        whatsappAccountId: selectedAccountIds[0],
        whatsappAccountIds: selectedAccountIds,
        templateId,
        variableMappings,
        ...((audienceMode === 'specific' || audienceMode === 'csv')
          ? { contactIds: selectedContactIds }
          : { tagIds: selectedTagIds })
      };

      const createRes = await api.post('/campaigns', payload);
      const campaignId = createRes.data?.data?.id;

      // 2. Start campaign queue dispatch
      await api.post(`/campaigns/${campaignId}/start`);

      // 3. Navigate to campaign report page
      navigate(`/campaigns/${campaignId}`);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to launch campaign broadcast');
    } finally {
      setLoading(false);
    }
  };

  const selectedTemplateObj = templates.find(t => t.id === Number(templateId));
  const selectedAccounts = accounts.filter(a => selectedAccountIds.includes(a.id));

  // Filter contacts by opt-in status and live search query
  const filteredContacts = availableContacts.filter((c) => {
    if (optedInOnly && (!c.is_opted_in || c.status !== 'active')) return false;
    if (!contactSearch.trim()) return true;
    const q = contactSearch.toLowerCase();
    return (
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  // Filter CSV review rows by active tab and search query
  const filteredCsvReviewRows = csvReviewRows.filter((row) => {
    if (csvFilterTab === 'valid' && row.status !== 'valid') return false;
    if (csvFilterTab === 'duplicates' && row.status !== 'duplicate') return false;
    if (csvFilterTab === 'invalid' && row.status !== 'invalid') return false;
    if (csvSearchTerm.trim()) {
      const q = csvSearchTerm.toLowerCase();
      return (
        row.phone.toLowerCase().includes(q) ||
        row.rawPhone.toLowerCase().includes(q) ||
        (row.name && row.name.toLowerCase().includes(q)) ||
        (row.email && row.email.toLowerCase().includes(q)) ||
        (row.tag && row.tag.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div>
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between mb-4 gap-3">
        <div>
          <h2 className="brand-font mb-1">Create Marketing Campaign</h2>
          <p className="text-muted mb-0">Official WhatsApp broadcast wizard with multi-account rotation & compliance checks</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="wizard-stepper">
        <div className={`wizard-step ${step === 1 ? 'active' : step > 1 ? 'completed' : ''}`}>
          <div className="step-circle">{step > 1 ? '✓' : '1'}</div>
          <div className="step-label">Campaign & Senders</div>
        </div>
        <div className={`wizard-step ${step === 2 ? 'active' : step > 2 ? 'completed' : ''}`}>
          <div className="step-circle">{step > 2 ? '✓' : '2'}</div>
          <div className="step-label">Audience Filter</div>
        </div>
        <div className={`wizard-step ${step === 3 ? 'active' : step > 3 ? 'completed' : ''}`}>
          <div className="step-circle">{step > 3 ? '✓' : '3'}</div>
          <div className="step-label">Template & Variables</div>
        </div>
        <div className={`wizard-step ${step === 4 ? 'active' : step > 4 ? 'completed' : ''}`}>
          <div className="step-circle">{step > 4 ? '✓' : '4'}</div>
          <div className="step-label">Compliance Preflight</div>
        </div>
        <div className={`wizard-step ${step === 5 ? 'active' : ''}`}>
          <div className="step-circle">5</div>
          <div className="step-label">Launch Broadcast</div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show mb-4" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {accountFeedback.text && (
        <div className={`alert alert-${accountFeedback.type} alert-dismissible fade show mb-4`} role="alert">
          {accountFeedback.text}
          <button type="button" className="btn-close" onClick={() => setAccountFeedback({ type: '', text: '' })}></button>
        </div>
      )}

      {/* Step 1: Campaign Details & Multi-Sender Selection */}
      {step === 1 && (
        <div className="cf-card mb-4">
          <div className="cf-card-header d-flex flex-wrap align-items-center justify-content-between gap-2">
            <h5 className="mb-0">Step 1: Campaign Details & Sending Accounts</h5>
            <button
              type="button"
              onClick={() => setShowAddAccountModal(true)}
              className="btn btn-sm btn-outline-success d-flex align-items-center gap-1"
            >
              <i className="bi bi-plus-circle-fill"></i>
              <span>+ Add / Connect WhatsApp Account Manually</span>
            </button>
          </div>
          <div className="cf-card-body">
            <div className="row g-3 mb-4">
              <div className="col-12 col-md-6">
                <label className="form-label fw-bold">Campaign Name <span className="text-danger">*</span></label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Diwali Mega Sale 2026 - VIP Early Access"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  required
                />
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label fw-bold">Campaign Purpose / Category</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Customer activation & repeat sales"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                />
              </div>
            </div>

            {/* Multi-Account Selection Section */}
            <div className="mb-4">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <label className="form-label fw-bold mb-0">
                  Select Sending WhatsApp Account(s) <span className="text-danger">*</span>
                </label>
                <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                  {selectedAccountIds.length} {selectedAccountIds.length === 1 ? 'Sender Selected' : 'Senders (Multi-Account Rotation)'}
                </span>
              </div>
              <p className="text-muted small mb-3">
                Select one or more connected WhatsApp numbers. If multiple accounts are selected, CampaignFlow automatically round-robins messages across them to distribute the load and increase sending speed.
              </p>

              {/* Account Cards */}
              <div className="row g-3">
                {accounts.length === 0 ? (
                  <div className="col-12 text-center py-4 bg-light rounded-3 border">
                    <i className="bi bi-whatsapp fs-3 text-muted mb-2"></i>
                    <p className="text-muted small mb-2">No WhatsApp accounts connected yet.</p>
                    <button
                      type="button"
                      onClick={() => setShowAddAccountModal(true)}
                      className="btn btn-sm btn-success"
                    >
                      Connect Your First WhatsApp Account
                    </button>
                  </div>
                ) : (
                  accounts.map((acc) => {
                    const isSelected = selectedAccountIds.includes(acc.id);

                    return (
                      <div key={acc.id} className="col-12 col-md-6">
                        <div
                          onClick={() => toggleAccountSelection(acc.id)}
                          className={`p-3 rounded-3 border cursor-pointer transition d-flex align-items-start gap-3 ${isSelected ? 'border-success bg-success-subtle bg-opacity-10 shadow-sm' : 'bg-white'}`}
                          style={{ cursor: 'pointer' }}
                        >
                          <input
                            type="checkbox"
                            className="form-check-input mt-1"
                            checked={isSelected}
                            onChange={() => toggleAccountSelection(acc.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex-grow-1">
                            <div className="d-flex align-items-center justify-content-between mb-1">
                              <span className="fw-bold text-dark">{acc.display_name}</span>
                              <span className="badge bg-success-subtle text-success border border-success-subtle" style={{ fontSize: '0.7rem' }}>
                                {acc.quality_rating || 'GREEN'}
                              </span>
                            </div>
                            <div className="text-dark small fw-semibold mb-1">
                              <i className="bi bi-telephone me-1 text-success"></i>
                              <code>{acc.phone_number}</code>
                            </div>
                            <div className="d-flex align-items-center gap-2 text-muted small" style={{ fontSize: '0.75rem' }}>
                              <span>WABA: {acc.waba_id}</span>
                              <span>•</span>
                              <span>Tier: {acc.messaging_limit_tier || 'TIER_10K'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Multi-Sender Notice */}
              {selectedAccountIds.length > 1 && (
                <div className="alert alert-info py-2 small d-flex align-items-center gap-2 mt-3 mb-0">
                  <i className="bi bi-arrow-repeat fs-5 text-info"></i>
                  <div>
                    <strong>Multi-Sender Load Balancing Active:</strong> Messages will be distributed evenly via Round-Robin across the <strong>{selectedAccountIds.length}</strong> selected WhatsApp numbers.
                  </div>
                </div>
              )}
            </div>

            <div className="d-flex justify-content-end mt-4">
              <button
                type="button"
                disabled={!campaignName.trim() || selectedAccountIds.length === 0}
                onClick={() => setStep(2)}
                className="btn btn-cf-primary d-flex align-items-center gap-2"
              >
                <span>Next: Target Audience</span>
                <i className="bi bi-arrow-right"></i>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Audience Selection & Segment Filters */}
      {step === 2 && (
        <div className="cf-card mb-4">
          <div className="cf-card-header d-flex flex-wrap align-items-center justify-content-between gap-2">
            <div>
              <h5 className="mb-0">Step 2: Audience Selection & Segment Filters</h5>
              <div className="text-muted small">Choose whether to broadcast by segment tags, target all contacts, hand-pick specific contacts, or upload a CSV file.</div>
            </div>
            {/* Mode Switcher Tabs */}
            <div className="btn-group" role="group">
              <button
                type="button"
                className={`btn btn-sm ${audienceMode === 'tags' ? 'btn-success fw-bold' : 'btn-outline-secondary'}`}
                onClick={() => setAudienceMode('tags')}
              >
                <i className="bi bi-tags-fill me-1"></i>
                Target by Tags / All
              </button>
              <button
                type="button"
                className={`btn btn-sm ${audienceMode === 'specific' ? 'btn-success fw-bold' : 'btn-outline-secondary'}`}
                onClick={() => setAudienceMode('specific')}
              >
                <i className="bi bi-people-fill me-1"></i>
                Pick Specific Contacts
                {selectedContactIds.length > 0 && audienceMode !== 'csv' && (
                  <span className="badge bg-light text-success ms-1">{selectedContactIds.length}</span>
                )}
              </button>
              <button
                type="button"
                className={`btn btn-sm ${audienceMode === 'csv' ? 'btn-success fw-bold' : 'btn-outline-secondary'}`}
                onClick={() => setAudienceMode('csv')}
              >
                <i className="bi bi-file-earmark-spreadsheet-fill me-1"></i>
                Upload CSV Audience
                {audienceMode === 'csv' && selectedContactIds.length > 0 ? (
                  <span className="badge bg-light text-success ms-1">{selectedContactIds.length}</span>
                ) : csvStats.valid > 0 ? (
                  <span className="badge bg-light text-success ms-1">{csvStats.valid}</span>
                ) : null}
              </button>
            </div>
          </div>
          <div className="cf-card-body">
            {audienceMode === 'tags' && (
              <div>
                <p className="text-muted small mb-3">
                  Choose segment tags to target specific customer groups. Only contacts with active, verified marketing opt-in consent will be included.
                </p>

                <div className="mb-4">
                  <label className="form-label fw-bold">Filter By Segment Tags (Optional):</label>
                  <div className="d-flex flex-wrap gap-2">
                    {tags.length === 0 ? (
                      <span className="text-muted small">No segment tags created yet. Broadcast will reach all eligible contacts.</span>
                    ) : (
                      tags.map(t => {
                        const isChecked = selectedTagIds.includes(t.id);
                        return (
                          <button
                            type="button"
                            key={t.id}
                            onClick={() => {
                              if (isChecked) {
                                setSelectedTagIds(selectedTagIds.filter(id => id !== t.id));
                              } else {
                                setSelectedTagIds([...selectedTagIds, t.id]);
                              }
                            }}
                            className={`btn btn-sm ${isChecked ? 'btn-success' : 'btn-outline-secondary'}`}
                          >
                            {isChecked ? '✓ ' : '+ '} {t.name}
                          </button>
                        );
                      })
                    )}
                  </div>
                  <div className="form-text small mt-2">
                    <i className="bi bi-info-circle me-1"></i>
                    Leave empty to target all eligible opted-in contacts in your workspace. Or switch to <strong>"Pick Specific Contacts"</strong> or <strong>"Upload CSV Audience"</strong> above.
                  </div>
                </div>
              </div>
            )}

            {audienceMode === 'specific' && (
              <div>
                <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-3 pb-3 border-bottom">
                  <div>
                    <h6 className="fw-bold mb-1">Select Single or Multiple Specific Contacts</h6>
                    <p className="text-muted small mb-0">
                      Check the boxes next to the contacts you wish to include in this broadcast. Click any row to toggle.
                    </p>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <span className={`badge ${selectedContactIds.length > 0 ? 'bg-success' : 'bg-secondary'} fs-6 px-3 py-2`}>
                      <i className="bi bi-check2-circle me-1"></i>
                      {selectedContactIds.length} {selectedContactIds.length === 1 ? 'Contact Selected' : 'Contacts Selected'}
                    </span>
                    {selectedContactIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedContactIds([])}
                        className="btn btn-sm btn-outline-danger"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="row g-2 mb-3 align-items-center">
                  <div className="col-12 col-md-6">
                    <div className="input-group input-group-sm">
                      <span className="input-group-text bg-white">
                        <i className="bi bi-search text-muted"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search contact by name, phone (+91...) or email..."
                        value={contactSearch}
                        onChange={(e) => setContactSearch(e.target.value)}
                      />
                      {contactSearch && (
                        <button
                          className="btn btn-outline-secondary"
                          type="button"
                          onClick={() => setContactSearch('')}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="col-12 col-md-6 d-flex align-items-center justify-content-md-end gap-2 flex-wrap">
                    <div className="form-check form-switch small mb-0 me-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="optedInOnlySwitch"
                        checked={optedInOnly}
                        onChange={(e) => setOptedInOnly(e.target.checked)}
                      />
                      <label className="form-check-label text-muted" htmlFor="optedInOnlySwitch">
                        Opted-in Only
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectAllContacts(filteredContacts)}
                      disabled={filteredContacts.length === 0}
                      className="btn btn-sm btn-outline-success"
                    >
                      Select All Shown ({filteredContacts.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeselectAllContacts(filteredContacts)}
                      disabled={selectedContactIds.length === 0}
                      className="btn btn-sm btn-outline-secondary"
                    >
                      Deselect Shown
                    </button>
                  </div>
                </div>

                {/* Contacts Table List */}
                {loadingContacts ? (
                  <div className="text-center py-4 text-muted">
                    <div className="spinner-border spinner-border-sm text-success me-2" role="status"></div>
                    Loading workspace contacts...
                  </div>
                ) : filteredContacts.length === 0 ? (
                  <div className="text-center py-5 bg-light rounded-3 border">
                    <i className="bi bi-person-x fs-1 text-muted mb-2"></i>
                    <h6 className="fw-bold text-dark">No contacts match your filter</h6>
                    <p className="text-muted small mb-2">
                      {contactSearch
                        ? `No contact found matching "${contactSearch}".`
                        : 'No contacts available in this workspace yet.'}
                    </p>
                    {contactSearch && (
                      <button
                        type="button"
                        onClick={() => setContactSearch('')}
                        className="btn btn-sm btn-outline-secondary"
                      >
                        Reset Search
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="table-responsive border rounded-3" style={{ maxHeight: '360px', overflowY: 'auto' }}>
                    <table className="table table-hover align-middle mb-0">
                      <thead className="table-light sticky-top" style={{ zIndex: 1 }}>
                        <tr>
                          <th style={{ width: '40px' }} className="text-center">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={
                                filteredContacts.length > 0 &&
                                filteredContacts.every(c => selectedContactIds.includes(Number(c.id)))
                              }
                              onChange={(e) => {
                                if (e.target.checked) {
                                  handleSelectAllContacts(filteredContacts);
                                } else {
                                  handleDeselectAllContacts(filteredContacts);
                                }
                              }}
                              title="Toggle select all shown"
                            />
                          </th>
                          <th>Contact Name & Email</th>
                          <th>Phone Number</th>
                          <th>Marketing Consent</th>
                          <th>Tags</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredContacts.map((c) => {
                          const isSelected = selectedContactIds.includes(Number(c.id));
                          const isEligible = Boolean(c.is_opted_in && c.status === 'active');
                          return (
                            <tr
                              key={c.id}
                              onClick={() => toggleContactSelection(c.id)}
                              style={{ cursor: 'pointer' }}
                              className={isSelected ? 'table-success bg-opacity-25' : ''}
                            >
                              <td className="text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  checked={isSelected}
                                  onChange={() => toggleContactSelection(c.id)}
                                />
                              </td>
                              <td>
                                <div className="d-flex align-items-center gap-2">
                                  <div
                                    className="rounded-circle bg-success-subtle text-success d-flex align-items-center justify-content-center fw-bold"
                                    style={{ width: '32px', height: '32px', fontSize: '0.8rem' }}
                                  >
                                    {(c.name || 'C').charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="fw-bold text-dark">{c.name || 'Unnamed Contact'}</div>
                                    {c.email && <div className="text-muted small">{c.email}</div>}
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div className="font-monospace fw-semibold text-dark">
                                  <i className="bi bi-whatsapp text-success me-1"></i>
                                  {c.phone}
                                </div>
                              </td>
                              <td>
                                {isEligible ? (
                                  <span className="badge bg-success-subtle text-success border border-success-subtle">
                                    <i className="bi bi-check-circle-fill me-1"></i>
                                    Opted In
                                  </span>
                                ) : (
                                  <span className="badge bg-danger-subtle text-danger border border-danger-subtle">
                                    <i className="bi bi-x-circle-fill me-1"></i>
                                    Unsubscribed / Inactive
                                  </span>
                                )}
                              </td>
                              <td>
                                {c.tags && c.tags.length > 0 ? (
                                  <div className="d-flex flex-wrap gap-1">
                                    {c.tags.map((t) => (
                                      <span key={t.id || t.name} className="badge bg-light text-dark border">
                                        {t.name}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-muted small">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="alert alert-info py-2 small d-flex align-items-center gap-2 mt-3 mb-0">
                  <i className="bi bi-info-circle-fill fs-5 text-info"></i>
                  <div>
                    <strong>Targeting Mode:</strong> {selectedContactIds.length > 0 ? (
                      <span>You have hand-picked <strong>{selectedContactIds.length}</strong> contact(s). Only these specific numbers will receive this WhatsApp broadcast.</span>
                    ) : (
                      <span>Please check one or more contact checkboxes to create a targeted list, or click <strong>"Target by Tags / All"</strong> or <strong>"Upload CSV Audience"</strong> above.</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* AUDIENCE MODE 3: UPLOAD CSV AUDIENCE */}
            {audienceMode === 'csv' && (
              <div>
                {/* Header Action Bar with Download Template & Load Sample */}
                <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-3 pb-3 border-bottom">
                  <div>
                    <h6 className="fw-bold mb-1 d-flex align-items-center gap-2">
                      <i className="bi bi-file-earmark-spreadsheet-fill text-success"></i>
                      Upload Audience CSV with Live Phone Validation & Review
                    </h6>
                    <p className="text-muted small mb-0">
                      Upload your customer list in CSV format. We will automatically format phone numbers to E.164 (+91...), flag duplicates, and allow you to review all rows before attaching.
                    </p>
                  </div>
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      id="downloadCsvTemplateBtn"
                      onClick={handleDownloadCsvTemplate}
                      className="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-1 fw-semibold shadow-sm"
                      title="Download clean CSV format with sample headers"
                    >
                      <i className="bi bi-cloud-arrow-down-fill"></i>
                      Download CSV Template
                    </button>
                    <button
                      type="button"
                      onClick={handleLoadDemoCsv}
                      className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
                      title="Quickly test with demo audience numbers"
                    >
                      <i className="bi bi-magic"></i>
                      Load Sample Demo Data
                    </button>
                  </div>
                </div>

                {/* Upload Zone */}
                <div className="p-4 mb-4 border border-2 border-dashed rounded-3 bg-light text-center">
                  <div className="d-flex flex-column align-items-center justify-content-center">
                    <div className="rounded-circle bg-success-subtle text-success p-3 mb-2">
                      <i className="bi bi-filetype-csv fs-1"></i>
                    </div>
                    <h6 className="fw-bold mb-1">
                      {csvFileName ? `File Selected: ${csvFileName}` : 'Choose or Drag & Drop your Audience CSV file'}
                    </h6>
                    <p className="text-muted small mb-3">
                      Columns expected: <code>Phone</code>, <code>Name</code>, <code>Email</code>, <code>City / Tag</code> (Supported: .csv, .txt)
                    </p>
                    <div className="d-flex align-items-center gap-2">
                      <label className="btn btn-sm btn-success px-4 py-2 cursor-pointer shadow-sm fw-semibold">
                        <i className="bi bi-folder2-open me-2"></i>
                        {csvFileName ? 'Change CSV File' : 'Browse CSV File'}
                        <input
                          type="file"
                          accept=".csv, text/csv, text/plain"
                          className="d-none"
                          onChange={handleFileUpload}
                        />
                      </label>
                      {csvFileName && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => {
                            setCsvRawText('');
                            setCsvFileName('');
                            setCsvReviewRows([]);
                            setCsvStats({ total: 0, valid: 0, duplicates: 0, invalid: 0 });
                            setCsvAppliedMessage(null);
                          }}
                        >
                          <i className="bi bi-trash me-1"></i> Clear
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Applied / Success Feedback Notification */}
                {csvAppliedMessage && (
                  <div className={`alert alert-${csvAppliedMessage.type} alert-dismissible fade show d-flex align-items-center gap-2 mb-4 shadow-sm`} role="alert">
                    <i className="bi bi-check-circle-fill fs-5 text-success"></i>
                    <div className="flex-grow-1">
                      <strong>Audience Attached:</strong> {csvAppliedMessage.text}
                    </div>
                    <button type="button" className="btn-close" onClick={() => setCsvAppliedMessage(null)}></button>
                  </div>
                )}

                {/* Review Section (shown when rows are parsed) */}
                {csvReviewRows.length > 0 ? (
                  <div>
                    {/* Validation Metrics Summary Cards */}
                    <div className="row g-2 mb-3 text-center">
                      <div className="col-6 col-md-3">
                        <div
                          className={`p-3 border rounded-3 bg-white h-100 ${csvFilterTab === 'all' ? 'border-primary ring-2 shadow-sm' : ''}`}
                          onClick={() => setCsvFilterTab('all')}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="text-muted small fw-semibold">Total Rows</div>
                          <div className="fs-4 fw-bold text-dark">{csvStats.total}</div>
                          <span className="badge bg-light text-dark border small">All records</span>
                        </div>
                      </div>
                      <div className="col-6 col-md-3">
                        <div
                          className={`p-3 border rounded-3 bg-success-subtle border-success-subtle h-100 ${csvFilterTab === 'valid' ? 'border-success shadow-sm' : ''}`}
                          onClick={() => setCsvFilterTab('valid')}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="text-success small fw-semibold">Valid & Ready</div>
                          <div className="fs-4 fw-bold text-success">{csvStats.valid}</div>
                          <span className="badge bg-success small">Targetable</span>
                        </div>
                      </div>
                      <div className="col-6 col-md-3">
                        <div
                          className={`p-3 border rounded-3 bg-warning-subtle border-warning-subtle h-100 ${csvFilterTab === 'duplicates' ? 'border-warning shadow-sm' : ''}`}
                          onClick={() => setCsvFilterTab('duplicates')}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="text-warning-emphasis small fw-semibold">Duplicates in File</div>
                          <div className="fs-4 fw-bold text-warning-emphasis">{csvStats.duplicates}</div>
                          <span className="badge bg-warning text-dark small">Skipped</span>
                        </div>
                      </div>
                      <div className="col-6 col-md-3">
                        <div
                          className={`p-3 border rounded-3 bg-danger-subtle border-danger-subtle h-100 ${csvFilterTab === 'invalid' ? 'border-danger shadow-sm' : ''}`}
                          onClick={() => setCsvFilterTab('invalid')}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="text-danger small fw-semibold">Invalid / Ineligible</div>
                          <div className="fs-4 fw-bold text-danger">{csvStats.invalid}</div>
                          <span className="badge bg-danger small">Needs Fix</span>
                        </div>
                      </div>
                    </div>

                    {/* Filter Tabs and Search Bar inside Review */}
                    <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2 mb-3">
                      <div className="btn-group btn-group-sm" role="group">
                        <button
                          type="button"
                          className={`btn ${csvFilterTab === 'all' ? 'btn-dark' : 'btn-outline-secondary'}`}
                          onClick={() => setCsvFilterTab('all')}
                        >
                          All ({csvStats.total})
                        </button>
                        <button
                          type="button"
                          className={`btn ${csvFilterTab === 'valid' ? 'btn-success' : 'btn-outline-success'}`}
                          onClick={() => setCsvFilterTab('valid')}
                        >
                          Valid Only ({csvStats.valid})
                        </button>
                        <button
                          type="button"
                          className={`btn ${csvFilterTab === 'duplicates' ? 'btn-warning text-dark' : 'btn-outline-warning'}`}
                          onClick={() => setCsvFilterTab('duplicates')}
                        >
                          Duplicates ({csvStats.duplicates})
                        </button>
                        <button
                          type="button"
                          className={`btn ${csvFilterTab === 'invalid' ? 'btn-danger' : 'btn-outline-danger'}`}
                          onClick={() => setCsvFilterTab('invalid')}
                        >
                          Invalid ({csvStats.invalid})
                        </button>
                      </div>

                      <div className="input-group input-group-sm" style={{ maxWidth: '320px' }}>
                        <span className="input-group-text bg-white">
                          <i className="bi bi-search text-muted"></i>
                        </span>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Search in CSV rows..."
                          value={csvSearchTerm}
                          onChange={(e) => setCsvSearchTerm(e.target.value)}
                        />
                        {csvSearchTerm && (
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => setCsvSearchTerm('')}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Review Table */}
                    <div className="table-responsive border rounded-3 mb-3" style={{ maxHeight: '360px', overflowY: 'auto' }}>
                      <table className="table table-hover align-middle mb-0 cf-table">
                        <thead className="table-light sticky-top">
                          <tr>
                            <th style={{ width: '40px' }} className="text-center">#</th>
                            <th>Phone Number (Normalized E.164)</th>
                            <th>Contact Name</th>
                            <th>Email</th>
                            <th>Tag / City</th>
                            <th>Status</th>
                            <th>Audit Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredCsvReviewRows.length === 0 ? (
                            <tr>
                              <td colSpan="7" className="text-center py-4 text-muted">
                                No records match the active filter "{csvFilterTab}".
                              </td>
                            </tr>
                          ) : (
                            filteredCsvReviewRows.map((r) => (
                              <tr
                                key={r.id}
                                className={
                                  r.status === 'valid'
                                    ? ''
                                    : r.status === 'duplicate'
                                    ? 'table-warning bg-opacity-10'
                                    : 'table-danger bg-opacity-10'
                                }
                              >
                                <td className="text-center text-muted small">{r.rowNumber}</td>
                                <td>
                                  <div className="font-monospace fw-semibold">
                                    <i className={`bi ${r.status === 'valid' ? 'bi-whatsapp text-success' : 'bi-telephone text-muted'} me-1`}></i>
                                    {r.phone}
                                  </div>
                                  {r.rawPhone !== r.phone && (
                                    <div className="text-muted small" style={{ fontSize: '0.75rem' }}>
                                      Raw: {r.rawPhone}
                                    </div>
                                  )}
                                </td>
                                <td>
                                  <div className="fw-bold text-dark">{r.name}</div>
                                </td>
                                <td className="text-muted small">{r.email}</td>
                                <td>
                                  {r.tag !== '—' ? (
                                    <span className="badge bg-light text-dark border">{r.tag}</span>
                                  ) : (
                                    <span className="text-muted small">—</span>
                                  )}
                                </td>
                                <td>
                                  {r.status === 'valid' && (
                                    <span className="badge bg-success-subtle text-success border border-success-subtle">
                                      <i className="bi bi-check-circle-fill me-1"></i>
                                      Valid & Ready
                                    </span>
                                  )}
                                  {r.status === 'duplicate' && (
                                    <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle">
                                      <i className="bi bi-exclamation-triangle-fill me-1"></i>
                                      Duplicate
                                    </span>
                                  )}
                                  {r.status === 'invalid' && (
                                    <span className="badge bg-danger-subtle text-danger border border-danger-subtle">
                                      <i className="bi bi-x-circle-fill me-1"></i>
                                      Invalid
                                    </span>
                                  )}
                                </td>
                                <td className="text-muted small">{r.note}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Bottom Action Bar for CSV */}
                    <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between p-3 bg-light border rounded-3 gap-3">
                      <div>
                        <div className="fw-semibold text-dark">
                          Ready to target {csvStats.valid} valid recipient(s)
                        </div>
                        <div className="text-muted small">
                          Clicking below will save and verify consent for these contacts and immediately link them to this campaign broadcast.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleApplyCsvContacts}
                        disabled={isImportingCsv || csvStats.valid === 0}
                        className="btn btn-success fw-bold d-inline-flex align-items-center gap-2 px-4 shadow-sm"
                      >
                        {isImportingCsv ? (
                          <>
                            <div className="spinner-border spinner-border-sm" role="status"></div>
                            <span>Applying Audience ({csvStats.valid})...</span>
                          </>
                        ) : (
                          <>
                            <i className="bi bi-check2-all fs-5"></i>
                            <span>Confirm & Apply CSV Contacts ({csvStats.valid})</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="alert alert-secondary py-3 text-center mb-0">
                    <i className="bi bi-cloud-arrow-up fs-3 text-muted d-block mb-1"></i>
                    <span className="text-muted small">
                      Please upload a CSV file above or click <strong>"Load Sample Demo Data"</strong> to preview your contacts.
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="d-flex justify-content-between mt-4">
              <button type="button" onClick={() => setStep(1)} className="btn btn-outline-secondary">
                Back
              </button>
              <button
                type="button"
                onClick={handleAudiencePreview}
                disabled={loading || ((audienceMode === 'specific' || audienceMode === 'csv') && selectedContactIds.length === 0)}
                className="btn btn-cf-primary d-flex align-items-center gap-2"
              >
                {loading ? 'Estimating Audience...' : (
                  <>
                    <span>Next: Select Template</span>
                    <i className="bi bi-arrow-right"></i>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Template & Variable Mapping */}
      {step === 3 && (
        <div className="cf-card mb-4">
          <div className="cf-card-header">
            <h5 className="mb-0">Step 3: Select Approved Template & Map Variables</h5>
            <span className="badge bg-success-subtle text-success">
              Audience: {audienceEstimate?.estimatedCount || 0} Opted-In Recipients {audienceMode === 'specific' ? '(Direct Selection)' : ''}
            </span>
          </div>
          <div className="cf-card-body">
            <div className="row g-4">
              <div className="col-12 col-md-6">
                <label className="form-label fw-bold">Choose WhatsApp Approved Template <span className="text-danger">*</span></label>
                <select
                  className="form-select mb-3"
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  required
                >
                  {templates.map(tpl => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name} ({tpl.language}) - {tpl.category}
                    </option>
                  ))}
                </select>

                {(() => {
                  const tplComps = Array.isArray(selectedTemplateObj?.components)
                    ? selectedTemplateObj.components
                    : (typeof selectedTemplateObj?.components === 'string' ? JSON.parse(selectedTemplateObj?.components || '[]') : []);
                  const bodyComp = tplComps.find(c => c.type === 'BODY' || c.type === 'body');
                  const bodyText = bodyComp?.text || '';
                  const placeholders = Array.from(new Set(bodyText.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) || [])).sort();

                  if (placeholders.length === 0) {
                    const isHelloWorld = selectedTemplateObj?.name === 'hello_world';
                    const hasIndianSender = selectedAccounts.some(acc => acc.phone_number?.includes('+91') || acc.display_name?.includes('Indian'));

                    return (
                      <div className={`alert ${isHelloWorld && hasIndianSender ? 'alert-warning' : 'alert-info'} py-3 small d-flex align-items-start gap-2 mt-3 mb-0`}>
                        <i className={`bi ${isHelloWorld && hasIndianSender ? 'bi-exclamation-triangle-fill text-warning' : 'bi-check-circle-fill text-info'} fs-5 mt-1`}></i>
                        <div>
                          <strong>{isHelloWorld && hasIndianSender ? 'Meta Cloud API Policy Notice (#131058):' : 'Official Approved Fixed Template:'}</strong>
                          <p className="mb-1 mt-1 text-muted">
                            {isHelloWorld && hasIndianSender ? (
                              <>
                                Meta strictly enforces that <code>hello_world</code> can <strong>ONLY</strong> be sent from Public Test Numbers (<code>+1 555-199-9056</code>). To broadcast from your Indian number (<code>+91 86014 67210</code>), select a custom approved template like <code>welcome_msg</code>.
                              </>
                            ) : (
                              <>
                                Template <code>{selectedTemplateObj?.name}</code> does not require custom parameter mapping. It is pre-approved by Meta and ready to send directly.
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div>
                      <h6 className="fw-bold mt-4 mb-2">Map Template Placeholders ({placeholders.length} Required)</h6>
                      {placeholders.map((ph, idx) => {
                        const varKey = `var_${idx + 1}`;
                        const cleanKey = ph.replace(/[{}]/g, '');
                        return (
                          <div key={ph} className="mb-3">
                            <label className="form-label small fw-semibold">
                              Variable {ph} {idx === 0 ? '(e.g. Customer Name)' : `(Parameter: ${cleanKey})`}
                            </label>
                            <input
                              type="text"
                              className="form-control"
                              placeholder={idx === 0 ? 'contact.name' : `Value for ${cleanKey}`}
                              value={variableMappings[cleanKey] || variableMappings[varKey] || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setVariableMappings({
                                  ...variableMappings,
                                  [varKey]: val,
                                  [cleanKey]: val
                                });
                              }}
                            />
                            {idx === 0 && <div className="form-text small">Use "contact.name" for recipient personalization.</div>}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Mobile Preview */}
              <div className="col-12 col-md-6 text-center">
                <div className="small fw-bold text-muted mb-2 text-uppercase">Sample Recipient Preview</div>
                <div className="wa-preview-screen">
                  <div className="wa-bubble text-start">
                    {(() => {
                      const tplComps = Array.isArray(selectedTemplateObj?.components)
                        ? selectedTemplateObj.components
                        : (typeof selectedTemplateObj?.components === 'string' ? JSON.parse(selectedTemplateObj?.components || '[]') : []);
                      const headerComp = tplComps.find(c => c.type === 'HEADER' || c.type === 'header');
                      const bodyComp = tplComps.find(c => c.type === 'BODY' || c.type === 'body');
                      const footerComp = tplComps.find(c => c.type === 'FOOTER' || c.type === 'footer');
                      const btnComp = tplComps.find(c => c.type === 'BUTTONS' || c.type === 'buttons');

                      let previewBody = bodyComp?.text || 'Hello from WhatsApp';
                      const phMatches = Array.from(new Set(previewBody.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) || []));
                      phMatches.forEach((ph, idx) => {
                        const varKey = `var_${idx + 1}`;
                        const cleanKey = ph.replace(/[{}]/g, '');
                        const mappedVal = variableMappings[cleanKey] || variableMappings[varKey];
                        const displayVal = (mappedVal === 'contact.name' || (!mappedVal && idx === 0)) ? 'Ananya Gupta' : (mappedVal || `[${cleanKey}]`);
                        previewBody = previewBody.split(ph).join(displayVal);
                      });

                      return (
                        <>
                          {headerComp?.text && <div className="wa-header">{headerComp.text}</div>}
                          <div className="wa-body" style={{ whiteSpace: 'pre-wrap' }}>
                            {previewBody}
                          </div>
                          {footerComp?.text && <div className="wa-footer">{footerComp.text}</div>}
                          {btnComp?.buttons?.[0]?.text && <div className="wa-button">{btnComp.buttons[0].text}</div>}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>

            <div className="d-flex justify-content-between mt-4">
              <button type="button" onClick={() => setStep(2)} className="btn btn-outline-secondary">
                Back
              </button>
              <button
                type="button"
                onClick={handleRunPreflight}
                disabled={loading}
                className="btn btn-cf-primary d-flex align-items-center gap-2"
              >
                {loading ? 'Running Checks...' : (
                  <>
                    <span>Next: Compliance Preflight</span>
                    <i className="bi bi-shield-check"></i>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Compliance Preflight Checks */}
      {step === 4 && preflightData && (
        <div className="cf-card mb-4">
          <div className="cf-card-header bg-light">
            <h5 className="mb-0">Step 4: Meta Compliance & Preflight Verification</h5>
          </div>
          <div className="cf-card-body">
            <div className="row g-3 mb-4">
              <div className="col-12 col-md-4">
                <div className="p-3 border rounded-3 bg-light">
                  <div className="small text-muted">Audience Eligible</div>
                  <div className="fs-3 fw-bold text-success">{preflightData.audienceCount}</div>
                  <div className="small text-muted">Verified opted-in contacts</div>
                </div>
              </div>

              <div className="col-12 col-md-4">
                <div className="p-3 border rounded-3 bg-light">
                  <div className="small text-muted">Selected Senders</div>
                  <div className="fs-3 fw-bold text-dark">{selectedAccountIds.length}</div>
                  <div className="small text-muted">WhatsApp numbers connected</div>
                </div>
              </div>

              <div className="col-12 col-md-4">
                <div className="p-3 border rounded-3 bg-light">
                  <div className="small text-muted">Template Verification</div>
                  <div className="fs-3 fw-bold text-success">APPROVED</div>
                  <div className="small text-muted">Meta Marketing Category</div>
                </div>
              </div>
            </div>

            {preflightData.issues.length > 0 ? (
              <div className="alert alert-warning mb-4">
                <h6 className="fw-bold mb-2">Issues detected that must be resolved:</h6>
                <ul className="mb-0">
                  {preflightData.issues.map((issue, idx) => (
                    <li key={idx}>{issue}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="alert alert-success d-flex align-items-center gap-2 mb-4">
                <i className="bi bi-check-circle-fill fs-4"></i>
                <div>
                  <strong>All Preflight Checks Passed!</strong> This broadcast complies with WhatsApp Business Cloud API policies.
                </div>
              </div>
            )}

            <div className="d-flex justify-content-between">
              <button type="button" onClick={() => setStep(3)} className="btn btn-outline-secondary">
                Back
              </button>
              <button
                type="button"
                disabled={!preflightData.canProceed}
                onClick={() => setStep(5)}
                className="btn btn-cf-primary d-flex align-items-center gap-2"
              >
                <span>Proceed to Launch</span>
                <i className="bi bi-arrow-right"></i>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 5: Launch / Schedule */}
      {step === 5 && (
        <div className="cf-card mb-4">
          <div className="cf-card-header bg-success-subtle">
            <h5 className="mb-0 text-success">Step 5: Launch Broadcast Campaign</h5>
          </div>
          <div className="cf-card-body">
            <div className="p-4 border rounded-3 bg-light mb-4">
              <h5 className="fw-bold text-dark mb-3">Broadcast Summary Confirmation</h5>
              <div className="row g-2 small">
                <div className="col-sm-4 text-muted">Campaign Name:</div>
                <div className="col-sm-8 fw-bold">{campaignName}</div>

                <div className="col-sm-4 text-muted">Estimated Recipients:</div>
                <div className="col-sm-8 text-success fw-bold">
                  {preflightData?.audienceCount} Eligible Contacts 
                  {audienceMode === 'specific' && ` (${selectedContactIds.length} Hand-Picked)`}
                </div>

                <div className="col-sm-4 text-muted">Sending Numbers:</div>
                <div className="col-sm-8">
                  {selectedAccounts.map(a => (
                    <span key={a.id} className="badge bg-dark me-1">
                      {a.display_name} ({a.phone_number})
                    </span>
                  ))}
                  {selectedAccountIds.length > 1 && (
                    <span className="badge bg-info text-dark ms-1">
                      Round-Robin Rotation
                    </span>
                  )}
                </div>

                <div className="col-sm-4 text-muted">Template:</div>
                <div className="col-sm-8">{selectedTemplateObj?.name}</div>

                <div className="col-sm-4 text-muted">Background Dispatch:</div>
                <div className="col-sm-8 text-dark">BullMQ + Redis Worker (Rate-limited with jitter)</div>
              </div>
            </div>

            <div className="d-flex justify-content-between">
              <button type="button" onClick={() => setStep(4)} className="btn btn-outline-secondary">
                Back
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleLaunchCampaign}
                className="btn btn-success btn-lg d-flex align-items-center gap-2 px-4 shadow"
              >
                {loading ? 'Dispatching...' : (
                  <>
                    <i className="bi bi-send-fill"></i>
                    <span>Launch WhatsApp Broadcast Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual WhatsApp Account Connection Modal */}
      {showAddAccountModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px' }}>
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-whatsapp text-success me-2"></i>
                  Add WhatsApp Sending Account
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowAddAccountModal(false)}></button>
              </div>
              <form onSubmit={handleAddManualAccount}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Display / Brand Name <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Acme Support Line 2"
                      value={manualAccount.displayName}
                      onChange={(e) => setManualAccount({ ...manualAccount, displayName: e.target.value })}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Sender Phone Number <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="+919811223344"
                      value={manualAccount.phoneNumber}
                      onChange={(e) => setManualAccount({ ...manualAccount, phoneNumber: e.target.value })}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Meta Phone Number ID <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control font-monospace"
                      placeholder="e.g. 1092837465993"
                      value={manualAccount.phoneNumberId}
                      onChange={(e) => setManualAccount({ ...manualAccount, phoneNumberId: e.target.value })}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Meta WABA ID <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control font-monospace"
                      placeholder="e.g. 992837465001"
                      value={manualAccount.wabaId}
                      onChange={(e) => setManualAccount({ ...manualAccount, wabaId: e.target.value })}
                      required
                    />
                  </div>

                  <div className="mb-2">
                    <label className="form-label small fw-semibold">System User Access Token</label>
                    <input
                      type="password"
                      className="form-control font-monospace"
                      placeholder="Permanent Meta Graph API Token (Optional in dev)"
                      value={manualAccount.accessToken}
                      onChange={(e) => setManualAccount({ ...manualAccount, accessToken: e.target.value })}
                    />
                    <div className="form-text small">Leave empty in development to use test mock adapter.</div>
                  </div>
                </div>

                <div className="modal-footer border-top bg-light">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddAccountModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" disabled={addingAccount} className="btn btn-cf-primary">
                    {addingAccount ? 'Connecting...' : 'Connect & Add to Campaign'}
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
