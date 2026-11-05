CREATE TABLE line_shipment_exceptions (
    id uuid PRIMARY KEY,
    shipment_id uuid NOT NULL REFERENCES line_shipments(id) ON DELETE RESTRICT,
    type varchar(20) NOT NULL
        CHECK (type IN ('CUSTOMS_HOLD','TRANSSHIPMENT','DAMAGE','DISPUTE')),
    status varchar(10) NOT NULL DEFAULT 'OPEN'
        CHECK (status IN ('OPEN','RESOLVED')),
    description varchar(2000) NOT NULL CHECK (length(btrim(description)) > 0),
    review_due date,
    opened_by varchar(80) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    reviewed_by varchar(80),
    resolution varchar(2000),
    resolved_at timestamptz,
    CHECK ((status='OPEN' AND reviewed_by IS NULL AND resolution IS NULL AND resolved_at IS NULL)
        OR (status='RESOLVED' AND reviewed_by IS NOT NULL AND resolution IS NOT NULL AND resolved_at IS NOT NULL))
);
CREATE INDEX idx_line_shipment_exceptions_open
    ON line_shipment_exceptions(shipment_id,review_due,created_at DESC)
    WHERE status='OPEN';
CREATE INDEX idx_line_shipment_exceptions_history
    ON line_shipment_exceptions(shipment_id,created_at DESC,id DESC);

CREATE TABLE line_shipment_exception_events (
    id uuid PRIMARY KEY,
    case_id uuid NOT NULL REFERENCES line_shipment_exceptions(id) ON DELETE RESTRICT,
    event varchar(10) NOT NULL CHECK (event IN ('OPENED','RESOLVED')),
    notes varchar(2000) NOT NULL CHECK (length(btrim(notes)) > 0),
    actor varchar(80) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX idx_line_shipment_exception_events
    ON line_shipment_exception_events(case_id,created_at ASC,id ASC);

CREATE FUNCTION reject_shipment_exception_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Shipment exception events are append-only';
END;
$$;

CREATE TRIGGER trg_shipment_exception_events_append_only
    BEFORE UPDATE OR DELETE ON line_shipment_exception_events
    FOR EACH ROW EXECUTE FUNCTION reject_shipment_exception_event_mutation();
