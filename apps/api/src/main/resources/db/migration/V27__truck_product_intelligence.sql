CREATE TABLE truck_product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES truck_product_categories(id),
  slug varchar(80) NOT NULL UNIQUE,
  name varchar(120) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_id, name)
);

INSERT INTO truck_product_categories(slug,name) VALUES
 ('fuel-tanker','Fuel Tanker'),('water-tanker','Water Tanker'),
 ('sewage-truck','Sewage Truck'),('garbage-compactor','Garbage Compactor'),
 ('milk-tanker','Milk Tanker'),('other-special-purpose','Other Special-Purpose Trucks');

CREATE TABLE truck_manufacturers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(160) NOT NULL,
  country varchar(100),
  website varchar(500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_truck_manufacturer_name ON truck_manufacturers(lower(name));

CREATE TABLE truck_spec_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES truck_product_categories(id),
  field_key varchar(80) NOT NULL,
  label varchar(120) NOT NULL,
  unit varchar(40),
  data_type varchar(16) NOT NULL DEFAULT 'TEXT' CHECK (data_type IN ('TEXT','NUMBER','BOOLEAN')),
  required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  UNIQUE (category_id, field_key)
);

INSERT INTO truck_spec_templates(category_id,field_key,label,unit,data_type,sort_order)
SELECT c.id,v.field_key,v.label,v.unit,v.data_type,v.sort_order
FROM truck_product_categories c CROSS JOIN (VALUES
 ('tank_capacity','Tank capacity','L','NUMBER',10),
 ('overall_dimensions','Overall dimensions','mm','TEXT',20),
 ('gross_vehicle_weight','Gross vehicle weight','kg','NUMBER',30),
 ('payload_capacity','Payload capacity','kg','NUMBER',40),
 ('axle_configuration','Axle configuration',NULL,'TEXT',50),
 ('engine_make_model','Engine make / model',NULL,'TEXT',60),
 ('engine_power','Engine power','kW','NUMBER',70)
) AS v(field_key,label,unit,data_type,sort_order)
WHERE c.parent_id IS NULL;

CREATE TABLE truck_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES truck_product_categories(id),
  manufacturer_id uuid REFERENCES truck_manufacturers(id),
  model_code varchar(100),
  model_name varchar(160) NOT NULL,
  brand varchar(120),
  description varchar(3000),
  status varchar(16) NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','ACTIVE','ARCHIVED')),
  created_by varchar(80) NOT NULL,
  approved_by varchar(80),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (manufacturer_id, model_code)
);
CREATE INDEX idx_truck_products_category_status ON truck_products(category_id,status,model_name);
CREATE INDEX idx_truck_products_search ON truck_products(lower(model_name),lower(brand));

CREATE TABLE truck_product_spec_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES truck_products(id) ON DELETE CASCADE,
  template_id uuid REFERENCES truck_spec_templates(id) ON DELETE SET NULL,
  field_key varchar(80) NOT NULL,
  label varchar(120) NOT NULL,
  value varchar(500) NOT NULL,
  unit varchar(40),
  UNIQUE(product_id,field_key)
);
CREATE INDEX idx_truck_product_specs_product ON truck_product_spec_values(product_id);

CREATE TABLE truck_product_applications (
  product_id uuid NOT NULL REFERENCES truck_products(id) ON DELETE CASCADE,
  application varchar(180) NOT NULL,
  PRIMARY KEY(product_id,application)
);
CREATE TABLE truck_product_configurations (
  product_id uuid NOT NULL REFERENCES truck_products(id) ON DELETE CASCADE,
  configuration varchar(180) NOT NULL,
  PRIMARY KEY(product_id,configuration)
);
CREATE TABLE truck_product_market_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES truck_products(id) ON DELETE CASCADE,
  country varchar(100) NOT NULL,
  note varchar(1000) NOT NULL
);
CREATE INDEX idx_truck_product_market_country ON truck_product_market_notes(lower(country));

CREATE TABLE truck_product_document_refs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES truck_products(id) ON DELETE CASCADE,
  label varchar(160) NOT NULL,
  reference varchar(1000) NOT NULL,
  media_type varchar(80),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE truck_product_suppliers (
  product_id uuid NOT NULL REFERENCES truck_products(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(product_id,supplier_id)
);
CREATE INDEX idx_truck_product_suppliers_supplier ON truck_product_suppliers(supplier_id,product_id);

CREATE TABLE truck_product_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES truck_products(id) ON DELETE CASCADE,
  actor varchar(80) NOT NULL,
  action varchar(24) NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_truck_product_history_product ON truck_product_history(product_id,created_at DESC);

ALTER TABLE rfq_line_items ADD COLUMN truck_product_id uuid REFERENCES truck_products(id) ON DELETE SET NULL;
CREATE INDEX idx_rfq_line_items_truck_product ON rfq_line_items(truck_product_id) WHERE truck_product_id IS NOT NULL;
