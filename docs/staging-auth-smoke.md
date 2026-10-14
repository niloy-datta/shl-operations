# Isolated full-stack authentication smoke test

This is a **synthetic environment** quality gate, not a production penetration test or full browser E2E suite. GitHub Actions starts the real Next.js, Spring Boot and PostgreSQL services with generated test credentials. It never imports SHL records or accesses a live domain.

It checks:
- Anonymous access is denied and cross-origin login is rejected.
- Password-only users are restricted when mandatory MFA is enabled.
- MFA setup completes and previous sessions are revoked.
- A one-use recovery code enables a fresh verified login, and replay is rejected.
- Authorized users can list an empty customer directory; logout revokes access.

The workflow runs on pull requests or manual GitHub Actions invocation as `Isolated Full-Stack Auth Smoke`. It destroys volumes and synthetic credentials at the end, even on failures.

It does **not** test real shipping/finance workflows, large datasets, visual accessibility, privileged recovery approvals, or deployment security. Those are still launch blockers.
