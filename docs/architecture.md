# Architecture and milestone boundary

## Audit

The supplied prompt identifies `niloy-datta/shl-global` as the public site. No local copy exists in this workspace, so its Next.js, Cloudflare Worker, and CMS details are treated as supplied context rather than verified code facts. This project is isolated in `shl-operations`; no public site code, DNS, deployment, or company records were accessed.

Local tooling: Node 24.19.0, npm 11.17.0, Java 21.0.12, Git 2.55.0. Java 25, Maven, Docker, and npm registry connectivity were unavailable for execution. The application targets Java 25 through the container image; Spring Boot 4.1.1 supports it. Dependency versions should be rechecked during the first connected build.

## Current topology

Browser → Next.js server (loopback:3000) → private Spring Boot API → private PostgreSQL.

The browser receives an encrypted, HTTP only, same site session cookie. The web server holds an authenticated Basic credential within this short lived encrypted cookie and relays requests to the private API. The API authenticates against `staff_users`, requires ADMIN for current business endpoints, and stores contacts and early-stage RFQ sourcing records in PostgreSQL. No public API port is mapped. In production, replace this bootstrap arrangement with managed identity, MFA, individual roles, audit logging, rotation, and transport security.

## Tables and relationships

`staff_users(id, username, password_hash, role, enabled, created_at)`
`customers(id, name, email, phone, country, created_at)`
`suppliers(id, name, email, phone, country, created_at)`
`rfqs(id, reference, customer_id, subject, details, quantity, unit, currency, deadline, status, created_at, updated_at)`
`supplier_offers(id, rfq_id, supplier_id, unit_price, moq, lead_days, notes, updated_at)`
`rfq_activity(id, rfq_id, actor, action, detail, created_at)`

RFQs reference customers; supplier offers reference RFQs and suppliers. A bounded RFQ activity log records changes to this sourcing module, but is not a comprehensive audit system. Later modules should reference stable UUIDs through foreign keys: customer inquiries → leads → customer RFQs → supplier RFQs → supplier quotes → quote comparisons → customer quotes → approvals → orders/projects → tasks/shipments. Finance and commission data require separate authorization policies and auditable domain services before implementation.

## Modules and decisions

- Start with a modular monolith. `security` owns identity; `contacts` owns customers and suppliers; `trading` owns RFQ/offer workflows. Add `sales`, `procurement`, `projects`, `logistics`, `finance`, and `commissions` as domain packages as their workflows become real.
- Flyway owns schema changes; Hibernate validates mappings and must never modify a production schema.
- Backend authorization is mandatory even when controls are hidden in the UI. Contacts use bounded pagination and request validation.
- Dashboard totals come from the database. Empty views are intentional and no records are seeded.
- This milestone avoids publishing private APIs, asynchronous services, message brokers, or public website changes. The separate public static preview displays workflow illustrations only, with no business records or API integration.

## RFQ design and status controls

A customer-linked RFQ moves NEW → SOURCING → READY_FOR_QUOTE → CLOSED. The READY_FOR_QUOTE transition requires at least one saved supplier offer; CLOSED RFQs cannot accept changes. Supplier offers are quoted in the RFQ currency and sorted by unit price as a convenience, not an automated procurement recommendation. No financial authorization, vendor award, outward quotation, or purchase order is implemented. Server-side ADMIN authorization applies to all RFQ endpoints.

## Before staging

Verify actual dependencies and builds, run persistence and security integration tests, add user provisioning and recovery, fine grained permissions, MFA, audit events, document security, account lockout/rate limits, backups with restoration drills, observability, API versioning, and a security review. A dedicated secret manager and TLS termination are required. No production readiness is claimed.

