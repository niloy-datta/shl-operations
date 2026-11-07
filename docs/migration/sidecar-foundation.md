# Sidecar foundation

This is an additive development scaffold; Java remains the only business API. The only non-health route is GET /api/me. It delegates every valid bearer session to the legacy API at the fixed internal service address http://api:8080 and fails closed on errors. The sidecar has no database credentials or schema write capabilities. /health/live and /health/ready assert process state only; /openapi describes the sidecar health routes.

The pnpm workspace contains the sidecar and packages only; apps/web continues to use its existing npm lockfile. From the repository root, use corepack enable, pnpm install --frozen-lockfile, pnpm build, pnpm typecheck and pnpm test.

To opt into the sidecar and unused Redis placeholder locally, use docker compose -f compose.yaml -f compose.ts-sidecar.yaml --profile ts-sidecar up --build. Neither exposes a host port or changes the existing PostgreSQL volume. Disable the profile to roll back.

Before adding any business vertical slice, preserve opaque session revocation, current role and MFA enrollment checks. CRM reads require all applicable role and data scopes. Build contract and denial tests against a disposable database; do not forward real company data to an unverified sidecar.

Identity bridge tests use a synthetic mocked upstream. They do not prove live Java/PostgreSQL session, MFA or revocation parity. Run cross-service tests against disposable data before routing real users to this endpoint.
