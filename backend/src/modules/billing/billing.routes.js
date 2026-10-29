import { Router } from 'express';
import * as billingService from './billing.service.js';
import { authenticate } from '../../middleware/auth.js';
import { requireTenant, requireRole } from '../../middleware/tenant.js';

const router = Router();

router.use(authenticate, requireTenant);

router.get('/plans', async (req, res, next) => {
  try {
    const plans = await billingService.listPlans();
    res.json({ success: true, data: plans });
  } catch (err) {
    next(err);
  }
});

router.get('/subscription', async (req, res, next) => {
  try {
    const sub = await billingService.getSubscription(req.businessId);
    res.json({ success: true, data: sub });
  } catch (err) {
    next(err);
  }
});

router.get('/usage', async (req, res, next) => {
  try {
    const usage = await billingService.getUsage(req.businessId);
    res.json({ success: true, data: usage });
  } catch (err) {
    next(err);
  }
});

router.post('/upgrade', requireRole(['owner']), async (req, res, next) => {
  try {
    const { planId } = req.body;
    const result = await billingService.changePlan(req.businessId, planId);
    res.json({ success: true, message: 'Plan upgraded successfully', data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
