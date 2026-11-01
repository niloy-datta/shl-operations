-- V15: website lead intake idempotency; no credentials or PII in this table.
-- The transaction inserts a placeholder, locks it, creates exactly one lead,
-- and fills lead_id before committing.
CREATE TABLE website_lead_submissions (
    source varchar(20) NOT NULL CHECK (source IN ('contact','freight_quote')),
    external_submission_id varchar(120) NOT NULL,
    payload_sha256 char(64) NOT NULL,
    lead_id uuid UNIQUE REFERENCES crm_leads(id),
    received_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(source,external_submission_id)
);
CREATE INDEX idx_website_lead_submissions_received
    ON website_lead_submissions(received_at DESC);
