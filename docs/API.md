# CampaignFlow REST API Reference

All requests must use `Content-Type: application/json`.
Protected endpoints require `Authorization: Bearer <JWT_TOKEN>`.

---

## 1. Authentication (`/api/auth`)

### Register Business & Owner
`POST /api/auth/register`
```json
{
  "businessName": "Acme Retail Store",
  "name": "Rahul Sharma",
  "email": "owner@acmeretail.com",
  "password": "Password123!",
  "timezone": "Asia/Kolkata"
}
```

### Login
`POST /api/auth/login`
```json
{
  "email": "owner@acmeretail.com",
  "password": "Password123!"
}
```

### Current User & Workspace
`GET /api/auth/me`

### Logout
`POST /api/auth/logout`

---

## 2. Contacts & Audience (`/api/contacts`)

### List Contacts
`GET /api/contacts?page=1&limit=20&search=9811&tag=VIP&optedIn=true`

### Create Contact with Verifiable Consent
`POST /api/contacts`
```json
{
  "phone": "+919876543210",
  "name": "Ananya Gupta",
  "email": "ananya@example.com",
  "consentProof": "Explicit opt-in received on website checkout"
}
```

### Toggle Consent / Unsubscribe
`PATCH /api/contacts/:id/consent`
```json
{
  "optedIn": false,
  "reason": "Customer requested unsubscribe via support"
}
```

### Delete Contact
`DELETE /api/contacts/:id`

---

## 3. CSV Imports (`/api/imports`)

### Preview & Column Mapping Analysis
`POST /api/imports/preview`
```json
{
  "csvText": "phone,name,email,consent\n9811122233,Ananya,ananya@test.com,yes"
}
```

### Execute Verified Import
`POST /api/imports/execute`
```json
{
  "csvText": "phone,name,email,consent\n9811122233,Ananya,ananya@test.com,yes",
  "fileName": "leads_2026.csv",
  "columnMapping": {
    "phone": "phone",
    "name": "name",
    "email": "email",
    "consent": "consent"
  },
  "consentSource": "csv_upload_batch"
}
```

---

## 4. WhatsApp Accounts & Templates (`/api/whatsapp`)

### Connect WhatsApp Account
`POST /api/whatsapp/connect`
```json
{
  "displayName": "Acme Retail Offers",
  "phoneNumber": "+919876543210",
  "phoneNumberId": "1092837465992",
  "wabaId": "992837465001",
  "accessToken": "EAA..."
}
```

### Synchronize Meta Templates
`POST /api/whatsapp/accounts/:accountId/sync-templates`

### List Approved Templates
`GET /api/whatsapp/templates?status=APPROVED`

---

## 5. Webhooks (`/api/webhooks`)

### Webhook Verification Challenge (Meta)
`GET /api/webhooks/whatsapp?hub.mode=subscribe&hub.challenge=123&hub.verify_token=campaignflow_meta_verify_token_xyz`

### Webhook Event Ingestion (Statuses & Inbound Messages)
`POST /api/webhooks/whatsapp`
Headers: `X-Hub-Signature-256: sha256=...`

---

## 6. Campaigns (`/api/campaigns`)

### Preview Audience
`POST /api/campaigns/preview`
```json
{
  "tagIds": [1, 2]
}
```

### Compliance Preflight Check
`POST /api/campaigns/preflight`
```json
{
  "whatsappAccountId": 1,
  "templateId": 1,
  "tagIds": [1]
}
```

### Create Campaign Draft
`POST /api/campaigns`
```json
{
  "name": "Diwali Mega Sale Early Access",
  "purpose": "Customer activation broadcast",
  "whatsappAccountId": 1,
  "templateId": 1,
  "tagIds": [1],
  "variableMappings": {
    "var_1": "contact.name",
    "var_2": "30",
    "var_3": "FESTIVE30"
  }
}
```

### Start / Queue Campaign
`POST /api/campaigns/:id/start`

### Pause Campaign
`POST /api/campaigns/:id/pause`

### Cancel Campaign
`POST /api/campaigns/:id/cancel`

### Campaign Report & Recipient Logs
`GET /api/campaigns/:id`

---

## 7. AI Promotional Copy Assistant (`/api/ai`)

### Generate Message Copy
`POST /api/ai/generate-copy`
```json
{
  "businessDescription": "Acme Retail Store",
  "productOrService": "Festive Ethnic Wear",
  "offerDetails": "Flat 30% off with code FESTIVE30",
  "language": "Hinglish",
  "tone": "Engaging & Urgent"
}
```

---

## 8. Billing & Quotas (`/api/billing`)

### List Available Plans
`GET /api/billing/plans`

### Current Subscription
`GET /api/billing/subscription`

### Monthly Usage Breakdown
`GET /api/billing/usage`

### Upgrade Plan
`POST /api/billing/upgrade`
```json
{
  "planId": 3
}
```

---

## 9. Super Admin Console (`/api/admin`)

*(Requires `role: superadmin`)*

### Platform Metrics & Health
`GET /api/admin/dashboard`

### List All Businesses
`GET /api/admin/businesses`

### Update Tenant Status (Active / Suspended)
`PATCH /api/admin/businesses/:id/status`
```json
{
  "status": "suspended"
}
```
