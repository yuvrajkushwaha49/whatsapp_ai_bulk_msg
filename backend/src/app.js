import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import authRouter from './modules/auth/auth.routes.js';
import contactsRouter from './modules/contacts/contacts.routes.js';
import importsRouter from './modules/imports/imports.routes.js';
import whatsappRouter from './modules/whatsapp/whatsapp.routes.js';
import webhooksRouter from './modules/webhooks/webhooks.routes.js';
import campaignsRouter from './modules/campaigns/campaigns.routes.js';
import billingRouter from './modules/billing/billing.routes.js';
import analyticsRouter from './modules/analytics/analytics.routes.js';
import usersRouter from './modules/users/users.routes.js';
import adminRouter from './modules/admin/admin.routes.js';
import aiRouter from './modules/ai/ai.routes.js';
import metaRouter from './modules/whatsapp/metaSetup.routes.js';

import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { isUsingFallback } from './database/db.js';

dotenv.config();

// Allowed CORS origins helper
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'https://whatsapp.bhaktisong.fun'
].filter(Boolean);

export const isCorsOriginAllowed = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return false;
};

const app = express();

// Security and utility middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (isCorsOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy blocked access from origin: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id', 'x-hub-signature-256']
}));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Capture raw body for Meta webhook signature verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));
app.use(express.urlencoded({ extended: true }));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'CampaignFlow API',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    databaseMode: isUsingFallback() ? 'development_mock_adapter' : 'mysql_connected'
  });
});

// Mount Modules
app.use('/api/auth', authRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/imports', importsRouter);
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/meta', metaRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/billing', billingRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/users', usersRouter);
app.use('/api/admin', adminRouter);
app.use('/api/ai', aiRouter);

// 404 & Centralized Error Handler
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
