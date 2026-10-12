# SHL Operations OS — boudi-aligned execution blueprint

Updated: 2026-10-12. Main branch is the development source of truth.

## Business goal
Replace disconnected spreadsheets and manual handoffs with one secure private operations system for international B2B trading, supplier sourcing, freight/logistics, finance and project teams. Public `shlshl.com` is unchanged. Public GitHub Pages previews must never contain private business data.

## Workflow map
**Trading:** customer inquiry → RFQ → supplier offers → comparative decision → internal pricing approval → sales quotation → purchase order → quality control → shipment → delivery → invoicing → closure.

**Freight:** freight inquiry → rate quotation → booking → ETD/ETA updates → shipping documents → delivery → invoice.

**Shared services:** customers, suppliers, contacts, staff tasks, attachments, searchable history, role permissions, audit events, currency and branch context.

## Delivered in private application (initial development milestone)
- Authenticated admin-only dashboard with real DB counts for customers, suppliers and RFQs.
- Customer and supplier directories: validated create/edit, search, pagination and visible-page CSV export.
- RFQ creation linked to a saved customer; fields: subject, specifications, quantity/unit, currency, target deadline.
- RFQ stages: `NEW → SOURCING → READY_FOR_QUOTE → CLOSED`. Guarded transitions; at least one supplier offer is required before ready status.
- Supplier quotation capture/upsert: supplier, unit price, minimum order quantity, lead days, notes. Offers are ordered by price only within a single RFQ currency.
- RFQ detail drawer: supplier comparison, stage controls and RFQ-specific activity entries (actor/action/time).
- Dedicated `/workspace/rfqs` trading desk; responsive dashboard, filter/search, pagination, creation and offer forms.
- PostgreSQL Flyway V2 schema with foreign keys, constraints and indexes.
- Public read-only static preview has workflow descriptions but no customer/supplier data, prices, API or persistence.

## IMPORTANT LIMITS
- The RFQ screen **does not** send quotations, create purchase orders, manage money or execute approval.
- Cheapest quoted unit price is **not** the best supplier. Compare quality, MOQ, freight, tax, inspection, payment and trade terms manually for now.
- No live FX conversion or speculative margin/profit numbers.
- RFQ activity records are **not** a replacement for global tamper-resistant audit logging.
- Bootstrap ADMIN-only authentication is for local development; no real company data or production deployment before security gate.

## Next delivery gates

### P0 — secure identity and staff workflow (before real data)
- Named staff identities, role and branch mapping (Admin, BD, Sourcing, Logistics, Finance, Management).
- MFA, session management, safe account recovery, password rotation and rate limiting.
- Server-enforced RBAC on every endpoint; Finance/commission visible only to explicitly authorized roles.
- Audit event log, protected document storage, backups/restoration, logging/monitoring and security testing.
**Acceptance:** unauthorized staff cannot read other roles' restricted records; audit/security tests pass; recovery verified.

### P1 — commercial sourcing and trading completion
- Multiple supplier quotations per RFQ, revision history and PDF/document evidence.
- Request-to-quote comparison with Incoterms, MOQ, quantity and quality/specification compliance.
- Margin/pricing approvals, outgoing customer quotation versioning, sales order and purchase order states.
**Acceptance:** one RFQ travels to approved customer quote and PO with traceable revisions and approvals.

### P1 — freight and logistics
- Shipment linked to order/project, container/BL references, origin and destination, ETD/ETA/ATD/ATA.
- Document checklist (commercial invoice, packing list, BL), milestones, assigned owner and exception alerts.
**Acceptance:** each shipment has current milestones, accountable owner, searchable documents and overdue indicators.

### P1 — project/operations tasks
- Kanban/calendar workflow, assignment, reminders, escalation and WeCom notification adapter where authorized.
**Acceptance:** tasks and reminders reflect real linked RFQ/order/shipment records, never fictitious activity.

### P2 — finance, commissions and leadership analytics
- Currency-aware receivable/payable invoices, payment allocation, reconciliation and per-transaction FX context.
- Permission-controlled gross margin, commissions and approval policy.
- Query-verified KPIs for cycle time, quote conversion, delays, gross margin and outstanding cash.
**Acceptance:** ledger totals reconcile; finance access tested; report definitions are independently auditable.

## Engineering and release checklist
1. Keep Next.js + TypeScript, Spring Boot + Java, PostgreSQL, Flyway, Docker Compose modular-monolith topology.
2. Work on `main` as requested, but require GitHub Actions web (typecheck/lint/build) + API (Maven verify).
3. Test migrations and transactional status paths with PostgreSQL Testcontainers.
4. Maintain strict separation between private operations database and public website/preview.
5. Deploy to an authenticated TLS-hosted environment only after P0 security controls and backup restore test.
