# Lead ownership routing — first vertical slice

This internal development feature provides a manager-only queue of open unassigned
leads, active BD workload counts, explicit manual transfer with reason, manager-triggered
least-loaded allocation, and append-only ownership history.

The routing algorithm considers the count of each active BD employee's open leads,
not the complexity, estimated value, geography or time needed for those leads.
New leads are not assigned automatically without a manager action. No external
email, WeCom or WhatsApp messages are sent.

## Routes
- GET /api/growth/leads/queue — paginated manager queue
- GET /api/growth/leads/workload — active BD workload comparison
- GET /api/growth/leads/{id}/assignments — last 100 ownership events
- POST /api/growth/leads/{id}/assign — validated ownerId and reason
- POST /api/growth/leads/queue/assign-next — oldest eligible lead, least-loaded BD

All routes are restricted to ADMIN/MANAGEMENT, on both Spring method security
and existing authenticated lead routing. A transfer rejects closed leads,
inactive/non-BD staff and same-owner assignment. History is append-only.
The manager-triggered queue action uses a transaction-scoped PostgreSQL
advisory lock to serialize workload-based decisions.

## Explicit exclusions and rollout gates
- Territory rules need approved staff coverage geography master data;
  no geography is inferred from company names. This roadmap item remains partial.
- Existing owners remain unchanged, and historical ownership transitions
  before V16 are not fabricated.
- Existing BD list visibility requires a follow-up field/row privacy review.
- PR #17 reserves Flyway V15. Merge/review its migration before V16 is applied
  to persistent staging to avoid out-of-order migration issues.
- Require API and UI CI, simultaneous routing tests, role-negative tests,
  stakeholder review and independent security review before release.
- The source is currently public; never use live confidential SHL records.
