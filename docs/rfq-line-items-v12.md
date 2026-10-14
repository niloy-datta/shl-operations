# RFQ structured requirement lines — first vertical slice

**Implementation scope:** SHL Trading Desk now has a PostgreSQL-backed, audited requirements list per RFQ. It is a safe extension to the existing one-quantity RFQ and its single-price supplier offer/quotation/order workflow. This slice **does not introduce commercial per-line pricing**.

## Available functionality

- Open an RFQ in `/workspace/rfqs` and add/edit/remove up to 50 product requirement lines.
- Each line stores product name, technical specifications, HS code (4–10 numeric digits), quantity, unit, tolerance notes, origin country and target destination.
- Legacy single-header RFQs stay readable and actionable without generated or fabricated product lines.
- Lines may be changed in `NEW` or `SOURCING` while no supplier offer exists. The first accepted offer freezes requirements. Requests in `READY_FOR_QUOTE` and `CLOSED` are immutable.
- A single line must have the exact same quantity and unit as the RFQ header before a supplier offer can be saved or an RFQ can move to `READY_FOR_QUOTE`.
- **Multiple lines cannot be priced with a single aggregate supplier offer.** That case is blocked before a supplier offer is saved, and its RFQ cannot move into the legacy quotation flow. Requirements stay editable until a compatible commercial implementation is completed.
- All writes are server-role-gated to ADMIN/MANAGEMENT/BD/SOURCING, use a parent RFQ database lock, and add an audit event. The Next.js BFF has a strict method/path allowlist for these endpoints.

## API

All routes below require authenticated staff with approved RFQ roles:

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/rfqs/{rfqId}/items` | List the RFQ's saved requirements in order |
| POST | `/api/rfqs/{rfqId}/items` | Add a line |
| PUT | `/api/rfqs/{rfqId}/items/{itemId}` | Update a line before supplier offers |
| DELETE | `/api/rfqs/{rfqId}/items/{itemId}` | Remove a line before supplier offers |

All API requests pass the existing same-origin BFF route under `/api/trading/` and are audited.

## Commercial safety and next scope

The existing RFQ header quantity/unit and currency continue to drive commercial totals. The structured lines are for sourcing requirements only until separate per-line supplier offers, quotation revisions, purchase-order item matching and split fulfillment are implemented and reviewed. Users must not interpret a multi-line RFQ as already approved for invoicing or shipping.

Do not import real SHL customer, pricing or supplier records until the separate production security and release gates have passed.

## Verification

- Flyway migration `V12__rfq_line_items.sql` adds the table without editing historical migrations or backfilling fictional line records.
- `RfqItemsWorkflowTest` exercises line CRUD, parent ownership, roles, freezes on supplier offers, quantity/unit mismatch rejection and multi-item commercial safety.

References: [Flyway versioned migrations](https://documentation.red-gate.com/fd/versioned-migrations-273973333.html) and [project backlog](enterprise-50-step-roadmap.md).
