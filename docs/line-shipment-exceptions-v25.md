# V25 — Manually recorded shipment exception cases (partial item 24)

This vertical slice allows internal logistics and management users to record, review, and close exceptions attached to **line shipments**. It does not contact carriers, customs agencies, insurers or customers and cannot create legal claims automatically.

## Case workflow

- A BOOKED or IN_TRANSIT shipment can have CUSTOMS_HOLD, TRANSSHIPMENT, DAMAGE, or DISPUTE cases. A DELIVERED shipment can have DAMAGE or DISPUTE cases; CANCELLED cannot open new cases.
- Authorized ADMIN/MANAGEMENT/LOGISTICS staff enter a type, evidence-based description and optional UTC review date.
- The case starts OPEN and is resolved only by a different ADMIN/MANAGEMENT reviewer with a required resolution note.
- Duplicate/invalid resolution attempts are rejected. Opening and resolving produce append-only event rows, actor/time stamps and centralized audit events.
- SOURCING may read exception cases, but not open or resolve them. BD and FINANCE have no access.
- These cases do not override actual shipping milestones, finance status, document checklists or contact partners automatically.
- The UI is integrated into the existing line-shipment details drawer and shows history, open cases and independent resolution controls.
- The web relay allowlists only specific GET, POST, and PATCH exception paths, with session and same-origin checks.

## Endpoints

- GET \`/api/logistics/line-shipments/{shipmentId}/exceptions\`
- POST \`/api/logistics/line-shipments/{shipmentId}/exceptions\` accepts \`{type,description,reviewDue}\`
- GET \`/api/logistics/line-shipments/{shipmentId}/exceptions/{caseId}/events\`
- PATCH \`/api/logistics/line-shipments/{shipmentId}/exceptions/{caseId}/resolve\` accepts \`{resolution}\`

## Remaining operational sign-off

Full item 24 still requires SLA routing, linked claim amounts, insured damage evidence, secure file attachments, escalation policies, carrier/customer verification, and separate regulated compliance approval. No production release or real SHL data is permitted until the broader roadmap security gates pass.

## Internal escalation alerts

Open shipment exception cases with a review due date within seven days (including overdue cases) now appear in role-scoped operational alerts for ADMIN, MANAGEMENT, LOGISTICS and SOURCING. Resolving the case removes the alert. These are in-app reminders, not outbound notifications or carrier reports.
