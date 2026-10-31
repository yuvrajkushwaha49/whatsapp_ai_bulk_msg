# Official Meta WhatsApp Embedded Signup Setup Guide

This guide provides step-by-step instructions for configuring **Facebook Login for Business** and **WhatsApp Embedded Signup** in your Meta Developer Console so your SaaS customers can connect their official WhatsApp Business Accounts with a single click.

---

## 1. Prerequisites in Meta for Developers

1. A verified [Meta Business Portfolio](https://business.facebook.com/) (formerly Meta Business Manager).
2. An active [Meta Developer Account](https://developers.facebook.com/).

---

## 2. Step-by-Step Meta Developer App Configuration

### Step A: Create a Meta App
1. Go to [developers.facebook.com/apps](https://developers.facebook.com/apps/) and click **Create App**.
2. Select **Other** as the use case ➔ Click **Next**.
3. Select **Business** as the app type ➔ Click **Next**.
4. Enter your App Name (e.g. `CampaignFlow WhatsApp Platform`) and link your verified Meta Business Portfolio.
5. Click **Create App**.

---

### Step B: Add Required Products to Your App
In the App Dashboard left sidebar:
1. Under **Add Products to Your App**:
   * Add **WhatsApp** ➔ Click **Set Up**.
   * Add **Facebook Login for Business** ➔ Click **Set Up**.

---

### Step C: Configure WhatsApp Embedded Signup & Obtain Configuration ID

This is the most critical step for the one-click "Continue with Facebook" popup:

1. In the left menu, navigate to:  
   **Facebook Login for Business** ➔ **Configurations** (or Quickstart).
2. Click **Create Configuration**.
3. Set a Configuration Name: `CampaignFlow WhatsApp Onboarding`.
4. Under **Permissions**, select:
   * `whatsapp_business_management` (Required: to access and manage WABAs and phone numbers).
   * `whatsapp_business_messaging` (Required: to send and receive WhatsApp messages and templates).
5. Under **Features**, ensure **WhatsApp Embedded Signup** is checked/enabled.
6. Save the configuration.
7. **Copy the Configuration ID** (e.g., `1234567890123456`).
8. Paste this Configuration ID into your `.env`:
   ```ini
   META_EMBEDDED_SIGNUP_CONFIG_ID=your_configuration_id_here
   ```

---

### Step D: Allowed Domains & Webhooks
1. In the App Dashboard ➔ **App Settings** ➔ **Basic**:
   * Add your live production domain in **App Domains**:  
     `whatsapp.bhaktisong.fun`
   * Add your Privacy Policy URL and Terms of Service URL.
2. In **Facebook Login for Business** ➔ **Settings**:
   * Add your live HTTPS domain to **Valid OAuth Redirect URIs**:  
     `https://whatsapp.bhaktisong.fun`
3. In **WhatsApp** ➔ **Configuration**:
   * **Callback URL**: `https://whatsapp.bhaktisong.fun/api/webhooks/whatsapp`
   * **Verify Token**: `campaignflow_secure_webhook_token_2026`
   * Subscribe to the **`messages`** and **`message_template_status_update`** fields.

---

## 3. Environment Variables in CampaignFlow

In your backend `.env` file (e.g., on your EC2 instance):

```ini
# Meta WhatsApp Business Platform
META_APP_ID=1165054629187576
META_APP_SECRET=your_meta_app_secret
META_EMBEDDED_SIGNUP_CONFIG_ID=your_meta_configuration_id
META_TOKEN_ENCRYPTION_KEY=super_secure_32_bytes_token_encryption_key_2026
META_WEBHOOK_VERIFY_TOKEN=campaignflow_secure_webhook_token_2026
WHATSAPP_API_VERSION=v21.0
```

---

## 4. Understanding App Modes & Permissions

| App Mode | Who Can Onboard? | Requirements |
|---|---|---|
| **Development Mode** | Developers, Admins, and Testers added to your Meta App. | Perfect for initial testing with your own WABA and test numbers. No App Review required. |
| **Live / Production Mode** | Any customer / business around the world! | Requires submitting **App Review** for `whatsapp_business_management` and `whatsapp_business_messaging` with Advanced Access, and completing Business Verification. |

---

## 5. What Happens When a Customer Clicks "Continue with Facebook"?

1. **Customer Clicks Button**: Official Meta popup opens via Facebook JavaScript SDK.
2. **Meta Hosts The Flow**: Customer logs into Facebook, picks/creates their Meta Business Portfolio, creates or selects their WABA, enters their business phone number, and verifies via SMS OTP.
3. **Session Listener**: As the customer completes the flow, Meta fires `sessionInfoListener` events sending the `waba_id` and `phone_number_id` directly to our frontend.
4. **Code Exchange**: Meta returns an authorization `code`. Frontend sends it to `/api/whatsapp/accounts/connect/complete`.
5. **Backend Server-Side**:
   * Exchanges `code` for an access token directly with Meta Graph API.
   * Encrypts the token at rest using AES-256-GCM.
   * Subscribes your app to the customer's WABA webhooks (`POST /{waba-id}/subscribed_apps`).
   * Registers the phone number.
   * Stores the account in the database and updates status to `CONNECTED`.
6. **Instant Readiness**: The customer's account immediately appears in **WhatsApp Accounts**, **Inbox**, **Templates**, and **Campaigns**!
