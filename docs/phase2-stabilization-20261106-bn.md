# SHL Operations — Phase 2 stabilization ও release review

তারিখ: ৬ নভেম্বর ২০২৬। Branch: `integration/fullstack-recovery-20261106`। Review: [Draft PR #39](https://github.com/niloy-datta/shl-operations/pull/39)।

আগের সাতটি feature পুনরায় implement বা merge করা হয়নি। Existing Next.js → Spring Boot → PostgreSQL implementation-এর usability ও integration fixes করা হয়েছে। এটি production approval নয়।

## বাস্তবে কী ঠিক হয়েছে

- **Logistics workflow:** LOGISTICS account commercial quotation API-তে 403 পেত এবং সেখান দিয়ে shipment booking-এ পৌঁছাতে পারত না। `/workspace/shipments/line` desk, সীমিত issued-PO lookup এবং exception/document alert deep link যুক্ত হয়েছে। একই shipment panel reuse হয়েছে; price/margin lookup-এ প্রকাশ হয় না। Search, shipment pagination ও refresh আছে; আগের shipment records-ও রাখা হয়েছে।
- **Loading race:** দ্রুত request শেষ হওয়ার পরে queued animation frame loading flag আবার true করত। Enterprise, Growth, RFQ list/details, Costs, Shipping ও supplier-reference list-এর সাতটি effect-এ pending frame cancel করা হয়েছে। Real API ও delayed browser frame দিয়ে regression test আছে।
- **Navigation/session:** Growth, RFQ, Costs, contribution ও cockpit menu shared role-aware navigation ব্যবহার করে। ১৯টি full-page login assignment central router event দিয়ে প্রতিস্থাপিত হয়েছে। Commission access explicit grant ছাড়া দেখায় না। Mobile menu disclosure ও sign-out ব্যবহারযোগ্য।
- **Daily workflow:** Dashboard-এ role অনুযায়ী alerts, leads/follow-up, RFQ, shipment ও billing review-এর সরাসরি priority links; signed-in account initial; বাস্তব database totals।
- **Forms/accessibility:** Shared dialog focus trap, Escape, initial focus, focus restoration ও scroll lock; customer, enterprise, growth ও RFQ dialogs-এ ব্যবহার। Dashboard ও alerts-এর পরীক্ষায় পাওয়া text contrast ঠিক হয়েছে।
- **Truthful feedback:** পুনরায় reconciliation ব্যর্থ হলে পুরোনো green match থাকে না। Evidence/exception loading বা error-কে empty success বলা হয় না। Closed lead-এ নতুন opt-in disable; quotation action ও supplier self-review controls existing server rule অনুযায়ী সীমিত। Staff form-এর ভুল “MFA not implemented” লেখা সরানো হয়েছে।
- **Browser CI:** Chromium + axe, desktop/tablet/mobile projects, normal password/MFA enrollment ও server-issued session, failure screenshot/trace এবং HTML/JSON report। `.env.e2e` ও auth-state ignored; Docker build context থেকেও বাদ। Unique Compose project-এ tmpfs PostgreSQL ব্যবহার হয়।

## যাচাইয়ের পরিধি ও ফলাফল

| Check | ফলাফল |
|---|---|
| Java 25 / Maven clean verify / PostgreSQL Testcontainers | ৭৮ pass; failure/error/skipped ০ |
| Frontend proxy/session/navigation contracts | ১৩ pass |
| TypeScript ও source ESLint | Pass; warning/error ০ |
| Docker Next.js production build | Pass |
| Desktop Chromium 1440×1000 | ১৯ pass; retry/skipped ০ |
| Tablet Chromium 820×1180 | ১৯ pass; retry/skipped ০ |
| Mobile Chromium 390×844 | ১৯ pass; retry/skipped ০ |
| Runtime dependency npm audit (`--omit=dev`) | ০ advisory; পুরো Docker image-এর security certification নয় |
| V1–V26 Phase 2 migration diff | কোনো পরিবর্তন নেই |

Browser suite real login, invalid credentials, mandatory enrollment, recovery-code replay rejection, logout, six-role API/navigation restrictions, commission denial, customer form/save/search, command keyboard, alert outage/retry, expired sessions, CRM/consent/reviewed conversion, independent compliance review, RFQ/landed cost, quotation approval/self-approval denial, SO/PO reconciliation/issue, factory progress, logistics booking/exception/review/delivery এবং finance billing candidate persistence যাচাই করে। কিছু fixture API দিয়ে তৈরি; তারপর UI দিয়ে workflow চালিয়ে API persistence পরীক্ষা করা হয়। Success API mock করা হয় না; কেবল unavailable-alert test-এ intentional 503 inject করা হয়।

Axe scan শুধু dashboard ও alerts-এর serious/critical WCAG A/AA findings gate করে। এটি সব page-এর পূর্ণ accessibility certification নয়। Desktop/mobile dashboard screenshot-ও চোখে দেখে যাচাই করা হয়েছে। Chromium mobile viewport physical phone বা Safari পরীক্ষা নয়।

চূড়ান্ত local Chromium run: **৫৭/৫৭ pass**, ৫৭ সেকেন্ড; প্রতিটি viewport-এ একই ১৯টি test। Failure screenshot/trace আগের failed runs থেকে সংরক্ষিত; pass run-এ desktop/tablet/mobile dashboard ও shipping screenshots এবং axe JSON reports আছে।

## Review ও release blockers

মূল PR-এর ৯০টি path-এর review map ও findings: [PR #39 review map](phase2-pr39-review.md)। নতুন Phase 2 files ওই original inventory-এর অতিরিক্ত।

- Repository public; existing release policy private repository চায়। Main protection API 404 এবং rulesets empty; required review/status checks enforce হচ্ছে না। PR audit-এর সময় approving review ছিল না। Settings বদলানো হয়নি।
- Dependabot security updates, secret scanning ও push protection disabled পাওয়া গেছে। Independent security/privacy/operational sign-off বাকি। Full-history secret audit বা penetration test দাবি করা হচ্ছে না।
- Full npm audit-এ minimatch → TypeScript ESLint chain-এর ৮টি moderate affected development package আছে (`GHSA-g3hv-75wg-m249`)। Suggested cross-major eslint-config-next downgrade প্রয়োগ করা হয়নি। বর্তমান Dockerfile build workspace-এর dev dependencies-ও runtime image-এ রাখে; tooling/image hardening বাকি।
- Consent outbound suppression, secure document upload/vault/authenticity check, carrier feeds, verified delivery, accounting posting/GL এবং settlement এই কাজের মধ্যে সম্পূর্ণ হয়নি।
- Previously broken V22–V26-without-V21 database history-তে automatic Flyway repair/out-of-order override নেই। Clean V20 → V26 upgrade test বহাল।

## পুনরায় browser test চালানো

Repository root থেকে নতুন synthetic configuration তৈরি করো; script existing `.env.e2e` overwrite করে না:

```powershell
node scripts/create-e2e-env.mjs
docker compose --project-name shl-e2e-review --env-file .env.e2e -f compose.yaml -f compose.e2e.yaml up --build --wait --wait-timeout 180
Set-Location apps/web
npm ci --no-audit --no-fund
npx playwright install chromium
node --env-file ../../.env.e2e node_modules/@playwright/test/cli.js test
```

Linux runner browser system dependencies-সহ install করে। Windows-এ WSL Docker daemon ব্যবহার করলে WSL session সক্রিয় রাখো। Reports: `apps/web/playwright-report/`, `apps/web/test-results/`; earlier local failures: ignored `.e2e-evidence/`। Trace-এ synthetic credentials/session থাকতে পারে; working company data দিয়ে এই test চালিও না। CI cleanup disposable DB মুছে দেয়।

একই project name দিয়ে শুধু test stack cleanup করো:

```powershell
Set-Location ../..
docker compose --project-name shl-e2e-review --env-file .env.e2e -f compose.yaml -f compose.e2e.yaml down --volumes --remove-orphans
```

Private `.env.e2e` ও `apps/web/e2e/.auth`-এর test credentials-ও কাজ শেষে সরাও। Working `.env`, existing database volume বা real SHL records এই test ব্যবহার করে না।

## Delivery evidence

Code/test commits: `c8682a3` (shipping integration), `a524f48` (UI/loading fixes), `868ffd9` (Chromium suite/CI)। CI result ও exact delivery head PR checks-এ দেখো; এই report-এর recorded result পৃথক।

PR draft থাকবে। Main merge, production deployment, real data import এবং original #31–37-এর duplicate merge করা হয়নি। আগে থেকে untracked `IMPLEMENTED_FEATURES_BN.md` অপরিবর্তিত রাখা হয়েছে।
