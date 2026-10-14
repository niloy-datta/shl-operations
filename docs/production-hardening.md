# Release hardening — deployment mode and encrypted backups

**Status: code implemented on a review branch, not deployed or certified.**

## Production launch prevention

Set `SHL_DEPLOYMENT_MODE=production` or activate a Spring profile named `prod` or `production` only on an approved, isolated production environment. At startup, the API will reject production if `MFA_ENFORCEMENT_ENABLED` is not true or its `MFA_ENCRYPTION_KEY` is not a valid 64-character hexadecimal secret. Production also refuses to auto-create the bootstrap admin when `staff_users` is empty. Staff identities must be securely provisioned in a prior, approved process.

**Do not switch modes to bypass a release blocker.** This application still needs separate checks for infrastructure isolation, secret management, secure account recovery, browser E2E testing, and production approval.

## Encrypted offsite database backup

The script `scripts/backup-encrypted-offsite.sh` streams the PostgreSQL custom archive into `age`; no plaintext dump is intentionally written to host disk. It uploads encrypted ciphertext to a **versioned** S3 bucket using SSE-KMS and verifies the stored object length and encryption metadata. It does not configure a schedule, retention or bucket policy.

On a secure backup host with access to the private Compose network, Docker, age, OpenSSL, and AWS CLI:

```bash
export BACKUP_AGE_RECIPIENT="age1...public-recipient..."
export BACKUP_S3_BUCKET="private-versioned-backup-bucket"
export BACKUP_S3_PREFIX="shl-operations/encrypted"
export BACKUP_KMS_KEY_ID="arn:aws:kms:region:account:key/approved-id"
bash scripts/backup-encrypted-offsite.sh
```

Never commit the `age` private identity. Generate it separately; store a protected offline recovery copy and test it on an isolated operator workstation. Grant the backup job write-only or narrowly scoped S3 permissions, KMS encryption permissions, and no public S3 bucket access. Configure bucket versioning, retention/Object Lock, immutability and least-privilege IAM separately.

## Isolated restore drill

Retrieve the ciphertext through an approved account to the isolated recovery workstation, supply the private key only there, and run:

```bash
BACKUP_AGE_IDENTITY_FILE=/secure/age-private-key.txt \
  bash scripts/restore-encrypted-drill.sh /secure/retrieved.dump.age
```

The drill decrypts to a pipe, restores into an ephemeral `--network none` PostgreSQL 17 container, validates nine core tables, then deletes the container. This checks a subset of restoration only. Record timing, checksum, object version, row counts, expected schema/migration version, and approval outside the repository.

## Remaining mandatory controls

- Repository private + protected branch and required checks, review and secret scanning; current repository is public until changed in GitHub settings.
- Authenticated dual-control factor recovery, key rotation, restricted audit logging, password breach checks, security tests and pen test.
- HTTPS ingress, private API/database, workload identity, secrets manager, staging/production isolation, monitoring and incident response.
- Scheduled backup job, Object Lock/retention, alternate-region disaster recovery, recurring full application restore, RPO/RTO measurements.
- End-to-end business tests and verified accounting correctness; incomplete financial modules remain disabled for real transactions.

References: [OWASP ASVS 5.0](https://github.com/OWASP/ASVS/blob/master/5.0/en/0x15-V6-Authentication.md), [PostgreSQL 17 pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html), [age CLI](https://github.com/FiloSottile/age), [GitHub rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets).
