import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../services/api';
import AiwavoHeader from '../components/AiwavoHeader';
import '../styles/dashboard.css';

const SAMPLE_CSV = `phone,name,email,tag,consent
9811122233,Ananya Gupta,ananya@test.com,VIP Customer,yes
9822233344,Vikram Malhotra,vikram@test.com,Diwali Festival 2026,yes
9833344455,Sunita Rao,sunita@test.com,Weekend Shopper,yes
9844455566,Rohan Mehra,rohan@test.com,VIP Customer,yes
9844455566,Rohan Duplicate,rohan@test.com,VIP Customer,yes
9877700011,Karan Johar,karan@test.com,Unverified Lead,no`;

export default function CsvImport() {
  const outletContext = useOutletContext();
  const onToggleSidebar = outletContext?.onToggleSidebar;
  const fileInputRef = useRef(null);
  const [step, setStep] = useState(1);
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState([]);
  const [sampleRows, setSampleRows] = useState([]);
  const [columnMapping, setColumnMapping] = useState({
    phone: '',
    name: '',
    email: '',
    tag: '',
    consent: ''
  });

  const [importResult, setImportResult] = useState(null);
  const [importHistory, setImportHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await api.get('/imports');
      if (res.data?.success) setImportHistory(res.data.data);
    } catch (err) {
      console.error('Failed to load import history', err);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      setCsvText(evt.target.result);
    };
    reader.readAsText(file);
  };

  const handlePreview = async () => {
    if (!csvText.trim()) {
      setError('Please provide or upload CSV content');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/imports/preview', { csvText });
      if (res.data?.success) {
        setHeaders(res.data.data.headers);
        setSampleRows(res.data.data.sample);
        setColumnMapping({
          phone: res.data.data.mappingSuggestions.phone || res.data.data.headers[0] || '',
          name: res.data.data.mappingSuggestions.name || '',
          email: res.data.data.mappingSuggestions.email || '',
          tag: res.data.data.mappingSuggestions.tag || '',
          consent: res.data.data.mappingSuggestions.consent || ''
        });
        setStep(2);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to parse CSV preview');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!columnMapping.phone) {
      setError('Please select which column contains the Phone Number');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await api.post('/imports/execute', {
        csvText,
        fileName,
        columnMapping,
        consentSource: 'csv_upload_batch',
        defaultCountryCode: '91'
      });

      if (res.data?.success) {
        setImportResult(res.data.data);
        setStep(3);
        fetchHistory();
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'CSV Import failed');
    } finally {
      setLoading(false);
    }
  };

  const loadSampleData = () => {
    setCsvText(SAMPLE_CSV);
    setFileName('sample_festive_audience.csv');
  };

  const handleDownloadSampleCsv = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_audience_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <AiwavoHeader
        title="Excel Manager"
        subtitle="Bulk contact ingestion with E.164 normalization, intra-file deduplication & consent checks"
        onToggleSidebar={onToggleSidebar}
      />

      <div className="em-page-container">
        {error && (
          <div className="alert alert-danger alert-dismissible fade show mb-4 rounded-3 shadow-sm" role="alert">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            {error}
            <button type="button" className="btn-close" onClick={() => setError('')}></button>
          </div>
        )}

        {/* Hero Banner */}
        <div className="em-hero-banner">
          <div className="em-hero-left">
            <div className="em-hero-icon">
              <i className="bi bi-file-earmark-excel"></i>
            </div>
            <div>
              <h1 className="em-hero-title">Manage Excel Import</h1>
              <p className="em-hero-subtitle">
                Bulk contact ingestion with E.164 normalization, duplicate check and consent mapping.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDownloadSampleCsv}
            className="em-hero-btn-blue"
          >
            <i className="bi bi-download"></i>
            <span>Download Sample CSV Template</span>
          </button>
        </div>

        {/* Wizard Stepper */}
        <div className="em-stepper-wrap">
          <div className="em-stepper-line">
            <div
              className="em-stepper-line-progress"
              style={{
                width: step === 1 ? '16%' : step === 2 ? '50%' : '100%'
              }}
            ></div>
          </div>
          <div className="em-step-item">
            <div className={`em-step-circle ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
              {step > 1 ? '✓' : '1'}
            </div>
            <div className={`em-step-label ${step === 1 ? 'active' : ''}`}>Upload CSV</div>
          </div>
          <div className="em-step-item">
            <div className={`em-step-circle ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
              {step > 2 ? '✓' : '2'}
            </div>
            <div className={`em-step-label ${step === 2 ? 'active' : ''}`}>Column Mapping</div>
          </div>
          <div className="em-step-item">
            <div className={`em-step-circle ${step === 3 ? 'active' : ''}`}>
              3
            </div>
            <div className={`em-step-label ${step === 3 ? 'active' : ''}`}>Results & Audit</div>
          </div>
        </div>

        {/* Step 1: Upload CSV */}
        {step === 1 && (
          <div className="em-card">
            <div className="em-card-header">
              <h2 className="em-card-title">Step 1: Choose CSV File or Paste Data</h2>
            </div>

            {/* Dashed Dropzone */}
            <div className="em-dropzone">
              <div className="em-dropzone-badge">
                <i className="bi bi-filetype-csv fs-5"></i>
                <span>CSV</span>
              </div>
              <div className="em-dropzone-title">Upload your customer CSV file</div>
              <div className="em-dropzone-desc">
                Max 50,000 rows. Formats supported: .csv (UTF-8). Need a starting template?{' '}
                <a
                  href="#download"
                  onClick={(e) => {
                    e.preventDefault();
                    handleDownloadSampleCsv();
                  }}
                  className="text-primary text-decoration-none fw-semibold"
                >
                  <i className="bi bi-download me-1"></i>Download CSV Template
                </a>
              </div>

              {/* Custom File Input Bar */}
              <div className="em-file-input-group">
                <button
                  type="button"
                  className="em-file-choose-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <i className="bi bi-file-earmark-arrow-up"></i>
                  <span>Choose File</span>
                </button>
                <div className="em-file-status-box">
                  {fileName || 'No file chosen'}
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </div>
            </div>

            {/* Raw CSV Textarea */}
            <div className="mb-4">
              <label className="em-raw-label">Or Paste Raw CSV Text:</label>
              <textarea
                className="em-textarea"
                rows="6"
                placeholder="phone,name,email,tag,consent..."
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
              ></textarea>
            </div>

            {/* Bottom Next Button */}
            <div className="d-flex justify-content-end">
              <button
                type="button"
                onClick={handlePreview}
                disabled={loading || !csvText.trim()}
                className="em-btn-next"
              >
                {loading ? 'Analyzing CSV...' : (
                  <>
                    <span>Next: Column Mapping</span>
                    <i className="bi bi-arrow-right"></i>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Column Mapping */}
        {step === 2 && (
          <div className="em-card">
            <div className="em-card-header">
              <div>
                <h2 className="em-card-title">Step 2: Map CSV Headers to Database Attributes</h2>
                <div className="text-muted small mt-1">{sampleRows.length} sample rows analyzed</div>
              </div>
            </div>

            <div className="row g-4 mb-4">
              <div className="col-12 col-md-6 col-lg-3">
                <label className="form-label fw-bold text-dark small">
                  Phone Column <span className="text-danger">*</span>
                </label>
                <select
                  className="form-select border-success rounded-3 shadow-none"
                  value={columnMapping.phone}
                  onChange={(e) => setColumnMapping({ ...columnMapping, phone: e.target.value })}
                  required
                >
                  <option value="">-- Select Phone Column --</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <div className="form-text small text-muted">Mandatory for WhatsApp sending</div>
              </div>

              <div className="col-12 col-md-6 col-lg-3">
                <label className="form-label fw-bold text-dark small">Name Column</label>
                <select
                  className="form-select rounded-3 shadow-none"
                  value={columnMapping.name}
                  onChange={(e) => setColumnMapping({ ...columnMapping, name: e.target.value })}
                >
                  <option value="">-- None / Skip --</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <div className="form-text small text-muted">Used for template variable substitution</div>
              </div>

              <div className="col-12 col-md-6 col-lg-3">
                <label className="form-label fw-bold text-dark small">Email Column</label>
                <select
                  className="form-select rounded-3 shadow-none"
                  value={columnMapping.email}
                  onChange={(e) => setColumnMapping({ ...columnMapping, email: e.target.value })}
                >
                  <option value="">-- None / Skip --</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <div className="form-text small text-muted">Secondary contact identifier</div>
              </div>

              <div className="col-12 col-md-6 col-lg-3">
                <label className="form-label fw-bold text-dark small">Segment Tag Column</label>
                <select
                  className="form-select rounded-3 shadow-none"
                  value={columnMapping.tag}
                  onChange={(e) => setColumnMapping({ ...columnMapping, tag: e.target.value })}
                >
                  <option value="">-- None / Skip --</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <div className="form-text small text-muted">Audience clustering tag</div>
              </div>
            </div>

            {/* Consent Notice */}
            <div className="p-3 bg-light rounded-3 border mb-4">
              <div className="d-flex align-items-center gap-2 mb-1">
                <i className="bi bi-shield-check text-success fs-5"></i>
                <span className="fw-bold text-dark">Verifiable WhatsApp Consent Check</span>
              </div>
              <p className="text-muted small mb-2">
                Under WhatsApp Business Platform policies, marketing broadcasts may only be sent to customers who explicitly opted in. 
                Any row where consent is missing, rejected, or whose previous unsubscribe record exists will be automatically protected and skipped.
              </p>
              <div className="form-check">
                <input 
                  className="form-check-input" 
                  type="checkbox" 
                  id="consentCheckConfirm" 
                  defaultChecked 
                  required 
                />
                <label className="form-check-label small fw-semibold" htmlFor="consentCheckConfirm">
                  I confirm that our business holds auditable marketing opt-in records for these imported customers.
                </label>
              </div>
            </div>

            <div className="d-flex justify-content-between align-items-center">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn btn-outline-secondary rounded-3 px-4 fw-semibold"
              >
                ← Back
              </button>
              <button 
                type="button"
                onClick={handleExecuteImport} 
                disabled={loading} 
                className="em-btn-next"
              >
                {loading ? 'Processing Import...' : (
                  <>
                    <i className="bi bi-cloud-arrow-up"></i>
                    <span>Execute Import & Verify</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Results & Audit Summary */}
        {step === 3 && importResult && (
          <div className="em-card">
            <div className="em-card-header">
              <h2 className="em-card-title text-success d-flex align-items-center gap-2">
                <i className="bi bi-check-circle-fill"></i>
                Import Completed Successfully
              </h2>
            </div>
            
            <div className="row g-3 text-center mb-4">
              <div className="col-3">
                <div className="p-3 border rounded-3 bg-light">
                  <div className="text-muted small">Total Rows</div>
                  <div className="fs-3 fw-bold text-dark">{importResult.totalRows}</div>
                </div>
              </div>
              <div className="col-3">
                <div className="p-3 border rounded-3 bg-success-subtle">
                  <div className="text-success small fw-semibold">Imported / Updated</div>
                  <div className="fs-3 fw-bold text-success">{importResult.successful}</div>
                </div>
              </div>
              <div className="col-3">
                <div className="p-3 border rounded-3 bg-warning-subtle">
                  <div className="text-warning small fw-semibold">Duplicates Skipped</div>
                  <div className="fs-3 fw-bold text-warning">{importResult.duplicates}</div>
                </div>
              </div>
              <div className="col-3">
                <div className="p-3 border rounded-3 bg-danger-subtle">
                  <div className="text-danger small fw-semibold">Failed / Ineligible</div>
                  <div className="fs-3 fw-bold text-danger">{importResult.failed}</div>
                </div>
              </div>
            </div>

            {/* Row Level Skip/Failure Audit */}
            {importResult.rowReports && importResult.rowReports.length > 0 && (
              <div className="mt-4">
                <h6 className="fw-bold text-dark mb-2">Audit Report: Skipped & Ineligible Rows</h6>
                <div className="table-responsive">
                  <table className="table table-sm cf-table">
                    <thead>
                      <tr>
                        <th>Row #</th>
                        <th>Phone</th>
                        <th>Status</th>
                        <th>Reason / Compliance Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResult.rowReports.map((r, i) => (
                        <tr key={i}>
                          <td>{r.row_number}</td>
                          <td><code>{r.phone || 'N/A'}</code></td>
                          <td>
                            <span className={`badge ${r.status === 'skipped' ? 'bg-warning text-dark' : 'bg-danger'}`}>
                              {r.status}
                            </span>
                          </td>
                          <td className="text-muted small">{r.error_reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="d-flex justify-content-end gap-3 mt-4">
              <button
                type="button"
                onClick={() => { setStep(1); setCsvText(''); setFileName(''); setImportResult(null); }}
                className="btn btn-outline-secondary rounded-3 px-4 fw-semibold"
              >
                Import Another CSV
              </button>
              <a href="/contacts" className="em-btn-next text-decoration-none">
                <span>View Audience Database</span>
                <i className="bi bi-arrow-right"></i>
              </a>
            </div>
          </div>
        )}

        {/* Past CSV Import Jobs Table */}
        <div className="em-card">
          <div className="em-card-header">
            <h2 className="em-card-title">Past CSV Import Jobs</h2>
          </div>
          <div className="table-responsive">
            <table className="table cf-table align-middle">
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Total Rows</th>
                  <th>Imported</th>
                  <th>Duplicates</th>
                  <th>Failed</th>
                  <th>Status</th>
                  <th>Import Date</th>
                </tr>
              </thead>
              <tbody>
                {importHistory.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-4 text-muted">
                      No past CSV imports recorded.
                    </td>
                  </tr>
                ) : (
                  importHistory.map(job => (
                    <tr key={job.id}>
                      <td>
                        <i className="bi bi-file-earmark-spreadsheet text-success me-2 fs-6"></i>
                        <span className="fw-semibold text-dark">{job.file_name}</span>
                      </td>
                      <td>{job.total_rows}</td>
                      <td className="text-success fw-bold">{job.successful_rows}</td>
                      <td className="text-warning fw-bold">{job.duplicate_rows}</td>
                      <td className="text-danger fw-bold">{job.failed_rows}</td>
                      <td>
                        <span className="badge-status badge-approved">{job.status}</span>
                      </td>
                      <td className="text-muted small">
                        {new Date(job.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
