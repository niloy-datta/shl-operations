# Identity bridge: evidence and outstanding parity

Baseline: a9eb334. The sidecar GET /api/me delegates to the internal Java service for every syntactically valid bearer token; it never validates or stores sessions locally. It deliberately exposes no login, MFA, session administration or staff operations.

| Legacy source | Current observed rule | Sidecar evidence | Remaining work |
| --- | --- | --- | --- |
| SessionService.validFormat and validate | A 43-character URL-safe token is hashed; auth_sessions joins staff_users and checks revocation, expiry, enabled status and password change. | Bridge forwards a correctly formatted token on every request; unit tests mock 200/401 responses. | Verify each condition against Java and disposable PostgreSQL; test revocation races and current role changes. |
| BearerSessionFilter | When enrollment is required, only MFA status/enroll/confirm and current logout are allowed; /api/me receives 403. | Bridge returns 403 when upstream returns 403. | Prove the real enrollment gate and status/body compatibility through both services. |
| MeController | Authenticated GET returns username and role. | Bridge forwards the request and returns those fields. | Contract-test response and headers, failures and disabled users against Java. |
| SessionController, MfaController, MfaService | Java owns login, logout, session management, MFA and recovery. | No equivalent route is exposed by the bridge. | Inventory every endpoint and grant before any migration. |

The Java SecurityConfig also enforces route-level access and defaults to deny. The bridge makes no independent authorization decision and is not ready for production or frontend cutover. The source inventory is incomplete until the endpoint-level review described in java-to-ts-matrix.md is performed.
