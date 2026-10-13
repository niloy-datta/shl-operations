# SHL Operations OS — Boudi-aligned implementation milestone

## Feature-by-feature code, committed separately

### CRM and customer development
- `crm_leads`: company, contact, source (website/email/WeChat/referral/manual/other),
  optional customer and staff owner, next follow-up and status.
- `/workspace/growth/leads`: real paginated search, create form and validated statuses:
  NEW → CONTACTED/QUALIFIED/LOST, CONTACTED → QUALIFIED/LOST, QUALIFIED → WON/LOST.
- Lead creation and mutation restricted to ADMIN/MANAGEMENT/BD.

### Project / job control
- `business_projects` with unique job reference, customer, optional won lead and confirmed
  sales order, responsible staff, deadline and explicit status flow.
- `project_notes` retains append-only author/timestamp evidence.
- `/workspace/growth/projects` provides owner selection, project creation, status
  transitions, record detail and notes. The backend validates customer consistency, live
  staff ownership and order completion guards.

### Expenses and financial control
- `project_expenses` supports category, currency, amount, date, author, approver and
  DRAFT → APPROVED / VOID. Self-approval is prohibited. Expenses for projects linked to
  sales orders must use that order's currency. Requires ADMIN/MANAGEMENT/FINANCE.
- `/workspace/costs/expenses` shows paginated expenses and distinct currency totals;
  no FX conversion is implied.
- `/workspace/costs/profitability` provides evidence-gated **provisional commercial
  contribution**: order contract value minus issued/received purchase-order commitments
  and approved project expenses. A number appears only if confirmed purchase quantity
  equals approved quote quantity AND no draft expense remains. Otherwise display
  "insufficient data". This **does not constitute audited profit**, booked revenue,
  cash flow, full landed cost, tax, FX profit, or commission-adjusted margin.

### Confidential commission vault
- `confidential_commissions`: STAFF / CNEE / KEY_PERSON / OTHER category, beneficiary,
  monetary basis, decimal percentage rate, backend-computed amount, status and decision
  maker. All history is stored in `confidential_commission_events`, not general audit
  records.
- `/workspace/costs/commissions`: private record entry, detail, history, approval
  actions. The UI only shows the link when the access probe returns allowed=true.
- **No role inherits commission access — not even ADMIN.** To authorize an employee,
  set `COMMISSION_AUTHORIZED_USERS` in a protected deployment environment to a
  comma-separated list of exact, case-sensitive existing staff usernames. Empty means NOBODY.
  Example placeholder: `COMMISSION_AUTHORIZED_USERS=authorized.user1,authorized.user2`.
  Use real identity-approved usernames only, not example values.
- Two different explicitly allowed accounts are needed to propose and approve a commission.
  The approval check is enforced in Java and transaction-protected PostgreSQL logic.
- Ordinary dashboard, finance and audit endpoints never query confidential beneficiary
  or commission amounts. Do not infer authorization from the existence of an ADMIN role.
- Deployers and DB superusers remain trusted privileged operators; stronger encryption at
  rest, dual control on access administration and external audit retention are production gates.

### Operational alerts
- `/workspace/alerts` aggregates pending staff tasks, CRM follow-ups, project deadlines,
  shipment ETAs and invoice due dates for the coming seven days plus overdue items.
- Each source is filtered by role; ordinary staff see own assignments and project ownership,
  financial alerts go only to finance/management/admin, shipments to logistics/sourcing/etc.
- Up to 100 deadline items; server-day is **UTC** for cross-office consistency.
- This is an **in-app, read-only action feed**. No scheduler, email, WeCom or WhatsApp
  messages are sent yet. The date of a due item is not a confirmed shipment update.
- No personal notifications are ever generated outside the application.

## Data persistence and validation

- Flyway V6 creates `crm_leads`, `business_projects`, `project_notes`.
- Flyway V7 creates `project_expenses`, `confidential_commissions`.
- Flyway V8 creates a separate commission-only history table.
- All monetary amounts use Java `BigDecimal`, with PostgreSQL numeric constraints.
- Read/write restrictions are enforced on Spring Security and service-level identity checks,
  not just hidden menus.
- Next.js server proxy routes allow only explicit GET/POST/PATCH endpoints and enforce
  session presence and same-origin checks for writes.
- GitHub Actions validates TypeScript/lint/production web build, Java Maven verify and
  Testcontainers PostgreSQL tests, including authorization and negative workflow cases.

## Manual development test

1. Pull main and copy `.env.example` to an untracked `.env`.
2. Supply distinct strong database/admin secrets and required local MFA encryption key.
3. Run `docker compose up --build`; authenticate as a real development user.
4. Create customer → CRM lead → mark contacted/qualified/won → project → add notes.
5. Record operational expense; a different finance manager approves.
6. Only after configuring two approved exact usernames in protected env, create and
   independently approve a confidential commission.
7. Check due dates in the Alerts workspace and incomplete/eligible cost projections in
   Project contribution. Finance values remain separated by original ISO currency.

## Not implemented / not safe to claim as finished

- Public site changes (Sara Huang staff section, trading product gallery, five logistics
  networks, Google Map, WhatsApp contact, CMS), and forms → CRM ingestion: blocked on
  verifying source-of-truth product, people and network data; site remains untouched.
- Organization directory, consignee profiles, lead follow-up communications and automatic
  project creation are still incomplete beyond the linked MVP.
- Production general ledger, reconciliation, taxes, cross-currency FX evidence, approval
  authorization administration and commission settlement/payout execution.
- Real freight/booking APIs, shipping documents, malware-scanned secure storage, reminders
  delivered through WeCom/email/SMS, staff invitations and file uploads.
- Enforced MFA, secure recovery, separate server-side approval logs, secret rotation,
  immutable external audit, offsite backups and full security review.
- Browser E2E tests, load tests, compliance controls, production observability and deployment.

**NOT PRODUCTION READY.** Do not load actual SHL commercial/financial data, disclose
commissions or connect public website intake until authorized and independently verified.
