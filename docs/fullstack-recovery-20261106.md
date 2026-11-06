# Verified full-stack recovery — 6 November 2026

Working branch: `integration/fullstack-recovery-20261106`. Baseline: `b27df0f76a1acce7d87d0d2a2563e1b9062d24c4` on latest fetched main. This is a development integration for review, not a production release. Original PRs #31–37 and #28 remain unmerged.

Delivery: [draft integration PR #39](https://github.com/niloy-datta/shl-operations/pull/39). Use the PR's checks tab for the current head's CI results; local verification below is recorded separately.

## Recovery and integration

- Original `frontend-only` HEAD: `8bab194`. Fifteen modified frontend files and untracked artifacts were copied outside the repository before switching branches. A named Git stash also preserves the original changes. No reset, force push, production migration, live data import, or infrastructure change was performed.
- Integration starts from full-stack main, preserving its administrator-assisted password reset (#38), session authentication, RBAC and MFA. Preview-mode local changes that remove authentication remain recoverable in the backup; they are not applied to business pages.
- [All 40 remote branch decisions](recovery-branch-audit-20261106.md) distinguish already delivered/superseded code from genuinely missing functionality. The unrelated Supabase-auth branch is excluded.
- PRs #31–37 were integrated in dependency order and tested between stages. The shipment branch's deletion of consent functionality was repaired in commit `55be292`; the consent migration, tests, API and UI remain present alongside shipment exceptions.
- V1–V20 migration contents are unchanged. V21–V26 are unique, ordered additions. An upgrade test migrates to V20, inserts a synthetic customer, applies the six new migrations, validates checksums, checks the preserved record and confirms a second migrate is a no-op.

## Verified feature inventory

"Implemented" below refers to development code and the named checks. It does not certify real business usage, visual browser behavior, production scale or every possible workflow.

| Module | Previous state | Integrated current state and evidence | Remaining work |
|---|---|---|---|
| Dashboard / executive desk | Main implemented; app home redirected to public showcase | App home enters guarded workspace; existing cockpit and daily desk preserved; source-backed dashboard API and page routes pass HTTP smoke | Visual and responsive browser acceptance; risk-adjusted realized margin |
| Customers, suppliers, contacts | Local frontend snapshot; fuller main API/UI | Main CRUD, search, pagination, entity contacts and consignee directory restored; contact/persistence/entity/consignee Java tests pass; directory creation/editing hidden from read-only roles | Large-data performance and destructive dedup merge workflow |
| CRM / lead consent #31 | Pending branch; later shipment branch deletes it | Append-only preferences, current/history UI, allowlisted proxy and API restored; 4 consent tests pass; real HTTP role checks pass | Privacy review, legal evidence verification and outbound suppression |
| Reviewed lead conversion #32 | Pending stack | Idempotent independently reviewed WON-lead conversion into existing customer/RFQ/project; 3 workflow tests pass; proxy and role matrix pass | Operational approval; automated customer creation is intentionally absent |
| RFQ / supplier quotations | Main structured items and immutable revisions | Existing sourcing tests pass; UI connects to landed-cost scenarios; RFQ and quote routes verified | Attachment storage, documentary verification and pricing-scale benchmarks |
| Customer quotations / approvals | Main implemented, separate legacy and line flows | Independent line approval and immutable source snapshots preserved; 8 combined quote/order/shipment/PO tests pass | Versioned commercial PDF output and executed contracts |
| Sales / purchase orders, matching #36 | Main line procurement; matching pending | PO reconciliation UI/API and server-side source checks before issue integrated; positive, mismatch and role-negative tests pass | Amendments, partial fulfillment and operational sign-off |
| Shipments / exceptions #33 | Main manual ETD/ETA and documents; exceptions pending | Audited case opening and independent resolution UI/API integrated; overdue review alerts clear after resolution; Java workflow and proxy checks pass | Carrier integration, secure document vault, POD and external evidence certification |
| Supplier compliance #34 | Pending stack | Evidence-reference desk, independent review and expiry alerts integrated; 3 workflow tests and HTTP role matrix pass | Secure file storage, actual document verification and approved-vendor policy |
| Landed-cost scenarios #35 | Pending stack | Immutable sourced same-currency scenario comparison integrated; 4 workflow tests and BFF contracts pass | FX conversion policy, accounting-grade landed costs and operational approval |
| Factory milestones #37 | Pending stack | Staff-reported production start/readiness/quality sequence, history, independent quality review and due-date alerts integrated; included in 8 combined workflow tests | External inspection certification and manufacturer telemetry |
| Tasks, projects, alerts | Main implemented; alert failure could look like empty success | Role-scoped feed preserved; unavailable/loading counts show dashes; errors cannot claim queue clear; shared feedback/empty states and retry; HTTP APIs pass | Notifications, broader project planning and browser interaction acceptance |
| Finance, expenses, billing | Main legacy finance and unposted line billing | Finance-control tests pass; invoice, summary, expenses, contribution and billing endpoints pass HTTP checks | Double-entry GL, tax/subledgers, reconciliation and actual payment execution |
| Confidential commissions | Explicit username grant required | All six role classes remain denied without a grant; no ADMIN override; finance-control tests and real BFF HTTP denial pass | Dual-control grant administration, periodic recertification and settlement ledger |
| Staff, roles, sessions, MFA | Full main implementation, including #38 | Password recovery preserved; session, MFA, enforcement and HTTP error tests pass; five additional staff roles enroll MFA in full-stack smoke | Dual-approved factor recovery, key rotation and independent security review |
| Shared UX / keyboard navigation | UX branch unintegrated; separate cockpit shortcut | Five additive UX commits reused; one global command finder; core home/enterprise/alerts sidebars share role taxonomy; identity requests shared; mobile menu disclosure; close/Tab/arrow/Enter behavior corrected in code | Browser tool unavailable: responsive, keyboard and visual behavior are **not browser-verified**; other specialist desks retain their local sidebars |

## Verification

| Check | Result |
|---|---|
| Java 25 / Maven `clean verify` with PostgreSQL 17.6 Testcontainers | **78 tests passed, 0 failed, 0 errors, 0 skipped** |
| New real-servlet HTTP error test | Passed: 400 validation, 401 anonymous, 403 role/commission denial, 404 missing record; direct `/error` remains denied |
| Flyway clean initialization and V20 upgrade | Passed through V26; existing synthetic customer preserved; no duplicate versions or changed V1–V20 files |
| Frontend BFF/session/navigation contracts | **12 tests passed** using real handlers with controlled network/cookie I/O |
| TypeScript | Passed |
| ESLint | Passed with **19 warnings**, all existing/imported `window.location.assign` navigation warnings; zero errors |
| Next.js production build | Passed; lockfile includes Linux and Windows optional compiler packages |
| Real Next.js → Spring Boot → PostgreSQL smoke | Passed: 25 anonymous-guarded/authenticated page URLs, 28 API reads, five additional MFA-authenticated role matrices, commission isolation, new write-origin checks, recovery-code replay and logout revocation |
| Release-gate offline tests | 10 cases passed, including public/missing-protection/zero-review/missing-check failure cases |
| Recovery Bash / launcher PowerShell / static preview JavaScript syntax | Passed |
| Responsive browser and keyboard smoke | **Not run successfully:** browser host unavailable; native Windows browser automation stopped because URL could not be established confidently |
| GitHub Actions for integration head | [Live checks on PR #39](https://github.com/niloy-datta/shl-operations/pull/39/checks); final checked head/status is provided in the delivery response |

The original MockMvc/controller suite missed a real HTTP behavior: container error redispatch converted valid 403/404 responses into 401. `SecurityConfig` now permits only `DispatcherType.ERROR`; direct requests still follow the normal deny-all chain. This follows [Spring Security's dispatch authorization guidance](https://docs.spring.io/spring-security/reference/servlet/authorization/authorize-http-requests.html#match-by-dispatcher-type). `HttpErrorStatusTest` uses a real embedded servlet container to keep this regression covered. The full-stack smoke was rerun successfully after the fix.

Login now reports upstream outages as unavailable rather than invalid credentials. Directory and trading proxies use bounded upstream requests, and directory POST bodies have the same size guard as edits. The Windows launcher and README use the configured `127.0.0.1` origin to prevent localhost/127.0.0.1 CSRF mismatches.

## Outstanding release blockers

1. Repository is public; main branch protection API returns 404. Required reviews/checks cannot be verified. These settings were not changed.
2. Privacy, operations and security sign-offs on the pending feature stack are still open. Green tests are not those approvals.
3. Browser visual/responsive/keyboard verification remains outstanding due to the automation environment. HTTP route checks are not browser E2E tests.
4. The larger unfinished capabilities listed above and in the [50-step roadmap](enterprise-50-step-roadmap.md) remain partial or missing. No mock data or placeholder is presented as a completed business feature.
5. Production deployment, production migrations, external messaging and live infrastructure changes require separate authorization and were not performed.
6. Upgrade verification starts from stable main's V20 schema. A disposable branch database that already applied V22–V26 while the shipment branch omitted V21 needs an explicit migration-history review before reuse. No automatic Flyway repair or out-of-order override is introduced.

## Local run and checks

1. Use Docker with Compose. Copy `.env.example` to `.env` only if no existing private configuration needs preserving. Configure distinct random DB/admin passwords and a unique 64-hex-character MFA key. Leave commission grants empty unless explicitly approved.
2. Run `docker compose up --build` from repository root, then open **http://127.0.0.1:3000**. Sign in with the configured bootstrap account. Existing databases retain their existing account passwords.
3. Frontend: `cd apps/web`, then `npm ci`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
4. API: Java 25, Maven and Docker are required; in `apps/api`, run `mvn clean verify`. The final API runtime image contains no Maven.
5. Full-stack smoke: use a **fresh disposable local database** with MFA enforcement enabled; set synthetic `SHL_TEST_ADMIN_USERNAME`, `SHL_TEST_ADMIN_PASSWORD` and loopback `SHL_TEST_BASE_URL`, then run `node --test scripts/staging-auth-smoke.test.mjs`. It provisions synthetic staff accounts and changes MFA state, so do not point it at a persistent working database.
6. Release configuration checks: `bash scripts/test-github-release-gates.sh` (requires jq); the separate live checker requires authenticated GitHub CLI and does not change repository settings.

Local verification used an isolated, labelled Docker network, tmpfs PostgreSQL storage and synthetic credentials. Test services/configuration are removed after verification; existing database volumes and unrelated containers are preserved.
