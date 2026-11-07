# SHL NEXUS — implementation ও review inventory

তারিখ: ৭ নভেম্বর ২০২৬। Baseline: `d6f2d2af04294875cebb892851635339c927e994`, integration branch / Draft PR #39। ৬ নভেম্বরের NEXUS increment-এর ওপর Phase 3 truck product catalog যোগ হয়েছে; এটি সম্পূর্ণ enterprise roadmap বা production readiness-এর ঘোষণা নয়।

## Executive Black V3 — review branch

Authenticated workspace dark-first SHL wordmark, compact 64px topbar ও theme-aware shared surfaces ব্যবহার করে; saved light preference এবং login/MFA boundary অক্ষত। `/workspace/command-center` management team projection থেকে ছয়টি বাস্তব operational KPI, searchable priority table, independent review queue, pipeline, order/workload ও staff-reported shipment watch দেখায়। Revenue/margin/exposure বা reference screenshot-এর sample record/identity যোগ হয়নি। Mobile priority row-তে business matter ও due date রাখা হয়; desktop/tablet-এ পুরো context থাকে। পাঁচটি target viewport-এর actual Chromium capture ও axe JSON ignored `.nexus-evidence/after/`-এ। Feature branch tests/PR status এই section final delivery-র আগে update হবে।

## কী preserve ও কী বদলেছে

Next.js BFF → Spring Boot → PostgreSQL architecture, existing business forms, session/MFA, independent approvals ও commission username allowlist রাখা হয়েছে। আগে প্রয়োগ করা migration অপরিবর্তিত রেখে additive Flyway V27 যোগ হয়েছে। Working `.env`, bootstrap credentials ও local database volume অক্ষত; local DB-তে কেবল V27 schema migration হয়েছে, কোনো synthetic product বা business row লেখা হয়নি। `IMPLEMENTED_FEATURES_BN.md`-এর আগে থেকে থাকা user edits এই delivery-তে stage/commit করা হয়নি।

PR #39 ও open #31–37 audit করে duplicate integration করা হয়নি। Local NEXUS commits recover করে dedicated Phase 3 branch-এ রাখা হয়েছে। User-requested fast-forward-এ PR #39-এর `d6f2d2a` head main-এ পৌঁছানোর পর GitHub PR #39-কে merged হিসেবে mark করেছে। Draft PR #40 এখনও open, base `integration/fullstack-recovery-20261106`: https://github.com/niloy-datta/shl-operations/pull/40. Production deploy করা হয়নি।

## Implemented / preserved / pending

| Capability | অবস্থা ও বাস্তব সীমা |
|---|---|
| Shared SHL NEXUS shell | Implemented: single visible role-aware navigation, breadcrumb, profile/role, real logout, module finder, quick-create, alert entry, persisted light/dark preference |
| My Day | Implemented: personal tasks/leads; permitted shared operational records; real source metrics; priority/date/type/search filters; truthful unavailable/empty states |
| Executive overview | Implemented: management team scope, independent quotation/SO/PO review links, bounded line-order and shipping watchlists, task workload; no price/margin/commission projection |
| Customer CRM | Preserved CRUD/search/export + new contact profile drawer and connected customer RFQ search. Lead consent, conversion and communication timeline preserved in lead desk |
| Supplier intelligence | Profile/contact drawer + exact supplier evidence deep link, existing independent compliance review; truck product-এ supplier relationship ও linked quotation history আছে. Formal vendor scoring pending |
| RFQ comparison | Existing immutable revision workflow preserved; latest per-item supplier prices, MOQ, lead time, Incoterm/port and notes now in a comparison table. Structured payment-term fields and automatic certification matching pending |
| CSV import | Implemented: UTF-8 CSV, up to 100 rows/1 MB; header mapping; required/length/email validation; normalized-name duplicates within file and existing directory; preview + explicit confirmation; existing authenticated POST API |
| CSV integrity limits | Individual saves, not a bulk transaction; partial results explicit; final duplicate recheck helps but concurrent imports have no database unique-name guarantee. No fuzzy/contact-level matching, updates/upsert or automatic retry |
| Excel workbook import | Pending dependency/security review; UI explicitly accepts CSV only |
| Logistics timeline | Implemented from existing ETD/ETA and staff departure/delivery report events. Verified ATD/ATA fields, external proof and carrier tracking remain pending; no GPS/maps added |
| Shipment documents/exceptions | Existing auditable checklist, references and independent exception review preserved. Secure file vault/upload/download and cross-module document index pending |
| Trading/vehicle workflow | Existing RFQ product/specification/quantity, quote versions, approvals, SO/PO, booking and delivery preserved. Truck model/category catalog ও configurable technical templates যোগ হয়েছে; no existing categories replaced |
| Task execution | Existing assignment, priority, deadlines, linked legacy records and status APIs preserved; overview/workload added. Per-task completion-history UI and richer ownership on RFQs/shipments pending |
| Pipeline | Actual authorized source counts and existing stage-workspace/record links. Counts are not mutually exclusive funnel cohorts; historical conversion analytics and universal record graph pending |
| Global search / saved filters | Ctrl/Cmd+K module finder retained; priority records searchable within the current snapshot. Full company record search and per-account saved filters pending |
| Finance / commissions | Existing server finance-role policy preserved; explicit independent commission grant remains required. No grant inferred from Sen/Cris display names; no account/role created. Exact account-policy mapping must be reviewed before changing finance access |
| Accounting / payments | Existing invoices/payments/expenses and unposted line-billing review preserved. No fabricated posting, GL, reconciliation, settlement or legally verified invoice claimed |

