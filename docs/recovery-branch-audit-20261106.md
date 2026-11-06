# Full-stack recovery branch audit — 6 November 2026

Audit baseline: `origin/main` at `b27df0f76a1acce7d87d0d2a2563e1b9062d24c4`.

Fetched all remote refs; compared merge bases, commit deltas, added implementation paths, PR bases/states, source diffs and tests. Unique commit counts alone do not establish missing functionality because earlier PRs were squash merged. No AGENTS.md was found in the checkout or inspected ancestor directories.

Important source findings:

- PRs #31–37 are an actual ordered stack; #31 starts on main and each next PR targets its predecessor. Privacy/operational/security reviews remain outstanding. Nothing was merged into main.
- Commit `080ccb8` in #33 deletes the complete #31 consent implementation and migration V21. The integration restores it, including BFF routes, UI and tests; it does not accept the top branch as a complete source snapshot.
- Latest main includes #38 administrator-assisted password reset. Its controller, proxy and UI survive the older stack integration.
- Main redirected `/` into an external static showcase. The application now enters `/workspace` and keeps login guards; the showcase stays separate.
- Local uncommitted changes were all preview-mode authentication removals or replacements. Kept in an external byte-for-byte backup and `recovery: preserve frontend-only local work before full-stack integration` stash, rather than applying them to the authenticated app. Untracked artifacts were also backed up.
- Existing V1–V20 migration files are unchanged. Added versions are V21–V26, with no duplicate numeric versions. Schema changes run only in disposable tests.
- GitHub repository visibility is public; GET branch protection for main returns 404. No visibility or branch policy was changed.

