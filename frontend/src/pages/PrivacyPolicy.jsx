import React from 'react';
import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
  return (
    <div className="bg-light min-vh-100 py-5">
      <div className="container" style={{ maxWidth: '900px' }}>
        
        {/* Navigation / Header */}
        <div className="d-flex align-items-center justify-content-between mb-4 pb-3 border-bottom">
          <Link to="/" className="d-flex align-items-center gap-2 text-decoration-none">
            <div className="bg-primary text-white rounded p-2 d-flex align-items-center justify-content-center shadow-xs" style={{ width: '38px', height: '38px' }}>
              <i className="bi bi-whatsapp fs-5"></i>
            </div>
            <span className="h4 mb-0 fw-bold text-dark brand-font">CampaignFlow</span>
          </Link>
          <div className="d-flex align-items-center gap-3">
            <Link to="/terms" className="btn btn-sm btn-outline-secondary">Terms of Service</Link>
            <Link to="/login" className="btn btn-sm btn-primary">Log In</Link>
          </div>
        </div>

        {/* Policy Content Card */}
        <div className="card border-0 shadow-sm p-4 p-md-5 bg-white" style={{ borderRadius: '16px' }}>
          
          <div className="mb-4">
            <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-1 rounded-pill mb-2">
              Meta WhatsApp Business Platform Compliant
            </span>
            <h1 className="fw-bold text-dark mb-2">Privacy Policy</h1>
            <p className="text-muted small mb-0">Last Updated: November 1, 2026</p>
          </div>

          <hr className="my-4" />

          {/* Section 1 */}
          <section className="mb-4">
            <h4 className="fw-bold text-dark mb-3">1. Introduction & Overview</h4>
            <p className="text-secondary leading-relaxed">
              Welcome to <strong>CampaignFlow</strong> ("we", "our", or "us"). We provide a multi-tenant WhatsApp marketing, customer communication, and broadcast automation Software-as-a-Service (SaaS) platform built on the official <strong>Meta WhatsApp Business Cloud API</strong>.
            </p>
            <p className="text-secondary leading-relaxed">
              We respect your privacy and are committed to protecting the personal data of our SaaS customers (businesses and workspace owners) as well as the end-user contacts who interact with our customers via WhatsApp. This Privacy Policy explains how we collect, use, store, and safeguard your information.
            </p>
          </section>

          {/* Section 2 */}
          <section className="mb-4">
            <h4 className="fw-bold text-dark mb-3">2. Information We Collect</h4>
            <p className="text-secondary">We collect information in the following categories:</p>
            <ul className="text-secondary ps-3">
              <li className="mb-2">
                <strong>Account & Profile Information:</strong> Name, business name, business email address, phone number, encrypted login credentials, and billing information.
              </li>
              <li className="mb-2">
                <strong>Meta & WhatsApp Business Account Data:</strong> Meta Business Portfolio ID, WhatsApp Business Account (WABA) ID, WhatsApp Phone Number ID, verified display name, and authorized Meta OAuth access tokens (which are always encrypted at rest with AES-256-CBC).
              </li>
              <li className="mb-2">
                <strong>Contact Lists & Audiences:</strong> Contact phone numbers, names, attributes, and tags uploaded or imported by our customers for messaging campaigns.
              </li>
              <li className="mb-2">
                <strong>WhatsApp Messaging Data & Webhooks:</strong> Inbound and outbound message text, template parameters, timestamps, delivery statuses (sent, delivered, read, failed), and webhook callbacks received from Meta Cloud API.
              </li>
              <li className="mb-2">
                <strong>Technical & Usage Data:</strong> IP addresses, browser user agent, session timestamps, and operational audit logs for security and fraud prevention.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="mb-4">
            <h4 className="fw-bold text-dark mb-3">3. How We Use Your Information</h4>
            <p className="text-secondary">We use the collected information exclusively to:</p>
            <ul className="text-secondary ps-3">
              <li className="mb-2">Provide, operate, and maintain our WhatsApp SaaS platform services.</li>
              <li className="mb-2">Facilitate authorized message sending and customer support chat through the official Meta WhatsApp Business Cloud API.</li>
              <li className="mb-2">Sync approved WhatsApp message templates and maintain phone number quality ratings.</li>
              <li className="mb-2">Process real-time webhooks for live message delivery and read status updates.</li>
              <li className="mb-2">Enforce strict multi-tenant data isolation and prevent cross-tenant data access.</li>
              <li className="mb-2">Comply with applicable legal obligations and official Meta WhatsApp Business Messaging Policies.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="mb-4">
            <h4 className="fw-bold text-dark mb-3">4. Multi-Tenant Isolation & Security Standards</h4>
            <p className="text-secondary leading-relaxed">
              Every client on our platform operates in an independently isolated workspace. We implement industry-leading technical and organizational security measures:
            </p>
            <ul className="text-secondary ps-3">
              <li className="mb-2">
                <strong>AES-256 Token Encryption:</strong> Meta OAuth access tokens and sensitive credentials are encrypted using military-grade AES-256-CBC encryption at rest and are never sent in plaintext to frontend browsers.
              </li>
              <li className="mb-2">
                <strong>Tenant Boundary Enforcement:</strong> All database queries are strictly parameterized and scoped by <code>business_id</code> to ensure one client can never view, query, or send messages using another client's WhatsApp account.
              </li>
              <li className="mb-2">
                <strong>Transport Encryption:</strong> All communications between your browser, our servers, and Meta Cloud API servers use HTTPS / TLS 1.3 encryption.
              </li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="mb-4">
            <h4 className="fw-bold text-dark mb-3">5. Data Sharing & Third-Party Service Providers</h4>
            <p className="text-secondary leading-relaxed">
              <strong>We do not sell, rent, or trade your personal data or your WhatsApp contacts to any third party for marketing or advertising purposes.</strong>
            </p>
            <p className="text-secondary leading-relaxed">
              Data is only transmitted to:
            </p>
            <ul className="text-secondary ps-3">
              <li className="mb-2">
                <strong>Meta Platforms, Inc.:</strong> Data necessary to send and receive WhatsApp messages via the official WhatsApp Business Cloud API (subject to Meta's Privacy Policy).
              </li>
              <li className="mb-2">
                <strong>Infrastructure Providers:</strong> Secure cloud hosting, database servers, and queue processing infrastructure operating under strict confidentiality agreements.
              </li>
              <li className="mb-2">
                <strong>Legal Authorities:</strong> Only when strictly required by applicable law, court order, or governmental regulation.
              </li>
            </ul>
          </section>

          {/* Section 6 - CRITICAL FOR META COMPLIANCE */}
          <section className="mb-4 p-4 rounded-3 border bg-light" id="data-deletion">
            <div className="d-flex align-items-center gap-2 mb-2">
              <i className="bi bi-trash3-fill text-danger fs-5"></i>
              <h4 className="fw-bold text-dark mb-0">6. User Data Deletion Instructions (Meta Compliance)</h4>
            </div>
            <p className="text-secondary leading-relaxed">
              Under Meta Platform terms and international data protection laws (GDPR, CCPA), you have the right to request the deletion of your personal data and WhatsApp Business account mappings from our platform.
            </p>
            <h6 className="fw-bold text-dark mt-3 mb-2">How to Request Data Deletion:</h6>
            <ol className="text-secondary ps-3 mb-3">
              <li className="mb-2">
                <strong>In-App Disconnect:</strong> You can disconnect your WhatsApp Business Account at any time by navigating to <code>Settings → WhatsApp Accounts → Disconnect</code>. This will immediately revoke token access and remove account mappings.
              </li>
              <li className="mb-2">
                <strong>Email Deletion Request:</strong> Send an email from your registered account email to:
                <div className="my-2 p-2 bg-white rounded border font-monospace text-primary fw-bold">
                  support@campaignflow.io / yuvgamers12@gmail.com
                </div>
                with the subject line: <code>"User Data Deletion Request - CampaignFlow"</code>. Please include your business name and registered WhatsApp phone number.
              </li>
            </ol>
            <p className="text-secondary small mb-0">
              Upon receiving your verified request, we will permanently purge all stored customer profiles, contact numbers, and access tokens within <strong>30 days</strong>, and provide written confirmation upon completion.
            </p>
          </section>

          {/* Section 7 */}
          <section className="mb-4">
            <h4 className="fw-bold text-dark mb-3">7. Opt-In & Customer Messaging Consent</h4>
            <p className="text-secondary leading-relaxed">
              CampaignFlow strictly enforces Meta's WhatsApp Business Messaging Policies. Customers using our service are required to obtain verifiable opt-in consent from end-users before initiating marketing or promotional WhatsApp communications. Customers must also honor recipient opt-out requests (e.g., "STOP") immediately.
            </p>
          </section>

          {/* Section 8 */}
          <section className="mb-4">
            <h4 className="fw-bold text-dark mb-3">8. Contact Us & Data Protection Officer</h4>
            <p className="text-secondary leading-relaxed">
              If you have any questions, concerns, or requests regarding this Privacy Policy or your personal information, please contact our Data Protection Team:
            </p>
            <div className="p-3 bg-light rounded-3 border">
              <div className="fw-bold text-dark">CampaignFlow Data Protection Office</div>
              <div className="text-muted small mt-1">Domain: <a href="https://bhaktisong.fun" target="_blank" rel="noopener noreferrer">bhaktisong.fun</a> / <a href="https://whatsapp.bhaktisong.fun" target="_blank" rel="noopener noreferrer">whatsapp.bhaktisong.fun</a></div>
              <div className="text-muted small">Support & Privacy Email: <a href="mailto:yuvgamers12@gmail.com">yuvgamers12@gmail.com</a></div>
              <div className="text-muted small">Response Window: Within 24-48 business hours</div>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="text-center text-muted small mt-4">
          &copy; {new Date().getFullYear()} CampaignFlow SaaS Platform. All rights reserved. • <Link to="/terms" className="text-decoration-none text-muted">Terms of Service</Link>
        </div>

      </div>
    </div>
  );
}
