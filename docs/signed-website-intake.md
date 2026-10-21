# Signed SHL public website → CRM lead intake (staging-only)

This feature is code-complete for its **first isolated backend vertical slice**; it is **not enabled on the public website**, is **not a production release**, and is **not authority to load SHL records**.

## Internal API

`POST /api/integrations/website/leads` with `Content-Type: application/json`.

Headers:
- `X-SHL-Timestamp`: Unix epoch seconds (5-minute clock-skew window)
- `X-SHL-Signature`: `sha256=<lowercase HMAC-SHA256 hex>`

Signature input is the UTF-8 timestamp, a single newline byte, then the **exact unmodified JSON body bytes**. Secret is the high-entropy env variable `SHL_WEBSITE_INTAKE_SECRET`, at least 32 characters. If unset, endpoint fails closed with 503. The integration is exempt from staff session authentication **only on this exact route**; HMAC is required on every call.

Example body (fictional only):

```json
{
  "source":"freight_quote",
  "externalSubmissionId":"submission_20261021_abcd_1234",
  "companyName":"Example Company",
  "contactName":"Example Person",
  "contactEmail":"example@example.test",
  "subject":"Freight quotation request",
  "description":"Synthetic test message"
}
```

Sources supported: `contact`, `freight_quote`. Unique `(source,externalSubmissionId)` guarantees idempotency: first submission 201; identical replay 200 and `duplicate:true`; changed content with the same ID 409. Unauthenticated or stale signatures 401. Payload limit 8192 bytes. The request only creates a CRM lead and audited intake record. It **does not send messages, assign staff, issue quotations or approve payments**.

## Staging integration checklist

1. **Do not expose Spring Boot API or PostgreSQL directly to the Internet.** Install a dedicated HTTPS gateway with exact-route ingress policy and layered WAF/rate limiting, and check threat model and replay controls. A timestamp only provides a narrow replay window; the database idempotency key prevents duplicate creation.
2. In approved private staging, generate and securely store the shared secret (minimum 256 bits of entropy), inject it into **API service only** via secret manager. Do not put it in the browser, repo, logs or public `.env`.
3. Make a secure Cloudflare Worker (or another existing server-side form handler) compute HMAC over **the same exact bytes** before forwarding. Persist a unique submission ID across retries. The worker must preserve the existing email delivery path when CRM is temporarily down.
4. Configure per-source spam checks and regional privacy/retention policy. Limit outbound egress to the approved HTTPS endpoint, and rotate the signing secret safely in a controlled change.
5. Test signed intake with synthetic contacts, rejection, duplicates, outages, audit/CRM visibility and recovery. Route alerts to the operations owner.
6. Confirm manager approval, mandatory MFA, recovery drills, independent security review and rollback plan before production rollout.

The public `shl-global` site is **untouched**. This code is backward-compatible and opt-in.

## Test coverage

`WebsiteLeadIntakeTest`: valid signature, one-time creation, replay/idempotency, conflicting payload, bad signature, expired timestamp, invalid fields. CI uses Testcontainers/PostgreSQL. Follow-up tests: full HTTP authorization using unauthenticated request through proxy, clock sync errors, concurrent duplicate requests, URL WAF behavior and integration-level Worker retry behavior.

## Remaining modules (not implemented by this slice)

- Safe line-aware RFQ → order and purchase linking; complete freight document vault including quarantine, malware scanning, permissions and audited downloads.
- Finance double-entry reconciliation, commission settlement and secure approvals.
- AI/RAG **after** secure documents and isolation: background ingestion, chunking, pgvector/hybrid retrieval, ACL checks, citation evaluation, prompt-injection tests and cost tracking.
- Async queues, durable notifications, automated backups/restore verification, tracing and performance budgets.
- Account recovery, mandatory MFA, externally reviewed production security and a company-authorized go-live.

See `docs/enterprise-50-step-roadmap.md` for the other tracked dependencies.