| Remote branch | Verified PR state | Code comparison and integration decision |
|---|---|---|
| `chore/production-release-gate-20261015` | PR #10 MERGED, base `main` | Feature already delivered on main, often by squash merge. No new implementation paths versus main; preserve newer main code. |
| `docs/2026-11-01-repo-status` | No matching PR in 100-result inventory | No new implementation paths versus main; existing source and tests supersede branch snapshot. |
| `docs/verified-github-preview-deployment-20261022` | PR #24 MERGED, base `main` | Feature already delivered on main, often by squash merge. No new implementation paths versus main; preserve newer main code. |
| `feat/admin-assisted-password-recovery-20261106` | PR #38 MERGED, base `main` | Feature already delivered on main, often by squash merge. No new implementation paths versus main; preserve newer main code. |
| `feat/boudi-priority-command-desk` | PR #25 MERGED, base `main` | Feature already delivered on main, often by squash merge. No new implementation paths versus main; preserve newer main code. |
| `feat/controlled-approvals-and-integrity` | PR #5 MERGED, base `main` | Feature already delivered on main, often by squash merge. No new implementation paths versus main; preserve newer main code. |
| `feat/dedup-review-candidates-20261021` | PR #19 MERGED, base `main` | Feature already delivered on main, often by squash merge. No new implementation paths versus main; preserve newer main code. |
| `feat/enforced-mfa-onboarding-20261015` | PR #11 MERGED, base `main` | Feature already delivered on main, often by squash merge. No new implementation paths versus main; preserve newer main code. |
| `feat/enterprise-foundation-phase-2` | PR #8 MERGED, base `main` | Feature already delivered on main, often by squash merge. No new implementation paths versus main; preserve newer main code. |
| `feat/enterprise-operations-platform` | PR #3 MERGED, base `main` | Feature already delivered on main, often by squash merge. No new implementation paths versus main; preserve newer main code. |
| `feat/factory-milestones-v29` | PR #37 OPEN, base `feat/purchase-order-matching-v28` | Integrated in dependency order; original PR remains open for stakeholder review. 24 new implementation paths vs main. V25 deletion of consent repaired separately. |
| `feat/isolated-staging-refresh-20261021` | PR #20 MERGED, base `main` | Feature already delivered on main, often by squash merge. No new implementation paths versus main; preserve newer main code. |
| `feat/landed-cost-scenarios-v27` | PR #35 OPEN, base `feat/supplier-compliance-review-v26` | Integrated in dependency order; original PR remains open for stakeholder review. 18 new implementation paths vs main. V25 deletion of consent repaired separately. |
| `feat/lead-communication-consent-v23` | PR #31 OPEN, base `main` | Integrated in dependency order; original PR remains open for stakeholder review. 4 new implementation paths vs main. V25 deletion of consent repaired separately. |
| `feat/lead-ownership-queue-20261021` | PR #18 MERGED, base `main` | Feature already delivered on main, often by squash merge. No new implementation paths versus main; preserve newer main code. |
| `feat/lead-qualification-v22-20261031` | PR #30 MERGED, base `main` | Feature already delivered on main, often by squash merge. No new implementation paths versus main; preserve newer main code. |
| `feat/leads-projects-finance-control` | PR #6 MERGED, base `main` | Feature already delivered on main, often by squash merge. No new implementation paths versus main; preserve newer main code. |
| `feat/line-aware-customer-quotes-20261015` | PR #16 MERGED, base `main` | Feature already delivered on main, often by squash merge. No new implementation paths versus main; preserve newer main code. |
| `feat/line-billing-review-20261022` | PR #23 MERGED, base `main` | Feature already delivered on main, often by squash merge. No new implementation paths versus main; preserve newer main code. |
| `feat/line-order-procurement-20261022` | PR #21 MERGED, base `main` | Feature already delivered on main, often by squash merge. No new implementation paths versus main; preserve newer main code. |
| `feat/line-shipment-document-alerts-v21` | PR #27 MERGED, base `main` | Feature already delivered on main, often by squash merge. No new implementation paths versus main; preserve newer main code. |
| `feat/line-shipment-document-checklist-v20` | PR #26 MERGED, base `main` | Feature already delivered on main, often by squash merge. No new implementation paths versus main; preserve newer main code. |
| `feat/line-shipment-tracking-20261022` | PR #22 MERGED, base `main` | Feature already delivered on main, often by squash merge. No new implementation paths versus main; preserve newer main code. |
| `feat/operations-command-center-v3` | PR #2 MERGED, base `main` | Feature already delivered on main, often by squash merge. No new implementation paths versus main; preserve newer main code. |
| `feat/operations-ux-system-20261022` | No matching PR in 100-result inventory | Selected five additive UX commits; consolidated command shortcut and core sidebars without importing stale files. |
| `feat/operations-workspace-v2` | PR #1 MERGED, base `main` | Feature already delivered on main, often by squash merge. No new implementation paths versus main; preserve newer main code. |
| `feat/production-readiness-security-20261015` | PR #9 CLOSED, base `main` | Closed PR: existing EnrollmentGateFilterTest/MfaEnforcementIntegrationTest supersede old mandatory-MFA test; old preflight requires absent compose.prod.yaml and .env.production.example. Not ported. |
| `feat/purchase-order-matching-v28` | PR #36 OPEN, base `feat/landed-cost-scenarios-v27` | Integrated in dependency order; original PR remains open for stakeholder review. 21 new implementation paths vs main. V25 deletion of consent repaired separately. |
| `feat/release-safety-encrypted-backups-20261015` | PR #12 MERGED, base `main` | Feature already delivered on main, often by squash merge. No new implementation paths versus main; preserve newer main code. |
| `feat/reviewed-lead-conversion-v24` | PR #32 OPEN, base `feat/lead-communication-consent-v23` | Integrated in dependency order; original PR remains open for stakeholder review. 8 new implementation paths vs main. V25 deletion of consent repaired separately. |
| `feat/rfq-line-quote-revisions-20261015` | PR #15 MERGED, base `main` | Feature already delivered on main, often by squash merge. No new implementation paths versus main; preserve newer main code. |
| `feat/rfq-structured-items-20261015` | PR #14 MERGED, base `main` | Feature already delivered on main, often by squash merge. No new implementation paths versus main; preserve newer main code. |
| `feat/security-sessions-and-controls` | PR #4 MERGED, base `main` | Feature already delivered on main, often by squash merge. No new implementation paths versus main; preserve newer main code. |
| `feat/shipment-exception-cases-v25` | PR #33 OPEN, base `feat/reviewed-lead-conversion-v24` | Integrated in dependency order; original PR remains open for stakeholder review. 7 new implementation paths vs main. V25 deletion of consent repaired separately. |
| `feat/signed-website-lead-intake-20261021` | PR #17 MERGED, base `main` | Feature already delivered on main, often by squash merge. No new implementation paths versus main; preserve newer main code. |
| `feat/supplier-compliance-review-v26` | PR #34 OPEN, base `feat/shipment-exception-cases-v25` | Integrated in dependency order; original PR remains open for stakeholder review. 14 new implementation paths vs main. V25 deletion of consent repaired separately. |
| `feat/windows-localhost-launcher-20261030` | PR #29 MERGED, base `main` | Feature already delivered on main, often by squash merge. No new implementation paths versus main; preserve newer main code. |
| `fix/supabase-spring-integration` | Unrelated history | Excluded: replaces session/MFA model, removes existing tests, conflicts with migration V21/V22, introduces mock-data client. |
| `security/github-release-gates-20261028` | PR #28 OPEN, base `main` | Selected three release-check files; offline policy tests pass. Live governance remains blocked. |
| `test/fullstack-mfa-staging-smoke-20261015` | PR #13 MERGED, base `main` | Feature already delivered on main, often by squash merge. No new implementation paths versus main; preserve newer main code. |
