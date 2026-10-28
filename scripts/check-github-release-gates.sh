#!/usr/bin/env bash
# Read-only GitHub release checks. Does not authorize production use.
set -euo pipefail

REPO="${SHL_GITHUB_REPO:-niloy-datta/shl-operations}"
BRANCH="${SHL_RELEASE_BRANCH:-main}"

if ! command -v gh >/dev/null 2>&1; then
  echo 'BLOCKED: GitHub CLI (gh) is not installed.' >&2
  exit 2
fi
if ! gh auth status >/dev/null 2>&1; then
  echo 'BLOCKED: Authenticate GitHub CLI with gh auth login.' >&2
  exit 2
fi

failures=0
pass() { printf 'PASS: %s\n' "$1"; }
block() { printf 'BLOCKED: %s\n' "$1" >&2; failures=$((failures + 1)); }

if visibility=$(gh api "repos/$REPO" --jq '.visibility' 2>/dev/null); then
  if [[ "$visibility" == private ]]; then
    pass 'Repository is private.'
  else
    block "Repository visibility is $visibility (must be private)."
  fi
else
  block 'Cannot verify repository visibility; check token and repository access.'
fi

if protection=$(gh api "repos/$REPO/branches/$BRANCH/protection" 2>/dev/null); then
  pass "Branch $BRANCH protection is configured."
  if grep -Eq '"required_pull_request_reviews"[[:space:]]*:[[:space:]]*\{' <<<"$protection"; then
    pass 'Pull-request reviews are required.'
  else
    block 'Required pull-request reviews could not be verified.'
  fi
  if grep -Eq '"required_status_checks"[[:space:]]*:[[:space:]]*\{' <<<"$protection"; then
    pass 'Required status checks are configured.'
  else
    block 'Required status checks could not be verified.'
  fi
else
  block "Cannot verify branch $BRANCH protection; missing rules or insufficient permission."
fi

if (( failures > 0 )); then
  printf '%s\n' "GitHub release gates: FAILED ($failures blocker(s))." >&2
  exit 1
fi
printf '%s\n' 'GitHub release gates: PASS (GitHub configuration only; not production approval).'
