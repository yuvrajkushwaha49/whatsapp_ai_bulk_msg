import React, { useState, useEffect } from 'react';
import api from '../services/api';

const SAMPLE_CSV = `phone,name,email,tag,consent
9811122233,Ananya Gupta,ananya@test.com,VIP Customer,yes
9822233344,Vikram Malhotra,vikram@test.com,Diwali Festival 2026,yes
9833344455,Sunita Rao,sunita@test.com,Weekend Shopper,yes
9844455566,Rohan Mehra,rohan@test.com,VIP Customer,yes
9844455566,Rohan Duplicate,rohan@test.com,VIP Customer,yes
9877700011,Karan Johar,karan@test.com,Unverified Lead,no`;

export default function CsvImport() {
  const [step, setStep] = useState(1);
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('contacts.csv');
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

  return (
    <div>
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between mb-4 gap-3">
        <div>
          <h2 className="brand-font mb-1">CSV Audience Importer</h2>
          <p className="text-muted mb-0">Bulk contact ingestion with E.164 normalization, intra-file deduplication & consent checks</p>
        </div>
      </div>

      {/* Wizard Stepper */}
      <div className="wizard-stepper">
        <div className={`wizard-step ${step === 1 ? 'active' : step > 1 ? 'completed' : ''}`}>
          <div className="step-circle">{step > 1 ? '✓' : '1'}</div>
          <div className="step-label">Upload CSV</div>
        </div>
        <div className={`wizard-step ${step === 2 ? 'active' : step > 2 ? 'completed' : ''}`}>
          <div className="step-circle">{step > 2 ? '✓' : '2'}</div>
          <div className="step-label">Column Mapping</div>
        </div>
        <div className={`wizard-step ${step === 3 ? 'active' : ''}`}>
          <div className="step-circle">3</div>
          <div className="step-label">Results & Audit</div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show mb-4" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {/* Step 1: Upload or Paste */}
      {step === 1 && (
        <div className="cf-card mb-4">
          <div className="cf-card-header">
            <h5 className="mb-0">Step 1: Choose CSV File or Paste Data</h5>
            <button onClick={loadSampleData} className="btn btn-sm btn-outline-success">
              <i className="bi bi-magic me-1"></i> Load Test Sample CSV
            </button>
          </div>
          <div className="cf-card-body">
            <div className="mb-4 text-center p-4 border border-2 border-dashed rounded-3 bg-light">
              <i className="bi bi-filetype-csv fs-1 text-success mb-2"></i>
              <div className="fw-semibold">Upload your customer CSV file</div>
              <p className="text-muted small">Max 50,000 rows. Formats supported: .csv (UTF-8)</p>
              <input 
                type="file" 
                accept=".csv" 
                className="form-control w-auto mx-auto" 
                onChange={handleFileUpload} 
              />
            </div>

            <div className="mb-3">
              <label className="form-label small fw-semibold">Or Paste Raw CSV Text:</label>
              <textarea
                className="form-control font-monospace small"
                rows="7"
                placeholder="phone,name,email,tag,consent..."
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
              ></textarea>
            </div>

            <div className="d-flex justify-content-end">
              <button 
                onClick={handlePreview} 
                disabled={loading || !csvText.trim()} 
                className="btn btn-cf-primary d-flex align-items-center gap-2"
              >
                {loading ? 'Analyzing CSV...' : (
                  <>
                    <span>Next: Map Columns</span>
                    <i className="bi bi-arrow-right"></i>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Column Mapping */}
      {step === 2 && (
        <div className="cf-card mb-4">
          <div className="cf-card-header">
            <h5 className="mb-0">Step 2: Map CSV Headers to Database Attributes</h5>
            <span className="small text-muted">{sampleRows.length} sample rows analyzed</span>
          </div>
          <div className="cf-card-body">
            <div className="row g-3 mb-4">
              <div className="col-12 col-md-6 col-lg-3">
                <label className="form-label fw-bold text-dark">
                  Phone Column <span className="text-danger">*</span>
                </label>
                <select
                  className="form-select border-success"
                  value={columnMapping.phone}
                  onChange={(e) => setColumnMapping({ ...columnMapping, phone: e.target.value })}
                  required
                >
                  <option value="">-- Select Phone Column --</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <div className="form-text small">Mandatory for WhatsApp sending</div>
              </div>

              <div className="col-12 col-md-6 col-lg-3">
                <label className="form-label fw-bold text-dark">Name Column</label>
                <select
                  className="form-select"
                  value={columnMapping.name}
                  onChange={(e) => setColumnMapping({ ...columnMapping, name: e.target.value })}
                >
                  <option value="">-- None / Skip --</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <div className="form-text small">Used for template variable substitution</div>
              </div>

              <div className="col-12 col-md-6 col-lg-3">
                <label className="form-label fw-bold text-dark">Email Column</label>
                <select
                  className="form-select"
                  value={columnMapping.email}
                  onChange={(e) => setColumnMapping({ ...columnMapping, email: e.target.value })}
                >
                  <option value="">-- None / Skip --</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div className="col-12 col-md-6 col-lg-3">
                <label className="form-label fw-bold text-dark">Segment Tag Column</label>
                <select
                  className="form-select"
                  value={columnMapping.tag}
                  onChange={(e) => setColumnMapping({ ...columnMapping, tag: e.target.value })}
                >
                  <option value="">-- None / Skip --</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            </div>

            {/* Consent Policy Notice */}
            <div className="p-3 bg-light rounded-3 border mb-4">
              <div className="d-flex align-items-center gap-2 mb-1">
                <i className="bi bi-shield-check text-success fs-5"></i>
                <span className="fw-semibold text-dark">Verifiable WhatsApp Consent Check</span>
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

            <div className="d-flex justify-content-between">
              <button onClick={() => setStep(1)} className="btn btn-outline-secondary">
                Back
              </button>
              <button 
                onClick={handleExecuteImport} 
                disabled={loading} 
                className="btn btn-cf-primary d-flex align-items-center gap-2"
              >
                {loading ? 'Processing Import...' : (
                  <>
                    <i className="bi bi-cloud-arrow-up-fill"></i>
                    <span>Execute Import & Verify</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Results & Audit Summary */}
      {step === 3 && importResult && (
        <div className="cf-card mb-4">
          <div className="cf-card-header bg-success-subtle">
            <h5 className="mb-0 text-success">
              <i className="bi bi-check-circle-fill me-2"></i> Import Completed Successfully
            </h5>
          </div>
          <div className="cf-card-body">
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

            <div className="d-flex justify-content-end gap-2 mt-4">
              <button onClick={() => { setStep(1); setCsvText(''); setImportResult(null); }} className="btn btn-outline-secondary">
                Import Another CSV
              </button>
              <a href="/contacts" className="btn btn-cf-primary">
                View Audience Database
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Import History Table */}
      <div className="cf-card">
        <div className="cf-card-header">
          <h5 className="mb-0">Past CSV Import Jobs</h5>
        </div>
        <div className="table-responsive">
          <table className="table cf-table">
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
                      <i className="bi bi-file-earmark-text text-muted me-2"></i>
                      <span className="fw-semibold">{job.file_name}</span>
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
  );
}
