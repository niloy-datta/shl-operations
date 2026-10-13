-- V6: real CRM pipeline and project/job lifecycle.
CREATE TABLE crm_leads (
    id uuid PRIMARY KEY,
    reference varchar(40) NOT NULL UNIQUE,
    customer_id uuid REFERENCES customers(id),
    company_name varchar(180) NOT NULL,
    contact_name varchar(120) NOT NULL,
    contact_email varchar(240),
    source varchar(20) NOT NULL CHECK (source IN ('WEBSITE','EMAIL','WECHAT','REFERRAL','MANUAL','OTHER')),
    subject varchar(180) NOT NULL,
    description varchar(2000),
    status varchar(16) NOT NULL DEFAULT 'NEW'
      CHECK (status IN ('NEW','CONTACTED','QUALIFIED','WON','LOST')),
    owner_id uuid REFERENCES staff_users(id),
    next_follow_up date,
    created_by varchar(80) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_leads_status_followup ON crm_leads(status,next_follow_up);
CREATE INDEX idx_leads_owner ON crm_leads(owner_id,status);
CREATE INDEX idx_leads_created ON crm_leads(created_at DESC,id DESC);
CREATE INDEX idx_leads_customer ON crm_leads(customer_id);

CREATE TABLE business_projects (
    id uuid PRIMARY KEY,
    reference varchar(40) NOT NULL UNIQUE,
    customer_id uuid NOT NULL REFERENCES customers(id),
    lead_id uuid UNIQUE REFERENCES crm_leads(id),
    sales_order_id uuid UNIQUE REFERENCES sales_orders(id),
    title varchar(180) NOT NULL,
    description varchar(2000),
    owner_id uuid NOT NULL REFERENCES staff_users(id),
    status varchar(16) NOT NULL DEFAULT 'PLANNED'
      CHECK (status IN ('PLANNED','ACTIVE','ON_HOLD','COMPLETED','CANCELLED')),
    due_date date,
    created_by varchar(80) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_projects_owner_status ON business_projects(owner_id,status);
CREATE INDEX idx_projects_customer ON business_projects(customer_id);
CREATE INDEX idx_projects_due ON business_projects(due_date) WHERE status IN ('PLANNED','ACTIVE','ON_HOLD');
CREATE INDEX idx_projects_created ON business_projects(created_at DESC,id DESC);

CREATE TABLE project_notes (
    id uuid PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES business_projects(id),
    author varchar(80) NOT NULL,
    note varchar(2000) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_project_notes ON project_notes(project_id,created_at DESC,id DESC);
