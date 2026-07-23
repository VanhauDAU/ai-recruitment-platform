#!/usr/bin/env bash

# Classify a GitHub Actions change set without relying on a third-party action.
# Output is deliberately limited to key=value lines so it can be appended to
# $GITHUB_OUTPUT by both backend and frontend workflows.

set -euo pipefail

event_name="${EVENT_NAME:-}"
base_sha="${BASE_SHA:-}"
head_sha="${HEAD_SHA:-${GITHUB_SHA:-}}"
before_sha="${BEFORE_SHA:-}"

backend=false
frontend=false
docs=false
ci=false
deploy=false
frontend_audit=false
changed_count=0

set_all_areas() {
  backend=true
  frontend=true
  ci=true
  deploy=true
  frontend_audit=true
}

is_commit() {
  local revision="$1"
  [[ -n "$revision" ]] && git cat-file -e "${revision}^{commit}" 2>/dev/null
}

is_zero_sha() {
  local revision="$1"
  [[ -n "$revision" && "$revision" =~ ^0+$ ]]
}

classify_path() {
  local changed_path="$1"

  changed_count=$((changed_count + 1))

  case "$changed_path" in
    backend/Dockerfile)
      backend=true
      deploy=true
      ;;
    frontend/Dockerfile)
      frontend=true
      deploy=true
      ;;
    deploy/*|docker/*|docker-compose.yml|docker-compose.*.yml|docker-compose*.yaml)
      backend=true
      frontend=true
      deploy=true
      ;;
    .github/workflows/*deploy*)
      backend=true
      frontend=true
      ci=true
      deploy=true
      ;;
    backend/*)
      backend=true
      ;;
    frontend/*)
      frontend=true
      case "$changed_path" in
        frontend/package.json|frontend/package-lock.json)
          frontend_audit=true
          ;;
      esac
      ;;
    docs/*|README.md|CHANGELOG.md|AGENTS.md|CLAUDE.md)
      docs=true
      ;;
    .github/workflows/backend-ci.yml|scripts/check_backend_layering.sh)
      backend=true
      ci=true
      ;;
    .github/workflows/frontend-ci.yml|scripts/check_api_boundary.sh|scripts/check_feature_boundary.sh)
      frontend=true
      ci=true
      frontend_audit=true
      ;;
    scripts/check_env_sync.sh|scripts/check_all.sh|scripts/ci_changed_areas.sh)
      backend=true
      frontend=true
      ci=true
      if [[ "$changed_path" == scripts/ci_changed_areas.sh ]]; then
        frontend_audit=true
      fi
      ;;
    .github/*|.github/**/*|scripts/*)
      backend=true
      frontend=true
      ci=true
      ;;
    *)
      # Unknown root-level configuration is treated conservatively.
      backend=true
      frontend=true
      ci=true
      ;;
  esac
}

classify_diff() {
  local from_revision="$1"
  local to_revision="$2"
  local use_merge_base="$3"
  local changed_path
  local diff_file
  local diff_range

  if ! is_commit "$from_revision" || ! is_commit "$to_revision"; then
    set_all_areas
    return
  fi

  if [[ "$use_merge_base" == true ]]; then
    diff_range="${from_revision}...${to_revision}"
  else
    diff_range="${from_revision}..${to_revision}"
  fi

  diff_file="$(mktemp "${TMPDIR:-/tmp}/ci-changed-areas.XXXXXX")"
  trap '[[ -z "${diff_file:-}" ]] || rm -f -- "$diff_file"' EXIT
  if ! git diff --name-only --no-renames -z "$diff_range" -- > "$diff_file"; then
    rm -f "$diff_file"
    trap - EXIT
    set_all_areas
    return
  fi

  while IFS= read -r -d '' changed_path; do
    classify_path "$changed_path"
  done < "$diff_file"
  rm -f "$diff_file"
  trap - EXIT
}

case "$event_name" in
  pull_request)
    classify_diff "$base_sha" "$head_sha" true
    ;;
  push)
    frontend_audit=true
    if is_zero_sha "$before_sha"; then
      set_all_areas
    else
      classify_diff "$before_sha" "$head_sha" false
    fi
    ;;
  schedule)
    frontend_audit=true
    ;;
  workflow_dispatch)
    set_all_areas
    ;;
  *)
    # New event types must run all gates until their diff semantics are explicit.
    set_all_areas
    ;;
esac

printf 'backend=%s\n' "$backend"
printf 'frontend=%s\n' "$frontend"
printf 'docs=%s\n' "$docs"
printf 'ci=%s\n' "$ci"
printf 'deploy=%s\n' "$deploy"
printf 'frontend_audit=%s\n' "$frontend_audit"
printf 'changed_count=%s\n' "$changed_count"
