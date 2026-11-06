# SHL NEXUS — implementation ও review inventory

তারিখ: ৬ নভেম্বর ২০২৬। Baseline: `d6f2d2af04294875cebb892851635339c927e994`, integration branch / Draft PR #39। এটি existing app-এর একটি কার্যকর NEXUS increment; সম্পূর্ণ enterprise roadmap বা production readiness-এর ঘোষণা নয়।

## কী preserve ও কী বদলেছে

Next.js BFF → Spring Boot → PostgreSQL architecture, existing business forms, session/MFA, independent approvals, commission username allowlist ও Flyway V1–V26 রাখা হয়েছে। নতুন migration নেই। Working `.env`, bootstrap credentials ও local database volume বদলানো হয়নি। আগে থেকে untracked `IMPLEMENTED_FEATURES_BN.md` অক্ষত।

PR #39 ও open #31–37 audit করে তাদের integration পুনরায় merge করা হয়নি। এই increment local review-এর জন্য; GitHub push/PR update বা remote deployment করা হয়নি। Baseline-এর green CI নতুন local changes-এর CI evidence নয়।

## Implemented / preserved / pending

| Capability | অবস্থা ও বাস্তব সীমা |
|---|---|
| Shared SHL NEXUS shell | Implemented: single visible role-aware navigation, breadcrumb, profile/role, real logout, module finder, quick-create, alert entry, persisted light/dark preference |
| My Day | Implemented: personal tasks/leads; permitted shared operational records; real source metrics; priority/date/type/search filters; truthful unavailable/empty states |
| Executive overview | Implemented: management team scope, independent quotation/SO/PO review links, bounded line-order and shipping watchlists, task workload; no price/margin/commission projection |
| Customer CRM | Preserved CRUD/search/export + new contact profile drawer and connected customer RFQ search. Lead consent, conversion and communication timeline preserved in lead desk |
| Supplier intelligence | Profile/contact drawer + exact supplier evidence deep link, existing independent compliance review; previous RFQ quotations remain in sourcing desks. Formal vendor scoring and structured product catalog pending |
| RFQ comparison | Existing immutable revision workflow preserved; latest per-item supplier prices, MOQ, lead time, Incoterm/port and notes now in a comparison table. Structured payment-term fields and automatic certification matching pending |
| CSV import | Implemented: UTF-8 CSV, up to 100 rows/1 MB; header mapping; required/length/email validation; normalized-name duplicates within file and existing directory; preview + explicit confirmation; existing authenticated POST API |
| CSV integrity limits | Individual saves, not a bulk transaction; partial results explicit; final duplicate recheck helps but concurrent imports have no database unique-name guarantee. No fuzzy/contact-level matching, updates/upsert or automatic retry |
| Excel workbook import | Pending dependency/security review; UI explicitly accepts CSV only |
| Logistics timeline | Implemented from existing ETD/ETA and staff departure/delivery report events. Verified ATD/ATA fields, external proof and carrier tracking remain pending; no GPS/maps added |
| Shipment documents/exceptions | Existing auditable checklist, references and independent exception review preserved. Secure file vault/upload/download and cross-module document index pending |
| Trading/vehicle workflow | Existing RFQ product/specification/quantity, quote versions, approvals, SO/PO, booking and delivery preserved. Standalone truck/model/category master and structured vehicle templates pending; no existing categories replaced |
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

## Checks ও evidence

Recorded Java verification: **৮১ pass**, failure/error/skipped ০; includes three new overview ownership/role/reviewer tests, existing HTTP status, MFA/session/password recovery, business workflows and migration upgrade checks.

Frontend contracts/parser checks: **১৬ pass**। TypeScript, source ESLint এবং Docker production build যাচাই করা হয়েছে। **চূড়ান্ত Chromium matrix: ৬৯/৬৯ pass**, প্রতিটি viewport-এ ২৩টি; retry/skipped/flaky ০। ছয়টি screen × light/dark × তিন viewport-এর axe checks-এ serious/critical finding ০। Production dependency audit-এ advisory ০; full tooling/image hardening এখনও আলাদা risk। failed runs-এর screenshot, axe JSON ও traces ignored evidence folder-এ রাখা হয়েছে।

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

Source tokens/components: [DESIGN.md](../DESIGN.md)। নতুন theme login/MFA enrollment-এর authentication boundary বদলায় না।

## Release risks ও পরের development priorities

1. Domain ownership, Sen/Cris exact account grants, document retention/privacy ও independent operational/security approval স্থির করা। Existing admin role দিয়ে commission override নেই।
2. Structured truck/model/specification master, supported categories ও consistent unit/commercial-term schema—reviewed additive migration ও business acceptanceসহ।
3. Secure document storage/access/retention এবং searchable reference index; uploaded evidence authentication বা verified delivery certificate বলে দাবি না করা।
4. Transactional import service, reviewed duplicate keys/idempotency ও safe Excel parsing; concurrent imports ও unknown network outcomes-এর governance।
5. Rich record search, saved filters, per-record task/ownership links, historical pipeline analytics এবং specialist screens-এর wider accessibility review।
6. PR #39-এর existing release blockers: public repository, unenforced main protection/reviews/check rules, independent sign-offs, moderate tooling dependency findings ও runtime-image hardening। এই increment সেগুলো production-approved ঘোষণা করে না।

## Final local delivery

Final full Chromium run: **৬৯/৬৯ pass**, প্রায় ৯৬ সেকেন্ড; retry, skipped, flaky এবং unexpected failure: ০। Compact priority expansion, mobile navigation focus/Escape, command overlay coverage, customer profile, CSV approval/results এবং two-supplier comparison-ও covered।

Local `http://127.0.0.1:3000`-এ same code rebuild ও health check pass; authenticated overview HTTP 200। তিন viewport × ছয় route × দুই theme-এর ৩৬টি after screenshot নেওয়া হয়েছে। Working database-এ কোনো synthetic business row insert করা হয়নি; screenshots-এর login session শেষে revoke করা হয়েছে।

Core source commits: `bcebff7` (projection/lookup), `24e0da5` (shell and connected UI), `a1129cc` (browser coverage); `1eef6ab` covers final density/mobile/modal polish; all commits remain local. GitHub CI was not run for these unpushed commits. Existing PR #39 baseline evidence is separate.

Temporary E2E Compose stack ও synthetic auth/config files cleanup করা হয়েছে। Working localhost stack চালু রাখা হয়েছে। Existing database volume, `.env` ও original local report অক্ষত।
