ALTER TABLE staff_users ADD COLUMN supabase_user_id uuid UNIQUE;
ALTER TABLE staff_users ADD COLUMN mfa_required boolean NOT NULL DEFAULT true;
ALTER TABLE staff_users ALTER COLUMN password_hash DROP NOT NULL;

CREATE TABLE staff_permissions (
  staff_id uuid NOT NULL REFERENCES staff_users(id) ON DELETE RESTRICT,
  permission varchar(60) NOT NULL CHECK (permission IN ('COMMISSION_ACCESS')),
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(staff_id, permission)
);

CREATE TABLE app_auth_sessions (
  session_id uuid PRIMARY KEY,
  staff_id uuid NOT NULL REFERENCES staff_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE INDEX idx_app_sessions_staff ON app_auth_sessions(staff_id, created_at DESC);
