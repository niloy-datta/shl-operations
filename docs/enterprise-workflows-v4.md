# SHL Operations OS - Enterprise workflow foundation

Implemented on the feat/enterprise-operations-platform development branch.

## Implemented scope

1. Existing customers, suppliers, RFQs, supplier offers, guarded RFQ states.
2. Versioned customer quotations from READY_FOR_QUOTE RFQs. Submission and explicit ADMIN/MANAGEMENT approval. One approved quote per RFQ.
3. Sales orders created from approved quotations; status transitions from DRAFT to CONFIRMED to IN_PROGRESS to COMPLETED. Completion requires delivered shipments and no outstanding shipments.
4. Purchase orders use an offer from the same RFQ, respect supplier MOQ, and snapshot price and currency. DRAFT to ISSUED to RECEIVED.
5. Shipments linked to confirmed sales orders, optionally issued purchase orders. Milestone history is retained by the API.
6. Currency-aware invoice tracking and payment allocation, protected against overpayments, duplicate payment references and voiding paid invoices. Not a full accounting ledger.
7. Assigned operational tasks with due dates, priorities, task progress and one optional linked RFQ/order/shipment.
8. Named staff accounts, access roles, self-service password rotation, audit entries on core business writes.
9. Authenticated Next.js module pages, creation forms, status controls, paginated lists and record details. No invented KPIs.
10. Local PostgreSQL archive backup helper. Archive validation is not a restore drill.

## Access matrix

| Module | Read | Write |
| --- | --- | --- |
| Customers/suppliers | All roles | ADMIN, MANAGEMENT, BD, SOURCING |
| RFQs and offers | ADMIN, MANAGEMENT, BD, SOURCING | Same roles |
| Quotations | ADMIN, MANAGEMENT, BD, SOURCING | Create/submit: ADMIN, MANAGEMENT, BD. Approve/reject: ADMIN, MANAGEMENT |
| Sales orders | All roles | ADMIN, MANAGEMENT, BD |
| Purchase orders | ADMIN, MANAGEMENT, SOURCING, LOGISTICS, FINANCE | ADMIN, MANAGEMENT, SOURCING |
| Shipments | ADMIN, MANAGEMENT, LOGISTICS, SOURCING | Same roles |
| Finance and payments | ADMIN, MANAGEMENT, FINANCE | Same roles |
| Tasks | Own (management/admin see all) | Create: admin/management. Progress: assignee or manager |
| Staff accounts | ADMIN | ADMIN |
| Account password | Own session | Own session with current password |
| Audit trail | ADMIN, MANAGEMENT | Append through application workflows only |

All writes are validated by Spring Boot and PostgreSQL constraints, not merely the interface. User-specific permissions are enforced on the API even when navigation links are hidden.

## Local end-to-end workflow

1. Copy .env.example into .env, configure unique secrets, run docker compose up --build, sign in as bootstrap admin.
2. Add customer and supplier. Create an RFQ, transition to SOURCING, add offers, mark READY_FOR_QUOTE.
3. Create a quotation, submit and approve as management.
4. Create sales order from approved quote; confirm.
5. Create purchase order from matching supplier offer; issue it.
6. Book shipment against sales order and issued PO. Record transit and delivery.
7. Create an invoice, issue it, allocate payments without exceeding balance.
8. Assign tasks, review audit history, and administer staff roles.

The client linked-record pickers show up to 100 results. Large searchable selectors, file evidence and batch operations are future enhancements.

## Technical design

Browser to authenticated Next.js proxy to private Spring Boot modular monolith to private PostgreSQL. Flyway V3 adds customer_quotes, sales_orders, purchase_orders, shipments, shipment_milestones, invoices, invoice_payments, work_tasks, audit_events and staff metadata. Financial and state mutations lock parent rows and run in transactions.
The existing public static GitHub Pages preview remains disconnected from all company data.

Automated checks: Next.js TypeScript, ESLint and production build; Java Maven verify and PostgreSQL Testcontainers integration tests covering the commercial chain and role restrictions.

## Production blockers - do not load company data yet

- Replace bootstrap Basic-password sessions with managed identity, multi-factor authentication, rate limiting, revocable sessions, strong password and account recovery policies and HTTPS/TLS.
- Enforce field- and branch-specific permissions, finance segregation of duties, independent two-person approval and sensitive-data access auditing.
- Build tamper-evident externally stored audit trails. Current database administrators can edit records directly.
- Secure document storage, malware scanning, signed links, shipping papers, QC and supplier contract records.
- Build a proper double-entry accounting ledger, reconciliation, tax, FX transaction evidence, credit adjustments and commissions.
- Real supplier award policies, Incoterms, freight rate/booking APIs and workflow integrations.
- Production monitoring, incident response, secrets management, penetration testing, vulnerability scans, load testing.
- Encrypted offsite backups and proven isolated restores, disaster recovery, accessibility and browser E2E tests.
- Robust business UAT and deployment security gates.

This is a significant coded enterprise foundation, not a certified production-grade or million-dollar finished application.
