# Northstar Core — যাচাই প্রতিবেদন

তারিখ: ১ নভেম্বর ২০২৬। Branch: `fix/supabase-spring-integration`। Base: `4cb22af`। ব্যবহারকারীর নির্দেশ অনুযায়ী এই branch `niloy-datta/shl-operations` repository-তে প্রকাশ করা হচ্ছে। Main-এ merge বা production deployment করা হয়নি। আগে থেকে থাকা পরিবর্তন আলাদা commit-এ সংরক্ষণ করা হয়েছে।

## প্রকৃত সমস্যা ও সংশোধন

1. Frontend-এর business API URL-গুলোর জন্য Next proxy এবং পূর্ণ Java backend configuration অনুপস্থিত ছিল। ফলে dashboard ও অন্য module-এ 404 হচ্ছিল। Existing URL contract রেখে server-side proxy এবং compatible Java business controllers যুক্ত হয়েছে।
2. Spring security/JWT verification, staff identity binding, datasource configuration এবং migrations সংযুক্ত ছিল না। OAuth2 resource server, JWKS verification, Flyway এবং Hibernate schema validation যুক্ত হয়েছে। পুরোনো custom password authentication আনা হয়নি।
3. Dashboard/directory-তে একটি request ব্যর্থ হলে অন্য সফল ফল হারানো, unavailable data-কে zero/empty হিসেবে দেখানো এবং misleading live indicators-এর সমস্যা ছিল। Independent request state, error state, abort cleanup ও manual Retry রাখা হয়েছে।
4. Dev server ও production build একই `.next` directory ব্যবহার করছিল; build চললে dev CSS হারাতে পারত। Development এখন `.next-dev` ব্যবহার করে।
5. Login-এর MFA lookup/code failure-এ partial password session রয়ে যেত। এখন সেটি clear হয়। Provider outage ও invalid password আলাদা status দেয়।
6. Email callback-এর allowlist check এবং email-session refresh-এর identity consistency check অসম্পূর্ণ ছিল। Verified identity মিলিয়ে session গ্রহণ করা হয়।
7. Account page-এ MFA/session components যুক্ত ছিল না এবং MFA setup-এর recovery-code UI বাস্তব provider flow-এর সঙ্গে মেলেনি। বাস্তব Supabase enroll/challenge/verify, manual TOTP key, required-policy check ও সঠিক recovery limitation দেখানো হয়।
8. Logout/password change-এ শুধু provider sign-out যথেষ্ট ছিল না; business API session revoke ছিল না। Database session revocation এবং global token issuance cutoff যুক্ত হয়েছে। Unconfirmed revocation-কে success দেখানো হয় না।
9. Staff form পুরোনো username/password payload পাঠাচ্ছিল। এখন confirmed Supabase identity UUID link করে। Java password তৈরি/সংরক্ষণ করে না।
10. Overview সব ব্যবহারকারীকে Administrator দেখাত। এখন `/api/me` থেকে প্রকৃত staff identity/role আসে; contact write action role/service যাচাই ছাড়া সক্রিয় হয় না।
11. অনেক module MFA-required 403-কে শুধু role denial দেখাত। এখন security settings-এ verification-এর নির্দেশনা দেয়। Failed logout-এ ভুল navigation এবং session refresh-এর stale response-ও সংশোধিত হয়েছে।
12. Backend input/error handling, exact contact duplicate prevention এবং stable contact pagination order যুক্ত হয়েছে। Existing historical duplicate/data মুছে ফেলা হয়নি।
13. Root env example-এ obsolete JWT secret ও conflicting PostgreSQL port ছিল। Local-only configuration, run/provision helpers এবং documentation যুক্ত হয়েছে।

## Authentication ও authorization

Supabase identity/password/TOTP/session refresh পরিচালনা করে। Next verified identity ও secure cookies ব্যবহার করে এবং same-origin mutation checks করে। Java আবার JWT signature, issuer, audience, expiry, subject/session UUID ও authenticated/non-anonymous claims যাচাই করে। ES256/RS256-এর জন্য JWKS; legacy HS256 কেবল explicit mode-এ Supabase `/auth/v1/user` confirmation ব্যবহার করে। কোনো signing secret browser-এ যায় না।

প্রতি business request-এ PostgreSQL-এর enabled staff role ব্যবহার হয়; editable JWT user metadata role দেয় না। Sensitive API এবং MFA-required staff-এর জন্য `aal2` প্রয়োজন। Commission-এর জন্য `COMMISSION_ACCESS` explicit database grant লাগে; administrator-ও স্বয়ংক্রিয় access পায় না। Unauthenticated/revoked token 401, অপর্যাপ্ত permission/MFA 403, authorization database outage 503 দেয়।

