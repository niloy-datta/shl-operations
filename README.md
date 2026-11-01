# SHL International — Northstar Core

Existing Next.js 15 / React 19 operations workspace with Java 21 / Spring Boot 3.5 and PostgreSQL 16. Supabase handles identity, passwords and TOTP MFA. Spring Boot owns business data, authorization, validation and audit records.

## Request flow

```text
Browser → same-origin Next.js API route → Spring Security → business controllers → PostgreSQL
                    ↓                           ↓
          Supabase verified session     Supabase JWKS signature + claims
                                        database staff role + MFA + revocation
```

The browser receives no database credentials, service-role key or JWT signing secret. Next forwards the verified user's access token, never the incoming browser Authorization header or cookies. Business responses are private and uncached. There is no authentication bypass or demo data fallback.

## Run locally on Windows

Requirements: Node.js 22+, Java 21, Maven 3.9+, Docker with Compose. The scripts also work with this workstation's existing Maven wrapper cache and Docker-in-Ubuntu-WSL setup.

1. Install frontend dependencies with `npm --prefix apps/web ci`.
2. Copy `.env.example` to `.env` and `apps/web/.env.example` to `apps/web/.env.local`. Preserve existing local configuration. Set a strong, unique local `DB_PASSWORD` before starting PostgreSQL. Both files are gitignored.
3. Run these in separate terminals from the repository root:

```powershell
docker compose up postgres
```

```powershell
npm run dev:api
```

```powershell
npm run dev
```

Open **http://localhost:3000/workspace**. `npm run dev` starts Next.js; Java requires the second command. The API listens on `127.0.0.1:8080`. PostgreSQL uses `127.0.0.1:55433` to avoid conflicting with other local projects. Keep the Compose terminal open, especially when Docker runs inside WSL. No existing database volume should be deleted to fix a startup error.

Flyway applies the versioned migrations and Hibernate validates the resulting schema; it never uses create/drop or automatic schema updates. If an existing database has tables without Flyway history, stop and prepare a reviewed baseline after a backup. Do not enable automatic baselining or reset its schema.

## Configuration

| File | Variable | Purpose |
| --- | --- | --- |
| `.env` | `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | JDBC connection for the business database |
| `.env` | `DB_PORT` | Local Compose host port, default 55433 |
| `.env` | `API_PORT`, `API_BIND_ADDRESS` | API listener, defaults 8080 and loopback |
| `.env` | `SUPABASE_URL` | Same identity project as the frontend |
| `.env` | `SUPABASE_JWT_MODE` | `jwks` for ES256/RS256; explicit `legacy` for HS256 |
| `.env` | `SUPABASE_PUBLISHABLE_KEY` | Only required for legacy verification against `/auth/v1/user` |
| `apps/web/.env.local` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public identity project configuration |
| `apps/web/.env.local` | `SHL_PUBLIC_ORIGIN` | Exact trusted browser origin, e.g. `http://localhost:3000` |
| `apps/web/.env.local` | `SHL_AUTH_ALLOWED_EMAILS` | Comma-separated authorized staff emails; empty configuration denies access |
| `apps/web/.env.local` | `API_INTERNAL_URL` | Server-only API origin, e.g. `http://127.0.0.1:8080` |

`start-api.ps1` loads root `.env`. On other operating systems, export these variables in the shell and run `mvn spring-boot:run` inside `apps/api`. Never place credentials in command arguments, screenshots, commits or public environment variables. HTTPS is required outside local loopback. Keep debug/trace logging disabled in production.

## Supabase and staff setup

Use the same Supabase project for both apps. Configure email/password authentication, email confirmation, TOTP MFA, a production SMTP provider and provider rate limits. In Supabase URL Configuration set the intended Site URL and explicitly allow the app's `/auth/callback` URL (local example: `http://localhost:3000/auth/callback`). Production URL and SMTP changes require a separate approved configuration step.

Registration/recovery uses Supabase; registration does **not** create a business administrator. Add the staff email to `SHL_AUTH_ALLOWED_EMAILS`, confirm the identity's email, and link its actual Supabase user UUID to `staff_users.supabase_user_id`.

For the first administrator in the default **local** database only:

```powershell
powershell -NoProfile -File scripts/provision-local-owner.ps1 -SupabaseUserId <confirmed-user-uuid> -Username owner
```

This helper never replaces an existing enabled administrator. Later staff identities can be linked through Staff & access by an MFA-verified administrator. Staff passwords are never stored or set by Java. Open **My security** (`/workspace/account`) to enroll or verify an authenticator. Use the manual setup key in an authenticator app, then confirm the six-digit code. The app does not issue recovery codes; lost-factor recovery requires a separately verified administrator/Supabase recovery procedure.