## API ও authorization evidence

- `GET /api/workspace-overview?scope=personal|team` (Next) → `GET /api/workspace/overview` (Spring) → existing tasks, leads, RFQs, line quotes/orders/POs/shipments/billing candidates and role-filtered alerts.
- Spring security filter এবং controller method উভয়েই supported roles check করে। Non-manager `scope=team` → 403। Personal tasks/leads actor/owner দিয়ে scoped; manager team view আলাদাভাবে request করে। Shared RFQs/shipping follow existing role visibility; new ownership columns invented হয়নি।
- Quote review requires creator != current reviewer; pending SO/PO review linksও independent actor অনুযায়ী filtered। Actions still execute through existing business APIs and their rules.
- Projection returns no costs, margins, outstanding money or commissions. Existing financial endpoints are not opened to additional roles.
- `GET /api/data/suppliers/{id}` → exact supplier lookup; existing supplier read roles retained. Compliance links no longer depend on finding the supplier among the first 100 directory entries.
- Customer/supplier CSV writes use existing API validation, role permissions, same-origin protection and audit logging. There is no new unguarded bulk-write endpoint.
- Truck catalog BFF `/api/products` allowlists collection and detail routes, requires the existing session/CSRF policy for writes, and forwards to Spring `/api/products/**`. Supported catalog roles are ADMIN, MANAGEMENT, BD and SOURCING; product drafts are created/edited by ADMIN, MANAGEMENT or SOURCING, and only a different ADMIN/MANAGEMENT actor can approve. LOGISTICS/FINANCE have no catalog visibility.
- Product approval requires at least one entered specification. Only active products can be selected for an RFQ or comparison; RFQ linkage is nullable so old line items keep working. Catalog mutations are transactional and audited, with JSON change snapshots. V27 categories are reference seeds only; no products/specifications/certificates are fabricated.

## GitHub main delivery

- User-requested non-force fast-forward: `main` moved from `b27df0f76a1acce7d87d0d2a2563e1b9062d24c4` to `bdfcdca3baeb6562aab6d8463160eb769d3393b2`. This includes the 42-commit integration stack, recovered NEXUS work and Phase 3 catalog (52 commits relative to the old main tip).
- On that exact SHA, push Checks (API/web/scripts), Windows launcher and release-gate checks passed. The Chromium and isolated-auth pull-request workflows also passed on the same SHA. Vercel's `Preview Comments` status succeeded; GitHub has no deployment record for the SHA.
- `main` has no branch protection (GitHub API returned 404). Existing release/security sign-offs remain open blockers; no production deploy was performed.

## Checks ও evidence

Recorded Java verification for the Phase 2 NEXUS baseline: **৮১ pass**, failure/error/skipped ০; includes three new overview ownership/role/reviewer tests, existing HTTP status, MFA/session/password recovery, business workflows and migration upgrade checks. Phase 3 full Java/Testcontainers suite: **৮৫ pass**, failure/error/skipped ০; includes product create/update/search/approval/archive, role denial, history, RFQ linkage and V20→V27 upgrade checks.

Phase 2 frontend contracts/parser checks: **১৬ pass**। Phase 3 frontend checks: **১৭/১৭ pass**, TypeScript, ESLint, production build pass। Phase 2 Chromium matrix ছিল **৬৯/৬৯**। Phase 3 final Chromium suite: **৭২/৭২ pass**, desktop/tablet/mobile-এ ২৪টি করে; retries/skipped/flaky ০। Truck compare workflow, role matrix, six review routes × light/dark accessibility checks included; serious/critical axe findings ০। Production dependency audit-এ advisory ০ (tooling/image hardening remains a separate risk). E2E screenshots, axe JSON and traces ignored evidence folder-এ; synthetic session data public source হিসেবে commit হয়নি।

Local artifacts:

- `.nexus-evidence/before/` — ছয়টি original local screen
- `.nexus-evidence/after/` — final local screenshots
- `.nexus-evidence/review/index.html` — before/after review board
- `apps/web/playwright-report/` এবং `apps/web/test-results/` — current HTML/JSON test evidence
- `.nexus-evidence/` — previous failed-run diagnostics and synthetic test screenshots

E2E data temporary isolated Compose project-এ; working local database-এ synthetic import করা হয়নি। Reports/traces-এ synthetic sessions থাকতে পারে; সেগুলো public source হিসেবে commit করা হয়নি।

## Review routes

