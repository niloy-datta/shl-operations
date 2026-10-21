-- V17: Isolated line-aware order/procurement lifecycle.
-- No automatic coupling to legacy sales_orders, purchase_orders, shipments or finance.
CREATE TABLE line_sales_orders (
  id uuid PRIMARY KEY,
  reference varchar(40) NOT NULL UNIQUE,
  quote_id uuid NOT NULL UNIQUE REFERENCES customer_line_quotes(id) ON DELETE RESTRICT,
  rfq_id uuid NOT NULL UNIQUE REFERENCES rfqs(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  currency char(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
  total_amount numeric(20,2) NOT NULL CHECK(total_amount > 0),
  status varchar(16) NOT NULL DEFAULT 'DRAFT'
    CHECK(status IN ('DRAFT','CONFIRMED','CANCELLED')),
  created_by varchar(80) NOT NULL,
  confirmed_by varchar(80),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(status <> 'CONFIRMED' OR confirmed_by IS NOT NULL)
);
CREATE INDEX idx_line_sales_orders_customer ON line_sales_orders(customer_id,created_at DESC);

CREATE TABLE line_sales_order_items (
  id uuid PRIMARY KEY,
  sales_order_id uuid NOT NULL REFERENCES line_sales_orders(id) ON DELETE RESTRICT,
  quote_line_id uuid NOT NULL UNIQUE REFERENCES customer_line_quote_items(id) ON DELETE RESTRICT,
  rfq_item_id uuid NOT NULL REFERENCES rfq_line_items(id) ON DELETE RESTRICT,
  source_revision_id uuid NOT NULL REFERENCES rfq_line_offer_revisions(id) ON DELETE RESTRICT,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  product_name varchar(240) NOT NULL,
  unit varchar(32) NOT NULL,
  quantity numeric(18,3) NOT NULL CHECK(quantity>0),
  sell_unit_price numeric(18,4) NOT NULL CHECK(sell_unit_price>0),
  sell_total numeric(20,2) NOT NULL CHECK(sell_total>0),
  source_unit_cost numeric(18,4) NOT NULL CHECK(source_unit_cost>0),
  cost_total numeric(20,2) NOT NULL CHECK(cost_total>0),
  UNIQUE(sales_order_id,rfq_item_id)
);
CREATE INDEX idx_line_sales_order_items_order ON line_sales_order_items(sales_order_id);

CREATE TABLE line_purchase_orders (
  id uuid PRIMARY KEY,
  reference varchar(40) NOT NULL UNIQUE,
  sales_order_id uuid NOT NULL REFERENCES line_sales_orders(id) ON DELETE RESTRICT,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  currency char(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
  total_amount numeric(20,2) NOT NULL CHECK(total_amount>0),
  status varchar(16) NOT NULL DEFAULT 'DRAFT'
    CHECK(status IN ('DRAFT','ISSUED','CANCELLED')),
  created_by varchar(80) NOT NULL,
  issued_by varchar(80),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sales_order_id,supplier_id),
  CHECK(status <> 'ISSUED' OR issued_by IS NOT NULL)
);
CREATE INDEX idx_line_purchase_orders_order ON line_purchase_orders(sales_order_id);

CREATE TABLE line_purchase_order_items (
  id uuid PRIMARY KEY,
  purchase_order_id uuid NOT NULL REFERENCES line_purchase_orders(id) ON DELETE RESTRICT,
  sales_order_item_id uuid NOT NULL UNIQUE REFERENCES line_sales_order_items(id) ON DELETE RESTRICT,
  source_revision_id uuid NOT NULL REFERENCES rfq_line_offer_revisions(id) ON DELETE RESTRICT,
  product_name varchar(240) NOT NULL,
  unit varchar(32) NOT NULL,
  quantity numeric(18,3) NOT NULL CHECK(quantity>0),
  unit_cost numeric(18,4) NOT NULL CHECK(unit_cost>0),
  cost_total numeric(20,2) NOT NULL CHECK(cost_total>0)
);
CREATE INDEX idx_line_po_items_po ON line_purchase_order_items(purchase_order_id);

-- Quoted line and PO line snapshots must not change after being recorded.
-- Status transitions take place on the parent record with audited controllers.
CREATE OR REPLACE FUNCTION reject_line_commerce_snapshot_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Line order financial snapshots are immutable'
    USING ERRCODE='23514';
END $$;
CREATE TRIGGER trg_line_sales_order_items_immutable
  BEFORE UPDATE OR DELETE ON line_sales_order_items
  FOR EACH ROW EXECUTE FUNCTION reject_line_commerce_snapshot_mutation();
CREATE TRIGGER trg_line_purchase_order_items_immutable
  BEFORE UPDATE OR DELETE ON line_purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION reject_line_commerce_snapshot_mutation();
