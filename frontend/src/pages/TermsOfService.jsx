import React from 'react';
import { Link } from 'react-router-dom';

export default function TermsOfService() {
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
            <Link to="/privacy" className="btn btn-sm btn-outline-secondary">Privacy Policy</Link>
            <Link to="/login" className="btn btn-sm btn-primary">Log In</Link>
          </div>
        </div>

        {/* Terms Content Card */}
        <div className="card border-0 shadow-sm p-4 p-md-5 bg-white" style={{ borderRadius: '16px' }}>
          
          <div className="mb-4">
            <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-1 rounded-pill mb-2">
              Official SaaS Service Agreement
            </span>
            <h1 className="fw-bold text-dark mb-2">Terms of Service</h1>
            <p className="text-muted small mb-0">Last Updated: November 1, 2026</p>
          </div>

          <hr className="my-4" />

          {/* Section 1 */}
          <section className="mb-4">
            <h4 className="fw-bold text-dark mb-3">1. Acceptance of Terms</h4>
            <p className="text-secondary leading-relaxed">
              By registering for, accessing, or using the <strong>CampaignFlow</strong> software platform ("Service"), available at <code>whatsapp.bhaktisong.fun</code> or associated domains, you agree to be bound by these Terms of Service ("Terms"). If you are entering into these Terms on behalf of a company or other legal entity, you represent that you have the authority to bind such entity.
            </p>
          </section>

          {/* Section 2 */}
          <section className="mb-4">
            <h4 className="fw-bold text-dark mb-3">2. Description of Service</h4>
            <p className="text-secondary leading-relaxed">
              CampaignFlow is a multi-tenant business communication SaaS platform that allows enterprises and businesses to manage WhatsApp marketing campaigns, template messaging, contacts, and customer support conversations utilizing the official <strong>Meta WhatsApp Business Cloud API</strong>.
            </p>
          </section>

          {/* Section 3 */}
          <section className="mb-4">
            <h4 className="fw-bold text-dark mb-3">3. Meta Platforms & WhatsApp Policy Compliance</h4>
            <p className="text-secondary leading-relaxed">
              As a user of our Service, you explicitly agree to adhere to all terms, policies, and guidelines established by Meta Platforms, Inc., including but not limited to:
            </p>
            <ul className="text-secondary ps-3">
              <li className="mb-2">
                <strong>WhatsApp Business Messaging Policy:</strong> You must strictly obtain verifiable opt-in consent from individuals before sending them WhatsApp messages.
              </li>
              <li className="mb-2">
                <strong>No Spam or Unsolicited Messaging:</strong> The transmission of spam, fraudulent schemes, misleading content, or harassment via WhatsApp is strictly prohibited and will result in immediate account termination.
              </li>
              <li className="mb-2">
                <strong>Opt-Out Mechanism:</strong> You must respect user opt-out requests promptly (such as when a customer replies "STOP" or "UNSUBSCRIBE").
              </li>
              <li className="mb-2">
                <strong>Template Approval:</strong> All marketing, utility, and authentication message templates must be approved through Meta's official review process before broadcast.
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="mb-4">
            <h4 className="fw-bold text-dark mb-3">4. Multi-Tenant Architecture & Account Responsibility</h4>
            <p className="text-secondary leading-relaxed">
              Each workspace on CampaignFlow operates independently with dedicated account mapping and encrypted credential storage. You are responsible for:
            </p>
            <ul className="text-secondary ps-3">
              <li className="mb-2">Maintaining the confidentiality of your workspace login credentials.</li>
              <li className="mb-2">All activities, campaigns, and broadcasts originating from your WhatsApp Business Account (WABA) and phone numbers.</li>
              <li className="mb-2">Ensuring that your business information and Meta Business Portfolio details provided during Facebook Login / Embedded Signup are accurate and verified.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="mb-4">
            <h4 className="fw-bold text-dark mb-3">5. Meta Cloud API Conversation Fees & Subscription Plans</h4>
            <p className="text-secondary leading-relaxed">
              Use of our SaaS platform requires an active subscription plan. In addition to our SaaS software fees, WhatsApp messaging charges are determined by Meta Platforms based on conversation categories (Marketing, Utility, Authentication, Service). You are responsible for Meta-imposed messaging fees incurred on your connected WhatsApp Business Account.
            </p>
          </section>

          {/* Section 6 */}
          <section className="mb-4">
            <h4 className="fw-bold text-dark mb-3">6. Intellectual Property & Data Ownership</h4>
            <p className="text-secondary leading-relaxed">
              You retain all ownership rights to your business data, customer contacts, message copy, and media uploaded to the platform. CampaignFlow retains all rights, title, and interest in and to the platform software, algorithms, user interfaces, and documentation.
            </p>
          </section>

          {/* Section 7 */}
          <section className="mb-4">
            <h4 className="fw-bold text-dark mb-3">7. Disclaimers & Limitation of Liability</h4>
            <p className="text-secondary leading-relaxed">
              The Service is provided on an "as is" and "as available" basis. While we strive for 99.9% uptime, we do not warrant that the Service will be uninterrupted or error-free. We are not liable for any actions taken by Meta Platforms, Inc., including phone number quality tier reductions, temporary template holds, or WABA restrictions resulting from violation of WhatsApp Business policies.
            </p>
          </section>

          {/* Section 8 */}
          <section className="mb-4">
            <h4 className="fw-bold text-dark mb-3">8. Termination & Suspension</h4>
            <p className="text-secondary leading-relaxed">
              We reserve the right to suspend or terminate your workspace access immediately if we detect abusive messaging, violation of Meta policies, non-payment of subscription fees, or security threats to the multi-tenant platform infrastructure.
            </p>
          </section>

          {/* Section 9 */}
          <section className="mb-4">
            <h4 className="fw-bold text-dark mb-3">9. Contact & Governance</h4>
            <p className="text-secondary leading-relaxed">
              If you have any questions regarding these Terms of Service, please contact:
            </p>
            <div className="p-3 bg-light rounded-3 border">
              <div className="fw-bold text-dark">CampaignFlow Legal & Support Team</div>
              <div className="text-muted small mt-1">Platform URL: <a href="https://whatsapp.bhaktisong.fun" target="_blank" rel="noopener noreferrer">https://whatsapp.bhaktisong.fun</a></div>
              <div className="text-muted small">Support Email: <a href="mailto:yuvgamers12@gmail.com">yuvgamers12@gmail.com</a></div>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="text-center text-muted small mt-4">
          &copy; {new Date().getFullYear()} CampaignFlow SaaS Platform. All rights reserved. • <Link to="/privacy" className="text-decoration-none text-muted">Privacy Policy</Link>
        </div>

      </div>
    </div>
  );
}
