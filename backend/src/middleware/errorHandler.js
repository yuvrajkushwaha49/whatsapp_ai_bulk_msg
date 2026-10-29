import logger from '../utils/logger.js';

export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);

  logger.error(`[API Error] ${req.method} ${req.originalUrl} - ${err.message}`, err, {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.user ? req.user.id : null,
    businessId: req.businessId || null
  });

  const response = {
    success: false,
    error: {
      message: err.message || 'An unexpected internal server error occurred',
      code: err.code || 'INTERNAL_ERROR',
      ...(err.details ? { details: err.details } : {})
    }
  };

  if (process.env.NODE_ENV !== 'production' && err.stack) {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

export function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    error: {
      message: `Cannot ${req.method} ${req.originalUrl}`,
      code: 'ROUTE_NOT_FOUND'
    }
  });
}

export default {
  errorHandler,
  notFoundHandler
};
