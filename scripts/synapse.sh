#!/usr/bin/env bash
#
# Lifecycle for the local Synapse used by integration tests and the example app.
# Canonical documentation: memory_bank/ops/synapse.md
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYNAPSE_DIR="${SCRIPT_DIR}/../docker/synapse"
DATA_DIR="${SYNAPSE_DIR}/data"
COMPOSE=(docker compose -f "${SYNAPSE_DIR}/docker-compose.yml")
HOMESERVER_URL="http://localhost:8008"

# Accounts the integration suite and the example app expect to exist.
TEST_USERS=("alice:alice-password" "bob:bob-password")

log() { printf '\033[36m[synapse]\033[0m %s\n' "$1"; }
fail() { printf '\033[31m[synapse]\033[0m %s\n' "$1" >&2; exit 1; }

require_docker() {
  command -v docker >/dev/null 2>&1 || fail "docker is not installed"
  docker info >/dev/null 2>&1 || fail "docker is installed but not running"
}

generate_config() {
  if [ -f "${DATA_DIR}/homeserver.yaml" ]; then
    return
  fi
  log "generating homeserver configuration"
  mkdir -p "${DATA_DIR}"
  "${COMPOSE[@]}" run --rm \
    -e SYNAPSE_SERVER_NAME=localhost \
    -e SYNAPSE_REPORT_STATS=no \
    synapse generate >/dev/null

  # The generated config is minimal; the overrides make it test-friendly.
  log "applying test overrides"
  printf '\n# --- appended by scripts/synapse.sh ---\n' >> "${DATA_DIR}/homeserver.yaml"
  cat "${SYNAPSE_DIR}/overrides.yaml" >> "${DATA_DIR}/homeserver.yaml"
}

wait_for_health() {
  log "waiting for the homeserver to become healthy"
  for _ in $(seq 1 60); do
    if curl -fsS "${HOMESERVER_URL}/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  fail "homeserver did not become healthy in 60s; check: ${COMPOSE[*]} logs"
}

register_users() {
  for entry in "${TEST_USERS[@]}"; do
    local user="${entry%%:*}"
    local password="${entry##*:}"
    # register_new_matrix_user exits non-zero when the account already exists,
    # which is the normal case on a warm start.
    if "${COMPOSE[@]}" exec -T synapse register_new_matrix_user \
        -u "${user}" -p "${password}" --no-admin \
        -c /data/homeserver.yaml "${HOMESERVER_URL}" >/dev/null 2>&1; then
      log "registered @${user}:localhost"
    else
      log "@${user}:localhost already exists"
    fi
  done
}

case "${1:-}" in
  up)
    require_docker
    generate_config
    log "starting"
    "${COMPOSE[@]}" up -d
    wait_for_health
    register_users
    log "ready at ${HOMESERVER_URL}"
    ;;
  down)
    require_docker
    "${COMPOSE[@]}" down
    log "stopped"
    ;;
  reset)
    require_docker
    log "removing containers and all homeserver data"
    "${COMPOSE[@]}" down -v || true
    rm -rf "${DATA_DIR}"
    log "reset complete; run 'npm run synapse:up' for a clean server"
    ;;
  logs)
    "${COMPOSE[@]}" logs -f
    ;;
  *)
    fail "usage: synapse.sh {up|down|reset|logs}"
    ;;
esac
