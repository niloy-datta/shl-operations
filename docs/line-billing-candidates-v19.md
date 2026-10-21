# Internal line billing review (V19) — no legal invoices or ledger

Purpose: provide a safe, explicitly **unposted** finance review workflow
for delivered line sales orders, rather than falsely treating legacy
single-line invoice/payment APIs as compatible with multi-line orders.

## What is implemented

- Finance/admin/management can list eligible confirmed line sales orders:
  every quoted supplier allocation must have an issued PO and a
  staff-recorded DELIVERED shipment.
- An eligible order becomes one internal billing review candidate
  containing immutable copies of sell-price snapshots and total amount in
  the original quote currency, with optional proposed due date.
- Duplicate preparation is prohibited by a transactional sales order lock
  and unique sales_order_id on the billing candidate.
- A separate ADMIN/MANAGEMENT reviewer (not candidate creator) can
  mark DRAFT → REVIEWED or VOID with mandatory written notes.
  These are internal review states, **not invoice sent/paid states**.
- All changes are audited; non-finance roles are blocked server-side.
  The Next.js interface lives at /workspace/finance/line-billing.
- PostgreSQL Testcontainers tests validate multi-stage eligibility, amount
  reconciliation, duplicate rejection, immutable lines, role-denial and
  no legacy invoice creation.

## NOT included / blockers

- Commercial/tax invoice PDF, automatic communication, customer acceptance,
  invoice issue number, legal compliance, invoice tax/FX/freight allocation,
  credit notes, account receivable postings, bank reconciliation or payments.
- Shipment DELIVERED currently represents staff-entered status, not an
  externally verified delivery proof. Do not use it alone for statutory
  invoice issuance.
- Real SHL records are forbidden until independent security, finance/legal
  policy, account recovery, backups, private source and stakeholder
  production approval. This is development functionality only.