1. My Day — http://127.0.0.1:3000/workspace
2. Executive — http://127.0.0.1:3000/workspace/command-center
3. CRM — http://127.0.0.1:3000/workspace?view=customers
4. Suppliers — http://127.0.0.1:3000/workspace?view=suppliers
5. RFQ / comparison — http://127.0.0.1:3000/workspace/rfqs
6. Logistics — http://127.0.0.1:3000/workspace/shipments/line
7. Supplier reference review — http://127.0.0.1:3000/workspace/suppliers/compliance
8. Truck product catalog — http://127.0.0.1:3000/workspace/products
9. Add catalog product — http://127.0.0.1:3000/workspace/products/new
10. Product comparison — http://127.0.0.1:3000/workspace/products/compare?ids=<active-product-id-1>,<active-product-id-2>

Source tokens/components: [DESIGN.md](../DESIGN.md)। নতুন theme login/MFA enrollment-এর authentication boundary বদলায় না।

## Release risks ও পরের development priorities

1. Domain ownership, Sen/Cris exact account grants, document retention/privacy ও independent operational/security approval স্থির করা। Existing admin role দিয়ে commission override নেই।
2. Catalog content-এ sourced manufacturer/specification evidence যোগ, category taxonomy ownership ও allowed unit conventions business-approved করা। Product references are not verified certificates; product values remain user-entered until independently sourced/reviewed.
3. Secure document storage/access/retention এবং searchable reference index; uploaded evidence authentication বা verified delivery certificate বলে দাবি না করা।
4. Transactional import service, reviewed duplicate keys/idempotency ও safe Excel parsing; concurrent imports ও unknown network outcomes-এর governance।
5. Rich record search, saved filters, per-record task/ownership links, historical pipeline analytics এবং specialist screens-এর wider accessibility review।
6. PR #39-এর existing release blockers: public repository, unenforced main protection/reviews/check rules, independent sign-offs, moderate tooling dependency findings ও runtime-image hardening। এই increment সেগুলো production-approved ঘোষণা করে না।

## Phase 3 — truck product intelligence

- Migration: `apps/api/src/main/resources/db/migration/V27__truck_product_intelligence.sql` — additive normalized category, template, manufacturer, product, specification, application, configuration, market note, reference, supplier, history tables; optional RFQ line-item product FK. Seeded only the six requested categories.
- Backend: `TruckProductController.java`, security role policy and nullable product linkage in `RfqItemsController.java`. Validation, bounded pagination/search/sort, same-manufacturer model-code uniqueness, transactional updates, audit and independent approval; archived/draft products excluded from RFQ selection and comparison.
- Next BFF: authenticated/CSRF checked `/api/products` collection and allowlisted catch-all routes. Responsive pages include catalog table/filters, create/edit draft form with category templates, detail/change log/quotation history, comparison and RFQ product picker.
- Workflow verified against disposable PostgreSQL: sourced fields and references save/reload, draft→independent approval→active RFQ selection→comparison; invalid roles denied. Real localhost V27 has 6 category references and 0 catalog product rows.
- Screenshot: `.nexus-evidence/after/truck-product-compare.png` (actual Playwright browser result; synthetic test session/data, ignored and not committed).

## Final local delivery

Final full Chromium run: **৬৯/৬৯ pass**, প্রায় ৯৪ সেকেন্ড; retry, skipped, flaky এবং unexpected failure: ০। Compact priority expansion, mobile navigation focus/Escape, command overlay coverage, customer profile, CSV approval/results এবং two-supplier comparison-ও covered। My Day থেকে lead খুললে qualification triage, activity ও consent detail load হওয়া, dialog-এর initial focus/Shift+Tab containment এবং dark dialog-এর serious/critical axe findings-ও যাচাই করা হয়েছে।

Local `http://127.0.0.1:3000`-এ same code rebuild ও health check pass; authenticated overview HTTP 200। তিন viewport × ছয় route × দুই theme-এর ৩৬টি after screenshot নেওয়া হয়েছে। Working database-এ কোনো synthetic business row insert করা হয়নি; screenshots-এর login session শেষে revoke করা হয়েছে।

Core recovered source commits: `bcebff7` (projection/lookup), `24e0da5` (shell and connected UI), `a1129cc` (browser coverage); `1eef6ab` covers final density/mobile/modal polish; `bc7ec04` fixes lead triage deep-link loading and dark dialog focus/contrast. They are included in the pushed PR #40 branch along with the local recovery documentation commits. Phase 3 source commit: `1c3e22b9c105af06afc525080aa00b0023e670c3`. GitHub Actions on this exact SHA all passed: [Checks #467](https://github.com/niloy-datta/shl-operations/actions/runs/42285016580), [Chromium Browser E2E #4](https://github.com/niloy-datta/shl-operations/actions/runs/42285016583), and [Isolated Full-Stack Auth Smoke #49](https://github.com/niloy-datta/shl-operations/actions/runs/42285016633). Existing PR #39 baseline evidence is separate.

Temporary E2E Compose stack ও synthetic auth/config files cleanup করা হয়েছে। Working localhost stack চালু রাখা হয়েছে। Existing database volume, `.env` ও original local report অক্ষত।
