-- V20: Manual evidence-status checklist for line shipments. No file content or URL storage.
-- "REPORTED_RECEIVED" records a staff assertion only; it is NOT document verification.
CREATE TABLE line_shipment_document_checklist (
  shipment_id uuid NOT NULL REFERENCES line_shipments(id) ON DELETE RESTRICT,
  kind varchar(40) NOT NULL CHECK(kind IN
    ('COMMERCIAL_INVOICE','PACKING_LIST','TRANSPORT_DOCUMENT','CERTIFICATE_OF_ORIGIN','INSURANCE_CERTIFICATE')),
  status varchar(24) NOT NULL CHECK(status IN ('MISSING','REQUESTED','REPORTED_RECEIVED')),
  document_reference varchar(120),
  note varchar(300),
  updated_by varchar(80) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (shipment_id,kind),
  CHECK(status <> 'REPORTED_RECEIVED' OR
    (document_reference IS NOT NULL AND length(btrim(document_reference)) > 0))
);
CREATE TABLE line_shipment_document_events (
  id uuid PRIMARY KEY,
  shipment_id uuid NOT NULL,
  kind varchar(40) NOT NULL,
  old_status varchar(24) NOT NULL,
  new_status varchar(24) NOT NULL,
  document_reference varchar(120),
  note varchar(300),
  actor varchar(80) NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (shipment_id,kind)
    REFERENCES line_shipment_document_checklist(shipment_id,kind) ON DELETE RESTRICT,
  CHECK(old_status IN ('MISSING','REQUESTED','REPORTED_RECEIVED')),
  CHECK(new_status IN ('MISSING','REQUESTED','REPORTED_RECEIVED'))
);
CREATE INDEX idx_line_shipment_document_events_history
  ON line_shipment_document_events(shipment_id,occurred_at DESC,id DESC);
CREATE TRIGGER trg_line_shipment_document_events_append_only
  BEFORE UPDATE OR DELETE ON line_shipment_document_events
  FOR EACH ROW EXECUTE FUNCTION reject_line_shipment_event_mutation();
