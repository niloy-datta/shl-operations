# SHL Operations OS — 50-step enterprise execution roadmap

> Source of truth: `main`. Existing features stay in place. This is a backlog, not a claim that all 50 are complete. The phase-two enterprise modules have passed CI and been merged to main, but no live ERP deployment is authorized.
> All stages require server-side authorization, auditability, tests and no synthetic production data.
> **Do not enter real SHL financial, client or shipping information until production security gates are signed off.**

## Delivery stages
- **P0 — secure operating backbone:** items 01–20, with usable customer→lead→RFQ→order→shipment links.
- **P1 — finance, shipping evidence and operational depth:** items 21–35.
- **P2 — operational scale, quality, deployment and integrations:** items 36–50.
- [x] means implemented in code, **not** deployed or certified production-ready.
- [ ] means planned, not yet delivered.

### 1. Master data and CRM (01–05)
- [x] **01 — Consignee master and shipment binding (P0).** Customer-scoped address/contact profiles, create/edit/deactivate, auditable pre-dispatch shipment linkage, role checks and integration tests. UI under `/workspace/consignees`.
- [x] **02 — Scalable consignee selector (P0).** Server-side customer-bound filter/search, paginated selection and backend verification. Large-scale 100k performance remains unbenchmarked.
- [x] **03 — Business entity directory (P0).** HQ/partner/customer/supplier entity types, country/branch/registration details and immutable parent identity link. Broader organization hierarchy remains future scope.
- [x] **04 — Multiple company contacts (P0).** Department-specific buying, finance, logistics, management and compliance roles with a single active primary contact each. Consent-aware messaging remains in item 08/46.
- [ ] **05 — Safe deduplication (P1).** Partially delivered: manager-only exact-key candidate reports for customers, suppliers and customer-scoped consignees, with a read-only review desk. Pending: verified merges, foreign-key-preserving approvals, rollback ledger and scale tests. See [dedup review](dedup-review.md).

### 2. Lead intake and team workflow (06–10)
- [ ] **06 — Public website lead intake (P0).** Signed authenticated integration with spam protection, rate limits and validation; keep public site unchanged until approved.
- [ ] **07 — Lead ownership routing (P0).** Partially delivered: manager-only unassigned queue, audited manual ownership transfers, active BD workload display, manager-triggered least-loaded assignment, and append-only ownership history (V16). Pending: approved territory coverage model, multi-queue policy, concurrency/load validation and business sign-off. See [routing slice](lead-ownership-routing.md).
- [ ] **08 — Follow-up timeline (P0).** Partially delivered: append-only lead interaction notes (call/email/WeChat/meeting), next follow-up scheduling and audit history. Explicit communication consent records and outbound messaging remain pending.
- [ ] **09 — Opportunity scoring (P1).** Transparent explainable qualification and confidence; no invented probabilities.
- [ ] **10 — Lead conversion automation (P1).** Reviewed lead→customer→RFQ→project mapping with idempotency.

### 3. Sourcing and quotations (11–15)
- [ ] **11 — Structured RFQ line items (P0).** Partially delivered: audited per-RFQ item requirements, per-item supplier quotation revisions and draft/submitted/approved customer line quotation pricing with provisional margin and independent review. **V17 progress:** independently approved customer quotes create immutable line-aware sales orders, manager confirmation and supplier-specific immutable PO snapshots with separate issuance approval. **Not complete:** attachment storage, shipment/invoicing line allocations, amendments and supplier evidence review. Legacy conversion remains isolated.
- [ ] **12 — Supplier quotation revisions (P0).** Partially delivered: immutable per-line supplier pricing, sequential revisions, latest-price comparison and audit trail. Attachment references, documentary evidence review and vendor validation still pending.
- [ ] **13 — Landed-cost comparison (P1).** Incoterms, freight, insurance, duty and currency assumptions separately sourced.
- [ ] **14 — Sourcing evaluation approval (P1).** Multi-review scoring and four-eyes selection.
- [ ] **15 — Supplier compliance evidence (P1).** Trade licenses, compliance expiry and approved-vendor status.

