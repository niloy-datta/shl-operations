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
