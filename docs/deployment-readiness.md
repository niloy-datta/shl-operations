# SHL Operations OS — production release gates

**Current status: staging candidate only; not approved for live company data.**
The production Compose template provides TLS termination and network isolation; it is **not** an audited production release. Existing business application features are unchanged by the template.

## Hosting topology
- Public DNS `SHL_DOMAIN` → Caddy on ports 80/443 → private Next.js web container.
- Web → Spring Boot API on private `application` network.
- API → PostgreSQL on private `data` network. Neither API nor PostgreSQL publishes a host port.
- Application sessions are HTTP-only / secure in production. `SHL_REQUIRE_MFA=true` is enforced at the API before business operations. New staff can sign in to enroll at `/workspace/account`, then reauthenticate with a second factor. When required, MFA cannot be disabled through the API.
- Staff bootstrap uses environment secrets, never a seeded demo credential. No company records are seeded.

## Before starting staging with synthetic records
1. Move the repository to private visibility and ensure access controls and protected `main` with required reviews/checks. **The repository is public as of this change.**
2. Provision a dedicated host, stable public DNS for your own operations subdomain, HTTPS ports 80/443, locked-down SSH, updates and intrusion monitoring.
3. Copy `.env.production.example` to `.env` on the target host, replace every placeholder with individual high-entropy secrets; generate MFA key with `openssl rand -hex 32`. Keep `.env` outside version control and restrict filesystem access.
4. Run `python3 scripts/production_preflight.py`. It validates formatting/secrets and `docker compose config`, but **does not** test internet reachability or certify safety.
5. Review migrations/backups and **use only test records**; then run `docker compose --env-file .env -f compose.prod.yaml up -d --build`. Review `docker compose --env-file .env -f compose.prod.yaml ps` and server logs without exposing secrets.
6. Enroll the bootstrap administrator in authenticator MFA immediately, store one-use recovery codes securely, sign out, and sign in again with MFA.
7. Exercise negative-role access, approval separation, import/export, finance precision, session revocation, E2E tests and the restore drill in staging.

## Before any company data or public production launch
- [ ] Independent security review (ASVS-aligned), dependency/SAST scans, authenticated penetration test and remediation sign-off.
- [ ] Protected default branch, private source repository and least-privilege secrets handling; no personal or commercial data in source.
- [ ] Encrypted off-host database backups with restore automation, tested retention and documented RPO/RTO.
- [ ] Secure organization-approved account recovery / MFA reset with dual approval and logged emergency access. New policy only controls enrollment and disablement, not recovery.
- [ ] Document/data access isolation, upload scanning, retention, export restrictions and privacy review.
- [ ] Monitoring, alerting, incident response, hosting/service-level targets and on-call ownership.
- [ ] Complete general ledger, reconciliations and compliance rules **before claiming financial reports are authoritative**.
- [ ] Written acceptance of all required business workflows and explicit operations/security release approval.

## Rollback and operational notes
Before each schema migration, take and **verify an off-host encrypted backup**. Flyway migrations are forward-only by default; rolling back containers will not automatically reverse a database migration. Restore tested backups only through an approved documented recovery procedure.

The built-in local `scripts/backup-local.sh` and `restore-drill-local.sh` are local tools and do not constitute the encrypted off-site backup requirement. The static public showcase is separate from this private application.