### 4. Sales / procurement (16–20)
- [ ] **16 — Commercial document templates (P0).** Proforma and commercial quotations with versioned PDF outputs.
- [ ] **17 — Contracts and amendments (P0).** Executed terms, immutable versions and controlled change orders.
- [ ] **18 — Purchase-order line matching (P0).** Supplier PO vs sales order quantity, specification and currency verification.
- [ ] **19 — Production milestones (P1).** Factory readiness, quality inspections and delay escalations.
- [ ] **20 — Partial fulfillment (P1).** Split orders, multiple POs/shipments and controlled completion rules.

### 5. Freight / shipping operations (21–25)
- [ ] **21 — Secure shipping document vault (P0).** Private object storage, malware scans, signed URLs, strict file limits and audit events.
- [ ] **22 — Shipping-document checklist (P0).** BL/AWB, invoice, packing list, COO, insurance and missing-evidence alerts.
- [ ] **23 — Container tracking (P1).** Partially delivered V18: manual shipment booking from issued line POs with ETD/ETA, departure/delivery timestamps, immutable source-line allocation and append-only status events. Pending carrier/vessel/container reference model, verified external tracking feeds, source timestamps and claims workflows.
- [ ] **24 — Milestone exceptions (P1).** Customs hold, transshipment, damage and dispute case handling.
- [ ] **25 — Delivery proof and acceptance (P1).** Signed POD, customer acknowledgement and linked claim workflow.

### 6. Finance and control (26–30)
- [ ] **26 — Double-entry general ledger (P0).** Periods, chart of accounts, balanced immutable postings and journal approvals.
- [ ] **27 — Customer/supplier subledgers (P0).** V19 partial: internal line-aware billing review candidates from fully delivered supplier POs, immutable sell-price snapshots and independent review; no legal invoices or GL postings. Pending invoice allocations, credits/debits, ageing, tax policy and subledger journals.
- [ ] **28 — Bank reconciliation (P1).** Import-only statement matching with exception review and audit controls.
- [ ] **29 — FX/landed-cost evidence (P1).** Rates with sources and timestamps; no unapproved cross-currency totals.
- [ ] **30 — Tax/compliance treatment (P1).** Configurable tax rules reviewed by qualified jurisdiction specialists.

### 7. Confidential payments and executive oversight (31–35)
- [ ] **31 — Commission settlement ledger (P0).** Authorized accrual, payment status and duplicate payout prevention, without exposing confidential details to general reporting.
- [ ] **32 — Commission approval administration (P0).** Dual-control grants, periodic recertification and emergency revoke.
- [ ] **33 — Budget and cost centers (P1).** Team/project budgets, caps and variance explanations.
- [ ] **34 — Margin bridge dashboard (P1).** Contract to realized margin with auditable cost sources and unavailable-data flags.
- [ ] **35 — Executive exception cockpit (P1).** Partially delivered: management-only live operational snapshot, overdue projects, shipments, invoices, open tasks, outstanding currency balances. Risk-adjusted profit and dispute casework still outstanding.

### 8. Identity / security (36–40)
- [ ] **36 — Mandatory MFA policy (P0).** Enrollment, role-based enforcement, step-up approval authentication and safe reset.
- [ ] **37 — Account recovery (P0).** Dual-approved secure reset, hard session revocation and tamper-evident logs.
- [ ] **38 — Sensitive data isolation (P0).** At-rest encryption design, key rotation, export permissions and tenant boundaries.
- [ ] **39 — Threat defenses (P0).** Reverse proxy rate limits, origin checks, CSRF review, security headers, abuse alerting.
- [ ] **40 — Independent security audit (P0).** SAST/SCA, penetration testing, remediation and production gate sign-off.

### 9. Reliability / reporting (41–45)
- [ ] **41 — E2E browser tests (P1).** Auth, CRM, RFQ, fulfillment and finance flows in a private test environment.
- [ ] **42 — API contract and load tests (P1).** Validation regressions, pagination scale, role matrix and performance budgets.
- [ ] **43 — Safe observability (P1).** Structured logs, metrics, traces and PII-secret scrubbing with retention rules.
- [ ] **44 — Verified encrypted backups (P0).** Offsite copies, scheduled recovery drills, RPO/RTO and disaster runbook.
- [ ] **45 — Production CI/CD controls (P1).** Protected releases, SBOM, pinned build inputs, migrations and rollback plans.

