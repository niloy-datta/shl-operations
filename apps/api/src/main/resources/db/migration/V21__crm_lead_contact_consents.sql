CREATE TABLE crm_lead_contact_consents (
    id uuid PRIMARY KEY,
    lead_id uuid NOT NULL REFERENCES crm_leads(id),
    channel varchar(10) NOT NULL
        CHECK (channel IN ('EMAIL','PHONE','WECHAT')),
    purpose varchar(12) NOT NULL
        CHECK (purpose IN ('FOLLOW_UP','MARKETING')),
    decision varchar(10) NOT NULL
        CHECK (decision IN ('GRANTED','REVOKED')),
    evidence varchar(500) NOT NULL CHECK (length(btrim(evidence)) > 0),
    actor varchar(80) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_crm_lead_contact_consents_history
    ON crm_lead_contact_consents(lead_id,channel,purpose,created_at DESC,id DESC);

CREATE FUNCTION reject_consent_history_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Contact preference history is append-only';
END;
$$;

CREATE TRIGGER crm_lead_contact_consents_immutable
    BEFORE UPDATE OR DELETE ON crm_lead_contact_consents
    FOR EACH ROW EXECUTE FUNCTION reject_consent_history_mutation();