All new staff require `aal2` for business APIs. Staff/security, finance/costs, audit and executive metrics always require `aal2`, including when an individual staff policy is relaxed. `/api/me` and owned session management remain available for security setup. Application roles come from PostgreSQL on every request; editable `user_metadata` never grants permissions.

Commission access requires an explicit `staff_permissions` grant of `COMMISSION_ACCESS`. Neither ADMIN nor MANAGEMENT implies this permission. No default commission grant is created. Provision/revoke this grant only through an approved database administration process; do not put real commission details into shared audit logs.

Logout revokes the current business API session before signing out of Supabase. Password changes and MFA removal revoke all tracked business sessions and establish a token issuance cutoff, then request global Supabase sign-out. Revoked sessions cannot register again with a refreshed JWT. The account page lists **business API sessions that have accessed this application**, not the provider's complete device/session inventory. Provider refresh-token expiry and access-token expiry remain configured in Supabase.

## Business integration

The allowlisted Next proxy preserves existing frontend URLs:

| Browser API | Java API |
| --- | --- |
| `/api/data/dashboard`, `/api/data/me` | `/api/dashboard`, `/api/me` |
| `/api/data/customers`, `/api/data/suppliers` | `/api/customers`, `/api/suppliers` |
| `/api/trading/rfqs/**` | `/api/rfqs/**` |
| `/api/enterprise/{commerce,logistics,finance,staff,audit,dedup,entities,tasks}/**` | `/api/{resource}/**` |
| `/api/growth/**`, `/api/costs/**` | Same paths |
| `/api/alerts`, `/api/command-center` | `/api/alerts`, `/api/command-center/summary` |
| `/api/auth/sessions/**` | Same paths |

Compatible business controllers and V1–V20 migrations were reused from `niloy-datta/shl-operations` commit `254ce599c711b2d8b2329038263a37dfd6bbd0c1`. Its custom password/session/TOTP authentication was excluded. V21 adds Supabase staff bindings, explicit permissions and revocable business sessions; V22 adds the token cutoff. Historical legacy auth columns/tables are preserved but have no exposed authentication routes.

Missing configuration, unavailable services, invalid JSON and authorization failures remain distinct. The UI shows unavailable records as unavailable, rather than zero, and retains independent successful results. Contact search/pagination and current-page CSV export are preserved. An exact duplicate contact is rejected with 409 without deleting historical duplicates. Existing quotation/order approval and procurement rules remain enforced in Java.

## Tests

```powershell
cd apps/web
npm run typecheck
npm run lint
npm test
npm run build
```

With the local Next server running, from the repository root:

```powershell
node --test scripts/auth-smoke.test.mjs
```

Backend unit tests, inside `apps/api`:

```powershell
mvn test
```

Backend integration tests require an **isolated disposable PostgreSQL** database, not the runtime or production database:

```powershell
$env:NORTHSTAR_TEST_DB_URL='jdbc:postgresql://localhost:55432/northstar_test'
$env:NORTHSTAR_TEST_DB_USERNAME='postgres'
# Set NORTHSTAR_TEST_DB_PASSWORD privately in your shell.
mvn verify -Pintegration
```

These tests execute real migrations, HTTP requests, JWT signature checks, roles, MFA restrictions, commission grants, revocation and customer/supplier/RFQ persistence against local PostgreSQL. A local signing authority stands in for Supabase; this is **not** a live Supabase login/MFA test. Frontend route tests mock provider responses to cover password/MFA failure cases. The HTTP smoke suite checks public forms, unauthenticated redirects, input validation and CSRF rejection.

Development output uses `.next-dev`, production builds use `.next`, preventing a build from removing active development CSS assets.

## Production work pending

- Review this branch before merging or deployment. No production schema, credentials or deployment were changed.
- Back up and inspect the target business database and migration history; review legacy data and role assignments before migrations.
- Configure the Java service, private networking, managed business PostgreSQL, backups, TLS and server-only environment variables. If business tables are ever placed in a Supabase exposed schema, restrict Data API grants and implement appropriate RLS; these migrations target a separate private business database.
- Verify production redirect URLs, SMTP delivery, provider password/rate-limit policies and lost-factor recovery with real authorized accounts.
- Complete live email/password/MFA/refresh/recovery tests and authenticated desktop/mobile visual checks. Local cryptographic and mocked tests do not replace these checks.
- Review full quotation→independent approval→order→procurement→shipment→billing/payment workflows with representative approved business data. Module read tests and focused write tests are not an acceptance test of every workflow.

See [the verification report](docs/verification-report.md) for actual findings, file inventory and test evidence.
