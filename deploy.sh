#!/usr/bin/env bash
# Deploy/manage the self-hosted OtakuReader stack (Docker Compose).
#
#   ./deploy.sh start [--tls]      build and start (add --tls for automatic HTTPS via Caddy)
#   ./deploy.sh stop               stop the stack (data volume is kept)
#   ./deploy.sh status             container status + health
#   ./deploy.sh logs               follow app logs
#   ./deploy.sh backup             stop app, tar the library into ./backups, restart app
#   ./deploy.sh restore <file>     replace the library with a backup (asks first)
set -euo pipefail
cd "$(dirname "$0")"

info()  { printf '\033[0;32m[INFO]\033[0m %s\n' "$*"; }
warn()  { printf '\033[1;33m[WARN]\033[0m %s\n' "$*"; }
error() { printf '\033[0;31m[ERROR]\033[0m %s\n' "$*" >&2; }

# Prefer the compose v2 plugin, fall back to the legacy docker-compose binary.
compose() {
  if docker compose version >/dev/null 2>&1; then docker compose "$@"; else docker-compose "$@"; fi
}

check_docker() {
  command -v docker >/dev/null 2>&1 || { error "Docker is not installed."; exit 1; }
  if ! docker compose version >/dev/null 2>&1 && ! command -v docker-compose >/dev/null 2>&1; then
    error "Docker Compose is not installed (need the 'docker compose' plugin or docker-compose)."
    exit 1
  fi
}

# Read a single KEY=value from .env without executing it (never `source` an env file).
env_value() {
  grep -E "^$1=" .env 2>/dev/null | tail -n1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//' || true
}

check_env() {
  if [ ! -f .env ]; then
    cp .env.docker.example .env
    warn "Created .env from .env.docker.example. Set LIBRARY_TOKEN in it, then run this again."
    warn "Generate one with: openssl rand -hex 32"
    exit 1
  fi
  if [ -z "$(env_value LIBRARY_TOKEN)" ]; then
    error "LIBRARY_TOKEN is empty in .env. Set it (openssl rand -hex 32) and run again."
    exit 1
  fi
}

wait_healthy() {
  info "Waiting for the app to report healthy (up to ~90s)..."
  for _ in $(seq 1 30); do
    state="$(docker inspect -f '{{.State.Health.Status}}' otakureader 2>/dev/null || echo starting)"
    [ "$state" = "healthy" ] && { info "App is healthy."; return 0; }
    sleep 3
  done
  error "App did not become healthy. Recent logs:"
  compose logs --tail=50 app
  exit 1
}

cmd_start() {
  check_docker
  check_env
  local profile=()
  if [ "${1:-}" = "--tls" ]; then
    [ -n "$(env_value DOMAIN)" ] || { error "Set DOMAIN in .env to use --tls."; exit 1; }
    profile=(--profile tls)
  fi
  info "Building and starting..."
  compose "${profile[@]}" up -d --build
  wait_healthy
  compose ps
  info "Done. Data lives in the 'otakureader_data' volume. Back it up with: ./deploy.sh backup"
}

cmd_stop()   { check_docker; compose --profile tls down; info "Stopped (volumes kept)."; }
cmd_status() { check_docker; compose ps; docker inspect -f 'health: {{.State.Health.Status}}' otakureader 2>/dev/null || true; }
cmd_logs()   { check_docker; compose logs -f --tail=100 app; }

cmd_backup() {
  check_docker
  mkdir -p backups
  local stamp file
  stamp="$(date +%Y%m%d-%H%M%S)"
  file="otakureader-${stamp}.tgz"
  info "Stopping app for a consistent copy of the SQLite database..."
  compose stop app
  # Runs as root so it can write to the host ./backups bind mount.
  compose run --rm --no-deps --user root --entrypoint tar -v "$PWD/backups:/backup" app \
    czf "/backup/${file}" -C /app/data .
  compose start app
  info "Backup written to backups/${file}"
}

cmd_restore() {
  check_docker
  local file="${1:-}"
  [ -n "$file" ] || { error "Usage: ./deploy.sh restore <backups/file.tgz>"; exit 1; }
  [ -f "$file" ] || { error "No such file: $file"; exit 1; }
  local base; base="$(basename "$file")"
  warn "This REPLACES the current library (database and all downloaded pages) with $base."
  read -r -p "Type 'restore' to continue: " answer
  [ "$answer" = "restore" ] || { info "Cancelled."; exit 0; }
  compose stop app
  compose run --rm --no-deps --user root --entrypoint sh \
    -v "$(cd "$(dirname "$file")" && pwd):/backup:ro" app \
    -c "find /app/data -mindepth 1 -delete && tar xzf /backup/${base} -C /app/data && chown -R node:node /app/data"
  compose start app
  wait_healthy
  info "Restored from $base"
}

case "${1:-}" in
  start)   shift; cmd_start "$@" ;;
  stop)    cmd_stop ;;
  status)  cmd_status ;;
  logs)    cmd_logs ;;
  backup)  cmd_backup ;;
  restore) shift; cmd_restore "$@" ;;
  *) sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
