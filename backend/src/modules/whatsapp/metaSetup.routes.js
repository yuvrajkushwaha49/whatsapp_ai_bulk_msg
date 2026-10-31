import { Router } from 'express';
import * as metaSetupController from './metaSetup.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { requireTenant, requireRole } from '../../middleware/tenant.js';

const router = Router();

// Secure tenant context
router.use(authenticate, requireTenant);

// Setup Wizard State & Configuration
router.get('/setup/status', metaSetupController.getStatus);
router.post('/setup/mode', requireRole(['owner', 'admin']), metaSetupController.setMode);
router.post('/setup/validate', requireRole(['owner', 'admin']), metaSetupController.validateSetup);
router.post('/setup/advanced-config', requireRole(['owner', 'admin']), metaSetupController.saveAdvancedConfig);

// Embedded Signup Flow Endpoints
router.post('/embedded-signup/initiate', requireRole(['owner', 'admin']), metaSetupController.initiateSignup);
router.post('/embedded-signup/callback', requireRole(['owner', 'admin']), metaSetupController.handleEmbeddedCallback);

// Account Lifecycle & Verification
router.get('/accounts', metaSetupController.listAccounts);
router.post('/accounts/verify', requireRole(['owner', 'admin']), metaSetupController.verifyAccount);
router.post('/accounts/reconnect', requireRole(['owner', 'admin']), metaSetupController.reconnectAccount);
router.post('/accounts/disconnect', requireRole(['owner', 'admin']), metaSetupController.disconnectAccount);

export default router;
