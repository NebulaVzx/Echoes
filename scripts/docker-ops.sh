#!/usr/bin/env bash
# Echoes Docker Operations Script
# Usage: ./docker-ops.sh [command] [args]
# Commands: status, check, fix-web, fix-all, logs, restart, reload

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

header() { echo -e "${CYAN}\n=== $1 ===${NC}"; }
ok()     { echo -e "${GREEN}  OK   $1${NC}"; }
warn()   { echo -e "${YELLOW}  WARN $1${NC}"; }
err()    { echo -e "${RED}  ERR  $1${NC}"; }

# Container definitions: name|port|health_path|method|critical
CONTAINERS=(
  "echoes-web|3000|/login|GET|true"
  "echoes-gateway|8088|/api/v1/auth/register|GET|true"
  "echoes-user-service|0||GET|true"
  "echoes-memory-service|8002|/health|GET|true"
  "echoes-processor|8003|/health|GET|false"
  "echoes-vectorizer|8004|/health|GET|false"
  "echoes-postgres|0||GET|true"
  "echoes-redis|0||GET|true"
  "echoes-minio|9000|/minio/health/live|GET|false"
)

get_container_status() {
  docker ps --format "{{.Names}}|{{.Status}}" 2>/dev/null || true
}

test_http_health() {
  local port=$1 path=$2 method=${3:-GET}
  local url="http://localhost:${port}${path}"
  local code

  if [[ "$method" == "POST" ]]; then
    code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$url" \
      -H "Content-Type: application/json" \
      -d '{"email":"health@check.local","password":"test123"}' \
      --max-time 5 2>/dev/null || echo "000")
  else
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "000")
  fi

  [[ "$code" == "200" || "$code" == "307" || "$code" == "404" || "$code" == "401" ]]
}

cmd_status() {
  header "Container Status"
  local status_map
  status_map=$(get_container_status)

  for c in "${CONTAINERS[@]}"; do
    IFS='|' read -r name port path method critical <<< "$c"
    local found=false

    while IFS='|' read -r s_name s_status; do
      if [[ "$s_name" == "$name" ]]; then
        found=true
        if [[ "$s_status" == *"healthy"* ]]; then
          ok "$name: $s_status"
        elif [[ "$s_status" == *"unhealthy"* ]]; then
          err "$name: $s_status"
        else
          warn "$name: $s_status"
        fi
        break
      fi
    done <<< "$status_map"

    if [[ "$found" == false ]]; then
      err "$name: NOT RUNNING"
    fi
  done
}

cmd_check() {
  header "Deep Health Check"
  local status_map
  status_map=$(get_container_status)
  local issues=()

  for c in "${CONTAINERS[@]}"; do
    IFS='|' read -r name port path method critical <<< "$c"
    local running=false
    local container_status=""

    while IFS='|' read -r s_name s_status; do
      if [[ "$s_name" == "$name" ]]; then
        running=true
        container_status="$s_status"
        break
      fi
    done <<< "$status_map"

    if [[ "$running" == false ]]; then
      err "$name: container not running"
      issues+=("$name not running")
      continue
    fi

    if [[ "$container_status" == *"unhealthy"* ]]; then
      err "$name: unhealthy"
      issues+=("$name unhealthy")
    fi

    # HTTP health check
    if [[ "$port" -gt 0 && -n "$path" ]]; then
      if test_http_health "$port" "$path" "$method"; then
        ok "$name: HTTP $method $path reachable"
      else
        err "$name: HTTP $method $path FAILED"
        issues+=("$name HTTP health check failed")
      fi
    fi

    # Scan recent logs for errors
    local log_errors
    log_errors=$(docker logs --since 5m "$name" 2>&1 | grep -iE 'error|panic|fatal' | head -3 || true)
    if [[ -n "$log_errors" ]]; then
      warn "$name: recent errors in logs:"
      while IFS= read -r line; do
        warn "    $line"
      done <<< "$log_errors"
    fi
  done

  header "Check Summary"
  if [[ ${#issues[@]} -eq 0 ]]; then
    ok "All checks passed"
  else
    err "Found ${#issues[@]} issue(s):"
    for issue in "${issues[@]}"; do
      err "  - $issue"
    done
  fi
}

cmd_logs() {
  local container_name=${1:-}
  if [[ -z "$container_name" ]]; then
    err "Usage: ./docker-ops.sh logs <container-name>"
    echo "Available containers:"
    for c in "${CONTAINERS[@]}"; do
      IFS='|' read -r name _ _ _ _ <<< "$c"
      echo "  $name"
    done
    return 1
  fi

  header "Logs for $container_name (last 50 lines)"
  docker logs --tail 50 "$container_name" 2>&1 || err "Failed to get logs for $container_name"
}

cmd_restart() {
  local container_name=${1:-}
  if [[ -z "$container_name" ]]; then
    err "Usage: ./docker-ops.sh restart <container-name>"
    return 1
  fi

  header "Restarting $container_name"
  docker restart "$container_name"
  ok "$container_name restarted"
}

cmd_reload() {
  local service=${1:-}
  if [[ -z "$service" ]]; then
    err "Usage: ./docker-ops.sh reload <service>"
    echo "Available services: gateway, user-service, memory-service, processor, vectorizer, web, all"
    return 1
  fi

  header "Reloading $service"
  local container_name=""
  case "$service" in
    gateway)        container_name="echoes-gateway" ;;
    user-service)   container_name="echoes-user-service" ;;
    memory-service) container_name="echoes-memory-service" ;;
    processor)      container_name="echoes-processor" ;;
    vectorizer)     container_name="echoes-vectorizer" ;;
    web)            container_name="echoes-web" ;;
    all)
      for c in echoes-gateway echoes-user-service echoes-memory-service echoes-processor echoes-vectorizer echoes-web; do
        ok "Reloading $c..."
        docker restart "$c" >/dev/null 2>&1 || warn "$c restart failed"
      done
      ok "All services reloaded"
      return 0
      ;;
    *)
      err "Unknown service: $service"
      return 1
      ;;
  esac

  docker restart "$container_name"
  ok "$container_name reloaded (code changes applied without rebuild)"
}

