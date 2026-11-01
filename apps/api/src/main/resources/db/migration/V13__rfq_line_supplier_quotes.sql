-- Supplier quote revisions are immutable, individually linked to RFQ requirement lines.
-- Preserve historical single-header supplier_offers separately; no synthetic backfill.
CREATE TABLE rfq_line_offer_revisions (
  id uuid PRIMARY KEY,
  rfq_id uuid NOT NULL REFERENCES rfqs(id) ON DELETE RESTRICT,
  item_id uuid NOT NULL REFERENCES rfq_line_items(id) ON DELETE RESTRICT,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  revision_number integer NOT NULL CHECK (revision_number BETWEEN 1 AND 10000),
  unit_price numeric(18,4) NOT NULL CHECK (unit_price > 0),
  moq numeric(18,3) NOT NULL CHECK (moq > 0),
  lead_days integer NOT NULL CHECK (lead_days BETWEEN 1 AND 3650),
  incoterm varchar(12) CHECK (incoterm IS NULL OR incoterm IN
    ('EXW','FCA','FOB','CFR','CIF','DAP','DDP')),
  port varchar(160),
  notes varchar(2000),
  created_by varchar(80) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(item_id, supplier_id, revision_number)
);
CREATE INDEX idx_rfq_line_offer_latest
  ON rfq_line_offer_revisions(rfq_id,item_id,supplier_id,revision_number DESC);

CREATE OR REPLACE FUNCTION block_rfq_line_offer_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Supplier line quote revisions are immutable; append a new revision'
    USING ERRCODE='23514';
END $$;
CREATE TRIGGER trg_no_rewrite_rfq_line_offer
  BEFORE UPDATE OR DELETE ON rfq_line_offer_revisions
  FOR EACH ROW EXECUTE FUNCTION block_rfq_line_offer_mutation();
