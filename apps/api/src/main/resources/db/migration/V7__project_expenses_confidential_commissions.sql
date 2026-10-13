-- Expense and confidential commission records. No public or ordinary admin read privileges are implied.
CREATE TABLE project_expenses (
  id uuid PRIMARY KEY,
  reference varchar(40) NOT NULL UNIQUE,
  project_id uuid NOT NULL REFERENCES business_projects(id),
  category varchar(20) NOT NULL CHECK(category IN ('FREIGHT','CUSTOMS','PACKAGING','BANK_FEES','OPERATIONS','OTHER')),
  description varchar(300) NOT NULL,
  amount numeric(20,2) NOT NULL CHECK(amount > 0),
  currency char(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
  incurred_on date NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','APPROVED','VOID')),
  created_by varchar(80) NOT NULL,
  approved_by varchar(80),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_project ON project_expenses(project_id,status,incurred_on);
CREATE INDEX idx_expenses_created ON project_expenses(created_at DESC,id DESC);

-- Confidential by design: this table is NEVER joined into broad dashboards or finance endpoints.
CREATE TABLE confidential_commissions (
  id uuid PRIMARY KEY,
  reference varchar(40) NOT NULL UNIQUE,
  project_id uuid NOT NULL REFERENCES business_projects(id),
  beneficiary_type varchar(20) NOT NULL CHECK(beneficiary_type IN ('STAFF','CNEE','KEY_PERSON','OTHER')),
  beneficiary varchar(160) NOT NULL,
  basis_amount numeric(20,2) NOT NULL CHECK(basis_amount > 0),
  rate_percent numeric(7,4) NOT NULL CHECK(rate_percent > 0 AND rate_percent <= 100),
  commission_amount numeric(20,2) NOT NULL CHECK(commission_amount > 0),
  currency char(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
  status varchar(16) NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','APPROVED','CANCELLED')),
  created_by varchar(80) NOT NULL,
  approved_by varchar(80),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_commissions_project ON confidential_commissions(project_id,status);
CREATE INDEX idx_commissions_created ON confidential_commissions(created_at DESC,id DESC);
