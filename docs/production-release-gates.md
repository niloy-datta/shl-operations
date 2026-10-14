# SHL Operations OS — production release gates

**Release state: BLOCKED.** Passing unit tests or the local predeploy script does not mean the ERP is approved for actual customers, payments or shipping documents.

## How to run the local configuration checks

From the repository root:

```bash
cp .env.example .env
# Supply unique secrets in .env (never commit the file).
bash scripts/predeploy-check.sh
docker compose up --build
```

The script validates only local setup: no tracked `.env`, Compose syntax, and basic password/MFA-key presence. **It does not deploy, certify security, verify encryption, verify user permissions or prove recovery.**

## Release approval register (all required)

- [ ] Repository is private, secrets audited and rotated as needed; protected main branch requires reviews and passing checks.
- [ ] Mandatory staff MFA (including privileged and finance roles), authenticated recovery and step-up approvals implemented, tested and signed off.
- [ ] Production infrastructure uses HTTPS, protected private API/database networking and managed secrets; no bootstrap accounts left active without explicit policy.
- [ ] Encrypt and independently retain offsite PostgreSQL backups; restore a clean instance and document RPO/RTO evidence.
- [ ] Complete access-control regression, CSRF/origin and abuse testing, dependency/SBOM scans and independent security review.
- [ ] Complete browser end-to-end tests for staff, CRM, sourcing, order-to-cash, shipping, finance and permission-denied cases.
- [ ] Resolve financial correctness gaps: immutable double-entry ledger, reconciliations, exchange-rate evidence and commission settlement controls, or formally disable incomplete modules at rollout.
- [ ] Confirm document storage permissions, antivirus scanning, retention, upload/download audit, and signed URL expiry before enabling uploads.
- [ ] Complete monitored staging rollout with synthetic data, migrations, rollback exercise, alerting, operations runbook and independent product-owner approval.
- [ ] Obtain authorized SHL management, legal/compliance and security sign-off before production data or public application rollout.

## Separation of public demo and internal operations

The public static interface tour is not the ERP. Do not point the public demo to an internal API or publish real customer/supplier/pricing information. No automated production deployment workflow should be enabled until the above evidence has been reviewed.

## Evidence required for release

Capture CI runs and full E2E results, dated threat-model review, infrastructure network diagram, backup/restore logs, issue remediation links, rollback rehearsal and named approvers. Never store real secrets or customer records in this repository.

References: [50-step product backlog](enterprise-50-step-roadmap.md), [phase-two release constraints](phase-two-release.md), [Spring Boot actuator security](https://docs.spring.io/spring-boot/reference/actuator/endpoints.html), [GitHub branch rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets).
