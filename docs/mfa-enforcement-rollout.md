# Mandatory MFA rollout (development feature)

The API supports `MFA_ENFORCEMENT_ENABLED` (default `false` for local development). When enabled, a user without enrolled TOTP can authenticate with their password but receives an **enrollment-only session**: protected operations APIs return 403. Only MFA status, enrollment, confirmation and session logout endpoints are available. A fresh login with TOTP or a one-use recovery code is required after successful setup.

## Enable in a non-production environment

1. Set a strong private `MFA_ENCRYPTION_KEY` (64 hexadecimal characters). Treat encryption-key backups and rotation as separate security tasks.
2. Use dedicated staging with synthetic records. Set `MFA_ENFORCEMENT_ENABLED=true` on the API service, using managed secret/config storage.
3. Sign in with existing credentials. Users without MFA are sent to `/workspace/account/enroll-mfa`. Provide their own password to generate a setup key, confirm an authenticator code, save recovery codes securely, then sign in again.
4. Verify a password-only session cannot access supplier, CRM, finance, staff or shipment APIs. Test a recovery code once and its replay rejection.
5. Verify existing sessions for unenrolled users become enrollment-only immediately when enforcement turns on. Users with MFA remain subject to code verification at every new login.
6. Do not disable MFA while organization enforcement is active. Lost-factor recovery still requires an independently approved administrative process; do not bypass policy in production.

## Security boundaries

- Enrollment-only sessions still prove knowledge of the account password and are **not** full operational sessions.
- New staff can onboard through the same restricted process without requiring policy deactivation.
- Current enforcement does not implement risk-based step-up for approvals, password reset by administrators or verified dual-control recovery.
- The web and API remain development-only until the other release gates, including independent penetration review, backup drills and production infrastructure, pass.
- Keep the public static showcase separate from the private ERP API.

See [release checklist](production-release-gates.md) when Pull Request #10 is merged, and the [OWASP MFA guidance](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html).
