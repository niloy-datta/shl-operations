#!/usr/bin/env bash
# Pre-deployment configuration gate. This is NOT a security certification.
set -euo pipefail

failures=0
fail() { printf 'FAIL: %s\n' "$1" >&2; failures=$((failures + 1)); }
pass() { printf 'PASS: %s\n' "$1"; }

if [[ ! -f compose.yaml || ! -f .env.example ]]; then
  echo "Run from repository root." >&2
  exit 2
fi

if [[ ! -f .env ]]; then
  fail ".env is missing; create it locally and keep it out of Git"
else
  pass "Local .env exists"
fi

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if git ls-files --error-unmatch .env >/dev/null 2>&1; then
    fail ".env is tracked in Git"
  else
    pass ".env is not tracked"
  fi
else
  fail "Git checkout is needed to check secrets tracking"
fi

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  if docker compose config --quiet >/dev/null 2>&1; then
    pass "Docker Compose configuration parses"
  else
    fail "Docker Compose configuration is invalid or has missing variables"
  fi
else
  fail "Docker Compose v2 is not installed"
fi

# Presence/format only; does not prove secrets are stored or rotated safely.
if [[ -f .env ]]; then
  for key in POSTGRES_PASSWORD BOOTSTRAP_ADMIN_PASSWORD MFA_ENCRYPTION_KEY; do
    value=$(sed -n "s/^$key=//p" .env | tail -n 1 | tr -d '\r')
    if [[ -z "$value" || "$value" == *replace-with* ]]; then
      fail "$key must be configured securely (value not printed)"
    elif [[ "$key" == MFA_ENCRYPTION_KEY && ! "$value" =~ ^[[:xdigit:]]{64}$ ]]; then
      fail "MFA_ENCRYPTION_KEY requires exactly 64 hex characters"
    elif [[ "$key" != MFA_ENCRYPTION_KEY && ${#value} -lt 24 ]]; then
      fail "$key must be at least 24 characters"
    else
      pass "$key is populated (value hidden)"
    fi
  done
fi

echo
if (( failures )); then
  printf 'BLOCKED: %d local configuration check(s) failed.\n' "$failures" >&2
  exit 1
fi
echo "Local configuration checks passed. PRODUCTION RELEASE IS STILL BLOCKED"
echo "until the independent approvals in docs/production-release-gates.md are completed."
