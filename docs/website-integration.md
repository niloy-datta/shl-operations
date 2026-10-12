# Future public website → CRM intake contract

This is a design draft. The existing public forms and Cloudflare Worker remain untouched.

1. The website Worker continues delivering email as it does today.
2. Once approved, it sends a validated JSON POST to a dedicated intake endpoint with separate machine credentials. It must never use a staff account or expose secrets in browser code.
3. Proposed fields: `source` (`contact` or `freight_quote`), `externalSubmissionId`, `submittedAt`, sender name, email, phone, free text, and freight fields where present. Agree on exact mappings after inspecting the actual form payloads.
4. The CRM records `source + externalSubmissionId` under a unique constraint. Retries with the same ID return the prior result; different content under the same ID is rejected and investigated.
5. A failed CRM delivery must not break the existing email path. The Worker should retry with bounded backoff or retain a durable queue and alert on repeated failure. Secrets, personally identifiable data, and payloads must not appear in logs.
6. Protect the endpoint with scoped machine authentication, TLS, body size limits, validation, replay controls, and rate limits. Test duplicate submissions and partial outages before enabling traffic.

