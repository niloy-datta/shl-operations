CREATE TABLE confidential_commission_events (
  id uuid PRIMARY KEY,
  commission_id uuid NOT NULL REFERENCES confidential_commissions(id),
  actor varchar(80) NOT NULL,
  action varchar(40) NOT NULL,
  detail varchar(300),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_private_commission_history
  ON confidential_commission_events(commission_id,created_at DESC,id DESC);
