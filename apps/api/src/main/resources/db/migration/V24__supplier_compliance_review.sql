CREATE TABLE supplier_compliance_evidence (
    id uuid PRIMARY KEY,
    supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    kind varchar(25) NOT NULL
      CHECK(kind IN ('TRADE_LICENSE','TAX_CERTIFICATE','EXPORT_LICENSE',
                     'QUALITY_CERTIFICATE','INSURANCE','OTHER')),
    document_reference varchar(180) NOT NULL
      CHECK(length(btrim(document_reference))>0),
    issued_on date,
    expires_on date,
    notes varchar(500),
    submitted_by varchar(80) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CHECK(issued_on IS NULL OR expires_on IS NULL OR expires_on>=issued_on)
);
CREATE INDEX idx_supplier_compliance_evidence
  ON supplier_compliance_evidence(supplier_id,created_at DESC,id DESC);
CREATE INDEX idx_supplier_compliance_expiry
  ON supplier_compliance_evidence(expires_on,supplier_id)
  WHERE expires_on IS NOT NULL;

CREATE TABLE supplier_compliance_reviews (
    id uuid PRIMARY KEY,
    evidence_id uuid NOT NULL UNIQUE REFERENCES supplier_compliance_evidence(id) ON DELETE RESTRICT,
    decision varchar(10) NOT NULL CHECK(decision IN ('APPROVED','REJECTED')),
    review_reason varchar(500) NOT NULL CHECK(length(btrim(review_reason))>0),
    reviewed_by varchar(80) NOT NULL,
    reviewed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE FUNCTION reject_supplier_compliance_history_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Supplier compliance records are append-only';
END;
$$;

CREATE TRIGGER supplier_compliance_evidence_immutable
  BEFORE UPDATE OR DELETE ON supplier_compliance_evidence
  FOR EACH ROW EXECUTE FUNCTION reject_supplier_compliance_history_mutation();

CREATE TRIGGER supplier_compliance_reviews_immutable
  BEFORE UPDATE OR DELETE ON supplier_compliance_reviews
  FOR EACH ROW EXECUTE FUNCTION reject_supplier_compliance_history_mutation();
