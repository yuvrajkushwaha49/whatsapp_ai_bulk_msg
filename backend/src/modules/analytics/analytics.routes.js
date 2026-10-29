import { Router } from 'express';
import * as analyticsService from './analytics.service.js';
import { authenticate } from '../../middleware/auth.js';
import { requireTenant } from '../../middleware/tenant.js';

const router = Router();

router.use(authenticate, requireTenant);

router.get('/dashboard', async (req, res, next) => {
  try {
    const stats = await analyticsService.getDashboardStats(req.businessId);
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

export default router;
