# Staging topology (synthetic-data only)

Opt-in staging stack replacing the stale and conflicting deployment PR #9 template.
**Not approved for production or real SHL company information.**

Internet HTTPS → Caddy → private Next.js web → private Java API → private
PostgreSQL. Only Caddy publishes ports. A dedicated staging database volume
prevents mixing this environment with local development.

- Staging-only development mode permits bootstrap for synthetic accounts.
  Never repurpose this mode or Compose stack as a production deployment.
- Mandatory MFA is enabled with current MFA_ENFORCEMENT_ENABLED; malformed or
  missing MFA keys fail API startup.
- Exact SHL_PUBLIC_ORIGIN is bound to configured staging HTTPS domain for CSRF.
- Commissions deny everyone; public website intake disabled by default.
- TLS and network isolation are controls, not independent certification.

## Steps

1. Use a dedicated host and staging subdomain with valid DNS and SSL ingress.
2. Copy .env.staging.example to .env.staging. Replace ALL sample values with
   unique secret values; generate MFA key with openssl rand -hex 32.
   Never commit .env.staging.
3. Run: docker compose --env-file .env.staging -f compose.staging.yaml config --quiet
4. Start: docker compose --env-file .env.staging -f compose.staging.yaml up -d --build
5. Only use fictional records. Exercise login/MFA, permission denial, CSRF,
   migrations, HTTPS headers and data recovery in an isolated test environment.
6. Do not go live until independent security, recovery, privacy, stakeholder
   and operational acceptance gates are completed.

Refer to docs/production-release-gates.md. This template does not provide
production-grade identity recovery, SIEM, secret manager, retention/restore
drills or release authorization.
