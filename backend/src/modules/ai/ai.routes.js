import { Router } from 'express';
import * as aiService from './ai.service.js';
import { authenticate } from '../../middleware/auth.js';
import { requireTenant } from '../../middleware/tenant.js';

const router = Router();

router.use(authenticate, requireTenant);

router.post('/generate-copy', async (req, res, next) => {
  try {
    const result = await aiService.generateCopy(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
