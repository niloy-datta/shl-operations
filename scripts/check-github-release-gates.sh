#!/usr/bin/env bash
# Read-only GitHub release checks. Does not authorize production use.
set -euo pipefail

REPO="${SHL_GITHUB_REPO:-niloy-datta/shl-operations}"
BRANCH="${SHL_RELEASE_BRANCH:-main}"

if ! command -v jq >/dev/null 2>&1; then
  echo 'BLOCKED: jq is not installed.' >&2
  exit 2
fi
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
  if jq -e '.required_pull_request_reviews != null and (.required_pull_request_reviews.required_approving_review_count // 0) >= 1' >/dev/null <<<"$protection"; then
    pass 'At least one pull-request approval is required.'
  else
    block 'At least one required pull-request approval could not be verified.'
  fi
  if jq -e '.required_status_checks != null and (((.required_status_checks.contexts // []) | length) > 0 or ((.required_status_checks.checks // []) | length) > 0)' >/dev/null <<<"$protection"; then
    pass 'At least one required status check is configured.'
  else
    block 'No required status checks could be verified.'
  fi
else
  block "Cannot verify branch $BRANCH protection; missing rules or insufficient permission."
fi

if (( failures > 0 )); then
  printf '%s\n' "GitHub release gates: FAILED ($failures blocker(s))." >&2
  exit 1
fi
printf '%s\n' 'GitHub release gates: PASS (GitHub configuration only; not production approval).'