## বাস্তবে কী যাচাই হয়েছে

| পরীক্ষা | ফলাফল ও সীমা |
| --- | --- |
| Frontend TypeScript | `npm run typecheck` পাস |
| Frontend ESLint | `npm run lint` পাস; Next 15-তে বৈধ script, Next 16 deprecation notice আছে |
| Frontend route/service tests | ২৮টি পাস; provider response mock করা হয়েছে |
| Next production build | পাস; ২৮টি page generation সম্পন্ন |
| Local HTTP auth smoke | ১৬টি পাস; protected redirects, forged/legacy token rejection, CSRF, input validation, public forms |
| Backend compile/package | `mvn verify -Pintegration`-এর মাধ্যমে পাস |
| JWT/security unit tests | ৭টি পাস: RSA/EC signatures, invalid signature/issuer/audience/expiry, explicit legacy confirmation ও database-outage fail-closed |
| PostgreSQL HTTP integration tests | ৯টি পাস; local signing authority, আসল Spring Security ও PostgreSQL ব্যবহৃত হয়েছে |
| Flyway | ২২টি migration সফল; দ্বিতীয়বার migrate-এ পরিবর্তন শূন্য, existing test record অক্ষত |
| Local CSS asset | Login stylesheet HTTP 200, 26,394 bytes; এটি visual layout verification নয় |
| Local runtime | Next 3000, Java 8080, PostgreSQL 55433; Java unauthenticated request 401 দেয় |
| Owner provisioning | Existing confirmed Supabase owner identity read-only যাচাই করে শুধু local database-এ ADMIN/MFA-required binding করা হয়েছে; দ্বিতীয়বার helper চালিয়ে duplicate/overwrite হয়নি |

Integration tests customer create/edit, exact duplicate rejection, supplier search, RFQ create/detail, input rejection, persisted audit actor, database role/disabled staff, MFA policy, explicit commission grant, staff provisioning/access-change revocation এবং current/all session revocation যাচাই করে। Fresh session ID-সহ পুরোনো issued token-ও global cutoff-এর পরে প্রত্যাখ্যাত হয়।

Dashboard, quotations, sales orders, purchase orders, shipments, consignees, entities, invoices, expenses, profitability, leads, projects, alerts, tasks, staff, audit ও executive summary-এর read endpoints migrated local schema থেকে HTTP 200 দিয়েছে। এই ফলকে প্রতিটি business workflow-এর পূর্ণ acceptance test বলা হচ্ছে না।

## Pending ও সীমাবদ্ধতা

- Live Supabase password login, বাস্তব TOTP enrollment/challenge, email delivery/recovery এবং দীর্ঘমেয়াদি refresh/expiry পরীক্ষা সম্পন্ন হয়নি; private password ও authenticator ব্যবহার করা হয়নি। Local/mock ফলকে live success বলা হচ্ছে না।
- Authenticated desktop/mobile browser visual ও keyboard interaction checks বাকি। Responsive CSS ও rendering code সংরক্ষিত/পর্যালোচিত হয়েছে; HTTP/CSS tests browser verification-এর বিকল্প নয়।
- পূর্ণ quotation approval → order → procurement → shipment → billing/payment workflow approved representative data দিয়ে যাচাই বাকি।
- Production Java service, private PostgreSQL/networking, SMTP, redirect allowlist, rate-limit/password policies, backup/restore ও recovery procedure review/configuration বাকি। Live database/credentials/deployment পরিবর্তন করা হয়নি।
- Spring Data existing `PageImpl` serialization-এর ভবিষ্যৎ compatibility warning দেয়। বর্তমান consumed contact response fields integration test-এ সঠিক আছে; framework upgrade-এর সময় explicit stable DTO review প্রয়োজন।
- Commission access কারও জন্য default grant করা হয়নি। প্রয়োজনীয় ব্যক্তির পরিচয় ও অনুমোদন অনুযায়ী আলাদাভাবে grant করতে হবে।

Local run ও configuration: [README](../README.md)। Maven বিস্তারিত ফল `apps/api/target/surefire-reports` এবং `apps/api/target/failsafe-reports`-এ পাওয়া যায়; generated reports gitignored।

## পরিবর্তিত file inventory

এই তালিকায় base commit থেকে preserved frontend fixes, compatible imported backend এবং integration/security changes অন্তর্ভুক্ত। Local secret configuration ও generated build outputs অন্তর্ভুক্ত নয়।

