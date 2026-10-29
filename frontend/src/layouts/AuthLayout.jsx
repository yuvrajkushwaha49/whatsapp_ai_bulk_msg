import React from 'react';
import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="min-vh-100 d-flex flex-column justify-content-center py-5" style={{ backgroundColor: '#0f172a' }}>
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-12 col-md-8 col-lg-5">
            <div className="text-center mb-4">
              <div 
                className="d-inline-flex align-items-center justify-content-center rounded-3 mb-3 shadow"
                style={{ width: '56px', height: '56px', background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)' }}
              >
                <i className="bi bi-whatsapp text-white fs-2"></i>
              </div>
              <h2 className="brand-font text-white mb-1">CampaignFlow</h2>
              <p className="text-muted small">Official WhatsApp Business Marketing Automation</p>
            </div>
            
            <div className="card border-0 shadow-lg" style={{ borderRadius: '16px' }}>
              <div className="card-body p-4 p-md-5">
                <Outlet />
              </div>
            </div>

            <div className="text-center mt-4 text-muted small">
              &copy; {new Date().getFullYear()} CampaignFlow SaaS. Cloud API v21.0 Compliant.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
