-- V11: immutable lead follow-up evidence, no outbound messaging.
CREATE TABLE crm_lead_activity (
    id uuid PRIMARY KEY,
    lead_id uuid NOT NULL REFERENCES crm_leads(id),
    activity_type varchar(16) NOT NULL CHECK(activity_type IN ('NOTE','CALL','EMAIL','WECHAT','MEETING','OTHER')),
    note varchar(2000) NOT NULL CHECK(length(btrim(note)) > 0),
    next_follow_up date,
    actor varchar(80) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_lead_activity_lead ON crm_lead_activity(lead_id,created_at DESC,id DESC);
