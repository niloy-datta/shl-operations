# V26 — Supplier compliance reference review (partial item 15)

## Scope

This feature adds an internal supplier document-reference register with independent review and expiry alerts. Staff can submit reference metadata for trade licenses, tax certificates, export licenses, quality certificates, insurance or other documents. Submitted references and review decisions are immutable.

The application does not store document bytes or verify external registers. APPROVED is an internal staff decision about a supplied reference, not independent legal verification, general vendor approval or procurement authorization.

## Workflows

- SOURCING, ADMIN and MANAGEMENT may submit references. BD may view records. FINANCE and LOGISTICS cannot access this feature.
- ADMIN and MANAGEMENT may approve or reject, but may never review their own submission.
- Each reference has one independent review. Superseding references are new rows; history remains intact.
- Expired references cannot be approved. Approved references become EXPIRED at the end of their stated validity.
- Issuance dates must not exceed expiry dates. All text input has length limits and document types are allowlisted.
- PostgreSQL blocks UPDATE and DELETE on evidence and review rows.
- Alerts for reviewed references expiring within seven days appear for ADMIN, MANAGEMENT and SOURCING.
- The supplier desk is under /workspace/suppliers/compliance.

## API

- GET /api/supplier-compliance/suppliers/{supplierId}/evidence
- POST /api/supplier-compliance/suppliers/{supplierId}/evidence
- POST /api/supplier-compliance/suppliers/{supplierId}/evidence/{evidenceId}/review

## Pending

Secure file vault, malware scanning, electronic signature and government-register verification, regulatory-specific eligibility policies, approved-vendor decision workflow, expiry-specific purchasing controls, and production security sign-off are not implemented. Do not enter genuine SHL data yet.
