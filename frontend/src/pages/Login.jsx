import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await login(email, password);
      if (data.user.role === 'superadmin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3 className="fw-bold text-dark mb-1">Welcome back</h3>
      <p className="text-muted small mb-4">Sign in to your WhatsApp marketing workspace</p>

      {error && (
        <div className="alert alert-danger py-2 small d-flex align-items-center gap-2 mb-3">
          <i className="bi bi-exclamation-triangle-fill flex-shrink-0"></i>
          <div>{error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label small fw-semibold text-secondary">Email address</label>
          <div className="input-group">
            <span className="input-group-text bg-light border-end-0">
              <i className="bi bi-envelope text-muted"></i>
            </span>
            <input
              type="email"
              className="form-control border-start-0 ps-0"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
        </div>

        <div className="mb-4">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <label className="form-label small fw-semibold text-secondary mb-0">Password</label>
          </div>
          <div className="input-group">
            <span className="input-group-text bg-light border-end-0">
              <i className="bi bi-lock text-muted"></i>
            </span>
            <input
              type={showPassword ? 'text' : 'password'}
              className="form-control border-start-0 border-end-0 ps-0"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="btn btn-outline-secondary border-start-0"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex="-1"
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
            </button>
          </div>
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
              <span>Sign In to Workspace</span>
              <i className="bi bi-arrow-right"></i>
            </>
          )}
        </button>
      </form>

      <div className="text-center mt-4 text-muted small">
        Don't have a workspace? <Link to="/register" className="fw-semibold text-success text-decoration-none">Create business account</Link>
      </div>

      <div className="text-center mt-3 text-muted small" style={{ fontSize: '0.78rem' }}>
        <Link to="/privacy" className="text-muted text-decoration-none me-2">Privacy Policy</Link>
        <span>•</span>
        <Link to="/terms" className="text-muted text-decoration-none ms-2">Terms of Service</Link>
      </div>
    </div>
  );
}
