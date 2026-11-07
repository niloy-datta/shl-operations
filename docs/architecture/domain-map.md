# Domain ownership and access map (proposed)

Java remains the current owner of business writes. These target boundaries do not grant access or certify parity. Apply SecurityConfig and method/business-level checks together; ownership and grants may narrow access.

| Target module | Legacy areas | Required access and invariants before cutover |
| --- | --- | --- |
| identity | security, staff | Revocable sessions, MFA enrollment gate, enabled role; admin staff administration. |
| CRM | contacts, growth, website intake | Role checks, consent, scoped access and HMAC intake. |
| trading | RFQs, items, offers, catalog | Preserve role checks, transitions and price visibility. |
| commerce and procurement | quotes, orders, supplier compliance, PO production | Independent quote review, reconciliation, idempotency and transactions. |
| logistics | consignees, shipments, exceptions, documents | Preserve restricted roles and independent exception resolution. |
| finance and confidential commissions | finance, expenses, profitability, commissions | Finance roles do not imply independent commission grants. |
| organization and tasks | entities, tasks, command center | Preserve role checks and task ownership; review future organization scoping. |
| audit and integration | audit, website intake | Preserve transactional audit and signed raw-body intake checks. |

See the migration inventory for source locations. Foxmail sync, BullMQ workers and AI automation are not implemented in this sidecar.
