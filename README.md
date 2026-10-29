# CampaignFlow — WhatsApp Marketing SaaS Platform

![Version](https://img.shields.io/badge/version-1.0.0-success.svg)
![Meta Cloud API](https://img.shields.io/badge/Meta%20Cloud%20API-v21.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

**CampaignFlow** is a modern, production-ready multi-tenant WhatsApp Marketing Automation SaaS platform designed for businesses to send promotional broadcasts to opted-in customers using Meta's official WhatsApp Business Platform Cloud API.

---

## 🚀 Key Features

- **Multi-Tenant Workspace Isolation:** Strict data partitioning where businesses operate with total privacy and tenant-scoped SQL queries.
- **Official Meta Cloud API (v21.0):** Native integration for WABA onboarding, template synchronization, message sending, and webhook processing.
- **Audience & Consent Management:** E.164 phone normalization, auditable consent records, intra-file deduplication, and automatic suppression on `STOP` / `UNSUBSCRIBE` replies.
- **CSV Import Engine:** 3-step CSV wizard with column auto-mapping, duplicate skipping, invalid row detection, and row-level compliance reports.
- **Campaign Builder Wizard:** 5-step wizard with real-time audience estimation, dynamic template variable mapping, mobile preview, and preflight compliance checks.
- **Real-Time Analytics & Webhooks:** Delivery (`sent`, `delivered`, `read`) tracked via webhook events with Recharts visual graphs.
- **AI Copy Generator:** High-converting promotional copy in **Hindi**, **Hinglish**, and **English** with tone & CTA recommendations.
- **Role-Based Access Control (RBAC):** Granular permissions for `Owner`, `Admin`, `Marketer`, `Agent`, and `SuperAdmin`.
- **Subscription & Usage Quotas:** Tiered plans (Free, Starter, Pro, Enterprise) tracking contacts, messages, and campaigns.
- **Super Admin Governance Panel:** Platform-wide oversight, business approval/suspension, revenue metrics, and system health checks.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, React Router 6, Bootstrap 5, Bootstrap Icons, Recharts, Axios, React Hook Form |
| **Backend** | Node.js (ES modules), Express.js, `mysql2/promise` (pure parameterized SQL; NO ORM), Zod validation |
| **Queues & Workers** | Redis + BullMQ (with in-process fallback adapter for local dev), Exponential backoff & jitter |
| **Database** | MySQL 8 (utf8mb4, composite keys, indexes, foreign keys, 21 relational tables) |
| **Integrations** | Meta WhatsApp Business Platform Cloud API (v21.0), HMAC-SHA256 webhooks, OpenAI GPT-4o-mini |
| **DevOps** | Docker Compose (MySQL 8 + Redis 7), PM2 ecosystem, Nginx reverse proxy |

---

## 🏃 Quick Start (Local Development)

### 1. Prerequisites
- Node.js 20+ (tested on Node v24.15.0)
- npm 10+
- (Optional) Docker for containerized MySQL and Redis

### 2. Environment Configuration
Both backend and frontend have `.env.example` templates pre-configured with development defaults.

```bash
# Backend
cd backend
cp .env.example .env

# Frontend
cd ../frontend
cp .env.example .env
```

### 3. Start Database (Optional Docker Compose)
```bash
docker compose up -d
```
*Note: If MySQL/Redis is not running locally, CampaignFlow automatically activates its built-in Development Mock Adapter so you can develop, test, and inspect all features immediately!*

### 4. Run Migrations and Development Seeds
```bash
cd backend
npm run migrate
npm run seed
```

### 5. Run Automated Tests
```bash
cd backend
npm test
```
*All 8 core tests pass covering Phone normalization, Authentication, Tenant Isolation, Contacts CRUD, CSV Import, Unsubscribe enforcement, Preflight checks, and Webhook validation.*

### 6. Start Development Servers
**Backend:**
```bash
cd backend
npm run dev
# Running on http://localhost:5000 (Health check: http://localhost:5000/api/health)
```

**Frontend:**
```bash
cd frontend
npm run dev
# Running on http://localhost:5173
```

---

## 🔑 Demo Login Accounts

| Role | Email | Password | Permissions |
|---|---|---|---|
| **System SuperAdmin** | `superadmin@campaignflow.io` | `Password123!` | Platform-wide governance, all tenants, system health |
| **Workspace Owner** | `owner@acmeretail.com` | `Password123!` | Full workspace access, billing, team invites, campaigns |
| **Marketer** | `marketer@acmeretail.com` | `Password123!` | Create & launch campaigns, audience imports, AI copy |
| **Support Agent** | `agent@acmeretail.com` | `Password123!` | View-only audience and campaign delivery reports |

---

## 📦 Project Structure

```
aisency/
├── backend/
│   ├── src/
│   │   ├── app.js               # Express application configuration
│   │   ├── server.js            # Entry point & graceful shutdown
│   │   ├── config/              # Environment settings
│   │   ├── database/
│   │   │   ├── db.js            # Parameterized SQL gateway & fallback adapter
│   │   │   ├── migrate.js       # Database migration runner
│   │   │   ├── seed.js          # Development seeder
│   │   │   └── migrations/      # 001_initial_schema.sql (21 tables)
│   │   ├── middleware/          # auth.js, tenant.js (RBAC), validate.js, errorHandler.js
│   │   ├── modules/
│   │   │   ├── auth/            # Register, login, me, JWT sessions
│   │   │   ├── contacts/        # Contacts CRUD, tagging, consent controls
│   │   │   ├── imports/         # CSV parser, preview, deduplication, audit
│   │   │   ├── whatsapp/        # Meta Cloud API client, template sync
│   │   │   ├── webhooks/        # HMAC verification, status receipts, STOP handling
│   │   │   ├── campaigns/       # Wizard, audience filter, preflight, dispatch
│   │   │   ├── billing/         # Subscriptions, tiers, usage ledger
│   │   │   ├── analytics/       # Delivery rates, read rates, trend charts
│   │   │   ├── users/           # Team management, role switcher
│   │   │   ├── admin/           # Super Admin console
│   │   │   └── ai/              # Hindi, Hinglish, English copy generator
│   │   ├── queues/              # BullMQ campaign dispatch queue
│   │   └── utils/               # Logger, phone normalizer, JWT
│   ├── tests/                   # Automated integration test suite
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/          # Navbar, Sidebar, Breadcrumbs, StatCard
│   │   ├── hooks/               # useAuth.jsx (AuthContext, role checks)
│   │   ├── layouts/             # AppLayout, AuthLayout
│   │   ├── pages/               # Dashboard, Contacts, CsvImport, Campaigns, etc.
│   │   ├── services/            # Axios API client with token interceptors
│   │   └── styles/              # index.css (Custom rich SaaS CSS styling)
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── docs/
│   ├── API.md                   # REST API Reference
│   ├── ARCHITECTURE.md          # Multi-Tenant & Queue design
│   ├── DEPLOYMENT_UBUNTU.md     # Production deployment instructions
│   └── WHATSAPP_INTEGRATION.md  # Meta Developer & Webhook guidelines
├── docker-compose.yml           # MySQL 8 + Redis 7
├── ecosystem.config.cjs         # PM2 configuration for VPS
├── nginx.conf                   # Production Nginx reverse-proxy
├── .gitignore
└── README.md
```

---

## 📋 Delivery Status Checklist

| Phase | Milestone | Status | Details |
|---|---|---|---|
| **Phase 1** | Project Initialization & Monorepo Setup | ✅ Completed | Clean monorepo structure, `package.json`, `.env.example`, Docker Compose |
| **Phase 2** | Database Migrations & Multi-Tenant Auth | ✅ Completed | 21 relational tables, strict tenant isolation, JWT, bcrypt, RBAC |
| **Phase 3** | Contacts, CSV Importer & Opt-In Engine | ✅ Completed | E.164 phone normalization, deduplication, consent audit trail |
| **Phase 4** | Meta WhatsApp Cloud API & Webhooks | ✅ Completed | Cloud API client, template sync, HMAC SHA256, auto opt-out |
| **Phase 5** | Campaign Wizard, Preflight & Queues | ✅ Completed | 5-step wizard, preflight compliance checks, BullMQ dispatch workers |
| **Phase 6** | Analytics, Billing Quotas & Super Admin | ✅ Completed | Delivery & read charts, subscription plans, platform admin console |
| **Phase 7** | AI Message Generator & Automated Tests | ✅ Completed | Hindi/Hinglish copy generation, 8 automated test suites passing |
| **Phase 8** | Builds & Verification | ✅ Completed | Frontend Vite build passed (6.3s), Backend test suite passed (708ms) |
| **Phase 9** | Documentation & Production Configs | ✅ Completed | API.md, ARCHITECTURE.md, DEPLOYMENT_UBUNTU.md, PM2, Nginx |
#   w h a t s a p p _ a i _ b u l k _ m s g  
 