### 10. International operations and rollout (46–50)
- [ ] **46 — WeCom/email notifications (P1).** Opt-in channels, trusted integration credentials, retry queue and delivery tracking.
- [ ] **47 — SHL public-site CMS alignment (P1).** Approved Sara Huang profile, trading catalog, networks/maps and published content without fake facts.
- [ ] **48 — Localization / timezone support (P2).** English-first, optional bilingual, UTC storage and per-user display rules.
- [ ] **49 — Accessibility and UX design system (P1).** Keyboard-only interactions, mobile workflows, error recovery and WCAG audit.
- [ ] **50 — Go-live readiness and pilot (P0).** Data migration trial, acceptance testing, separation of duties, legal/compliance approvals and rollback exercise.

## Milestone 01 acceptance notes
- Flyway `V9__consignees.sql` creates customer-bound recipients and nullable shipment relation.
- Java `ConsigneeController` owns creation, search, update and restricted access; `LogisticsController` enforces active customer matching before departure.
- Existing shipments remain valid with `consignee_id = NULL`, ensuring backward compatibility; compulsory assignment is a separate product policy decision.
- `ConsigneeWorkflowTest` tests create, update, customer immutability, mismatch/inactive guards, linked milestones and lock after departure.
- UI creates/edits master data and assigns recipients to booked shipments. Recipient selection queries are customer-scoped and paginated; the shipment overview still shows the 100 most recent shipments and needs a separate shipment-search enhancement before production scale.
- No unreviewed public website integration, external messaging, file uploads or actual payment execution introduced.

## Engineering quality gates
1. No live data before approval.
2. All privilege checks are server-side, with negative-role integration tests.
3. DB writes use transactions and migrations, financial amounts use decimal types and immutable history where appropriate.
4. Each vertical slice needs UI, API, test coverage, documentation, and a successful CI build.
5. Product owner and operations stakeholders approve workflow semantics before production rollout.

## Phase two UI milestone (merged to main)
- Real multi-entity business registry: `/workspace/entities` with create/edit for approved staff and department contact maintenance.
- Executive command cockpit: `/workspace/command-center` with source-based KPI cards, exceptions, outstanding invoices and action queues. Confidential commissions excluded.
- Premium accessible public design experience: `/docs/demo/enterprise.html` source preview, no database, fake records, auth or API calls.
- Any static showcase deployment is **not** a launch of the authenticated operations platform; it must remain clearly labeled as an interface tour.

### Lead timeline addition
- Flyway V11 records internal CRM lead activities with a typed interaction label, staff actor, notes and optional future follow-up.
- The lead drawer can log activities and update the next follow-up; the API forbids scheduling on won/lost leads.
- No external email, WhatsApp, WeCom, or SMS integration is connected. Logging an activity is not proof of message delivery.

### Customer quotation versioning and independent review (V14)
- Separate `customer_line_quotes` / `customer_line_quote_items` capture all RFQ lines with the source supplier revision ID, cost snapshot, proposed selling price, totals, version and decision history.
- Draft creation checks source revision ownership/freshness, MOQ and non-negative provisional contribution, rejecting duplicate/omitted RFQ lines and already-approved deals.
- The creator must submit a draft; an independent ADMIN or MANAGEMENT user reviews and approves/rejects it. Supplier quote amendments are frozen during submitted/approved review. Old line snapshots are immutable at the database layer.
- New UI: `/workspace/enterprise/line-quotes?rfqId=<uuid>`; accessible from RFQ drawer. No live quote sending, automatic sales order, purchase order, invoice or settlement results from approvals.
- Legacy one-header commercial quote/order endpoints explicitly refuse structured line-price RFQs. A line-aware order and procurement vertical slice is still required before production rollout.
