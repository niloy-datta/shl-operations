# Phase 2 — Enterprise modules and safe showcase

**Status:** Development source merged to main, not production-ready. All statements below describe source code only unless a deployment is explicitly identified.

## New application modules
- `/workspace/entities` — legal entity/branch directory; customer and supplier links; active status; department contact profiles; primary-contact uniqueness.
- `/workspace/command-center` — management-only aggregation of customers, suppliers, active leads, RFQs, orders, projects, shipment movement, overdue exceptions, open tasks and outstanding invoice balances in original currencies. Restricted commissions are intentionally excluded.
- `/workspace/growth/leads` — append-only typed lead activity (internal notes / call / email / WeChat / meeting) and guarded next-follow-up scheduling.

## Backend details
- Flyway V10 adds corporate entity and contact tables. Identity link cannot be reassigned through update APIs.
- Flyway V11 adds immutable CRM lead activity rows.
- Java controllers use role gates, Jakarta validation, JDBC transactions and audit events.
- Financial summaries are source-based operational figures, **not audited financial statements or profit**.

## Public design experience
- `docs/demo/enterprise.html` contains a cinematic interface tour for the system's ten major product modules.
- `docs/demo/enterprise.js` provides keyboard-operable module navigation, previous/next workflow presentation, and hash deep links.
- This static page does not authenticate, communicate with the API, contain fake client transactions, or retrieve live company data.
- Public showcase project: `shl-operations-enterprise-preview` on Vercel.
- Deployment page: `https://shl-operations-enterprise-preview.vercel.app/enterprise.html`.
- A successful static design deployment does **not** deploy the authenticated Next.js/Spring Boot/PostgreSQL stack.

## Release gates for full application
1. Move source repository to private visibility before adding confidential company documents or pricing information.
2. Use dedicated managed PostgreSQL with tested encrypted offsite backups and automatic restore drills.
3. Provision distinct API/web services with mutually isolated networks. `API_INTERNAL_URL` must not point to an unauthenticated public service.
4. Keep environment secrets in provider secret storage; rotate bootstrap credentials and use least-privileged database accounts.
5. Enforce MFA, strong account recovery and dual control on sensitive approvals before real data.
6. Run Java/PostgreSQL tests, browser E2E flows, performance testing, dependency audits and independent penetration review.
7. Test data migrations, rollback procedures, monitoring, incident response and organization sign-off.
8. Deploy staging, validate workflows with synthetic records, review exceptions and approve production separately.

## Known limitations
- The company/recipient selectors presently browse a bounded current page or up to 100 directory references in some forms; server-backed search is needed for all production-scale selectors.
- Public website lead ingestion, secure freight documents, ERP double-entry accounting and carrier API integrations are not implemented.
- No company data has been imported and no production backend service has been deployed.
- The full 50-item backlog lives in `docs/enterprise-50-step-roadmap.md`.
