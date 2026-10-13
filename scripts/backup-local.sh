#!/usr/bin/env bash
# Local/development backup only. Never put database dumps in public GitHub repositories.
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077
mkdir -p backups
output="backups/shl-operations-$(date -u +%Y%m%dT%H%M%SZ).dump"
if ! docker compose exec -T db sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner --no-acl' > "$output"; then
  rm -f "$output"
  echo "Backup failed" >&2
  exit 1
fi
if ! docker compose exec -T db pg_restore --list < "$output" >/dev/null; then
  rm -f "$output"
  echo "Backup archive validation failed" >&2
  exit 1
fi
echo "Local backup written: $output"
echo "Archive readability is not restore correctness. Test restoration into a separate database."
