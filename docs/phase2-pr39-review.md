# Phase 2 — PR #39 review map

Review date: 2026-11-06. Original review range: `b27df0f76a1acce7d87d0d2a2563e1b9062d24c4..f3f84185a02c756dcf78b4087e01018cf68a384b` (90 paths). Phase 2 changes are subsequent commits on the same integration branch. This engineering review is not an independent security approval.

## Findings and dispositions

| Severity | Finding | Disposition / evidence |
|---|---|---|
| High usability/integration | LOGISTICS could not reach line-shipment booking through a quotation page whose commercial API correctly denies the role; paperwork/exception alerts targeted that page. | Added dedicated shipping desk reusing the existing panel, safe paginated issued-PO lookup, and shipment deep links. Java test enforces exact nonfinancial projection and excludes already-booked orders. Browser business test keeps quotation API 403 while booking succeeds. |
| Medium responsive usability | Linux Chromium tablet clipped the Staff reset-password button inside the generic 290px text cell; 56/57 CI tests passed. | Dedicated non-clipping action cell and wrapping action group; original failing screenshots/traces retained in run 42192975405. Normal pointer click and explicit cell-bounds regression remain enforced. |
| Medium accessibility | Customer modal did not trap keyboard focus; several workspace dialogs lacked consistent Escape/focus restoration. | Shared dialog wrapper applied to directory, growth, enterprise and RFQ forms. Browser tests cover customer focus/validation/save and command finder keyboard navigation. |
| Medium accessibility | Dashboard and alert text contrast failed real axe scans, including counts that appeared after data loaded. | Darkened existing palette text; scan waits for real totals. Automated scan scope is dashboard and alerts, not a whole-product accessibility certification. |
| Medium stability | Fast API responses could finish before the queued loading-frame callback, leaving six desks permanently loading. | Cancel the pending loading frame on request completion (seven effects, including RFQ details). Real browser regression deliberately delays animation frames while calling real APIs. |
| Medium workflow feedback | PO reconciliation could retain an old green match after a subsequent failed request; evidence/exception lists could briefly claim no records while loading or after error. | Clear match before retry; explicit loading/error-aware empty states. |
| Medium authorization UX | Quote actions offered to unauthorized roles or self-reviewers; consent offered opt-in on closed leads; supplier submitter saw self-review controls. | Controls follow existing backend rules; server authorization remains unchanged. |
| Low navigation | Nineteen full-page login assignments and duplicated specialist menus diverged from shared navigation. | Central session-expiry router event and shared role-filtered navigation. Source lint has zero warnings. |

## Security and release blockers

- Repository is public. Existing release-gate policy requires private visibility; no visibility change was made.
- Main legacy branch protection returns HTTP 404; repository rulesets are empty. Required approvals/status checks are not enforced. PR #39 has no submitted approving review at the audit snapshot.
- Dependabot security updates, secret scanning and push protection are disabled at the audit snapshot. No full-history secret audit or independent penetration test is claimed.
- `npm audit --omit=dev` reports zero vulnerabilities. Full audit reports eight moderate affected development-tool packages through minimatch / TypeScript ESLint (`GHSA-g3hv-75wg-m249`). npm proposes a cross-major eslint-config-next downgrade; that change was not applied during stabilization. Tooling dependency remediation remains open. The current web Dockerfile copies the build workspace including development dependencies into the runtime image; zero production-dependency advisories is not a clean bill for the whole image.
- Privacy/operational approval for consent, conversion and evidence handling remains outstanding. Consent does not implement outbound suppression; references are not uploaded/verified documents; delivery remains staff-reported; billing candidates are unposted.
- V1–V26 migration files are unchanged by Phase 2. No repair/out-of-order override is enabled. Upgrade test covers clean V20 to V26, not previously broken migration histories.
- Original #31–37 and #28 are not merged by this work. Their content already in this integration must not be merged again independently. No auto-merge is enabled by this work.

## Review sections

