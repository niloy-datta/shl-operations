CREATE TABLE auth_sessions (
  id uuid PRIMARY KEY,
  staff_id uuid NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at > created_at)
);
CREATE INDEX idx_auth_sessions_staff ON auth_sessions(staff_id,created_at DESC);
CREATE INDEX idx_auth_sessions_expiration ON auth_sessions(expires_at);

-- Store a digest of the normalized login identifier, never passwords or IP addresses.
CREATE TABLE auth_login_limits (
  login_key char(64) PRIMARY KEY,
  failures integer NOT NULL DEFAULT 0 CHECK (failures >= 0),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz
);
