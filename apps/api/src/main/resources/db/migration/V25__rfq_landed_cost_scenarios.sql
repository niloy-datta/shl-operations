CREATE TABLE rfq_landed_cost_scenarios (
    id uuid PRIMARY KEY,
    rfq_id uuid NOT NULL REFERENCES rfqs(id) ON DELETE RESTRICT,
    item_id uuid NOT NULL REFERENCES rfq_line_items(id) ON DELETE RESTRICT,
    supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    source_revision_id uuid NOT NULL REFERENCES rfq_line_offer_revisions(id) ON DELETE RESTRICT,
    source_revision_number integer NOT NULL CHECK(source_revision_number>0),
    currency char(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
    incoterm varchar(12),
    port varchar(160),
    quantity numeric(18,3) NOT NULL CHECK(quantity>0),
    source_unit_price numeric(18,4) NOT NULL CHECK(source_unit_price>0),
    freight numeric(18,2) NOT NULL CHECK(freight>=0),
    insurance numeric(18,2) NOT NULL CHECK(insurance>=0),
    duty numeric(18,2) NOT NULL CHECK(duty>=0),
    handling numeric(18,2) NOT NULL CHECK(handling>=0),
    estimated_total numeric(20,2) NOT NULL CHECK(estimated_total>0),
    estimated_unit_cost numeric(20,4) NOT NULL CHECK(estimated_unit_cost>0),
    assumption_source varchar(600) NOT NULL CHECK(length(btrim(assumption_source))>0),
    created_by varchar(80) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX idx_rfq_landed_cost_comparison
    ON rfq_landed_cost_scenarios(rfq_id,item_id,estimated_unit_cost,created_at DESC);

CREATE FUNCTION reject_landed_cost_scenario_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Landed cost scenarios are immutable';
END;
$$;

CREATE TRIGGER trg_landed_cost_scenario_immutable
    BEFORE UPDATE OR DELETE ON rfq_landed_cost_scenarios
    FOR EACH ROW EXECUTE FUNCTION reject_landed_cost_scenario_mutation();
