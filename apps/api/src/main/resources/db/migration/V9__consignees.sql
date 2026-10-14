-- V9: customer-scoped consignee master data and optional pre-dispatch shipment assignment.
CREATE TABLE consignees (
    id uuid PRIMARY KEY,
    code varchar(24) NOT NULL UNIQUE,
    customer_id uuid NOT NULL REFERENCES customers(id),
    company_name varchar(180) NOT NULL,
    contact_name varchar(120),
    email varchar(240),
    phone varchar(60),
    country_code char(2) NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
    address varchar(500) NOT NULL,
    active boolean NOT NULL DEFAULT true,
    created_by varchar(80) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_consignee_company_nonempty CHECK (length(btrim(company_name)) > 0),
    CONSTRAINT chk_consignee_address_nonempty CHECK (length(btrim(address)) > 0)
);
CREATE INDEX idx_consignees_customer ON consignees(customer_id,active);
CREATE INDEX idx_consignees_created ON consignees(created_at DESC,id DESC);

ALTER TABLE shipments ADD COLUMN consignee_id uuid REFERENCES consignees(id);
CREATE INDEX idx_shipments_consignee ON shipments(consignee_id) WHERE consignee_id IS NOT NULL;