Backend review checks role annotations, scoped parent lookup, bound SQL parameters, locks/transactions, independent reviewers, idempotent conversion and immutable source snapshots. Consent/convert/exception/compliance/milestone inputs are bounded; servlet ERROR dispatch permission is not a direct `/error` exemption. Commercial and commission permissions remain server enforced.

Migration review checks unique additive versions, foreign keys, indexes, immutable history triggers and database constraints. Full Java verification includes real servlet HTTP status regression and Testcontainers migration upgrade checks. BFF contract tests cover origin/authentication/status propagation and literal route allowlists.

Frontend review checks role-filtered navigation, truthful loading/error states, real actions, keyboard/focus behavior and responsive overflow. Removed quick-switcher files were the duplicate finder replaced in Phase 1. Existing legacy commerce records remain available; line-based sourcing/order/shipping workflows are separate existing data models, not duplicate records to auto-migrate.

Build/scripts review checks npm lock + npm ci, environment origin consistency, fail-closed release checks and isolated synthetic smoke. Phase 2 browser CI uses normal MFA/session APIs, a tmpfs PostgreSQL override and a unique Compose project. Failure artifacts contain synthetic data only; auth-state files and environment secrets are ignored and excluded from Docker context/artifact paths.

### Backend authorization and business transactions (11 paths)

- `apps/api/src/main/java/com/shl/operations/enterprise/LeadConsentController.java`
- `apps/api/src/main/java/com/shl/operations/enterprise/LeadConversionController.java`
- `apps/api/src/main/java/com/shl/operations/enterprise/LineOrdersController.java`
- `apps/api/src/main/java/com/shl/operations/enterprise/LineShipmentExceptionsController.java`
- `apps/api/src/main/java/com/shl/operations/enterprise/OperationalAlertsController.java`
- `apps/api/src/main/java/com/shl/operations/enterprise/PoProductionMilestonesController.java`
- `apps/api/src/main/java/com/shl/operations/enterprise/PurchaseOrderMatchingController.java`
- `apps/api/src/main/java/com/shl/operations/enterprise/PurchaseOrderMatchingService.java`
- `apps/api/src/main/java/com/shl/operations/enterprise/SupplierComplianceController.java`
- `apps/api/src/main/java/com/shl/operations/security/SecurityConfig.java`
- `apps/api/src/main/java/com/shl/operations/trading/RfqLandedCostController.java`

### Database migrations (6 paths)

- `apps/api/src/main/resources/db/migration/V21__crm_lead_contact_consents.sql`
- `apps/api/src/main/resources/db/migration/V22__reviewed_lead_conversions.sql`
- `apps/api/src/main/resources/db/migration/V23__line_shipment_exception_cases.sql`
- `apps/api/src/main/resources/db/migration/V24__supplier_compliance_review.sql`
- `apps/api/src/main/resources/db/migration/V25__rfq_landed_cost_scenarios.sql`
- `apps/api/src/main/resources/db/migration/V26__line_po_production_milestones.sql`

### Java regression tests (7 paths)

- `apps/api/src/test/java/com/shl/operations/CustomerLineQuotesWorkflowTest.java`
- `apps/api/src/test/java/com/shl/operations/HttpErrorStatusTest.java`
- `apps/api/src/test/java/com/shl/operations/LeadConsentWorkflowTest.java`
- `apps/api/src/test/java/com/shl/operations/LeadConversionWorkflowTest.java`
- `apps/api/src/test/java/com/shl/operations/MigrationUpgradeTest.java`
- `apps/api/src/test/java/com/shl/operations/RfqLandedCostWorkflowTest.java`
- `apps/api/src/test/java/com/shl/operations/SupplierComplianceWorkflowTest.java`

### Frontend routes, proxy boundaries and components (39 paths)

