-- Migration 002: Enhance Templates for Meta Approval Status Management
-- Compatible with MySQL 8.0+

ALTER TABLE templates 
  MODIFY COLUMN status ENUM('APPROVED', 'PENDING', 'REJECTED', 'PAUSED', 'DISABLED') NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS meta_status VARCHAR(64) NULL AFTER status,
  ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(1024) NULL AFTER meta_status,
  ADD COLUMN IF NOT EXISTS quality_rating VARCHAR(32) NULL DEFAULT 'UNKNOWN' AFTER rejection_reason,
  ADD COLUMN IF NOT EXISTS parameter_format ENUM('POSITIONAL', 'NAMED') NOT NULL DEFAULT 'POSITIONAL' AFTER quality_rating,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP NULL AFTER parameter_format,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP NULL AFTER last_synced_at;

-- Index for fast status querying and dashboard counts
CREATE INDEX IF NOT EXISTS idx_template_status_lang ON templates (business_id, status, language);
