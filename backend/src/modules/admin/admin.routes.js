import { Router } from 'express';
import * as adminService from './admin.service.js';
import * as platformMetaService from './platformMeta.service.js';
import { authenticate } from '../../middleware/auth.js';
import { requireSuperAdmin } from '../../middleware/tenant.js';

const router = Router();

router.use(authenticate, requireSuperAdmin);

router.get('/dashboard', async (req, res, next) => {
  try {
    const stats = await adminService.getSuperAdminDashboard();
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

router.get('/businesses', async (req, res, next) => {
  try {
    const businesses = await adminService.listAllBusinesses();
    res.json({ success: true, data: businesses });
  } catch (err) {
    next(err);
  }
});

router.get('/whatsapp-accounts', async (req, res, next) => {
  try {
    const accounts = await adminService.listAllWhatsAppAccounts();
    res.json({ success: true, data: accounts });
  } catch (err) {
    next(err);
  }
});

router.patch('/businesses/:id/status', async (req, res, next) => {
  try {
    const result = await adminService.updateBusinessStatus(req.params.id, req.body.status);
    res.json({ success: true, message: 'Business status updated', data: result });
  } catch (err) {
    next(err);
  }
});

// ==============================================================================
// Super Admin Platform Meta Integration Management
// ==============================================================================
router.get('/meta-integration', async (req, res, next) => {
  try {
    const config = await platformMetaService.getPlatformMetaConfig();
    res.json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
});

router.post('/meta-integration', async (req, res, next) => {
  try {
    const updated = await platformMetaService.savePlatformMetaConfig(req.body, req.user?.id);
    res.json({ success: true, message: 'Platform Meta configuration saved and encrypted at rest', data: updated });
  } catch (err) {
    next(err);
  }
});

router.post('/meta-integration/test', async (req, res, next) => {
  try {
    const testResult = await platformMetaService.testPlatformMetaConfig();
    res.json({ success: true, data: testResult });
  } catch (err) {
    next(err);
  }
});

router.get('/meta-integration/monitoring', async (req, res, next) => {
  try {
    const monitoring = await platformMetaService.getMetaIntegrationMonitoring();
    res.json({ success: true, data: monitoring });
  } catch (err) {
    next(err);
  }
});

export default router;
