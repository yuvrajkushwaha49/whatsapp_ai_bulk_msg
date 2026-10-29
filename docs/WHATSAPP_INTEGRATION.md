# Official WhatsApp Business Platform Cloud API Integration

CampaignFlow is built exclusively on Meta's official WhatsApp Business Platform Cloud API (pinned to **v21.0**).
It strictly avoids unofficial WhatsApp Web automation, session scraping, or third-party hacks.

---

## 1. Meta Developer App Prerequisites

1. Register at [Meta for Developers](https://developers.facebook.com/).
2. Create a **Business App**.
3. Under **Add Products**, add **WhatsApp**.
4. In the Meta Business Manager, create a **System User** with `whatsapp_business_management` and `whatsapp_business_messaging` permissions.
5. Generate a **Permanent System User Token**.

---

## 2. Webhook Setup & Security

1. In the Meta App Dashboard, navigate to **WhatsApp > Configuration**.
2. Click **Edit** on Webhook:
   - **Callback URL:** `https://yourdomain.com/api/webhooks/whatsapp`
   - **Verify Token:** Set to the value of `META_WEBHOOK_VERIFY_TOKEN` in your `.env`.
3. Click **Verify and Save**.
4. Subscribe to the following webhook fields:
   - `messages`: Receives delivery receipts (`sent`, `delivered`, `read`), errors, and inbound messages.
   - `message_template_status_update`: Receives template approval/rejection notifications.

### Signature Verification
Every incoming webhook is verified using `X-Hub-Signature-256` computed with `HMAC-SHA256` and your `META_APP_SECRET`. Unsigned or tampered requests are immediately rejected with HTTP 401.

---

## 3. Template Compliance & Marketing Rules

Meta strictly enforces template approval for outbound marketing messages:
1. **Templates must be APPROVED** before scheduling in CampaignFlow.
2. **Promotional Category:** All marketing templates must include an explicit opt-out mechanism (e.g. `Reply STOP to unsubscribe`).
3. **Preflight Suppression:** Before dispatching, CampaignFlow validates:
   - Recipient marketing opt-in consent is active.
   - Recipient has not previously sent a STOP/Unsubscribe message.
   - Sending WhatsApp phone number is connected with healthy quality rating.

---

## 4. Inbound Opt-Out Automation

When a customer replies with any of:
- `STOP`
- `UNSUBSCRIBE`
- `STOPALL`
- `CANCEL`
- `OPT OUT`

The CampaignFlow webhook engine immediately:
1. Sets `is_opted_in = FALSE` and `status = 'unsubscribed'`.
2. Appends an auditable record to `contact_consents` with timestamp.
3. Automatically suppresses this phone number from all future marketing broadcasts across the workspace.
4. Resubscription is never granted automatically via CSV import.
