# Multi-line sales → procurement (V17, development only)

This new vertical slice works with approved multi-product customer line quotations
without misusing the older single-header sales and purchase order workflows.

## Implemented

1. A BD/admin/management user creates one line-aware sales order from an
   independently approved, non-expired quotation. Source costs, sell amounts,
   suppliers, quantities, item identities, currency and price-revision IDs
   are immutable line snapshots; the order total must equal all quote lines.
2. A different authorized ADMIN/MANAGEMENT user confirms the draft sales order.
   Duplicate order creation is rejected using an explicit precondition and
   database UNIQUE constraints. Confirmation is audited.
3. On a confirmed order, an ADMIN/MANAGEMENT/SOURCING user creates one complete
   draft purchase order per supplier referenced in the approved quote.
   Each PO contains *all* source quote lines for that supplier, with original
   MOQ-verified cost snapshots. Multiple suppliers yield distinct POs.
4. An independent manager issues a PO (four-eyes). All operations are
   transactional, audited, and role checked on the backend.
5. The quotation workspace now exposes this order/procurement stage directly.
   The Next.js proxy has a strict endpoint allowlist, authenticated bearer
   proxying and same-origin CSRF checks.
6. Append-only financial snapshots are enforced by PostgreSQL triggers.
   PostgreSQL/Testcontainers workflow tests check amount reconciliation,
   duplicate/cross-supplier guards, immutable fields and forbidden roles.

## Deliberate release boundaries

- No email sends, PDF documents, vendor compliance clearance, supplier contract
  execution, funds transfer or live SHL customer data.
- These new line-aware orders are *not* legacy sales_orders or purchase_orders.
  Legacy shipment, invoice, project and finance endpoints cannot consume them.
  **Do not present this as complete order-to-cash.**
- Shipment allocation, partial deliveries, invoice allocations, tax/FX/insurance,
  acceptance/POD, amendments and secure document storage need separate
  controlled implementations; item 11/18 remain partially delivered.
- A manager issuing a PO in the development UI is a database status event,
  not proof a supplier has received or accepted a signed document.
- Security review, staging smoke test, privacy/access review, product owner
  signoff and back-up restore drills are required before any production use.

## Local test

Use synthetic test records only.

- API: cd apps/api && mvn -B verify (Java 25 + PostgreSQL Testcontainers)
- Web: cd apps/web && npm run typecheck && npm run lint && npm run build
- Enter /workspace/rfqs, create line requirements and supplier quote revisions,
  create and submit a customer line quotation, switch to an independent manager
  to approve, then work through new panel on /workspace/enterprise/line-quotes.
