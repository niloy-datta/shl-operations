# Supabase authentication

The Next.js app uses Supabase email/password authentication with server-managed,
HttpOnly cookies. Next.js 15 middleware refreshes sessions, prevents caching of
authenticated responses, and protects workspace pages and business API routes.
Server page guards also verify users with Supabase. The old development login
bypass and SHL session cookie no longer grant access.

## Project and local setup

- Project: `shl-operations` (`nlyuorlwqulfcljovajq`), Singapore.
- Copy `apps/web/.env.example` to `apps/web/.env.local` on another machine.
- Set the project URL and publishable key from Supabase's Connect dialog.
- Set `SHL_PUBLIC_ORIGIN` to the exact app origin, including its port locally.
- Run `npm install` and `npm run dev` from `apps/web`.

Only publishable keys belong in `NEXT_PUBLIC_` variables. Never add a service role
or secret key. `.env.local` is ignored by Git.

## First account

Set `SHL_AUTH_ALLOWED_EMAILS` to a comma-separated list of authorized staff emails.
The local owner email is `niloy.datta.dev@gmail.com`, based on the connected
Supabase organization. Registration and workspace access both enforce this list;
even accounts created directly through Supabase's public Auth API cannot access
the workspace unless allowed. An empty list denies access.

Open `http://localhost:3000/register`, use an allowed email, and choose a unique
16–128 character password. Open the confirmation email in the same browser.
Supabase sends its default email links to the configured Site URL; the app's
root route forwards PKCE codes to `/auth/callback`. The callback establishes the
cookie session and opens `/reset-password`. Newly confirmed users who already
chose their password can continue straight to the workspace from that screen.
The login page also offers password visibility controls and Forgot password.
Recovery links use the same callback and let the user save a new password.
Do not send passwords through repository files or chat.

Initial owner setup can also use `node scripts/setup-owner.mjs`. This requests a
one-time sign-in link for the single configured owner email and creates that
account if necessary. The owner opens the link locally, and the login page
exchanges its tokens for verified HttpOnly session cookies before opening the
password setup page. Tokens are removed from the browser URL immediately and
validated with Supabase before cookies are set. This flow does not require
choosing or sharing an owner password in scripts. Do not run it repeatedly;
Supabase applies email rate limits.

Signed-in users go to `/workspace`. Logout signs out the current device.
Account security supports changing the password after checking the current
password, then signs out all devices. Existing TOTP-enrolled accounts are prompted
for an authenticator code during login. MFA enrollment and per-device management
from the original Java backend are not part of this integration.

## Deployment

Set the same Supabase variables in the web hosting environment. Set
`SHL_PUBLIC_ORIGIN` to the final HTTPS app URL. The app uses Secure cookies in
production. Configure Supabase Site URL and redirect URLs for the final domain
before using email confirmation or recovery on a deployed domain. Locally, the
project's default Site URL is `http://localhost:3000`. No production domain is
hard-coded into auth. Also configure `SHL_AUTH_ALLOWED_EMAILS` on the host.

This change authenticates users; it does not connect the imported business
screens to a database or make the Java API accept Supabase JWTs. Add appropriate
RLS policies when introducing Supabase database tables.

## Current dashboard integration blocker

The current `northstar-core` checkout contains only `apps/api/pom.xml`; the
Spring Boot source tree and SQL migrations are absent. The web checkout also has
no `/api/data/*` handlers, and `API_INTERNAL_URL` is unset. As a result, an
unauthenticated dashboard data request currently returns `401` from auth
middleware. After login, `/api/data/dashboard` returns `404`. The dashboard now
reports the HTTP status instead of hiding it behind a generic loading error.
Do not use sample counts to mask this. Restoring the Spring API and migrations
from the SHL operations source, then choosing one identity provider compatible
with backend authorization, is required before live dashboard data can load.

## Verification

With the web server running, execute from the repository root:

```powershell
node --test scripts/auth-smoke.test.mjs
```

Use `AUTH_TEST_URL` and `AUTH_TEST_ORIGIN` for a server on another port. These tests
check unauthenticated route protection, CSRF protection, validation, rejected
unauthorized emails, registration allowlisting, recovery pages, cache headers,
and signed-out logout.
Successful sign-in, refresh, password change, and sign-out should also be checked
with a provisioned staff account. No test creates users or sends email.

Reference: https://supabase.com/docs/guides/auth/server-side/creating-a-client
