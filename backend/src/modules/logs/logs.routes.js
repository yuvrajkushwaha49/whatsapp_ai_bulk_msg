import { Router } from 'express';
import * as logsService from './logs.service.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

/**
 * GET /api/activity-logs (or /api/logs)
 * Retrieves audit logs with strict tenant isolation:
 * - Regular company members see ONLY their company's logs
 * - SuperAdmin can view all logs or filter by businessId
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { businessId, action, category, search, page, limit } = req.query;

    const result = await logsService.listAuditLogs({
      requestingUser: req.user,
      businessId,
      action,
      category,
      search,
      page,
      limit
    });

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/activity-logs
 * Internal/client logging helper
 */
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { action, entityType, entityId, details } = req.body;
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    const log = await logsService.createAuditLog({
      businessId: req.user.role === 'superadmin' ? (req.body.businessId || null) : req.businessId,
      userId: req.user.id,
      action,
      entityType,
      entityId,
      details,
      ipAddress
    });

    res.status(201).json({
      success: true,
      message: 'Audit log recorded',
      data: log
    });
  } catch (err) {
    next(err);
  }
});

export default router;
