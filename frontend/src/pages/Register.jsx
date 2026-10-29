import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Register() {
  const [formData, setFormData] = useState({
    businessName: '',
    name: '',
    email: '',
    password: '',
    timezone: 'Asia/Kolkata'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register(formData);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3 className="fw-bold text-dark mb-1">Create Workspace</h3>
      <p className="text-muted small mb-4">Start your WhatsApp marketing automation platform</p>

      {error && (
        <div className="alert alert-danger py-2 small d-flex align-items-center gap-2 mb-3">
          <i className="bi bi-exclamation-triangle-fill"></i>
          <div>{error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label small fw-semibold text-secondary">Business / Brand Name</label>
          <input
            type="text"
            name="businessName"
            className="form-control"
            placeholder="e.g. Apex Apparel Store"
            value={formData.businessName}
            onChange={handleChange}
            required
          />
        </div>

        <div className="mb-3">
          <label className="form-label small fw-semibold text-secondary">Your Full Name</label>
          <input
            type="text"
            name="name"
            className="form-control"
            placeholder="e.g. Sarah Jenkins"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>

        <div className="mb-3">
          <label className="form-label small fw-semibold text-secondary">Work Email</label>
          <input
            type="email"
            name="email"
            className="form-control"
            placeholder="sarah@company.com"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>

        <div className="mb-3">
          <label className="form-label small fw-semibold text-secondary">Password (min 8 chars)</label>
          <input
            type="password"
            name="password"
            className="form-control"
            placeholder="••••••••"
            value={formData.password}
            onChange={handleChange}
            minLength={8}
            required
          />
        </div>

        <div className="mb-4">
          <label className="form-label small fw-semibold text-secondary">Timezone</label>
          <select
            name="timezone"
            className="form-select"
            value={formData.timezone}
            onChange={handleChange}
          >
            <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
            <option value="UTC">UTC</option>
            <option value="America/New_York">America/New York (EST)</option>
            <option value="Europe/London">Europe/London (GMT)</option>
            <option value="Asia/Dubai">Asia/Dubai (GST)</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn btn-cf-primary w-100 py-2 d-flex align-items-center justify-content-center gap-2 mb-3"
        >
          {loading ? (
            <span className="spinner-border spinner-border-sm" role="status"></span>
          ) : (
            <>
              <span>Get Started Free</span>
              <i className="bi bi-arrow-right"></i>
            </>
          )}
        </button>
      </form>

      <div className="text-center mt-3 text-muted small">
        Already have a workspace? <Link to="/login" className="fw-semibold text-success text-decoration-none">Sign in</Link>
      </div>
    </div>
  );
}
