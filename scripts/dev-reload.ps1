# Echoes Dev Reload — 修改代码后快速重载服务（不 rebuild 镜像）
# Usage: .\dev-reload.ps1 [gateway|user-service|memory-service|processor|vectorizer|web|all]
#
# 原理：docker-compose.yml 已将代码目录 volume 挂载到容器内，
# 重启容器即可让 Go/Python 重新编译/加载最新代码。

param(
    [Parameter(Position=0)]
    [string]$Service
)

$ErrorActionPreference = 'Stop'

function Write-Ok($text)  { Write-Host "  OK   $text" -ForegroundColor Green }
function Write-Warn($text){ Write-Host "  WARN $text" -ForegroundColor Yellow }
function Write-Err($text) { Write-Host "  ERR  $text" -ForegroundColor Red }
function Write-Info($text){ Write-Host "  INFO $text" -ForegroundColor Cyan }

function Restart-ServiceContainer($name, $container) {
    Write-Info "Restarting $name..."
    try {
        docker restart $container | Out-Null
        Write-Ok "$name restarted"
    } catch {
        Write-Err "$name restart failed: $_"
        throw
    }
}

if (-not $Service) {
    Write-Host "Echoes Dev Reload — 快速重载服务（不 rebuild 镜像）"
    Write-Host ""
    Write-Host "Usage: .\dev-reload.ps1 <service>"
    Write-Host ""
    Write-Host "Services:"
    Write-Host "  gateway        Gateway Service (Go)"
    Write-Host "  user-service   User Service (Go)"
    Write-Host "  memory-service Memory Service (Go)"
    Write-Host "  processor      Processor Service (Python)"
    Write-Host "  vectorizer     Vectorizer Service (Python)"
    Write-Host "  web            Next.js Web App"
    Write-Host "  all            重载所有服务"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\dev-reload.ps1 gateway   # 修改 Gateway 代码后快速生效"
    Write-Host "  .\dev-reload.ps1 all       # 批量重载所有服务"
    exit 1
}

switch ($Service) {
    'gateway'        { Restart-ServiceContainer 'Gateway' 'echoes-gateway' }
    'user-service'   { Restart-ServiceContainer 'User Service' 'echoes-user-service' }
    'memory-service' { Restart-ServiceContainer 'Memory Service' 'echoes-memory-service' }
    'processor'      { Restart-ServiceContainer 'Processor' 'echoes-processor' }
    'vectorizer'     { Restart-ServiceContainer 'Vectorizer' 'echoes-vectorizer' }
    'web'            { Restart-ServiceContainer 'Web' 'echoes-web' }
    'all' {
        Restart-ServiceContainer 'Gateway' 'echoes-gateway'
        Restart-ServiceContainer 'User Service' 'echoes-user-service'
        Restart-ServiceContainer 'Memory Service' 'echoes-memory-service'
        Restart-ServiceContainer 'Processor' 'echoes-processor'
        Restart-ServiceContainer 'Vectorizer' 'echoes-vectorizer'
        Restart-ServiceContainer 'Web' 'echoes-web'
    }
    default {
        Write-Err "Unknown service: $Service"
        Write-Host "Run without arguments to see usage."
        exit 1
    }
}
