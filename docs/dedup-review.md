# Safe deduplication — exact-match review (partial)

This first step is intentionally **read-only**. It returns candidate groups
for human investigation and never merges, deletes or rewrites customer,
supplier, shipment or financial records.

- Customer/supplier candidate groups: equal normalized nonempty email;
  or equal normalized nonempty legal name plus nonempty country.
- Consignee candidate groups: equal normalized nonempty email within
  the **same customer**; or equal normalized company, address and country
  within the **same customer**.
- Candidate response has evidence type, normalized matching key, group size
  and source record UUIDs. A single pair may appear in more than one group.
- Access: ADMIN and MANAGEMENT only, both API gateway and Spring method rules.
- No synthetic match confidence, automatic destructive action or false
  declaration that shared email equals the same legal entity.

Endpoint: GET /api/dedup/candidates?entity=customers|suppliers|consignees&page=0&size=20

Not yet implemented: verified canonical-record selection, approval workflow,
foreign-key-preserving merge transaction, versioned rollback ledger, conflict
resolution, regulatory retention policy and load benchmarks. Item 05 remains
partial, and **must not be marked complete**.

The source repository is public. Do not load real SHL data before the full
production security gates and stakeholder approvals.
