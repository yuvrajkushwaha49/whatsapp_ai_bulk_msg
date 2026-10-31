-- ==============================================================================
-- Migration 006: Multi-Tenant WhatsApp Accounts Metadata & Token Lifecycle
-- Adds credential lifecycle, token type, expiry and error diagnostics
-- ==============================================================================

ALTER TABLE whatsapp_accounts 
  ADD COLUMN IF NOT EXISTS token_type VARCHAR(64) DEFAULT 'BEARER' AFTER access_token_encrypted,
  ADD COLUMN IF NOT EXISTS last_error_message TEXT NULL AFTER webhook_subscribed_at,
  ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMP NULL AFTER last_error_message;

-- Index for connection status and error monitoring across multi-tenant platform
CREATE INDEX IF NOT EXISTS idx_whatsapp_status_health ON whatsapp_accounts (connection_status, last_error_at);
