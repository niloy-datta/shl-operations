# Boudi-friendly command desk — implementation slice (2026-10-22)

## Scope of this pull request

This change upgrades the *authenticated, management-only* `/workspace/command-center` experience without bypassing existing API permissions, using mock records, or storing any user/company data in a public preview.

### Functional changes

- **Daily priority desk:** reports the number of overdue exception *categories* where a live source count is positive (late shipments, overdue tasks, overdue projects and overdue invoices). Each card links to the relevant existing workflow. Counts are not added together because records may overlap.
- **One-click routing:** inquiry/RFQ entry, supplier comparison, shipment operations and staff tasks use existing route destinations; buttons are navigation, not fabricated approvals or business mutations.
- **Snapshot filtering:** user can filter the next shipment and next task records that were returned by the existing permission-checked command-center API. Shipment reference, origin, destination and status, and task title, owner, priority and status are searchable. Filtering is client-side and remains explicitly limited to the available snapshot.
- **Keyboard navigation:** command palette opens with Ctrl/Command+K and presents labeled, searchable workspace module links. This is not a global document/CRM search.
- **Responsive styling:** clear hierarchy, high contrast, keyboard focus states, mobile breakpoints, reduced-motion handling and stable empty states.

### Security / correctness boundaries

- Management access remains enforced by the existing server-side page session guard and the protected `/api/command-center` endpoint.
- The existing restricted commission vault is **not** exposed in this view.
- No API routes, auth rules, database schema, finance calculations or operational records are changed.
- All displayed counts and watchlist records come from the existing API payload; nothing is mocked or persisted.
- Link destinations enforce their own roles and permissions. Seeing a navigation link does **not** grant permission.
- The application is **not production ready** and must not be fed live business data before security, recovery, privacy and infrastructure gates are approved.

### Manual acceptance checklist

1. Sign in as an authorized management user in an isolated staging environment with synthetic data; verify the priority category count matches the four server-provided overdue counts.
2. Confirm positive counts produce actionable module links; zero counts do not produce phantom attention items.
3. Verify tab selection and filtering with shipment and task samples, including no-match and empty states.
4. Verify Ctrl/Command+K opens module navigation, Escape closes it and navigation works using keyboard only.
5. On mobile widths 375px, 700px and tablet 900px, confirm no horizontal overflow and readable call-to-action controls.
6. Verify 403 restricted and 401 login behavior remains unchanged.
7. Run web `typecheck`, `lint` and `build` through repository CI. Re-check authorization on every linked destination.

### Outside this delivery

Actual invoice payments, full document vault, carrier APIs, secure public-site lead ingestion, double-entry accounting, global search, production backups/restore, complete mandatory MFA governance, and independent security certification are **not** provided by this UX slice. Track these separately in [the 50-step roadmap](enterprise-50-step-roadmap.md).
