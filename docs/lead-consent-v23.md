# V23 — Internal lead contact preferences and consent history

This development slice adds a **manual, append-only** channel/purpose decision log on lead records. It is not an outbound messaging service or a substitute for jurisdiction-specific privacy review.

## Boundaries

- Supported channels: EMAIL, PHONE, WECHAT. Purposes: FOLLOW_UP, MARKETING.
- Each decision is GRANTED or REVOKED, recorded with staff actor, timestamp, and required evidence/reason (maximum 500 characters). No external communication is initiated.
- An unrecorded pair is **UNKNOWN**, not permission. The latest decision per pair is displayed alongside the last 100 events.
- A GRANTED event on a WON/LOST lead is rejected; REVOKED remains possible.
- Only ADMIN, MANAGEMENT, and BD can access these endpoints, checked on the API as well as by the web session proxy.
- The API serializes edits by locking the lead row; duplicate consecutive decisions for a given channel/purpose are rejected.
- PostgreSQL rejects UPDATE and DELETE on decision history; new decisions are append-only. An audit event is recorded in the same transaction.

## API

- GET \`/api/growth/leads/{id}/consents\` returns \`{current,history}\`.
- POST \`/api/growth/leads/{id}/consents\` accepts \`{channel,purpose,decision,evidence}\` and returns 201.

The lead drawer renders current status, history, and a manual update form. Free-text evidence must be kept minimal; do not paste message contents, passwords, government identifiers, or sensitive personal information.

## Remaining work

Before any outbound email, WeCom, or phone automation: privacy/legal basis review for each destination and purpose; suppression enforcement at send time; proof verification; retention/deletion requirements; external system retries and delivery records; and independent product/security sign-off. The public repository is not approved for real SHL customer information.

## Tests

\`LeadConsentWorkflowTest\` covers unknown initial state, grant/revoke transitions, duplicate prevention, closed leads, missing leads, audit events, database immutability, BD use and denied sourcing access. CI must pass before merging this PR.
