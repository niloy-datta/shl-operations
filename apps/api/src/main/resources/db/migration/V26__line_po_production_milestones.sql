CREATE TABLE line_po_production_milestones (
    id uuid PRIMARY KEY,
    purchase_order_id uuid NOT NULL REFERENCES line_purchase_orders(id) ON DELETE RESTRICT,
    kind varchar(24) NOT NULL
      CHECK(kind IN ('PRODUCTION_START','FACTORY_READY','QUALITY_CHECK')),
    status varchar(16) NOT NULL DEFAULT 'PLANNED'
      CHECK(status IN ('PLANNED','IN_PROGRESS','BLOCKED','COMPLETED')),
    target_date date NOT NULL,
    notes varchar(500) NOT NULL CHECK(length(btrim(notes))>0),
    created_by varchar(80) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    completed_by varchar(80),
    completed_at timestamptz,
    UNIQUE(purchase_order_id,kind),
    CHECK ((status='COMPLETED' AND completed_by IS NOT NULL AND completed_at IS NOT NULL)
        OR (status<>'COMPLETED' AND completed_by IS NULL AND completed_at IS NULL))
);
CREATE INDEX idx_line_po_production_due
    ON line_po_production_milestones(target_date,purchase_order_id)
    WHERE status<>'COMPLETED';

CREATE TABLE line_po_production_events (
    id uuid PRIMARY KEY,
    milestone_id uuid NOT NULL REFERENCES line_po_production_milestones(id) ON DELETE RESTRICT,
    event varchar(16) NOT NULL
      CHECK(event IN ('PLANNED','IN_PROGRESS','BLOCKED','COMPLETED')),
    note varchar(500) NOT NULL CHECK(length(btrim(note))>0),
    actor varchar(80) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX idx_line_po_production_event_history
    ON line_po_production_events(milestone_id,created_at ASC,id ASC);

CREATE FUNCTION reject_line_po_production_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Factory milestone events are append-only';
END;
$$;

CREATE TRIGGER trg_line_po_production_events_immutable
    BEFORE UPDATE OR DELETE ON line_po_production_events
    FOR EACH ROW EXECUTE FUNCTION reject_line_po_production_event_mutation();

CREATE FUNCTION guard_line_po_production_identity()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.purchase_order_id IS DISTINCT FROM OLD.purchase_order_id OR
       NEW.kind IS DISTINCT FROM OLD.kind OR
       NEW.target_date IS DISTINCT FROM OLD.target_date OR
       NEW.created_by IS DISTINCT FROM OLD.created_by OR
       NEW.notes IS DISTINCT FROM OLD.notes THEN
        RAISE EXCEPTION 'Factory milestone identity and target are immutable';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_line_po_production_identity
    BEFORE UPDATE ON line_po_production_milestones
    FOR EACH ROW EXECUTE FUNCTION guard_line_po_production_identity();
