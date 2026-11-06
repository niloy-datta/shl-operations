# V29 — Supplier PO factory milestones (partial roadmap item 19)

Staff can record PRODUCTION_START, FACTORY_READY and QUALITY_CHECK milestones against an issued supplier purchase order. Milestones have immutable identity and target dates, a typed status, actor notes and an append-only event history.

## Workflow

- An issued supplier PO is required. Exactly one active milestone of each type can exist per PO.
- Status transitions are PLANNED to IN_PROGRESS or BLOCKED, IN_PROGRESS to COMPLETED or BLOCKED, and BLOCKED back to IN_PROGRESS.
- FACTORY_READY cannot complete until PRODUCTION_START is complete.
- QUALITY_CHECK cannot complete until FACTORY_READY is complete; it requires an ADMIN or MANAGEMENT reviewer other than the original milestone creator.
- ADMIN, MANAGEMENT and SOURCING can view/update the milestones, but independent quality completion requires privileged review. FINANCE, BD and LOGISTICS cannot read or change factory records.
- Open milestones with target dates in the next seven days or overdue appear in internal sourcing alerts.
- The line-order PO detail UI displays a manual milestone register with event history and progress editing.

## API

- GET /api/commerce/line-orders/purchase-orders/{poId}/production
- POST /api/commerce/line-orders/purchase-orders/{poId}/production
- GET /api/commerce/line-orders/purchase-orders/{poId}/production/{id}/events
- PATCH /api/commerce/line-orders/purchase-orders/{poId}/production/{id}/status

## Limitations

These are manual staff observations, not verified factory inspection certificates. No external carrier, production telemetry, insurance, shipment, finance or supplier-side messages are sent; the milestones are not a shipment release gate yet. Production workflows require operational sign-off before actual SHL data is used.
