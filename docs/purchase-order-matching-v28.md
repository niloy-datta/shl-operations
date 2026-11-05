# V28 — Supplier PO source reconciliation (partial roadmap item 18)

The server compares each draft supplier purchase order against its approved sales order allocation before allowing issuance.

## Checks

- Parent currency must match the source sales order currency. No FX conversion is inferred.
- Every PO line must match the allocated sales-order line by supplier, source supplier quote revision, exact product name and unit, quantity, source unit cost and extended cost.
- PO line count must equal the number of allocated sales lines for that supplier.
- Sum of supplier PO line totals must equal the PO header total.
- Any mismatch blocks issuance with HTTP 409. The service is independently invoked under a DB transaction when a PO is issued.
- Only ADMIN, MANAGEMENT and SOURCING can read the reconciliation; only ADMIN and MANAGEMENT can issue supplier POs under the pre-existing independent approver policy.
- The UI includes an on-demand read-only matching view alongside draft supplier PO approvals.
- No legal payment, supplier acknowledgement, invoice or customs document is generated.

## Endpoints

GET /api/commerce/line-orders/purchase-orders/{id}/reconciliation

## Limits

The checks use the immutable database snapshots. This is not independently verified supplier acknowledgement, contract comparison, external procurement integration or a safe amendment process. Source records remain development-only pending release security gates.
