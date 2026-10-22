# V20 — Line shipment document checklist (development only)

## What this slice adds
- The authenticated line shipment detail panel now displays five standard requirements: commercial invoice, packing list, BL/AWB, certificate of origin, and insurance certificate.
- Requirements default to `MISSING`. A logistics/management/admin operator can mark `REQUESTED` or `REPORTED_RECEIVED`; received records require a manually entered internal reference.
- Every change preserves the previous/new status, actor, timestamp and optional note in an append-only PostgreSQL event table, and generates an existing application audit event.
- A reported receipt is **not** a verified document. There is deliberately no upload, external URL, document download, virus scan, or signed storage link.
- A correction from `REPORTED_RECEIVED` to `MISSING` requires a reason of at least eight characters. No identical repeat writes; cancelled shipments are read-only.

## Permissions and implementation
- GET: ADMIN, MANAGEMENT, LOGISTICS and SOURCING, protected by the existing API role checks.
- PATCH: ADMIN, MANAGEMENT and LOGISTICS only. BD, FINANCE and unauthenticated requests cannot access the endpoint.
- Next.js same-origin proxy has narrowly allowlisted GET and PATCH paths; the UI hides write controls from SOURCING.
- Migration: `V20__line_shipment_document_checklist.sql`; existing shipments retain their data and gain a derived checklist with default missing state.

## Test and release boundary
- PostgreSQL workflow tests cover default items, input validation, audit/history immutability, correction reasons, duplicate transitions and denied roles.
- GitHub CI must run Maven verification and web typecheck/lint/build before merging.
- This does **not** satisfy roadmap #21 secure document vault, signed POD, legal invoice evidence or final #22 documentary verification. Do not enter production SHL document content, customer data or references before security approval.

## V21 — Operational due-date reminders
- An authorized ADMIN, MANAGEMENT, LOGISTICS or SOURCING user sees one `SHIPMENT_DOCUMENTS` alert per qualifying active line shipment when at least one of the five requirements is not reported received.
- The alert due date comes strictly from a saved `ETD` (UTC date comparison) on a `BOOKED` or `IN_TRANSIT` shipment. Missing ETD is not silently invented. Cancelled and delivered shipments do not generate these alerts.
- A current count uses the checklist's actual saved status records, treating missing rows as missing (default state). Up to 40 such alerts compete within the 100-item feed cap.
- Selecting an alert opens the associated RFQ line-quotation workspace so staff can navigate to its existing order/shipments panel; this does not automatically open the specific shipment.
- A `REPORTED_RECEIVED` record remains **unverified**. Alert clearance reflects a staff assertion, not certified documentary readiness. No outbound email/WeCom alerts are sent.
- The alert is never exposed to BD or FINANCE roles. Existing source-scoped alerts stay unchanged.
