#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cat > "$TMP/gh" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-}" == auth && "${2:-}" == status ]]; then
  [[ "${MOCK_AUTH:-ok}" == ok ]]
  exit
fi
if [[ "${1:-}" == api ]]; then
  target="${2:-}"
  case "$target" in
    repos/*/branches/*/protection)
      [[ "${MOCK_PROTECTED:-yes}" == yes ]] || exit 1
      printf '{"required_pull_request_reviews":%s,"required_status_checks":%s}\n' "${MOCK_REVIEWS:-null}" "${MOCK_CHECKS:-null}"
      ;;
    repos/*)
      [[ "${MOCK_VISIBILITY_ERROR:-no}" == no ]] || exit 1
      printf '%s\n' "${MOCK_VISIBILITY:-private}"
      ;;
    *) exit 1 ;;
  esac
  exit
fi
exit 1
MOCK
chmod +x "$TMP/gh"
export PATH="$TMP:$PATH"
export SHL_GITHUB_REPO="example/shl-test"
export SHL_RELEASE_BRANCH=main

run_case() {
  local label="$1" expected="$2"
  shift 2
  local status=0
  env -u MOCK_AUTH -u MOCK_PROTECTED -u MOCK_VISIBILITY -u MOCK_VISIBILITY_ERROR -u MOCK_REVIEWS -u MOCK_CHECKS "$@" bash "$ROOT/scripts/check-github-release-gates.sh" > "$TMP/output" 2>&1 || status=$?
  if [[ "$status" != "$expected" ]]; then
    printf 'FAIL: %s expected %s got %s\n' "$label" "$expected" "$status" >&2
    cat "$TMP/output" >&2
    exit 1
  fi
  printf 'PASS: %s\n' "$label"
}

run_case 'private protected with reviews/checks' 0 env MOCK_REVIEWS='{"required_approving_review_count":1}' MOCK_CHECKS='{"contexts":["ci"]}'
run_case 'public repository is blocked' 1 env MOCK_VISIBILITY=public MOCK_REVIEWS='{}' MOCK_CHECKS='{}'
run_case 'missing protection is blocked' 1 env MOCK_PROTECTED=no
run_case 'missing reviews is blocked' 1 env MOCK_REVIEWS=null MOCK_CHECKS='{}'
run_case 'missing checks is blocked' 1 env MOCK_REVIEWS='{}' MOCK_CHECKS=null
run_case 'failed API visibility lookup is blocked' 1 env MOCK_VISIBILITY_ERROR=yes
run_case 'missing CLI authorization is blocked' 2 env MOCK_AUTH=no
