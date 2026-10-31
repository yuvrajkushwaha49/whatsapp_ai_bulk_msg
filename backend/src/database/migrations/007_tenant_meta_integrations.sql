-- Migration 007: Tenant Meta Integrations & Guided Setup Wizard State
CREATE TABLE IF NOT EXISTS tenant_meta_integrations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  business_id BIGINT UNSIGNED NOT NULL UNIQUE,
  integration_mode ENUM('platform_managed', 'client_owned') DEFAULT 'platform_managed',
  meta_app_id VARCHAR(64) NULL,
  encrypted_meta_app_secret TEXT NULL,
  embedded_signup_config_id VARCHAR(64) NULL,
  configuration_status ENUM('pending', 'configured', 'verified', 'failed') DEFAULT 'pending',
  setup_step INT DEFAULT 1,
  setup_completed_at DATETIME NULL,
  last_validation_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_integration (business_id, integration_mode),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
