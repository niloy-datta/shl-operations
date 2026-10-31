# V22 — Explainable lead qualification triage (development only)

This is an internal **read-only** score for existing CRM lead records at
GET /api/growth/leads/{lead-id}/qualification. It is a deterministic
workflow-readiness heuristic, **not** a machine-learned conversion
probability, risk model, customer credit rating or approval.

## Rules (open leads only, 0–100)

| Already-recorded signal | Points |
| --- | ---: |
| Manually set to QUALIFIED | +45 |
| Or manually set to CONTACTED (mutually exclusive) | +25 |
| Assigned staff owner | +15 |
| Contact email recorded | +5 |
| Linked customer master | +15 |
| Next follow-up set for today or later (UTC) | +10 |
| At least one internal CRM activity recorded | +10 |

Bands: LOW under 40, MEDIUM 40–74, HIGH 75–100. A high score means
**more workflow signals are already recorded**, not that the deal will close.
Missing or overdue follow-up dates do not earn points. WON and LOST leads
are returned as CLOSED with no numeric score. Scores are recalculated on
each read, never saved as authoritative business data. The API returns
transparent signals, suggested next actions and a plain-language disclaimer.

## Security, UX and testing

- Only existing ADMIN, MANAGEMENT and BD roles can call this endpoint.
- It uses current lead permissions; it does not expand record visibility.
- The Next.js same-origin session proxy explicitly allowlists the GET path.
- The CRM detail drawer shows the score and reasons; no external messages
  or automated customer decisions are triggered.
- PostgreSQL Testcontainers tests cover updated scores, closure, missing
  records, negative-role access and read-only audit behavior.

## Remaining roadmap #09 work

Management must approve the weights and operational decision thresholds,
monitor bias/false signals and validate use in synthetic staging. No
confidence interval is invented. This milestone is **partial**.

No real SHL data or production deployment is authorized until the
[release gates](production-release-gates.md) pass.
