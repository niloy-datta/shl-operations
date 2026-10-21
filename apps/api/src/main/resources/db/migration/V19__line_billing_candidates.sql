-- V19: Internal line-aware billing candidates, NOT legal invoices or GL postings.
CREATE TABLE line_billing_candidates (
  id uuid PRIMARY KEY,
  reference varchar(40) NOT NULL UNIQUE,
  sales_order_id uuid NOT NULL UNIQUE REFERENCES line_sales_orders(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  currency char(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
  amount numeric(20,2) NOT NULL CHECK(amount>0),
  due_date date,
  status varchar(16) NOT NULL DEFAULT 'DRAFT'
    CHECK(status IN ('DRAFT','REVIEWED','VOID')),
  created_by varchar(80) NOT NULL,
  reviewed_by varchar(80),
  review_notes varchar(1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(status <> 'REVIEWED' OR reviewed_by IS NOT NULL)
);
CREATE INDEX idx_line_billing_status ON line_billing_candidates(status,created_at DESC);

CREATE TABLE line_billing_candidate_items (
  id uuid PRIMARY KEY,
  billing_id uuid NOT NULL REFERENCES line_billing_candidates(id) ON DELETE RESTRICT,
  sales_order_item_id uuid NOT NULL UNIQUE REFERENCES line_sales_order_items(id) ON DELETE RESTRICT,
  product_name varchar(240) NOT NULL,
  unit varchar(32) NOT NULL,
  quantity numeric(18,3) NOT NULL CHECK(quantity>0),
  sell_unit_price numeric(18,4) NOT NULL CHECK(sell_unit_price>0),
  line_total numeric(20,2) NOT NULL CHECK(line_total>0)
);
CREATE INDEX idx_line_billing_items_billing ON line_billing_candidate_items(billing_id);

CREATE TRIGGER trg_line_billing_items_immutable
  BEFORE UPDATE OR DELETE ON line_billing_candidate_items
  FOR EACH ROW EXECUTE FUNCTION reject_line_commerce_snapshot_mutation();
