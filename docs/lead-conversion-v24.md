# V24 — Reviewed lead conversion (partial item 10)

An independent ADMIN/MANAGEMENT reviewer may convert a **WON** CRM lead into one sourcing RFQ and one planned business project tied to an **existing approved customer**.

## Integrity and restrictions

- The lead must already be marked WON by its normal stage workflow.
- An independent reviewer (not the lead's creator) must submit a review reason.
- The chosen customer must exist, and any customer already linked to the lead must match it.
- The project owner must be an active staff user. Quantity, unit, three-letter currency and project title are explicitly supplied; no price or currency exchange rate is inferred.
- The lead row is locked in a transaction. A lead may be converted **once**. Identical POST retries return the original links and no new records; conflicting retries return HTTP 409.
- The immutable conversion snapshot contains all reviewed inputs and the reviewer. PostgreSQL prevents updates or deletes of the conversion row; the RFQ, project, and lead links are written atomically with audit events.
- A new RFQ starts as NEW and a new project starts as PLANNED. No sales quote, supplier PO, shipment, financial entry, email or WeCom message is generated.
- Only ADMIN and MANAGEMENT can read or execute this endpoint, checked by the API and authenticated same-origin Next.js proxy.
- The CRM lead details panel shows the reviewed conversion form only for a won lead viewed by authorized staff.

## Endpoints

- GET \`/api/growth/leads/{id}/conversion\`: returns existing linked IDs; 404 when not converted.
- POST \`/api/growth/leads/{id}/conversion\`: accepts \`customerId\`, \`ownerId\`, \`quantity\`, \`unit\`, \`currency\`, optional \`rfqDeadline\`, \`projectTitle\`, optional \`projectDescription\`, optional \`projectDueDate\`, and \`reviewReason\`.

## Not completed

This is **partial** roadmap item 10. Customer creation requires its own dedup, compliance and review workflow. There is no automatic new-customer creation, full catalog line mapping, quote/PO/procurement automation, contract approval or stakeholder acceptance. The live production application remains blocked.

## Validation

The Testcontainers integration test checks independent review, atomic source linkages, retry safety, conflicts, role denial, audit events, customer mismatch and DB immutability.
