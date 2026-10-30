# WhatsApp Template Management & Meta Approval Status Guide

This document describes the production-ready WhatsApp Template Management architecture for CampaignFlow, integrated with the official Meta WhatsApp Business Platform Cloud API (`v21.0`).

---

## 1. Meta Developer & WhatsApp Business Setup

### Prerequisites
1. **Meta for Developers Account:** [developers.facebook.com](https://developers.facebook.com)
2. **Business App:** Create a Business App with the **WhatsApp** product added.
3. **System User & Permanent Access Token:**
   - Under *Meta Business Manager > System Users*, create a System User (e.g. `CampaignFlow Bot`) with **Admin** role.
   - Assign WhatsApp Business Account asset with full control.
   - Generate a permanent token with permissions:
     - `whatsapp_business_management`
     - `whatsapp_business_messaging`
     - `manage_app_solution`
     - `whatsapp_business_manage_events`
4. **WhatsApp Business Account (WABA) & Phone Number:**
   - Ensure a registered phone number is verified and active (Live mode or Sandbox test sender).

---

## 2. Environment Configuration

Ensure the following variables are configured in `backend/.env` (refer to `.env.example`):

```ini
# Meta WhatsApp Cloud API (v21.0)
META_APP_ID=1165054629187576
META_APP_SECRET=your_app_secret
META_WEBHOOK_VERIFY_TOKEN=campaignflow_secure_webhook_token_2026
WHATSAPP_API_VERSION=v21.0
META_PHONE_NUMBER_ID=1341070215765610
META_WABA_ID=28532933229644434
META_ACCESS_TOKEN=your_permanent_system_user_token
```

---

## 3. Database Schema & Migration

Run the template enhancement migration:

```bash
# Path: backend/src/database/migrations/002_templates_management.sql
mysql -u cf_user -p campaignflow < backend/src/database/migrations/002_templates_management.sql
```

### Table Structure (`templates`)
| Field | Type | Description |
|---|---|---|
| `id` | BIGINT UNSIGNED AUTO_INCREMENT | Internal primary key |
| `business_id` | BIGINT UNSIGNED | Multi-tenant isolation |
| `whatsapp_account_id` | BIGINT UNSIGNED | Connected WABA account |
| `meta_template_id` | VARCHAR(128) | Official Meta template ID |
| `name` | VARCHAR(255) | Name (lowercase a-z, 0-9, _) |
| `language` | VARCHAR(32) | Language code (e.g., `en`, `en_US`, `hi`) |
| `category` | ENUM | `MARKETING`, `UTILITY`, `AUTHENTICATION` |
| `status` | ENUM | `APPROVED`, `PENDING`, `REJECTED`, `PAUSED`, `DISABLED` |
| `rejection_reason` | VARCHAR(1024) | Feedback when rejected by Meta |
| `quality_rating` | VARCHAR(32) | Quality rating from Meta (`GREEN`, `YELLOW`, `RED`, `UNKNOWN`) |
| `components` | JSON | Structured Header, Body, Footer, Buttons |
| `last_synced_at` | TIMESTAMP | Last synchronization time |
| `submitted_at` | TIMESTAMP | Submission timestamp |

---

## 4. How to Create and Submit a Template

1. Navigate to **WhatsApp Templates** in the CampaignFlow sidebar (`/templates`).
2. Click **Create Template**.
3. Fill in the template details:
   - **Template Name:** Must follow Meta naming restrictions (`^[a-z0-9_]{1,512}$`). Only lowercase letters, digits, and underscores.
   - **Category:** Choose `MARKETING`, `UTILITY`, or `AUTHENTICATION`.
   - **Language:** Select language (e.g. English, Hindi).
   - **Header (Optional):** None, Text, Image, Video, or Document.
   - **Body:** Enter message copy with numbered placeholders like `{{1}}`, `{{2}}`.
   - **Variable Examples:** Meta requires real sample values for every variable placeholder before approval.
   - **Footer (Optional):** Short text such as `"Reply STOP to opt out"`.
   - **Buttons (Optional):** Up to 3 Quick Replies, or 1 Website URL + 1 Phone Call button.
4. Review the **Live WhatsApp Mobile Simulator** on the right side.
5. Click **Submit Template to Meta**.
6. The template is immediately dispatched to Meta's Cloud API (`POST /{WABA_ID}/message_templates`) and enters the **In review (PENDING)** state.

---

## 5. Status Synchronization

### A. Automatic Webhook Synchronization (Instant)
Meta sends webhook events when a template review completes.
- **Endpoint:** `POST /api/webhooks/whatsapp`
- **Field:** `message_template_status_update`
- **Events:** `APPROVED`, `REJECTED`, `PAUSED`, `DISABLED`
When received, the backend updates the database record idempotently and records rejection reasons if applicable.

### B. Manual Sync Button
Users can click **Sync from Meta** on the `/templates` page. The backend queries `GET /{WABA_ID}/message_templates` across all pages and updates all statuses, components, and quality ratings.

### C. Live Single Template Status Check
On any template card or details modal, click **Check Live Meta Status** to query `GET /{TEMPLATE_ID}` directly.

---

## 6. Campaign Builder Integration

CampaignFlow strictly enforces Meta message sending rules:
- **Approval Check:** Unapproved (`PENDING`, `REJECTED`, `PAUSED`, `DISABLED`) templates are marked with status badges and blocked during campaign preflight checks.
- **Live Numbers vs Sandbox Numbers:** Public test numbers can send `hello_world`. Real live Indian registered numbers must send custom approved templates (e.g. `welcome_msg`).
- **Dynamic Variable Mapping:** Named and numbered parameters are dynamically extracted and replaced with recipient attributes (e.g. `{{customer_name}}` -> `Rahul`).

---

## 7. Common Meta API Errors & Troubleshooting

| Error Code | Meaning | Resolution |
|---|---|---|
| `(#131058)` | Hello World only on Test Numbers | `hello_world` cannot be sent from live registered numbers. Create a custom template like `welcome_msg` in WhatsApp Manager. |
| `(#132001)` | Template does not exist in translation | Verify template name and language code match Meta exactly (e.g. `en` vs `en_US`). |
| `(#100)` | Param name mismatch / Missing examples | When creating templates with variables, specify sample values under `example: { body_text: [["Val1", "Val2"]] }`. |
| `OAuthException 190` | Access Token Expired | Generate a permanent System User token with `whatsapp_business_messaging` and `whatsapp_business_management`. |
| `Pending Review` | Template in review | Meta automated checks take 2 to 15 minutes. Wait for status update or click "Sync from Meta". |

---

## 8. Running Automated Tests

Run the complete backend test suite:

```bash
cd backend
$env:NODE_ENV="test"; node --test tests/templates.test.js
$env:NODE_ENV="test"; node --test tests/api.test.js
```
