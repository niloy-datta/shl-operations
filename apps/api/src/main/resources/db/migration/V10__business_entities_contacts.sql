-- V10 — controlled corporate entity/branch registry and role-specific contacts.
-- Keep existing customers and suppliers intact. This augments, rather than migrates, their identities.
CREATE TABLE business_entities (
    id uuid PRIMARY KEY,
    reference varchar(32) NOT NULL UNIQUE,
    kind varchar(12) NOT NULL CHECK(kind IN ('CUSTOMER','SUPPLIER','PARTNER','OFFICE')),
    customer_id uuid REFERENCES customers(id),
    supplier_id uuid REFERENCES suppliers(id),
    legal_name varchar(180) NOT NULL CHECK(length(btrim(legal_name)) > 0),
    branch_name varchar(160),
    country_code char(2) NOT NULL CHECK(country_code ~ '^[A-Z]{2}$'),
    city varchar(120),
    website varchar(240),
    registration_number varchar(120),
    status varchar(12) NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE')),
    created_by varchar(80) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_entity_owner CHECK (
        (kind = 'CUSTOMER' AND customer_id IS NOT NULL AND supplier_id IS NULL) OR
        (kind = 'SUPPLIER' AND supplier_id IS NOT NULL AND customer_id IS NULL) OR
        (kind IN ('OFFICE','PARTNER') AND customer_id IS NULL AND supplier_id IS NULL)
    )
);
CREATE INDEX idx_entities_kind_status ON business_entities(kind,status,created_at DESC);
CREATE INDEX idx_entities_customer ON business_entities(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_entities_supplier ON business_entities(supplier_id) WHERE supplier_id IS NOT NULL;

CREATE TABLE business_entity_contacts (
    id uuid PRIMARY KEY,
    entity_id uuid NOT NULL REFERENCES business_entities(id),
    full_name varchar(160) NOT NULL CHECK(length(btrim(full_name)) > 0),
    position_title varchar(120),
    contact_role varchar(16) NOT NULL CHECK(contact_role IN
        ('BUYING','FINANCE','LOGISTICS','MANAGEMENT','COMPLIANCE','OTHER')),
    email varchar(240),
    phone varchar(60),
    is_primary boolean NOT NULL DEFAULT false,
    active boolean NOT NULL DEFAULT true,
    created_by varchar(80) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_entity_contacts_entity ON business_entity_contacts(entity_id,active,created_at DESC);
CREATE UNIQUE INDEX idx_entity_contacts_single_primary_role
    ON business_entity_contacts(entity_id,contact_role)
    WHERE is_primary AND active;
