#!/usr/bin/env bash
# Restore an encrypted archive into a disposable, offline PostgreSQL instance only.
set -euo pipefail
umask 077
die() { printf 'ERROR: %s\n' "$1" >&2; exit 1; }
[[ $# -eq 1 && -f "$1" ]] || die "Usage: BACKUP_AGE_IDENTITY_FILE=/secure/key.txt bash scripts/restore-encrypted-drill.sh /path/backup.dump.age"
archive="$(realpath "$1")"
identity="${BACKUP_AGE_IDENTITY_FILE:-}"
[[ -f "$identity" ]] || die "BACKUP_AGE_IDENTITY_FILE must reference a private age identity accessible on the restore workstation"
for command_name in docker age openssl; do
  command -v "$command_name" >/dev/null 2>&1 || die "Missing required command: $command_name"
done
container="shl-encrypted-restore-$RANDOM-$$"
password="$(openssl rand -hex 24)"
cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run --detach --rm --name "$container" --network none \
  -e POSTGRES_PASSWORD="$password" -e POSTGRES_DB=postgres \
  postgres:17.6 >/dev/null
ready=0
for (( i=0; i<45; i++ )); do
  if docker exec "$container" pg_isready -U postgres -d postgres >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
[[ "$ready" -eq 1 ]] || die "Disposable database failed to start"
# Decrypted data exists only in a pipe and the disposable database container.
age -d -i "$identity" "$archive" | docker exec -i "$container" \
  pg_restore -U postgres -d postgres --no-owner --no-acl --exit-on-error
count="$(docker exec "$container" psql -U postgres -d postgres -Atqc "
  SELECT count(*) FROM information_schema.tables
  WHERE table_schema='public'
  AND table_name IN ('staff_users','customers','suppliers','rfqs','customer_quotes',
    'sales_orders','invoices','auth_sessions','mfa_recovery_codes');
")"
[[ "$count" == 9 ]] || die "Restore failed: required core tables missing"
echo "Disposable encrypted restore drill passed: nine core tables verified."
echo "Application correctness, object-store retention and production RTO/RPO require separate tests."
