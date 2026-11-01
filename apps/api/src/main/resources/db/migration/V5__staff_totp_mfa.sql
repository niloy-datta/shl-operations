ALTER TABLE staff_users
  ADD COLUMN mfa_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN mfa_secret_enc varchar(512),
  ADD COLUMN mfa_pending_enc varchar(512),
  ADD COLUMN mfa_pending_at timestamptz,
  ADD COLUMN mfa_last_step bigint;
CREATE TABLE mfa_recovery_codes (
  id uuid PRIMARY KEY,
  staff_id uuid NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  code_hash char(64) NOT NULL UNIQUE,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_recovery_staff ON mfa_recovery_codes(staff_id) WHERE used_at IS NULL;
