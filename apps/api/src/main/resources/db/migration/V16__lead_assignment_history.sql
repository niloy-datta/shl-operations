-- V15 is reserved by the separately reviewed website-intake PR.
-- Preserve existing owners; do not fabricate historical events.
CREATE TABLE crm_lead_assignments (
  id uuid PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES crm_leads(id),
  previous_owner_id uuid REFERENCES staff_users(id),
  new_owner_id uuid NOT NULL REFERENCES staff_users(id),
  assigned_by varchar(80) NOT NULL,
  reason varchar(300) NOT NULL CHECK (length(btrim(reason)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (previous_owner_id IS DISTINCT FROM new_owner_id)
);
CREATE INDEX idx_crm_lead_assignments_history
  ON crm_lead_assignments(lead_id,created_at DESC,id DESC);
