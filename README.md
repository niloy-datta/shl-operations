# SHL Operations OS — private business operating system

Independent internal application. The existing `shl-global` website is untouched.

## Static GitHub Pages preview

The read-only visual demo is in [`docs/demo`](docs/demo) and is published from a separate, public static-only repository so this application repository can stay private. It does not run the Next.js app, authenticate users, connect to the API, or store records. It contains no customer, supplier, RFQ or pricing data. The full application still requires its Docker services and database.

GitHub Pages sites are publicly accessible. See [the preview](https://niloy-datta.github.io/shl-operations-preview/) for the static interface demo.

## Run locally

1. Install Docker Desktop with Compose.
2. Copy `.env.example` to `.env`. Set distinct random database and admin passwords. Sessions use 256-bit random opaque tokens hashed in PostgreSQL; SESSION_KEY is no longer needed. Generate a unique MFA_ENCRYPTION_KEY with `openssl rand -hex 32` before enabling authenticator MFA. Do not commit `.env`.
3. Run `docker compose up --build` in this folder.
4. Open `http://localhost:3000` and sign in with the bootstrap admin credentials.

The PostgreSQL volume persists records between restarts. To rerun checks in an environment with Docker, run `docker compose run --rm api mvn test` only in a build image with Maven, or `cd apps/api && mvn test` with Java 25 and Maven installed. For the web, run `cd apps/web && npm install && npm run typecheck && npm run lint && npm run build`.

## Enterprise workflow foundation (development)

A connected foundation now covers quotation approval, sales/purchase orders, shipments, invoices/payments, tasks, staff roles, audit events and authenticated Next.js pages. See [enterprise documentation](docs/enterprise-workflows-v4.md) for module boundaries, role matrix, workflow steps, testing and outstanding security gates.

For a local PostgreSQL archive use `bash scripts/backup-local.sh`, then test restoring it with `bash scripts/restore-drill-local.sh backups/<archive>.dump`. Never store backups in Git.

**This is not production ready.** MFA is optional, secure account recovery and enforced MFA are pending, as are edge login defenses and proper accounting, secure documents, automated restore drills and independent security review are still required. Do not load real SHL company data yet.

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
- Outgoing customer quotations, purchasing, shipments, invoices, payments and named-staff RBAC now have development implementations. **True double-entry ledger, commissions, MFA, production deployment and security hardening remain unimplemented.**
- No fabricated business metrics or sample records.

## Boundaries

This is a **local first milestone**, not a production release. The initial account is bootstrapped only if `staff_users` is empty; changing the environment password later does not rotate the database password. A privileged operator must manage account rotation directly until staff management is implemented. The API is private inside Compose, while only the web interface is exposed on loopback. The app uses a short lived encrypted credential session; later replace this with full staff identity management, individual access roles, MFA, audit events, and secure production deployment. Do not use real company data yet.

GitHub Actions checks run Node 24 with typecheck/lint/build, and Java 25 with Maven verify / PostgreSQL Testcontainers. This is CI verification, not a production deployment or complete security review. See [boudi-aligned execution blueprint](docs/operations-v3-roadmap.md), [architecture](docs/architecture.md) and [website integration](docs/website-integration.md).
