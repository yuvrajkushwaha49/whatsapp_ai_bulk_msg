-- ==============================================================================
-- Migration 005: Support Multi-Account Management & Primary Account Flag
-- Enables businesses to connect multiple WhatsApp numbers and set a default
-- ==============================================================================

ALTER TABLE whatsapp_accounts 
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE AFTER status;

-- Index for rapid primary account lookups per business tenant
CREATE INDEX IF NOT EXISTS idx_whatsapp_primary ON whatsapp_accounts (business_id, is_primary);
