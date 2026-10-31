import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor to inject Bearer token and tenant context
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('cf_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const userStr = localStorage.getItem('cf_user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.business_id) {
          config.headers['x-tenant-id'] = user.business_id;
        }
      } catch (e) {}
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor to handle unauthenticated 401 redirects
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token if expired or invalid
      localStorage.removeItem('cf_token');
      localStorage.removeItem('cf_user');
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
