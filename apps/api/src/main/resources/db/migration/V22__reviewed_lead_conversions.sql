CREATE TABLE crm_lead_conversions (
    lead_id uuid PRIMARY KEY REFERENCES crm_leads(id),
    customer_id uuid NOT NULL REFERENCES customers(id),
    owner_id uuid NOT NULL REFERENCES staff_users(id),
    rfq_id uuid NOT NULL UNIQUE REFERENCES rfqs(id),
    project_id uuid NOT NULL UNIQUE REFERENCES business_projects(id),
    quantity numeric(18,3) NOT NULL CHECK (quantity > 0),
    unit varchar(32) NOT NULL CHECK (length(btrim(unit)) > 0),
    currency char(3) NOT NULL,
    rfq_deadline date,
    project_title varchar(180) NOT NULL CHECK (length(btrim(project_title)) > 0),
    project_description varchar(2000),
    project_due_date date,
    review_reason varchar(300) NOT NULL CHECK (length(btrim(review_reason)) > 0),
    reviewed_by varchar(80) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX idx_crm_lead_conversions_created
    ON crm_lead_conversions(created_at DESC,lead_id DESC);

CREATE FUNCTION reject_lead_conversion_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Reviewed lead conversions are immutable';
END;
$$;

CREATE TRIGGER crm_lead_conversions_immutable
    BEFORE UPDATE OR DELETE ON crm_lead_conversions
    FOR EACH ROW EXECUTE FUNCTION reject_lead_conversion_mutation();
