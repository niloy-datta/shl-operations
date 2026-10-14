-- Structured customer requirements; existing commercial header amounts remain authoritative.
-- Never backfill fabricated product specifications into historical RFQs.
CREATE TABLE rfq_line_items (
  id uuid PRIMARY KEY,
  rfq_id uuid NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  line_number integer NOT NULL CHECK (line_number BETWEEN 1 AND 50),
  product_name varchar(240) NOT NULL CHECK (length(btrim(product_name)) > 0),
  specifications varchar(3000),
  hs_code varchar(10) CHECK (hs_code IS NULL OR hs_code ~ '^[0-9]{4,10}$'),
  quantity numeric(18,3) NOT NULL CHECK (quantity > 0),
  unit varchar(32) NOT NULL CHECK (length(btrim(unit)) > 0),
  tolerance_notes varchar(500),
  origin_country varchar(100),
  target_destination varchar(160),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rfq_id, line_number)
);
CREATE INDEX idx_rfq_line_items_rfq ON rfq_line_items(rfq_id, line_number);
