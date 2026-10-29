import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [business, setBusiness] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('cf_token');
    if (token) {
      checkAuth();
    } else {
      setLoading(false);
    }
  }, []);

  const checkAuth = async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data?.success) {
        setUser(res.data.data.user);
        setBusiness(res.data.data.business);
        setSubscription(res.data.data.subscription);
      }
    } catch (err) {
      localStorage.removeItem('cf_token');
      setUser(null);
      setBusiness(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    if (res.data?.success) {
      const { user, business, token } = res.data.data;
      localStorage.setItem('cf_token', token);
      setUser(user);
      setBusiness(business);
      return res.data.data;
    }
  };

  const register = async (formData) => {
    const res = await api.post('/auth/register', formData);
    if (res.data?.success) {
      const { user, business, token } = res.data.data;
      localStorage.setItem('cf_token', token);
      setUser(user);
      setBusiness(business);
      return res.data.data;
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem('cf_token');
      setUser(null);
      setBusiness(null);
      window.location.href = '/login';
    }
  };

  const hasRole = (allowedRoles = []) => {
    if (!user) return false;
    if (user.role === 'superadmin') return true;
    return allowedRoles.includes(user.role);
  };

  const isSuperAdmin = () => user?.role === 'superadmin';

  return (
    <AuthContext.Provider value={{ user, business, subscription, loading, login, register, logout, hasRole, isSuperAdmin, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default useAuth;
