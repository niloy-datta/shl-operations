CREATE TABLE rfqs (
  id uuid PRIMARY KEY,
  reference varchar(32) NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES customers(id),
  subject varchar(180) NOT NULL,
  details varchar(4000),
  quantity numeric(18,3) NOT NULL CHECK (quantity > 0),
  unit varchar(32) NOT NULL,
  currency char(3) NOT NULL,
  deadline date,
  status varchar(24) NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','SOURCING','READY_FOR_QUOTE','CLOSED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rfqs_customer ON rfqs(customer_id);
CREATE INDEX idx_rfqs_created ON rfqs(created_at DESC);
CREATE INDEX idx_rfqs_status ON rfqs(status);

CREATE TABLE supplier_offers (
  id uuid PRIMARY KEY,
  rfq_id uuid NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  unit_price numeric(18,4) NOT NULL CHECK (unit_price > 0),
  moq numeric(18,3) NOT NULL CHECK (moq > 0),
  lead_days integer NOT NULL CHECK (lead_days BETWEEN 1 AND 3650),
  notes varchar(2000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(rfq_id, supplier_id)
);
CREATE INDEX idx_supplier_offers_rfq ON supplier_offers(rfq_id);

CREATE TABLE rfq_activity (
  id uuid PRIMARY KEY,
  rfq_id uuid NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  actor varchar(80) NOT NULL,
  action varchar(60) NOT NULL,
  detail varchar(300),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rfq_activity_rfq ON rfq_activity(rfq_id, created_at DESC);