+- `.env.example`
- `.gitignore`
- `README.md`
- `apps/api/pom.xml`
- `apps/api/src/main/java/com/shl/operations/ApiErrors.java`
- `apps/api/src/main/java/com/shl/operations/OperationsApplication.java`
- `apps/api/src/main/java/com/shl/operations/contacts/ContactController.java`
- `apps/api/src/main/java/com/shl/operations/contacts/ContactInput.java`
- `apps/api/src/main/java/com/shl/operations/contacts/Customer.java`
- `apps/api/src/main/java/com/shl/operations/contacts/CustomerRepository.java`
- `apps/api/src/main/java/com/shl/operations/contacts/Supplier.java`
- `apps/api/src/main/java/com/shl/operations/contacts/SupplierRepository.java`
- `apps/api/src/main/java/com/shl/operations/enterprise/AuditController.java`
- `apps/api/src/main/java/com/shl/operations/enterprise/AuditService.java`
- `apps/api/src/main/java/com/shl/operations/enterprise/BusinessEntityController.java`
- `apps/api/src/main/java/com/shl/operations/enterprise/CommandCenterController.java`
- `apps/api/src/main/java/com/shl/operations/enterprise/CommerceController.java`
- `apps/api/src/main/java/com/shl/operations/enterprise/ConfidentialCommissionController.java`
- `apps/api/src/main/java/com/shl/operations/enterprise/ConsigneeController.java`
- `apps/api/src/main/java/com/shl/operations/enterprise/CustomerLineQuotesController.java`
- `apps/api/src/main/java/com/shl/operations/enterprise/DedupReviewController.java`
- `apps/api/src/main/java/com/shl/operations/enterprise/ExpenseController.java`
- `apps/api/src/main/java/com/shl/operations/enterprise/FinanceController.java`
- `apps/api/src/main/java/com/shl/operations/enterprise/GrowthController.java`
- `apps/api/src/main/java/com/shl/operations/enterprise/LeadQualificationController.java`
- `apps/api/src/main/java/com/shl/operations/enterprise/LeadRoutingController.java`
- `apps/api/src/main/java/com/shl/operations/enterprise/LineBillingReviewController.java`
- `apps/api/src/main/java/com/shl/operations/enterprise/LineOrdersController.java`
- `apps/api/src/main/java/com/shl/operations/enterprise/LineShipmentController.java`
- `apps/api/src/main/java/com/shl/operations/enterprise/LineShippingDocumentsController.java`
- `apps/api/src/main/java/com/shl/operations/enterprise/LogisticsController.java`
- `apps/api/src/main/java/com/shl/operations/enterprise/OperationalAlertsController.java`
- `apps/api/src/main/java/com/shl/operations/enterprise/Pages.java`
- `apps/api/src/main/java/com/shl/operations/enterprise/ProjectProfitabilityController.java`
- `apps/api/src/main/java/com/shl/operations/enterprise/StaffController.java`
- `apps/api/src/main/java/com/shl/operations/enterprise/TasksController.java`
- `apps/api/src/main/java/com/shl/operations/security/ApiSessionController.java`
- `apps/api/src/main/java/com/shl/operations/security/MeController.java`
- `apps/api/src/main/java/com/shl/operations/security/SecurityConfig.java`
- `apps/api/src/main/java/com/shl/operations/security/StaffAccessFilter.java`
- `apps/api/src/main/java/com/shl/operations/security/SupabaseJwtDecoder.java`
- `apps/api/src/main/java/com/shl/operations/trading/RfqItemsController.java`
- `apps/api/src/main/java/com/shl/operations/trading/RfqLineOffersController.java`
- `apps/api/src/main/java/com/shl/operations/trading/TradingController.java`
- `apps/api/src/main/resources/application.yml`
- `apps/api/src/main/resources/db/migration/V10__business_entities_contacts.sql`
- `apps/api/src/main/resources/db/migration/V11__lead_activity.sql`
- `apps/api/src/main/resources/db/migration/V12__rfq_line_items.sql`
- `apps/api/src/main/resources/db/migration/V13__rfq_line_supplier_quotes.sql`
- `apps/api/src/main/resources/db/migration/V14__customer_line_quote_versions.sql`
- `apps/api/src/main/resources/db/migration/V15__website_lead_intake.sql`
- `apps/api/src/main/resources/db/migration/V16__lead_assignment_history.sql`
- `apps/api/src/main/resources/db/migration/V17__line_orders_procurement.sql`
- `apps/api/src/main/resources/db/migration/V18__line_shipment_milestones.sql`
- `apps/api/src/main/resources/db/migration/V19__line_billing_candidates.sql`
- `apps/api/src/main/resources/db/migration/V1__initial.sql`
- `apps/api/src/main/resources/db/migration/V20__line_shipment_document_checklist.sql`
- `apps/api/src/main/resources/db/migration/V21__supabase_staff_and_api_sessions.sql`
- `apps/api/src/main/resources/db/migration/V22__staff_token_revocation_cutoff.sql`
- `apps/api/src/main/resources/db/migration/V2__rfq_sourcing.sql`
- `apps/api/src/main/resources/db/migration/V3__enterprise_workflows.sql`
- `apps/api/src/main/resources/db/migration/V4__revocable_sessions.sql`
- `apps/api/src/main/resources/db/migration/V5__staff_totp_mfa.sql`
- `apps/api/src/main/resources/db/migration/V6__crm_projects.sql`
- `apps/api/src/main/resources/db/migration/V7__project_expenses_confidential_commissions.sql`
- `apps/api/src/main/resources/db/migration/V8__confidential_commission_events.sql`
- `apps/api/src/main/resources/db/migration/V9__consignees.sql`
- `apps/api/src/test/java/com/shl/operations/security/FullStackIntegrationIT.java`
- `apps/api/src/test/java/com/shl/operations/security/StaffAccessFilterTest.java`
- `apps/api/src/test/java/com/shl/operations/security/SupabaseJwtDecoderTest.java`
- `apps/api/src/test/java/com/shl/operations/security/TestIdentity.java`
- `apps/web/.env.example`
- `apps/web/next.config.mjs`
- `apps/web/package.json`
- `apps/web/src/app/api/[...path]/route.ts`
- `apps/web/src/app/api/auth/email-session/route.ts`
- `apps/web/src/app/api/auth/login/route.ts`
- `apps/web/src/app/api/auth/logout/route.ts`
- `apps/web/src/app/api/auth/mfa/[action]/route.ts`
- `apps/web/src/app/api/auth/password/route.ts`
- `apps/web/src/app/api/auth/recover/route.ts`
- `apps/web/src/app/api/auth/register/route.ts`
- `apps/web/src/app/api/auth/set-password/route.ts`
- `apps/web/src/app/auth/callback/route.ts`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/reset-password/page.tsx`
- `apps/web/src/app/workspace/account/enroll-mfa/page.tsx`
- `apps/web/src/app/workspace/account/mfa-settings.tsx`
- `apps/web/src/app/workspace/account/page.tsx`
- `apps/web/src/app/workspace/account/session-manager.tsx`
- `apps/web/src/app/workspace/alerts/alerts-desk.tsx`
- `apps/web/src/app/workspace/command-center/executive-cockpit.tsx`
- `apps/web/src/app/workspace/consignees/consignee-workspace.tsx`
- `apps/web/src/app/workspace/costs/cost-desk.tsx`
- `apps/web/src/app/workspace/costs/profitability/profitability-desk.tsx`
- `apps/web/src/app/workspace/dedup/dedup-review-desk.tsx`
- `apps/web/src/app/workspace/enterprise/enterprise-desk.tsx`
- `apps/web/src/app/workspace/enterprise/line-quotes/line-order-panel.tsx`
- `apps/web/src/app/workspace/enterprise/line-quotes/line-quote-desk.tsx`
- `apps/web/src/app/workspace/enterprise/line-quotes/line-shipment-panel.tsx`
- `apps/web/src/app/workspace/enterprise/line-quotes/shipment-document-checklist.tsx`
- `apps/web/src/app/workspace/entities/entity-registry.tsx`
- `apps/web/src/app/workspace/finance/line-billing/billing-desk.tsx`
- `apps/web/src/app/workspace/growth/growth-desk.tsx`
- `apps/web/src/app/workspace/growth/lead-routing-panel.tsx`
- `apps/web/src/app/workspace/rfqs/rfq-workspace.tsx`
- `apps/web/src/app/workspace/workspace.tsx`
- `apps/web/src/lib/api-routing.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/frontend-service.ts`
- `apps/web/src/lib/supabase/user.ts`
- `apps/web/src/lib/workspace-access.ts`
- `apps/web/src/middleware.ts`
- `apps/web/tests/api-proxy.test.cjs`
- `apps/web/tests/auth-routes.test.cjs`
- `apps/web/tests/frontend-service.test.cjs`
- `apps/web/tests/load-ts.cjs`
- `apps/web/tsconfig.json`
- `compose.yaml`
- `package.json`
- `scripts/auth-smoke.test.mjs`
- `scripts/provision-local-owner.ps1`
- `scripts/start-api.ps1`
- `docs/verification-report.md`
