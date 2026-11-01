CREATE TABLE staff_users (
  id uuid PRIMARY KEY,
  username varchar(80) NOT NULL UNIQUE,
  password_hash varchar(255) NOT NULL,
  role varchar(30) NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE customers (
  id uuid PRIMARY KEY,
  name varchar(160) NOT NULL,
  email varchar(254),
  phone varchar(60),
  country varchar(100),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_customers_name ON customers (lower(name));
CREATE TABLE suppliers (
  id uuid PRIMARY KEY,
  name varchar(160) NOT NULL,
  email varchar(254),
  phone varchar(60),
  country varchar(100),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_suppliers_name ON suppliers (lower(name));

