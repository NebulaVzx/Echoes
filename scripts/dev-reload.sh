#!/usr/bin/env bash
# Echoes Dev Reload — 修改代码后快速重载服务（不 rebuild 镜像）
# Usage: ./dev-reload.sh [gateway|user-service|memory-service|processor|vectorizer|web|all]
#
# 原理：docker-compose.yml 已将代码目录 volume 挂载到容器内，
# 重启容器即可让 Go/Python 重新编译/加载最新代码。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$SCRIPT_DIR/.."

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

ok()  { echo -e "${GREEN}  OK   $1${NC}"; }
warn(){ echo -e "${YELLOW}  WARN $1${NC}"; }
err() { echo -e "${RED}  ERR  $1${NC}"; }
info(){ echo -e "${CYAN}  INFO $1${NC}"; }

reload_container() {
  local name=$1
  local container=$2
  info "Restarting $name..."
  if docker restart "$container" >/dev/null 2>&1; then
    ok "$name restarted"
  else
    err "$name restart failed"
    return 1
  fi
}

wait_healthy() {
  local container=$1
  local max_wait=${2:-30}
  local elapsed=0
  while [[ $elapsed -lt $max_wait ]]; do
    local status
    status=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "no-healthcheck")
    if [[ "$status" == "healthy" || "$status" == "no-healthcheck" ]]; then
      ok "$container healthy"
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  warn "$container not healthy after ${max_wait}s"
}

service="${1:-}"

if [[ -z "$service" ]]; then
  echo "Echoes Dev Reload — 快速重载服务（不 rebuild 镜像）"
  echo ""
  echo "Usage: ./dev-reload.sh <service>"
  echo ""
  echo "Services:"
  echo "  gateway       Gateway Service (Go)"
  echo "  user-service  User Service (Go)"
  echo "  memory-service Memory Service (Go)"
  echo "  processor     Processor Service (Python)"
  echo "  vectorizer    Vectorizer Service (Python)"
  echo "  web           Next.js Web App"
  echo "  all           重载所有服务"
  echo ""
  echo "Examples:"
  echo "  ./dev-reload.sh gateway         # 修改 Gateway 代码后快速生效"
  echo "  ./dev-reload.sh all             # 批量重载所有服务"
  exit 1
fi

case "$service" in
  gateway)
    reload_container "Gateway" "echoes-gateway"
    ;;
  user-service)
    reload_container "User Service" "echoes-user-service"
    ;;
  memory-service)
    reload_container "Memory Service" "echoes-memory-service"
    ;;
  processor)
    reload_container "Processor" "echoes-processor"
    ;;
  vectorizer)
    reload_container "Vectorizer" "echoes-vectorizer"
    ;;
  web)
    reload_container "Web" "echoes-web"
    ;;
  all)
    reload_container "Gateway" "echoes-gateway"
    reload_container "User Service" "echoes-user-service"
    reload_container "Memory Service" "echoes-memory-service"
    reload_container "Processor" "echoes-processor"
    reload_container "Vectorizer" "echoes-vectorizer"
    reload_container "Web" "echoes-web"
    ;;
  *)
    err "Unknown service: $service"
    echo "Run without arguments to see usage."
    exit 1
    ;;
esac
