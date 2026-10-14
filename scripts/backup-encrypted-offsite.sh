#!/usr/bin/env bash
# Encrypt in transit through a pipe; never write a plaintext dump to the host disk.
# This command is a building block, not a backup schedule or tested disaster recovery.
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
die() { printf 'ERROR: %s\n' "$1" >&2; exit 1; }
for command_name in docker age aws mktemp wc; do
  command -v "$command_name" >/dev/null 2>&1 || die "Missing required command: $command_name"
done
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is required"
recipient="${BACKUP_AGE_RECIPIENT:-}"
bucket="${BACKUP_S3_BUCKET:-}"
kms="${BACKUP_KMS_KEY_ID:-}"
prefix="${BACKUP_S3_PREFIX:-shl-operations/encrypted}"
[[ "$recipient" == age1* ]] || die "BACKUP_AGE_RECIPIENT must be a public age recipient"
[[ "$bucket" =~ ^[a-z0-9][a-z0-9.-]{2,62}$ ]] || die "Valid BACKUP_S3_BUCKET required"
[[ -n "$kms" ]] || die "BACKUP_KMS_KEY_ID required for SSE-KMS"
[[ "$prefix" =~ ^[a-zA-Z0-9/_-]+$ ]] || die "Invalid BACKUP_S3_PREFIX"
[[ "$prefix" != /* && "$prefix" != */ ]] || die "Prefix cannot start or end with /"
[[ -f .env ]] || die "Expected local .env with database credentials (not committed)"
tmpdir="$(mktemp -d)"
trap 'rm -rf -- "$tmpdir"' EXIT
archive="$tmpdir/backup.dump.age"
key="$prefix/$(date -u +%Y%m%dT%H%M%SZ)-$(openssl rand -hex 8).dump.age"
# Any pg_dump or age error aborts the upload because pipefail is set.
docker compose exec -T db sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner --no-acl' \
  | age -r "$recipient" > "$archive"
[[ -s "$archive" ]] || die "Encrypted backup is empty"
# Reject buckets where versioning is disabled.
versioning="$(aws s3api get-bucket-versioning --bucket "$bucket" --query Status --output text)"
[[ "$versioning" == "Enabled" ]] || die "S3 bucket versioning must be Enabled"
aws s3 cp "$archive" "s3://$bucket/$key" --no-progress \
  --sse aws:kms --sse-kms-key-id "$kms" >/dev/null
actual="$(wc -c < "$archive" | tr -d '[:space:]')"
remote="$(aws s3api head-object --bucket "$bucket" --key "$key" --query ContentLength --output text)"
[[ "$remote" == "$actual" ]] || die "Remote ciphertext length mismatch"
encryption="$(aws s3api head-object --bucket "$bucket" --key "$key" --query ServerSideEncryption --output text)"
[[ "$encryption" == "aws:kms" ]] || die "Remote object is not SSE-KMS encrypted"
printf 'Encrypted backup uploaded to s3://%s/%s\n' "$bucket" "$key"
echo "Not a restore guarantee: run the isolated restore drill and record results."
