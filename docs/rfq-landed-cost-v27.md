# V27 — Auditable landed-cost estimates (partial roadmap item 13)

A sourcing user can record a cost scenario against the current immutable supplier-quote revision for one RFQ requirement line. The same-currency estimate sums the source quotation price multiplied by requested quantity, plus explicitly supplied total freight, insurance, duty and handling amounts. The source quotation, INCOTERM, line quantity, calculation, author, supporting source description and timestamp are snapshotted immutably.

## Limits and controls

- Every scenario is in the originating RFQ currency. There are **no currency conversions** or inferred live FX rates.
- All cost components must be non-negative and independently entered; none is assumed to be zero without explicit user input. All monetary values use Java BigDecimal.
- The source supplier revision must be the latest revision for the line and supplier, and its MOQ cannot exceed requested quantity.
- Scenarios can only be recorded while an RFQ is in SOURCING, not after quotation approval.
- Different Incoterms may include some of these charges; the system does not silently infer charge inclusions, or provide authoritative tariffs, taxes or cost-of-goods.
- Supplier offer revisions, cost scenarios, approvals and purchase orders are still distinct; a scenario never authorizes vendor selection.
- ADMIN, MANAGEMENT, SOURCING may create; BD can read; FINANCE and LOGISTICS cannot access these sourcing details.
- PostgreSQL triggers forbid edits/deletes; source quote revisions and auditable snapshots are retained.

## API and UI

- GET /api/rfqs/{rfqId}/landed-cost: list up to 500 scenarios sorted within line by estimated unit cost
- POST /api/rfqs/{rfqId}/landed-cost: requires sourceRevisionId, freight, insurance, duty, handling and assumptionSource
- The existing RFQ details UI shows a cost comparison and assumption form.

## Pending

Actual port/freight APIs, country-specific duty verification, approved exchange rates, tax/legal review, quote version selections, cost approval and cross-currency comparisons are not implemented. Treat all figures as working estimates only.
