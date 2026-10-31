-- ==============================================================================
-- Migration 009: SaaS Platform-Level Meta Configuration & Embedded Signup Sessions
-- Implements AiSensy-style SaaS architecture where Super Admin configures ONE platform
-- Meta Developer App, and clients connect their own WABAs via "Continue with Facebook".
-- ==============================================================================

-- 1. Platform-level Meta Configuration (configured once by Super Admin for all tenants)
CREATE TABLE IF NOT EXISTS platform_meta_configs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  meta_app_id VARCHAR(64) NOT NULL,
  encrypted_meta_app_secret TEXT NOT NULL,
  embedded_signup_config_id VARCHAR(64) NULL,
  graph_api_version VARCHAR(16) DEFAULT 'v21.0',
  webhook_verify_token VARCHAR(128) NOT NULL,
  encrypted_webhook_app_secret TEXT NULL,
  is_enabled TINYINT(1) DEFAULT 1,
  readiness_status ENUM('ready', 'incomplete', 'missing_credentials', 'invalid_secret') DEFAULT 'incomplete',
  last_tested_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Meta Embedded Signup Onboarding Sessions (CSRF protection & OAuth state tracking)
CREATE TABLE IF NOT EXISTS meta_onboarding_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  state_hash VARCHAR(128) NOT NULL UNIQUE,
  session_status ENUM('initiated', 'authenticating', 'completed', 'expired', 'failed') DEFAULT 'initiated',
  redirect_origin VARCHAR(255) NULL,
  error_message TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  completed_at DATETIME NULL,
  INDEX idx_onboarding_state (state_hash),
  INDEX idx_onboarding_tenant (tenant_id),
  FOREIGN KEY (tenant_id) REFERENCES businesses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
