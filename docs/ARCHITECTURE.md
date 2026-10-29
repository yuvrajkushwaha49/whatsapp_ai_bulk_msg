# CampaignFlow Architecture & Multi-Tenant Design

CampaignFlow is an enterprise-grade, multi-tenant WhatsApp Marketing Automation SaaS built with Node.js, Express, MySQL 8, Redis, BullMQ, and React with Bootstrap 5.

---

## 1. Multi-Tenant Isolation Architecture

```
                    ┌────────────────────────────┐
                    │    Authenticated Client    │
                    └──────────────┬─────────────┘
                                   │ Bearer JWT (userId, businessId)
                                   ▼
                    ┌────────────────────────────┐
                    │  Auth & Tenant Middleware  │
                    └──────────────┬─────────────┘
                                   │ Resolves req.businessId from DB session
                                   ▼
         ┌──────────────────────────────────────────────────┐
         │              Business Service Layer              │
         │   • Strictly scopes all queries with business_id │
         │   • Parameterized SQL queries (No ORM)           │
         └─────────────────────────┬────────────────────────┘
                                   ▼
         ┌──────────────────────────────────────────────────┐
         │             MySQL 8 Relational Schema            │
         │   • Composite Unique Keys (business_id, phone)   │
         │   • ON DELETE CASCADE foreign keys               │
         └──────────────────────────────────────────────────┘
```

### Core Tenets of Tenant Isolation:
1. **Never trust client-supplied business IDs:** Tenant identification is derived strictly from the cryptographically verified JWT session.
2. **Tenant Scoped Queries:** Every query touching audience, campaigns, messages, or tags enforces `WHERE business_id = ?`.
3. **Database Uniqueness:** Contacts are uniquely constrained per business `(business_id, phone)`, preventing cross-tenant collisions while allowing multiple businesses to independently message the same consumer.
4. **Super Admin Isolation:** Super Admin privileges are separated from business tenant roles (`owner`, `admin`, `marketer`, `agent`).

---

## 2. Background Queue & Worker Pipeline

```
[Campaign Builder] ──► [Preflight Validator] ──► [BullMQ Queue: dispatch]
                                                           │
                                                           ▼
                                                [Campaign Worker]
                                                           │
               ┌───────────────────────────────────────────┴───────────────────────────────────────────┐
               ▼                                                                                       ▼
    [Recheck Consent & Opt-Out]                                                             [Meta Cloud API Client]
    (Suppress if unsubscribed)                                                             (Rate-limited with Jitter)
               │                                                                                       │
               ▼                                                                                       ▼
    [Mark as Skipped]                                                                       [Store Provider wamid]
                                                                                                       │
                                                                                                       ▼
                                                                                            [Awaiting Meta Webhooks]
```

### Queue Resilience Features:
- **Pre-send Recheck:** Contacts that opt out between campaign creation and actual execution are dynamically suppressed right before sending.
- **Exponential Backoff with Jitter:** Protects against transient Meta rate limits.
- **Development Fallback Mode:** When Redis is offline during local development, an asynchronous in-process queue executes jobs transparently.

---

## 3. Database Schema Overview (21 Tables)

| Table | Description |
|---|---|
| `businesses` | Tenant workspaces, timezone, and operational status |
| `users` | Workspace members with granular RBAC roles |
| `user_sessions` | Refresh token revocation and session tracking |
| `whatsapp_accounts` | Connected Meta WABA IDs, Phone Number IDs, and quality tiers |
| `contacts` | Audience contacts with E.164 phone numbers and custom JSON fields |
| `contact_consents` | Auditable consent ledger with source, category, and withdrawal audit trail |
| `tags` | Workspace segment tags |
| `contact_tags` | Many-to-many contact tag relations |
| `import_jobs` | CSV import batches with progress tracking |
| `import_rows` | Row-level validation and error reporting |
| `templates` | Synchronized Meta approved marketing templates |
| `campaigns` | Broadcast campaign records and variable mappings |
| `campaign_recipients` | Recipient delivery state machine (`pending` -> `sent` -> `delivered` -> `read`) |
| `messages` | Unified message log with provider message IDs (`wamid...`) |
| `webhook_events` | Idempotent webhook event ledger |
| `inbound_conversations`| Inbound customer messages and customer support threads |
| `subscription_plans` | Tiered pricing rules, contact quotas, and message allowances |
| `subscriptions` | Active tenant subscriptions and renewal dates |
| `usage_ledger` | Monthly quota consumption metrics |
| `audit_logs` | Compliance and security audit trail |
| `notifications` | In-app user notifications |
