# Line-aware shipment milestone tracking — V18 development

A controlled logistics slice connects **issued** supplier-specific line POs to
one complete shipment per PO. This remains separate from legacy one-header
shipments and does not generate invoices, payments, custom documents or
supplier/carrier notifications.

## Implemented

- Shipment booking from an issued supplier PO on a confirmed sales order.
  API verifies both statuses and locks the parent sales order and PO in a
  transaction. One booking per PO; duplicates are rejected.
- Purchase-order line quantities and product identities are copied into
  immutable shipment allocation rows. No partial-quantity booking in this
  version: the full supplier PO is shipped together.
- Origin, destination, optional carrier/tracking text and planned ETD/ETA.
  Invalid ETA-before-ETD and same-origin/destination are rejected.
- Shipment events: BOOKED → IN_TRANSIT → DELIVERED, or BOOKED → CANCELLED.
  Actual departure/arrival dates are recorded in UTC by authorized staff
  when changing the corresponding status. They are **staff-entered events**,
  not evidence that a carrier confirmed movement.
- Append-only event log and immutable shipment line allocations enforced
  by PostgreSQL triggers, with generic audit log alongside them.
- Next.js panel in the existing quote → sales order → supplier PO workflow.
  Staff with ADMIN/MANAGEMENT/LOGISTICS access may book or change statuses;
  SOURCING may read shipment records. BD and FINANCE cannot inspect this
  shipment API. Proxy GET/POST/PATCH routes require authentication, and
  writes require the same-origin header.
- PostgreSQL/Testcontainers regression covers booking prerequisites,
  duplicate prevention, roles, invalid transitions, records and immutable
  history.

## Explicit non-features

- **Not** carrier/vessel API tracking; no BL/AWB document attachment or
  signed proof of delivery. A typed tracking number is not validation.
- **Not** partial fulfillment, multiple shipments per supplier PO, customs,
  claims, insurance, amendments, packing-list allocation, reconciliation,
  invoices or bank payments.
- No movement of real SHL data until the approved security, document
  storage, finance, account recovery, backups and release gates are complete.

## Local tests

Run Java 25 + Maven + PostgreSQL Testcontainers, and Next.js typecheck,
lint/build through the repository CI. Conduct staging role-negative tests
and migration/restore verification before any real deployment.