- `apps/web/src/app/api/auth/login/route.ts`
- `apps/web/src/app/api/data/[resource]/[id]/route.ts`
- `apps/web/src/app/api/data/[resource]/route.ts`
- `apps/web/src/app/api/enterprise/[...path]/route.ts`
- `apps/web/src/app/api/growth/[...path]/route.ts`
- `apps/web/src/app/api/supplier-compliance/[...path]/route.ts`
- `apps/web/src/app/api/trading/[...path]/route.ts`
- `apps/web/src/app/design-system.css`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/workspace/alerts/alerts-desk.tsx`
- `apps/web/src/app/workspace/command-center/executive-cockpit.tsx`
- `apps/web/src/app/workspace/command-center/page.tsx`
- `apps/web/src/app/workspace/command-center/quick-switcher.css`
- `apps/web/src/app/workspace/command-center/quick-switcher.tsx`
- `apps/web/src/app/workspace/enterprise/enterprise-desk.tsx`
- `apps/web/src/app/workspace/enterprise/line-quotes/line-order-panel.tsx`
- `apps/web/src/app/workspace/enterprise/line-quotes/line-orders.css`
- `apps/web/src/app/workspace/enterprise/line-quotes/line-shipment-panel.tsx`
- `apps/web/src/app/workspace/enterprise/line-quotes/po-match-panel.tsx`
- `apps/web/src/app/workspace/enterprise/line-quotes/po-production-panel.tsx`
- `apps/web/src/app/workspace/enterprise/line-quotes/shipment-exceptions-panel.tsx`
- `apps/web/src/app/workspace/growth/growth-desk.tsx`
- `apps/web/src/app/workspace/growth/growth.css`
- `apps/web/src/app/workspace/growth/lead-consent-panel.tsx`
- `apps/web/src/app/workspace/growth/lead-conversion-panel.tsx`
- `apps/web/src/app/workspace/layout.tsx`
- `apps/web/src/app/workspace/rfqs/landed-cost-panel.tsx`
- `apps/web/src/app/workspace/rfqs/rfq-workspace.tsx`
- `apps/web/src/app/workspace/rfqs/rfqs.css`
- `apps/web/src/app/workspace/suppliers/compliance/page.tsx`
- `apps/web/src/app/workspace/suppliers/compliance/supplier-compliance-desk.tsx`
- `apps/web/src/app/workspace/suppliers/compliance/supplier-compliance.css`
- `apps/web/src/app/workspace/workspace.tsx`
- `apps/web/src/components/operations-command.tsx`
- `apps/web/src/components/ui/primitives.tsx`
- `apps/web/src/components/workspace-identity.tsx`
- `apps/web/src/components/workspace-navigation.tsx`
- `apps/web/src/lib/operations-navigation.ts`

### Build and development configuration (8 paths)

- `.gitattributes`
- `.gitignore`
- `apps/web/Dockerfile`
- `apps/web/next-env.d.ts`
- `apps/web/package-lock.json`
- `apps/web/package.json`
- `apps/web/tests/integration-contracts.test.mjs`
- `apps/web/tsconfig.json`

### Evidence and workflow documentation (12 paths)

- `README.md`
- `docs/enterprise-50-step-roadmap.md`
- `docs/fullstack-recovery-20261106.md`
- `docs/lead-consent-v23.md`
- `docs/lead-conversion-v24.md`
- `docs/line-shipment-exceptions-v25.md`
- `docs/po-production-milestones-v29.md`
- `docs/purchase-order-matching-v28.md`
- `docs/recovery-branch-audit-20261106.md`
- `docs/rfq-landed-cost-v27.md`
- `docs/staging-auth-smoke.md`
- `docs/supplier-compliance-v26.md`

### Automation and launch scripts (7 paths)

- `.github/workflows/checks.yml`
- `.github/workflows/github-release-gates.yml`
- `scripts/Start-SHL-Operations.ps1`
- `scripts/check-github-release-gates.sh`
- `scripts/staging-auth-smoke.test.mjs`
- `scripts/test-github-release-gates.sh`
- `scripts/workspace-smoke.mjs`
