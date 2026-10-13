# Security phase 5: revocable identity sessions

Implemented on feat/security-sessions-and-controls.

## What changes
- Browser session is an unguessable 256-bit random token stored in HttpOnly, Secure-in-production, SameSite=Strict cookie; NO password or Basic credential is stored in the cookie.
- Spring Boot persists only SHA-256 token digest, account UUID, expiration, revocation timestamp; token expires after 8 hours.
- Login checks BCrypt credentials inside a database transaction and tracks failed attempts per SHA-256 of normalized username, with a 15-minute lock after eight failures.
- Five most recent sessions are retained at most per account. Users can view and revoke sessions under Account security. Logging out revokes the server-side session.
- Password changes and staff role/disabled status changes revoke the account's sessions immediately. Old session cookies from the previous release stop working.
- Next.js never returns the bearer token in browser-readable JSON. Private backend remains inside Docker network.
- Session validation runs on each authenticated API request and reloads current role and enabled account state.
- CSRF-sensitive BFF actions require same origin; response headers disable framing/object embeds, disable browser permissions, and set security headers.

## Verification
CI validates Next.js typecheck/lint/build and Maven/PostgreSQL integration tests. Session lifecycle tests verify login, revocation, invalid password, throttling, password and role invalidation.

## Known limitations
- Account-based throttling can be abused for targeted denial of service; proxy-level IP/edge rate limiting and bot mitigation are still required.
- No MFA/TOTP or WebAuthn, self-service recovery, SSO, automatic secret rotation, managed IDP, breach-password screening, IP/device intelligence, or verified security review.
- Existing bootstrap password and database credentials remain local environment variables. This is **not approved production identity**.
- Database audit is not immutable. Use append-only external retention for production.
- TLS/HSTS assumes correct HTTPS termination in production; enable only after testing a dedicated domain.
- The first deployment after migration V4 forces existing users to log in again.

## Optional authenticator MFA (Flyway V5)
- Configure a **unique 64-character hex** MFA_ENCRYPTION_KEY before offering enrollment. Never commit it.
- At Account security, enter current password, register the manual TOTP key in an authenticator app, confirm a six-digit code, and save the eight one-use recovery codes.
- RFC 6238 SHA1 / 30-second / six-digit verification with ±1-step clock tolerance and replay counter.
- Secret is encrypted at rest with AES-256-GCM and an application-managed environment key; recovery code digests only are stored in PostgreSQL.
- Enabling or disabling MFA revokes all active sessions; complete the login again.
- Losing both the authenticator and all recovery codes requires a controlled manual identity-recovery process which is not implemented.
- MFA is optional in development, so un-enrolled accounts remain password-only. Enforcing MFA organization-wide and securing recovery are production blockers.
- **Encryption key loss makes existing MFA secrets unusable; key rotation is not implemented.** Store and back up key through a compliant secrets manager.

## Local restoration test
Use `bash scripts/backup-local.sh` then `bash scripts/restore-drill-local.sh backups/<archive>.dump`. The drill restores to a network-isolated temporary PostgreSQL container without touching the actual database. It only validates the presence of core tables; maintain separate production recovery exercises, encrypted backup retention, point-in-time recovery and data reconciliation.
