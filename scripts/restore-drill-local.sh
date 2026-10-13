#!/usr/bin/env bash
# Restores a local development archive to a disposable, isolated Postgres container.
# Does not connect to or modify any existing SHL database.
set -euo pipefail
if [[ $# -ne 1 || ! -f "$1" ]]; then
  echo "Usage: bash scripts/restore-drill-local.sh backups/<archive>.dump" >&2
  exit 2
fi
command -v docker >/dev/null || { echo "Docker is required" >&2; exit 2; }
command -v openssl >/dev/null || { echo "OpenSSL is required" >&2; exit 2; }
archive="$(realpath "$1")"
container="shl-restore-drill-$RANDOM-$$"
password="$(openssl rand -hex 24)"
cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT
docker run --detach --rm --name "$container" --network none \
  -e POSTGRES_PASSWORD="$password" -e POSTGRES_DB=postgres \
  postgres:17.6 >/dev/null
ready=0
for _ in $(seq 1 35); do
  if docker exec "$container" pg_isready -U postgres -d postgres >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [[ $ready -ne 1 ]]; then
  echo "Temporary PostgreSQL instance did not start" >&2
  exit 1
fi
docker exec -i "$container" pg_restore -U postgres -d postgres \
  --no-owner --no-acl --exit-on-error < "$archive"
expected=9
actual="$(docker exec "$container" psql -U postgres -d postgres -Atqc "
  SELECT count(*) FROM information_schema.tables
  WHERE table_schema='public'
  AND table_name IN (
    'staff_users','customers','suppliers','rfqs','customer_quotes',
    'sales_orders','invoices','auth_sessions','mfa_recovery_codes'
  )
")"
if [[ "$actual" != "$expected" ]]; then
  echo "Restore integrity check failed: expected $expected core tables, found $actual" >&2
  exit 1
fi
echo "Restore drill passed: core tables restored in isolated disposable PostgreSQL."
echo "This verifies structural restoration, not production RTO, RPO or application data reconciliation."
