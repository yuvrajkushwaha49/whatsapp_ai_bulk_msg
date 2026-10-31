-- ==============================================================================
-- Migration 004: Meta WhatsApp Embedded Signup Enhancements
-- Adds metadata fields for official WABA onboarding, verification & webhook status
-- ==============================================================================

ALTER TABLE whatsapp_accounts 
  ADD COLUMN IF NOT EXISTS meta_business_id VARCHAR(128) NULL AFTER business_id,
  ADD COLUMN IF NOT EXISTS verified_name VARCHAR(255) NULL AFTER display_name,
  ADD COLUMN IF NOT EXISTS connection_status VARCHAR(64) DEFAULT 'CONNECTED' AFTER status,
  ADD COLUMN IF NOT EXISTS permissions_json TEXT NULL AFTER connection_status,
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMP NULL AFTER permissions_json,
  ADD COLUMN IF NOT EXISTS webhook_subscribed_at TIMESTAMP NULL AFTER last_verified_at,
  ADD COLUMN IF NOT EXISTS disconnected_at TIMESTAMP NULL AFTER webhook_subscribed_at;

-- Ensure index for fast status lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_conn_status ON whatsapp_accounts (business_id, connection_status);
