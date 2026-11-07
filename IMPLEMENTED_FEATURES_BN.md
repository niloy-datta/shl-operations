# SHL Operations — কী কী implement ও integrate করা হয়েছে

সর্বশেষ আপডেট: ৬ নভেম্বর ২০২৬

বর্তমান local branch: `main`

এই আপডেটের আগের local commit: `0baea294b91464c294d30bcb0a2dff86fc000520`

Existing review: [Draft PR #39](https://github.com/niloy-datta/shl-operations/pull/39)

Local application: **http://127.0.0.1:3000**

**এটিই implementation status-এর মূল বাংলা নথি। পরবর্তী কাজের implemented, tested ও pending তথ্য এই একই file-এ আপডেট করা হবে; নতুন delivery/status Markdown file তৈরি করা হবে না।** Existing technical reports আগের কাজের evidence হিসেবে থাকবে।

এই নথিতে recovery, Phase 2 stabilization এবং SHL NEXUS-এর কাজ একসঙ্গে রয়েছে। সাতটি pending feature integrate ও repair করা হয়েছে; এরপর বাস্তব API-সংযুক্ত workspace, browser verification ও UX refinement যোগ করা হয়েছে। আগে থেকে থাকা module-গুলো আলাদা করে চিহ্নিত করা হয়েছে। এটি সম্পূর্ণ enterprise roadmap বা production-ready ঘোষণার নথি নয়।

সর্বশেষ যাচাই: **Java ৮১ pass, frontend contracts/parser ১৬ pass, Chromium ৬৯/৬৯ pass; TypeScript, ESLint ও production build pass।** Local `main`-এ recovery ও NEXUS changes আছে; নতুন NEXUS commits GitHub-এ push করা হয়নি।

## ১. Pending branch থেকে যুক্ত করা সাতটি feature

| Feature | কী যুক্ত বা ঠিক করেছি | যাচাই | কী বাকি |
|---|---|---|---|
| Lead consent — #31 | Email, phone ও WeChat-এর follow-up/marketing preference record; grant/revoke decision; বর্তমান অবস্থা ও পরিবর্তনের history; UI, authenticated API এবং append-only database record | ৪টি consent test pass; HTTP role checks pass | Privacy review, consent-এর আইনগত প্রমাণ যাচাই এবং outbound suppression |
| Reviewed lead conversion — #32 | Authorized independent reviewer দিয়ে WON lead-কে existing customer-এর সঙ্গে যুক্ত করে RFQ ও project তৈরি; একই request পুনরায় এলে duplicate conversion আটকানো | ৩টি workflow test pass; proxy ও role checks pass | Operational approval; automatic customer creation যুক্ত করা হয়নি |
| Shipment exceptions — #33 | Shipment-এর exception case খোলা, audit/history রাখা, independent resolution এবং overdue review reminder; resolve হলে reminder সরানো | Combined workflow ও API checks pass | Carrier integration, secure document vault ও delivery proof |
| Supplier compliance — #34 | Supplier evidence reference record, independent review, expiry date ও alerts; connected compliance desk | ৩টি workflow test pass; role checks pass | Actual document upload/storage ও authenticity verification |
| Landed-cost scenarios — #35 | একই currency-তে source/reference-সহ cost assumption ও scenario comparison; immutable saved scenarios; RFQ UI/API connection | ৪টি workflow test pass; proxy checks pass | FX conversion policy ও accounting-grade landed-cost treatment |
| Purchase-order reconciliation — #36 | PO issue করার আগে source sales-order lines ও commercial snapshots মিলিয়ে server-side validation; mismatch হলে issue আটকানো; matching UI/API | Combined quote/order/PO suite pass | Amendments, partial fulfillment ও operational sign-off |
| Factory milestones — #37 | Issued supplier PO-এর production start, factory-ready ও quality-check tracking; event history; independent quality review এবং due-date alerts | Combined quote/order/shipment/PO suite-এর ৮টি test pass | External factory inspection certification ও manufacturer telemetry |

**গুরুত্বপূর্ণ repair:** Shipment branch-এ consent-এর controller, migration, tests ও UI মুছে দেওয়া ছিল। সেগুলো আলাদা repair commit-এ ফিরিয়ে এনেছি, যাতে shipment feature যোগ করতে গিয়ে consent feature হারিয়ে না যায়।

## ২. Frontend, dashboard ও navigation-এ পরিবর্তন

- Application-এর `/` route থেকে public static preview-তে চলে যাওয়া বন্ধ করে authenticated `/workspace` entry ফিরিয়েছি।
- UX branch-এর shared design tokens ও reusable stat, feedback এবং empty-state components এনেছি এবং ব্যবহার করেছি।
- Dashboard, enterprise desk ও alerts-এর মূল sidebar একই role-aware navigation তালিকা ব্যবহার করে।
- Executive cockpit-এর আলাদা shortcut সরিয়ে একটি global module finder রেখেছি।
- Command finder-এর Ctrl/Cmd+K, Escape, Tab, arrow ও Enter handling সংশোধন করেছি।
- Shared workspace identity loading যুক্ত করেছি; commission navigation-এর জন্য explicit access check রেখেছি।
- Mobile navigation disclosure যুক্ত করেছি।
- Dashboard-এ hard-coded Administrator পরিচয়ের বদলে signed-in account-এর নাম ও role দেখিয়েছি।
- Read-only role-এর জন্য customer/supplier create ও edit controls লুকিয়েছি; backend permission checks বহাল আছে।
- Customer/supplier query navigation-এর সঙ্গে directory view ও pagination/filter state মিলিয়েছি।
- Alerts loading বা unavailable হলে count-এর জায়গায় dash দেখানো হয়। API fail করলে “queue clear” দেখায় না; error ও retry option দেখায়।
- Enterprise desk-এ server-side logout ব্যর্থ হলে সফল sign-out ধরে নেওয়া বন্ধ করেছি।

প্রথম recovery delivery-তে browser automation blocked ছিল। পরবর্তী Phase 2 ও NEXUS কাজের সময় real Chromium চালিয়ে desktop, tablet ও mobile verification সম্পন্ন হয়েছে। Shared NEXUS shell-এ single visible navigation ব্যবহার করা হয়; পুরোনো specialist business components সংরক্ষিত আছে।

## ৩. API, login ও security fixes

- Real HTTP request-এ `403`/`404` ভুলভাবে `401` হয়ে যাওয়ার Spring error-dispatch সমস্যা ঠিক করেছি।
- শুধু container-এর `ERROR` dispatch-এর জন্য প্রয়োজনীয় handling দিয়েছি; সরাসরি `/error` request-এর access খুলিনি।
- এই regression ধরার জন্য real embedded servlet container ব্যবহার করে HTTP test যোগ করেছি।
- Backend login service unavailable হলে “Invalid credentials” না দেখিয়ে `503 Service unavailable` দেওয়া হয়।
- Enterprise, directory ও trading proxy-তে upstream request timeout যুক্ত করেছি।
- Directory POST request-এর payload size limit যুক্ত করেছি।
- Session authentication, role permissions, MFA এবং latest main-এর admin-assisted password reset সংরক্ষণ করেছি।
- Commission access-এ ADMIN role দিয়ে কোনো override যোগ করিনি; explicit authorized username ছাড়া access বন্ধ থাকে।
- Windows launcher ও README-তে configured `127.0.0.1` origin মিলিয়েছি, যাতে `localhost`/`127.0.0.1` mismatch-এর কারণে write request reject না হয়।

## ৪. আগে থেকে থাকা যেসব module সংরক্ষণ ও যাচাই করেছি

এগুলো সব এই recovery কাজের মধ্যে নতুন করে তৈরি করা হয়নি; latest main-এর implementation ব্যবহার করা হয়েছে।

| Module | এই কাজের ফলাফল |
|---|---|
| Customers, suppliers ও contacts | CRUD, search, pagination, entity contacts এবং consignee directory সংরক্ষিত; সংশ্লিষ্ট Java/API checks pass |
| RFQ ও supplier quotations | Structured line items, quotation revision ও sourcing workflow সংরক্ষিত; landed-cost panel সংযুক্ত |
| Customer quotations ও approvals | Independent approval ও immutable source snapshots সংরক্ষিত |
| Sales orders ও purchase orders | Existing line procurement flow সংরক্ষিত; reconciliation ও factory tracking যুক্ত |
| Logistics ও shipment documents | Existing manual ETD/ETA, milestone ও document checklist সংরক্ষিত; exception handling যুক্ত |
| Tasks ও projects | Existing task/project APIs ও alerts সংযোগ সংরক্ষিত |
| Finance, expenses ও billing | Existing finance controls, expenses, provisional contribution এবং unposted line-billing review সংরক্ষিত |
| Staff, roles ও sessions | Existing account management, role changes, revocable sessions, MFA ও password recovery সংরক্ষিত |

## ৫. Database ও local recovery

- আগের ১৫টি modified frontend file এবং untracked artifacts repository-এর বাইরে backup করেছি।
- Original local changes একটি named Git stash-এও রেখেছি।
- Authentication সরিয়ে দেওয়া preview-mode local edits business application-এ প্রয়োগ করিনি; সেগুলো backup-এ আছে।
- Existing Flyway V1–V20 migration-এর contents বদলাইনি।
- V21–V26 migration integrate করেছি; numeric version duplication নেই।
- V20 database-এ একটি synthetic customer রেখে V26 পর্যন্ত upgrade, record preservation এবং repeated migration no-op হওয়ার test যুক্ত করেছি।
- Unrelated history-সহ Supabase authentication rewrite সরাসরি merge করিনি।
- Production database, real SHL records ও existing database volumes পরিবর্তন করিনি।

## ৬. সর্বশেষ testing ও stabilization-এর ফলাফল

এগুলো সর্বশেষ local implementation-এর recorded ফলাফল; এই documentation update-এর সময় test suite আবার চালানো হয়নি। প্রথম recovery-তে Java ৭৮ ও frontend ১২টি test ছিল; পরবর্তী coverage-সহ বর্তমান ফলাফল নিচে।

| Check | সর্বশেষ recorded result |
|---|---|
| Java / Maven `clean verify` + PostgreSQL Testcontainers | ৮১ pass; failure, error ও skipped: ০ |
| Frontend handler/session/navigation/parser contracts | ১৬ pass |
| TypeScript typecheck | Pass |
| ESLint | ০ error; ০ warning; আগের ১৯টি navigation warning resolve হয়েছে |
| Next.js / Docker production build | Pass |
| Real Chromium browser matrix | ৬৯/৬৯ pass; desktop 1440px, tablet 820px ও mobile 390px-এ প্রতিটি ২৩টি |
| Browser retry / skipped / flaky | সব ০; final run প্রায় ৯৪ সেকেন্ড |
| Role permissions | ADMIN, MANAGEMENT, BD, SOURCING, LOGISTICS ও FINANCE-এর positive/negative browser checks pass |
| Session / MFA / recovery | Real login, mandatory enrollment, recovery login, replay rejection, logout ও admin password-reset revocation covered |
| Business E2E | Consent, independent conversion/compliance review, quotation approval, PO matching, factory milestones, shipment exceptions ও finance workflow covered |
| Accessibility | ছয় core screen × light/dark × তিন viewport এবং scoped dark lead dialog-এ serious/critical axe finding ০ |
| Migration upgrade | V20 → V26 pass; synthetic customer preserved; repeated migration no-op |
| Production dependency audit | Advisory ০; development tooling/runtime-image hardening বাকি |
| Latest local HTTP check | Login page, login request ও authenticated overview: HTTP 200 |
| GitHub CI | আগের pushed integration baseline-এর checks pass ছিল; নতুন unpushed NEXUS commits-এর remote CI চালানো হয়নি |

Browser checks-এ keyboard navigation, mobile menu focus/Escape, dialog focus restoration/containment, validation, CSV preview/save, two-supplier comparison, API error/retry এবং lead triage deep link covered। এই axe ফলাফল full WCAG certification, physical-device বা Safari verification নয়।

Synthetic tests আলাদা temporary Compose database-এ হয়েছে। Working local database-এ synthetic business records insert করা হয়নি। Temporary test stack ও synthetic auth/config files cleanup করা হয়েছে। Existing `.env`, credentials ও database volume সংরক্ষিত।

## ৭. বর্তমান Git delivery ও release অবস্থা

- Recovery ও Phase 2 changes integration branch-এ push হয়েছিল; [PR #39](https://github.com/niloy-datta/shl-operations/pull/39) এখনও draft।
- ব্যবহারকারীর নির্দেশে integration-এর existing commits এবং বাংলা recovery report local `main`-এ আনা হয়েছে। এই report update-এর আগের HEAD: `0baea29`।
- NEXUS source commits: `bcebff7`, `24e0da5`, `a1129cc`, `1eef6ab`, `bc7ec04`; design/delivery documentation commits: `7adf128`, `0722e57`।
- নতুন NEXUS commits বা local `main` GitHub-এ push করা হয়নি; remote `main` merge বা production deployment হয়নি।
- Original pending PR #31–37 ও #28 আলাদাভাবে আবার merge করা হয়নি।
- আগের audit-এ repository public এবং main protection/review enforcement অনুপস্থিত ছিল; settings পরিবর্তন করা হয়নি। বর্তমান live settings এই documentation update-এ পুনরায় audit করা হয়নি।
- Privacy, operational ও independent security sign-off, moderate development-tooling findings এবং runtime-image hardening release review-এর বাকি বিষয়।
- Broken branch stack দিয়ে V21 বাদ দিয়ে আগে V22–V26 apply করা database reuse করতে হলে migration-history review লাগবে। Automatic Flyway repair/out-of-order override যুক্ত করা হয়নি।

## ৮. Local-এ চালানোর নিয়ম

1. Existing private configuration থাকলে সেটি সংরক্ষণ করো। প্রয়োজন হলে `.env.example` থেকে `.env` তৈরি করে আলাদা DB/admin password ও unique MFA key configure করো।
2. Repository root থেকে চালাও:

   ```powershell
   docker compose up --build
   ```

3. খোলো: **http://127.0.0.1:3000**। Configured bootstrap account দিয়ে login করো; existing database থাকলে আগের account password-ই থাকবে।

বিস্তারিত technical evidence: [Full recovery report](docs/fullstack-recovery-20261106.md)।

প্রতিটি remote branch-এর সিদ্ধান্ত: [Branch audit](docs/recovery-branch-audit-20261106.md)।

## ৯. SHL NEXUS-এ নতুন কী implement করেছি

| অংশ | বাস্তবে যা করা হয়েছে |
|---|---|
| Shared workspace shell | Navy/royal-blue design, reusable tokens/components, breadcrumb, role-aware single visible sidebar, signed-in profile, real logout, alert entry, quick-create ও Ctrl/Cmd+K module finder |
| Light/dark ও responsive layout | Persisted theme preference, server-rendered initial theme, desktop/tablet/mobile layout; mobile navigation focus/Escape ও modal layering fixes |
| My Day | নিজের tasks/leads, role-permitted shared operational records, real counts, due-date/type/search filters, compact priority list ও expand control; unavailable API-তে error/retry |
| Executive Overview | ADMIN/MANAGEMENT team scope, independent quotation/SO/PO review links, task workload, recent updates, bounded order ও shipment watchlists |
| Customer profile | Existing CRUD/search/export-এর সঙ্গে profile drawer, saved contact details এবং customer RFQ search link |
| Supplier profile | Contact/profile drawer এবং exact supplier evidence deep link; directory-এর প্রথম ১০০ record-এর বাইরে থাকলেও ID lookup কাজ করে |
| Reviewed CSV import | Customer/supplier CSV, ১ MB / ১০০ row limit, header mapping, quoted/multiline parsing, name/email/length validation, file/directory duplicates, preview, explicit review checkbox ও real API save |
| RFQ comparison | একই item-এর latest supplier revision-এর price, MOQ, lead time, Incoterm, port ও notes side-by-side table; existing sourced landed-cost scenarios preserved |
| Shipment timeline | Existing ETD/ETA ও staff-reported departure/delivery events; verified ATD/ATA বা carrier telemetry হিসেবে দেখানো হয় না |
| Lead priority deep link | My Day থেকে lead খুললে existing qualification triage, activity ও consent detail load; dialog initial focus, Tab/Shift+Tab এবং dark contrast fixes |

### নতুন API ও security boundary

- Next `GET /api/workspace-overview?scope=personal|team` → Spring `GET /api/workspace/overview` → existing PostgreSQL business records।
- Personal tasks/leads actor/owner scoped; team scope ADMIN/MANAGEMENT-এর জন্য। অন্য role-এর team request → 403। RFQ/shipping visibility existing role policy অনুসরণ করে।
- Overview independent review links থেকে current creator বাদ দেয়; action execute করার সময়ও existing server rules বহাল থাকে। Projection-এ price, margin বা commission fields দেওয়া হয়নি।
- Next `GET /api/data/suppliers/{id}` → exact authenticated supplier lookup; existing read permissions বহাল।
- CSV existing authenticated POST, origin checks, validation ও audit path ব্যবহার করে। Save-গুলো individual; partial/unknown results স্পষ্ট দেখায়। Concurrent imports-এর database uniqueness বা bulk transaction guarantee নেই।
- Finance permissions ও explicit commission username allowlist preserved; Sen/Cris নাম দেখে নতুন grant/account তৈরি করা হয়নি।
- NEXUS increment-এ নতুন migration নেই; existing Flyway V1–V26 অক্ষত।

### Screenshots ও review routes

[Before/after gallery](.nexus-evidence/review/index.html)-তে ছয় original screen এবং ছয় screen × দুই theme × তিন viewport-এর ৩৬টি after capture আছে। আলাদা illustrative workflow screenshots disposable test database থেকে; সেগুলো live SHL data নয়। Failed runs-এর screenshots/axe JSON/traces local ignored evidence folder-এ রাখা আছে; reports public source-এ commit করা হয়নি।

| Screen | Local route |
|---|---|
| My Day | http://127.0.0.1:3000/workspace |
| Executive Overview | http://127.0.0.1:3000/workspace/command-center |
| Customer CRM | http://127.0.0.1:3000/workspace?view=customers |
| Suppliers | http://127.0.0.1:3000/workspace?view=suppliers |
| RFQ / comparison | http://127.0.0.1:3000/workspace/rfqs |
| Logistics | http://127.0.0.1:3000/workspace/shipments/line |
| Supplier compliance | http://127.0.0.1:3000/workspace/suppliers/compliance |

Design tokens ও component structure: [DESIGN.md](DESIGN.md)। Browser reports: `apps/web/playwright-report/`, `apps/web/test-results/` ও `.nexus-evidence/verified/`।

## ১০. যা এখনও implement বা approve করা বাকি

1. Structured truck/model/category master, vehicle templates, payment-term fields ও supplier product catalog/scoring।
2. Secure document vault/upload/download, authenticity review, retention policy ও cross-module document index।
3. Verified ATD/ATA, carrier feeds, telemetry এবং verified delivery proof।
4. Excel workbook import, transactional bulk save, database duplicate keys/idempotency, concurrent import handling, fuzzy/contact matching ও reviewed upsert। বর্তমান UI CSV-only।
5. Full company record search, saved filters, universal record graph ও historical pipeline conversion analytics। বর্তমান stage counts mutually exclusive funnel নয়।
6. Per-task completion-history UI, richer RFQ/shipment ownership এবং specialist screens-এর wider accessibility review।
7. Sen/Cris-এর exact account-policy mapping, operational/privacy/security sign-off এবং repository protection/tooling/image hardening।
8. Double-entry GL, tax/subledger, bank reconciliation ও commission settlement; existing billing/finance controls পূর্ণ accounting system নয়।

পরবর্তী implementation শেষ হলে এই একই নথির relevant section ও latest verification আপডেট করা হবে। Unverified feature-কে complete বলা হবে না।
