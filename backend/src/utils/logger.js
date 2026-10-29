/**
 * Structured Logger for CampaignFlow
 * Masking sensitive parameters like passwords, tokens, API secrets
 */

const SENSITIVE_KEYS = ['password', 'password_hash', 'access_token', 'refresh_token', 'token', 'secret', 'authorization'];

function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);

  const clean = {};
  for (const [key, val] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.some(s => key.toLowerCase().includes(s))) {
      clean[key] = '[REDACTED]';
    } else if (typeof val === 'object') {
      clean[key] = sanitize(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

export const logger = {
  info: (msg, meta = {}) => {
    console.log(JSON.stringify({ level: 'INFO', timestamp: new Date().toISOString(), message: msg, ...sanitize(meta) }));
  },
  warn: (msg, meta = {}) => {
    console.warn(JSON.stringify({ level: 'WARN', timestamp: new Date().toISOString(), message: msg, ...sanitize(meta) }));
  },
  error: (msg, error = {}, meta = {}) => {
    console.error(JSON.stringify({
      level: 'ERROR',
      timestamp: new Date().toISOString(),
      message: msg,
      error: error.message || error,
      stack: error.stack,
      ...sanitize(meta)
    }));
  },
  debug: (msg, meta = {}) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(JSON.stringify({ level: 'DEBUG', timestamp: new Date().toISOString(), message: msg, ...sanitize(meta) }));
    }
  }
};

export default logger;
