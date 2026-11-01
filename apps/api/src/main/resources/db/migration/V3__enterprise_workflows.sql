ALTER TABLE staff_users ADD COLUMN password_changed_at timestamptz;
ALTER TABLE staff_users ADD CONSTRAINT chk_staff_role
  CHECK (role IN ('ADMIN','MANAGEMENT','BD','SOURCING','LOGISTICS','FINANCE'));
CREATE INDEX idx_staff_role ON staff_users(role) WHERE enabled = true;

CREATE TABLE audit_events (
  id uuid PRIMARY KEY,
  actor varchar(80) NOT NULL,
  action varchar(60) NOT NULL,
  entity_type varchar(40) NOT NULL,
  entity_id uuid NOT NULL,
  detail varchar(300),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_created ON audit_events(created_at DESC);
CREATE INDEX idx_audit_entity ON audit_events(entity_type,entity_id,created_at DESC);

CREATE TABLE customer_quotes (
  id uuid PRIMARY KEY,
  rfq_id uuid NOT NULL REFERENCES rfqs(id),
  version integer NOT NULL CHECK(version >= 1),
  unit_price numeric(18,4) NOT NULL CHECK(unit_price > 0),
  quantity numeric(18,3) NOT NULL CHECK(quantity > 0),
  currency char(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
  valid_until date,
  status varchar(16) NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED')),
  created_by varchar(80) NOT NULL,
  approved_by varchar(80),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(rfq_id, version)
);
CREATE UNIQUE INDEX idx_one_approved_quote_per_rfq ON customer_quotes(rfq_id) WHERE status = 'APPROVED';
CREATE INDEX idx_quotes_created ON customer_quotes(created_at DESC);

CREATE TABLE sales_orders (
  id uuid PRIMARY KEY,
  reference varchar(40) NOT NULL UNIQUE,
  quote_id uuid NOT NULL UNIQUE REFERENCES customer_quotes(id),
  rfq_id uuid NOT NULL REFERENCES rfqs(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  total_amount numeric(20,2) NOT NULL CHECK(total_amount > 0),
  currency char(3) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','CONFIRMED','IN_PROGRESS','COMPLETED','CANCELLED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_customer ON sales_orders(customer_id);
CREATE INDEX idx_orders_status ON sales_orders(status);

CREATE TABLE purchase_orders (
  id uuid PRIMARY KEY,
  reference varchar(40) NOT NULL UNIQUE,
  sales_order_id uuid NOT NULL REFERENCES sales_orders(id),
  supplier_offer_id uuid NOT NULL REFERENCES supplier_offers(id),
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  quantity numeric(18,3) NOT NULL CHECK(quantity > 0),
  unit_price numeric(18,4) NOT NULL CHECK(unit_price > 0),
  total_amount numeric(20,2) NOT NULL CHECK(total_amount > 0),
  currency char(3) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','ISSUED','RECEIVED','CANCELLED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sales_order_id, supplier_offer_id)
);
CREATE INDEX idx_purchase_sales ON purchase_orders(sales_order_id);

CREATE TABLE shipments (
  id uuid PRIMARY KEY,
  reference varchar(40) NOT NULL UNIQUE,
  sales_order_id uuid NOT NULL REFERENCES sales_orders(id),
  purchase_order_id uuid REFERENCES purchase_orders(id),
  origin varchar(160) NOT NULL,
  destination varchar(160) NOT NULL,
  carrier varchar(160),
  tracking_number varchar(120),
  etd date,
  eta date,
  atd date,
  ata date,
  status varchar(16) NOT NULL DEFAULT 'BOOKED' CHECK(status IN ('BOOKED','IN_TRANSIT','DELIVERED','CANCELLED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_shipments_order ON shipments(sales_order_id);
CREATE INDEX idx_shipments_status ON shipments(status);
CREATE TABLE shipment_milestones (
  id uuid PRIMARY KEY,
  shipment_id uuid NOT NULL REFERENCES shipments(id),
  event varchar(30) NOT NULL,
  notes varchar(300),
  actor varchar(80) NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_milestone_shipment ON shipment_milestones(shipment_id,occurred_at DESC);

CREATE TABLE invoices (
  id uuid PRIMARY KEY,
  reference varchar(40) NOT NULL UNIQUE,
  sales_order_id uuid NOT NULL REFERENCES sales_orders(id),
  purchase_order_id uuid REFERENCES purchase_orders(id),
  invoice_type varchar(12) NOT NULL CHECK(invoice_type IN ('RECEIVABLE','PAYABLE')),
  amount numeric(20,2) NOT NULL CHECK(amount > 0),
  currency char(3) NOT NULL,
  due_date date,
  status varchar(12) NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','ISSUED','PAID','VOID')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((invoice_type = 'PAYABLE' AND purchase_order_id IS NOT NULL)
    OR (invoice_type = 'RECEIVABLE' AND purchase_order_id IS NULL))
);
CREATE INDEX idx_invoices_order ON invoices(sales_order_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE TABLE invoice_payments (
  id uuid PRIMARY KEY,
  invoice_id uuid NOT NULL REFERENCES invoices(id),
  reference varchar(120) NOT NULL,
  amount numeric(20,2) NOT NULL CHECK(amount > 0),
  paid_on date NOT NULL,
  recorded_by varchar(80) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(invoice_id,reference)
);
CREATE INDEX idx_payments_invoice ON invoice_payments(invoice_id);

CREATE TABLE work_tasks (
  id uuid PRIMARY KEY,
  title varchar(180) NOT NULL,
  description varchar(2000),
  assignee_id uuid NOT NULL REFERENCES staff_users(id),
  rfq_id uuid REFERENCES rfqs(id),
  sales_order_id uuid REFERENCES sales_orders(id),
  shipment_id uuid REFERENCES shipments(id),
  due_date date,
  priority varchar(8) NOT NULL DEFAULT 'NORMAL' CHECK(priority IN ('LOW','NORMAL','HIGH')),
  status varchar(16) NOT NULL DEFAULT 'TODO' CHECK(status IN ('TODO','IN_PROGRESS','DONE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((CASE WHEN rfq_id IS NOT NULL THEN 1 ELSE 0 END) +
         (CASE WHEN sales_order_id IS NOT NULL THEN 1 ELSE 0 END) +
         (CASE WHEN shipment_id IS NOT NULL THEN 1 ELSE 0 END) <= 1)
);
CREATE INDEX idx_tasks_assignee ON work_tasks(assignee_id,status);
CREATE INDEX idx_tasks_due ON work_tasks(due_date) WHERE status <> 'DONE';
