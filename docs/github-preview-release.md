# GitHub-based deployment — verified scope

## Public static design tour — successfully deployed

- Public URL: https://niloy-datta.github.io/shl-operations-preview/enterprise.html
- Source repository: https://github.com/niloy-datta/shl-operations-preview
- Pull request: https://github.com/niloy-datta/shl-operations-preview/pull/2
- GitHub Pages successful release workflow: https://github.com/niloy-datta/shl-operations-preview/actions/runs/39653883434
- Workflow deployed public pages **without** an authenticated API, PostgreSQL,
  financial/business data, sessions, credentials or staff records.
- Future pushes to that preview repo's **main** automatically validate and
  publish its **site/** directory. The main ERP repository does not
  automatically synchronize source docs/demo files into the preview:
  copy reviewed, public-safe changes by PR to the preview repository.

This is a **static, read-only design tour**, not the running operations ERP.

## Functional ERP — currently not deployed

The real system is Next.js/TypeScript + Spring Boot/Java 25 + PostgreSQL.
GitHub Pages cannot execute these services. The application may be started
locally on localhost with Docker and synthetic test records, or in an approved,
isolated staging VM using compose.staging.yaml and docs/isolated-staging.md.

GitHub Actions already runs:
- Node.js 24 typecheck, ESLint and Next.js production build
- Java 25 Maven verify / PostgreSQL Testcontainers
- Isolated authentication and MFA integration smoke
- Staging Compose static network/security checks

CI success does **not** imply a functional live backend deployment.

## Explicit blockers for production ERP

1. Move source to a **private** organization-owned repository and protect
   default branch with appropriate review, signed releases and checks.
2. Select and provision private backend host and PostgreSQL database with
   verified capacity and access isolation, then configure HTTPS, domain and
   approved secret store. No credentials or payment data belong in GitHub.
3. Have SHL-authorized operators provision staff accounts, secure MFA recovery
   and organization-level incident response.
4. Finish full line-item purchase/fulfillment invoicing and double-entry
   reconciliation, and implement quarantined malware-scanned documents.
5. Verify encrypted backup/restore drills, contract/legal/tax requirements,
   negative-role integration/E2E tests, independent security review and
   management acceptance. Real client data is prohibited until this is done.

The repo does not contain reusable hosting credentials or a configured remote
Docker host. Publishing to GitHub Pages was the safe deployment completed; no
claim of complete ERP go-live is made.
