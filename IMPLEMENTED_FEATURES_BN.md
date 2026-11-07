# SHL Operations — কী কী implement ও integrate করা হয়েছে

তারিখ: ৬ নভেম্বর ২০২৬  
Branch: `integration/fullstack-recovery-20261106`  
Implementation delivery commit: `f3f84185a02c756dcf78b4087e01018cf68a384b`  
Review PR: [Draft PR #39](https://github.com/niloy-datta/shl-operations/pull/39)

এই নথিতে আগের recovery কাজের ফলাফল লেখা হয়েছে। নিচের সাতটি feature আগে GitHub-এর pending branch-এ ছিল; সেগুলো নতুন করে পুরোটা লেখার বদলে latest full-stack `main`-এর সঙ্গে integrate, repair এবং test করেছি। আগে থেকে থাকা কার্যকর module-গুলোও সংরক্ষণ করেছি। এটি production-ready ঘোষণার নথি নয়।

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

Keyboard ও mobile behavior-এর code পরিবর্তন হয়েছে, কিন্তু browser automation blocked থাকায় এগুলোকে browser-tested বলা হচ্ছে না। সব specialist desk-এর আলাদা sidebar এই কাজের মধ্যে consolidate করা হয়নি।

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

## ৬. Testing-এর ফলাফল

নিচের ফলাফল implementation delivery-এর সময় যাচাই করা হয়েছিল। বর্তমান remote CI state দেখতে PR-এর checks tab ব্যবহার করতে হবে।

| Check | Recorded result |
|---|---|
| Java 25 / Maven `clean verify` + PostgreSQL Testcontainers | ৭৮টি test pass; failure, error ও skipped: ০ |
| Frontend handler/session/navigation contracts | ১২টি test pass |
| TypeScript typecheck | Pass |
| ESLint | ০ error; ১৯টি navigation warning |
| Next.js production build | Pass |
| Authenticated/anonymous page-route HTTP checks | ২৫টি URL যাচাই |
| Real backend API reads through Next.js | ২৮টি API read যাচাই |
| Additional staff roles with MFA | ৫টি role-এর positive/negative access matrix pass |
| Session security | Recovery-code replay rejection ও logout revocation pass |
| Migration upgrade | V20 → V26 pass; existing synthetic customer preserved |
| Offline release-gate tests | ১০টি case pass |
| Bash, PowerShell launcher ও static preview JavaScript syntax | Pass |
| GitHub CI at delivery commit | Web, API, scripts, Windows launcher, offline release gates ও isolated full-stack smoke pass |
| Responsive/keyboard/visual browser test | Blocked; browser host unavailable এবং native automation browser URL নিশ্চিত করতে পারেনি |

## ৭. GitHub delivery ও কী বাকি আছে

- Changes logical commits-এ organize করে integration branch push করেছি এবং [Draft PR #39](https://github.com/niloy-datta/shl-operations/pull/39) খুলেছি।
- Original pending PR #31–37 এবং #28 merge করিনি।
- `main` merge বা production deployment করিনি।
- Delivery-এর সময় repository public ছিল এবং `main` branch protection পাওয়া যায়নি; সেই settings পরিবর্তন করিনি।
- Privacy, operational ও independent security sign-off বাকি।
- Double-entry general ledger, tax/subledger, bank reconciliation, secure document vault, carrier feeds, verified delivery proof ও commission settlement সম্পূর্ণ হয়নি।
- Stable main-এর V20 schema থেকে upgrade test করা হয়েছে। Broken branch stack দিয়ে আগে V22–V26 apply করা কিন্তু V21 বাদ পড়া database পুনরায় ব্যবহার করতে হলে migration-history review লাগবে। কোনো automatic Flyway repair/out-of-order override যুক্ত করিনি।

## ৮. Local-এ চালানোর নিয়ম

1. Existing private configuration থাকলে সেটি সংরক্ষণ করো। প্রয়োজন হলে `.env.example` থেকে `.env` তৈরি করে আলাদা DB/admin password ও unique MFA key configure করো।
2. Repository root থেকে চালাও:

   ```powershell
   docker compose up --build
   ```

3. খোলো: **http://127.0.0.1:3000**। Configured bootstrap account দিয়ে login করো; existing database থাকলে আগের account password-ই থাকবে।

বিস্তারিত technical evidence: [Full recovery report](docs/fullstack-recovery-20261106.md)।  
প্রতিটি remote branch-এর সিদ্ধান্ত: [Branch audit](docs/recovery-branch-audit-20261106.md)।
