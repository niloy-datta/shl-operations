-- V18: Controlled line-aware shipment booking for issued supplier purchase orders.
-- One full-allocation shipment per supplier PO; no partial fulfillment in this slice.
CREATE TABLE line_shipments (
  id uuid PRIMARY KEY,
  reference varchar(40) NOT NULL UNIQUE,
  sales_order_id uuid NOT NULL REFERENCES line_sales_orders(id) ON DELETE RESTRICT,
  purchase_order_id uuid NOT NULL UNIQUE REFERENCES line_purchase_orders(id) ON DELETE RESTRICT,
  origin varchar(160) NOT NULL CHECK(length(btrim(origin))>0),
  destination varchar(160) NOT NULL CHECK(length(btrim(destination))>0),
  carrier varchar(160),
  tracking_number varchar(120),
  etd date,
  eta date,
  atd date,
  ata date,
  status varchar(16) NOT NULL DEFAULT 'BOOKED'
    CHECK(status IN ('BOOKED','IN_TRANSIT','DELIVERED','CANCELLED')),
  created_by varchar(80) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(eta IS NULL OR etd IS NULL OR eta>=etd),
  CHECK(ata IS NULL OR atd IS NULL OR ata>=atd)
);
CREATE INDEX idx_line_shipments_order ON line_shipments(sales_order_id,created_at DESC);
CREATE INDEX idx_line_shipments_status_eta ON line_shipments(status,eta);

CREATE TABLE line_shipment_items (
  id uuid PRIMARY KEY,
  shipment_id uuid NOT NULL REFERENCES line_shipments(id) ON DELETE RESTRICT,
  purchase_order_item_id uuid NOT NULL UNIQUE REFERENCES line_purchase_order_items(id) ON DELETE RESTRICT,
  product_name varchar(240) NOT NULL,
  quantity numeric(18,3) NOT NULL CHECK(quantity>0),
  unit varchar(32) NOT NULL
);
CREATE INDEX idx_line_shipment_items_shipment ON line_shipment_items(shipment_id);

CREATE TABLE line_shipment_events (
  id uuid PRIMARY KEY,
  shipment_id uuid NOT NULL REFERENCES line_shipments(id) ON DELETE RESTRICT,
  event varchar(20) NOT NULL CHECK(event IN ('BOOKED','IN_TRANSIT','DELIVERED','CANCELLED')),
  notes varchar(300),
  actor varchar(80) NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_line_shipment_events_history
  ON line_shipment_events(shipment_id,occurred_at DESC,id DESC);

CREATE TRIGGER trg_line_shipment_items_immutable
  BEFORE UPDATE OR DELETE ON line_shipment_items
  FOR EACH ROW EXECUTE FUNCTION reject_line_commerce_snapshot_mutation();

CREATE OR REPLACE FUNCTION reject_line_shipment_event_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Shipping milestones are append-only'
    USING ERRCODE='23514';
END $$;
CREATE TRIGGER trg_line_shipment_events_append_only
  BEFORE UPDATE OR DELETE ON line_shipment_events
  FOR EACH ROW EXECUTE FUNCTION reject_line_shipment_event_mutation();
