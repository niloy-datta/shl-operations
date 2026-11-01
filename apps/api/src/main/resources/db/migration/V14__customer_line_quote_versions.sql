-- Standalone line-aware customer quotations: NO automatic legacy sales-order conversion.
-- Monetary fields are in the RFQ's own currency; they are provisional, excluding
-- freight, tax, insurance, duties, FX and supplier compliance validation.
CREATE TABLE customer_line_quotes (
  id uuid PRIMARY KEY,
  rfq_id uuid NOT NULL REFERENCES rfqs(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK(version BETWEEN 1 AND 10000),
  currency char(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
  status varchar(16) NOT NULL DEFAULT 'DRAFT'
    CHECK(status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED')),
  valid_until date,
  total_cost numeric(20,2) NOT NULL CHECK(total_cost > 0),
  total_sell numeric(20,2) NOT NULL CHECK(total_sell > 0),
  gross_contribution numeric(20,2) NOT NULL CHECK(gross_contribution >= 0),
  created_by varchar(80) NOT NULL,
  reviewed_by varchar(80),
  review_notes varchar(1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(rfq_id,version),
  CHECK(gross_contribution=total_sell-total_cost),
  CHECK((status='APPROVED' AND reviewed_by IS NOT NULL) OR status<>'APPROVED')
);
CREATE UNIQUE INDEX idx_approved_customer_line_quote
  ON customer_line_quotes(rfq_id) WHERE status='APPROVED';
CREATE INDEX idx_customer_line_quotes_recent ON customer_line_quotes(created_at DESC);

CREATE TABLE customer_line_quote_items (
  id uuid PRIMARY KEY,
  quote_id uuid NOT NULL REFERENCES customer_line_quotes(id) ON DELETE RESTRICT,
  rfq_item_id uuid NOT NULL REFERENCES rfq_line_items(id) ON DELETE RESTRICT,
  source_revision_id uuid NOT NULL REFERENCES rfq_line_offer_revisions(id) ON DELETE RESTRICT,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  product_name varchar(240) NOT NULL,
  unit varchar(32) NOT NULL,
  quantity numeric(18,3) NOT NULL CHECK(quantity>0),
  source_unit_cost numeric(18,4) NOT NULL CHECK(source_unit_cost>0),
  sell_unit_price numeric(18,4) NOT NULL CHECK(sell_unit_price>0),
  cost_total numeric(20,2) NOT NULL CHECK(cost_total>0),
  sell_total numeric(20,2) NOT NULL CHECK(sell_total>0),
  UNIQUE(quote_id,rfq_item_id)
);
CREATE INDEX idx_customer_line_quote_items ON customer_line_quote_items(quote_id);
CREATE OR REPLACE FUNCTION reject_customer_quote_line_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Customer quotation line snapshots are immutable; create a new quote version'
    USING ERRCODE='23514';
END $$;
CREATE TRIGGER trg_customer_quote_line_immutable
  BEFORE UPDATE OR DELETE ON customer_line_quote_items
  FOR EACH ROW EXECUTE FUNCTION reject_customer_quote_line_mutation();
