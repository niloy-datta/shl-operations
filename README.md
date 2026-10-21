# SHL Operations OS — internal business operating system (development)

Independent internal application. The existing `shl-global` website is untouched.

**Security note:** The source GitHub repository is currently public. The application is not ready for production; do not commit business data, credentials, commission details, or customer documents. Review privacy and security requirements before loading SHL records.

**GitHub Pages deployment status (2026-10-22):** The read-only [Enterprise Experience preview](https://niloy-datta.github.io/shl-operations-preview/enterprise.html) is deployed by [the separate public Pages repository](https://github.com/niloy-datta/shl-operations-preview). Its workflow validates static files before publishing. **No operational ERP, API, staff sessions, PostgreSQL or customer data have been deployed to GitHub Pages.** See [deployment boundaries](docs/github-preview-release.md).


**Current V17–V19 milestone:** Approved multi-line customer quotes can create audited line sales orders, one supplier-specific PO per selected supplier, one staff-tracked shipment per issued PO, and an internal *unposted* billing review candidate after full delivery. Independent approval, immutable source snapshots and Testcontainers checks are included. Real legal invoices, bank payments and shipping docs are **not** connected to these new line flows.

**Phase-two development:** [New enterprise modules and release gates](docs/phase-two-release.md) · [50-feature roadmap](docs/enterprise-50-step-roadmap.md). Business entity registry, executive command-center source and CRM lead timeline are merged into `main` as development features; they are not yet publicly deployed as a functional ERP. The safe [interactive enterprise design tour](https://shl-operations-enterprise-preview.vercel.app/enterprise.html) is a static showcase only, not a live ERP deployment.

## Static GitHub Pages preview

The read-only visual demo is in [`docs/demo`](docs/demo) and is published from a separate, public static-only repository so this application repository can stay private. It does not run the Next.js app, authenticate users, connect to the API, or store records. It contains no customer, supplier, RFQ or pricing data. The full application still requires its Docker services and database.

GitHub Pages sites are publicly accessible. See [the preview](https://niloy-datta.github.io/shl-operations-preview/) for the static interface demo.

## Security-focused release improvements (development code)

Production startup now has a fail-closed deployment-mode guard, and opt-in encrypted S3 backup and isolated restore scripts are available. These are implementation building blocks, not a deployed service, disaster recovery certification or permission to use real SHL data. See [release hardening](docs/production-hardening.md).

## Run locally

1. Install Docker Desktop with Compose.
2. Copy `.env.example` to `.env`. Set distinct random database and admin passwords. Sessions use 256-bit random opaque tokens hashed in PostgreSQL; SESSION_KEY is no longer needed. Generate a unique MFA_ENCRYPTION_KEY with `openssl rand -hex 32` before enabling authenticator MFA. Do not commit `.env`. Commission records are visible only to exact case-sensitive existing staff usernames in protected `COMMISSION_AUTHORIZED_USERS`; leave it empty to deny all. This list must be explicitly approved.
3. Run `docker compose up --build` in this folder.
4. Open `http://localhost:3000` and sign in with the bootstrap admin credentials.

The PostgreSQL volume persists records between restarts. To rerun checks in an environment with Docker, run `docker compose run --rm api mvn test` only in a build image with Maven, or `cd apps/api && mvn test` with Java 25 and Maven installed. For the web, run `cd apps/web && npm install && npm run typecheck && npm run lint && npm run build`.

## Current roadmap

The [50-step enterprise delivery roadmap](docs/enterprise-50-step-roadmap.md) tracks delivered code versus outstanding production tasks. The new customer-scoped consignee master at `/workspace/consignees` supports profile management and pre-dispatch shipment assignment, including owner matching and audit records. **This does not mean the system is production-ready.**

## Enterprise workflow foundation (development)

A connected foundation covers quotation approval, sales/purchase orders, shipments, invoices/payments, tasks, staff roles, audit events and authenticated Next.js pages. CRM leads, project jobs, expenses, an explicitly restricted commission vault and role-filtered operational alerts now have real database/API/UI implementations. See [new project and finance milestone](docs/implementation-milestone-v6.md) and [enterprise documentation](docs/enterprise-workflows-v4.md) for module boundaries, role matrix, workflow steps, testing and outstanding security gates.

For a local PostgreSQL archive use `bash scripts/backup-local.sh`, then test restoring it with `bash scripts/restore-drill-local.sh backups/<archive>.dump`. Never store backups in Git.

**This is not production ready.** Mandatory-MFA enrollment enforcement is implemented as an opt-in staging configuration; approved account recovery, factor reset governance, independent security review, properly protected infrastructure and complete double-entry accounting are still pending. Shipping documents, GL postings and payments are not enabled for new line workflows. Do not load real SHL company data yet.

## Implemented in the current development milestone

- Admin sign in with database-backed, revocable, HTTP-only opaque session cookies; internal bearer-token API authorization.
- PostgreSQL migrations, customer and supplier create/list/search, pagination, live dashboard totals.
- Responsive operations dashboard with real customer, supplier, RFQ, and total relationship KPI cards sourced from PostgreSQL.
- Searchable, paginated customer and supplier directories with create **and edit** forms, loading, error, and empty states.
- Contact editing uses authenticated same-origin `PUT /api/data/{resource}/{id}` proxy routes; the API enforces the existing ADMIN role and validates request data.
- Export the **currently displayed directory page** to CSV (not a full-directory export); leading spreadsheet formula characters are neutralized.
- Updated read-only static visual preview in `docs/demo` with no fictional counts, sample records, API calls, or storage.
- RFQ sourcing desk at `/workspace/rfqs`: customer-linked inquiries, supplier offer comparison (price/MOQ/lead time), guarded RFQ status changes and RFQ activity history.
- PostgreSQL Flyway V2 migration and transactional sourcing API; RFQ lifecycle tested using PostgreSQL Testcontainers.
- Outgoing customer quotations, purchasing, shipments, invoices, payments and named-staff RBAC have development implementations. CRM lead qualification, project jobs and notes, expenses, explicitly authorized confidential commissions, operational alerts and conservative project contribution reporting have also been implemented. **True double-entry ledger, commission settlement, compulsory MFA, production deployment and full security hardening are not implemented.**
- No fabricated business metrics or sample records.

## Mandatory authenticator policy (development)

The existing TOTP authenticator and one-use recovery codes now support an optional organization-wide **enforcement setting**. Use `MFA_ENFORCEMENT_ENABLED=true` in an approved isolated staging configuration. Users who have not enrolled can receive only a restricted MFA-setup session: business API access is blocked until setup is confirmed, existing sessions are revoked, and a new login with a code succeeds. MFA cannot be disabled while the policy is enforced. The API refuses to start with an invalid encryption key when enforcement is enabled.

Development default remains `false`, and enabling this flag **does not** make the ERP production-ready. Recovery governance, browser E2E coverage, external review and backups remain open. See [MFA rollout plan](docs/mfa-enforcement-rollout.md).

## Boundaries

This is a **local first milestone**, not a production release. The initial account is bootstrapped only if `staff_users` is empty; changing the bootstrap environment password later does not rotate an existing staff password. Named staff accounts, role changes, revocable opaque sessions, optional authenticator MFA and audit events are implemented. The API stays private inside Compose, while the web interface is bound to loopback for local development. Production-grade identity recovery, external identity management, secret rotation, role isolation and deployment security reviews remain open. Do not use real company data yet.

GitHub Actions checks run Node 24 with typecheck/lint/build, and Java 25 with Maven verify / PostgreSQL Testcontainers. This is CI verification, not a production deployment or complete security review. See [boudi-aligned execution blueprint](docs/operations-v3-roadmap.md), [architecture](docs/architecture.md) [new feature roadmap](docs/implementation-milestone-v6.md), and [website integration](docs/website-integration.md).
