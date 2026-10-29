import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await api.get('/whatsapp/templates');
      if (res.data?.success) {
        setTemplates(res.data.data);
        if (res.data.data.length > 0) {
          setSelectedTemplate(res.data.data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load templates', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between mb-4 gap-3">
        <div>
          <h2 className="brand-font mb-1">Approved WhatsApp Templates</h2>
          <p className="text-muted mb-0">Pre-approved Meta marketing templates synchronized with Cloud API</p>
        </div>
        <a href="/whatsapp" className="btn btn-outline-success d-flex align-items-center gap-2">
          <i className="bi bi-arrow-repeat"></i>
          <span>Sync from Meta</span>
        </a>
      </div>

      <div className="row g-4">
        {/* Template List */}
        <div className="col-12 col-lg-7">
          <div className="cf-card">
            <div className="cf-card-header">
              <h5 className="mb-0">Templates Available ({templates.length})</h5>
              <span className="badge bg-success-subtle text-success">Meta Approved Only</span>
            </div>
            <div className="list-group list-group-flush">
              {loading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-success" role="status"></div>
                </div>
              ) : templates.length === 0 ? (
                <div className="p-4 text-center text-muted">
                  No templates synced yet. Go to WhatsApp Accounts and click "Synchronize Meta Templates".
                </div>
              ) : (
                templates.map(tpl => {
                  const isSelected = selectedTemplate?.id === tpl.id;
                  const bodyComp = (tpl.components || []).find(c => c.type === 'BODY');

                  return (
                    <button
                      key={tpl.id}
                      onClick={() => setSelectedTemplate(tpl)}
                      className={`list-group-item list-group-item-action p-3 d-flex flex-column gap-2 text-start ${isSelected ? 'border-start border-success border-3 bg-light' : ''}`}
                    >
                      <div className="d-flex align-items-center justify-content-between">
                        <div className="fw-bold text-dark">{tpl.name}</div>
                        <span className={`badge-status ${tpl.status === 'APPROVED' ? 'badge-approved' : 'badge-pending'}`}>
                          {tpl.status}
                        </span>
                      </div>
                      <div className="text-muted small text-truncate" style={{ maxWidth: '480px' }}>
                        {bodyComp?.text || 'No body text'}
                      </div>
                      <div className="d-flex align-items-center gap-3 small text-muted">
                        <span><i className="bi bi-translate me-1"></i> {tpl.language}</span>
                        <span><i className="bi bi-tag me-1"></i> {tpl.category}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* WhatsApp Mobile Preview */}
        <div className="col-12 col-lg-5">
          <div className="cf-card">
            <div className="cf-card-header">
              <h5 className="mb-0">WhatsApp Mobile Preview</h5>
              <span className="small text-muted">How recipients see it</span>
            </div>
            <div className="cf-card-body text-center">
              {selectedTemplate ? (
                <div className="wa-preview-screen">
                  <div className="wa-bubble text-start">
                    {/* Header Component */}
                    {selectedTemplate.components?.find(c => c.type === 'HEADER') && (
                      <div className="wa-header">
                        {selectedTemplate.components.find(c => c.type === 'HEADER').text}
                      </div>
                    )}

                    {/* Body Component */}
                    <div className="wa-body text-dark">
                      {selectedTemplate.components?.find(c => c.type === 'BODY')?.text}
                    </div>

                    {/* Footer Component */}
                    {selectedTemplate.components?.find(c => c.type === 'FOOTER') && (
                      <div className="wa-footer">
                        {selectedTemplate.components.find(c => c.type === 'FOOTER').text}
                      </div>
                    )}

                    {/* Action Buttons */}
                    {selectedTemplate.components?.find(c => c.type === 'BUTTONS')?.buttons?.map((btn, idx) => (
                      <a key={idx} href="#" onClick={(e) => e.preventDefault()} className="wa-button">
                        <i className={`bi ${btn.type === 'URL' ? 'bi-box-arrow-up-right' : 'bi-reply'} me-1`}></i>
                        {btn.text}
                      </a>
                    ))}
                  </div>

                  <div className="mt-3 text-muted small">
                    Template ID: <code>{selectedTemplate.meta_template_id}</code>
                  </div>
                </div>
              ) : (
                <div className="text-muted py-5">Select a template to view mobile preview</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