cmd_fix_web() {
  header "Fixing Web Container"

  # Step 1: Check for host dev server conflict on port 3002
  local host_pid
  host_pid=$(lsof -ti:3002 2>/dev/null || netstat -ano 2>/dev/null | grep "3002" | grep LISTENING | awk '{print $5}' | head -1 || true)
  if [[ -n "$host_pid" && "$host_pid" =~ ^[0-9]+$ ]]; then
    warn "Host process on port 3002 (PID $host_pid) - stopping to avoid cache conflict"
    kill -9 "$host_pid" 2>/dev/null || true
    sleep 2
    ok "Host dev server stopped"
  fi

  # Step 2: Clean .next cache
  local next_dir="$PROJECT_DIR/web/.next"
  if [[ -d "$next_dir" ]]; then
    warn "Removing .next cache directory..."
    rm -rf "$next_dir"
    ok ".next cache cleared"
  fi

  # Step 3: Restart web container
  warn "Restarting echoes-web container..."
  docker restart echoes-web
  sleep 5

  # Step 4: Wait for startup
  warn "Waiting for dev server to compile..."
  local elapsed=0 max_wait=60
  while [[ $elapsed -lt $max_wait ]]; do
    sleep 3
    elapsed=$((elapsed + 3))

    local logs
    logs=$(docker logs --tail 5 echoes-web 2>&1 || true)
    if [[ "$logs" == *"Ready in"* ]]; then
      ok "Dev server ready after ${elapsed}s"
      break
    fi
  done

  # Step 5: HTTP check
  sleep 5
  if test_http_health 3000 "/login" "GET"; then
    ok "http://localhost:3000/login reachable"
  else
    err "http://localhost:3000/login NOT reachable"
    warn "Recent logs:"
    docker logs --tail 20 echoes-web 2>&1 || true
  fi
}

cmd_fix_all() {
  header "One-Click Fix All"

  # 1. Fix web first (most problematic)
  cmd_fix_web

  # 2. Check and restart unhealthy critical services
  local status_map
  status_map=$(get_container_status)

  for c in "${CONTAINERS[@]}"; do
    IFS='|' read -r name port path method critical <<< "$c"
    [[ "$name" == "echoes-web" ]] && continue

    local running=false
    local container_status=""

    while IFS='|' read -r s_name s_status; do
      if [[ "$s_name" == "$name" ]]; then
        running=true
        container_status="$s_status"
        break
      fi
    done <<< "$status_map"

    if [[ "$running" == false ]]; then
      err "$name not running - attempting restart"
      docker restart "$name" 2>/dev/null || true
      sleep 3
      continue
    fi

    if [[ "$container_status" == *"unhealthy"* ]]; then
      warn "$name unhealthy - restarting"
      docker restart "$name"
      sleep 3
    fi
  done

  # 3. Final health check
  header "Running final health check..."
  sleep 10
  cmd_check
}

show_help() {
  cat <<'EOF'
Echoes Docker Operations Script

Usage: ./docker-ops.sh [command] [args]

Commands:
  status                Show all container statuses
  check                 Deep health check (HTTP probes + log scanning)
  fix-web               Fix web container (clear cache, stop conflicts, restart)
  fix-all               One-click fix: web + restart unhealthy + check
  logs <container>      Show last 50 lines of container logs
  restart <container>   Restart a specific container
  reload <service>      Reload service after code changes (no rebuild)
  help                  Show this help message

Examples:
  ./docker-ops.sh status
  ./docker-ops.sh check
  ./docker-ops.sh fix-web
  ./docker-ops.sh fix-all
  ./docker-ops.sh logs echoes-web
  ./docker-ops.sh restart echoes-memory-service
EOF
}

# Main
case "${1:-status}" in
  status)   cmd_status ;;
  check)    cmd_check ;;
  fix-web)  cmd_fix_web ;;
  fix-all)  cmd_fix_all ;;
  logs)     cmd_logs "${2:-}" ;;
  restart)  cmd_restart "${2:-}" ;;
  reload)   cmd_reload "${2:-}" ;;
  help|--help|-h) show_help ;;
  *)
    err "Unknown command: $1"
    show_help
    exit 1
    ;;
esac
