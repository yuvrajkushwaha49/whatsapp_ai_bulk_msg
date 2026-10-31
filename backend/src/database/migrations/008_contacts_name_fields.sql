-- Migration 008: Add first_name, last_name and tags to contacts
ALTER TABLE contacts 
  ADD COLUMN first_name VARCHAR(128) NULL AFTER name,
  ADD COLUMN last_name VARCHAR(128) NULL AFTER first_name,
  ADD COLUMN tags JSON NULL AFTER custom_fields,
  ADD COLUMN last_contacted_at TIMESTAMP NULL AFTER tags;
