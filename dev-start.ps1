# Echoes (拾忆) - Windows Development Environment Startup Script
# Version: 1.0.0
# Usage: .\dev-start.ps1

$ErrorActionPreference = "Stop"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Echoes (拾忆) - Starting Dev Environment" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Check if Docker is available
if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Docker not found." -ForegroundColor Red
    Write-Host "Please install Docker Desktop with WSL2 backend:" -ForegroundColor Yellow
    Write-Host "  https://docs.docker.com/desktop/install/windows-install/" -ForegroundColor White
    exit 1
}

# Check if docker-compose is available
if (!(Get-Command docker-compose -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: docker-compose not found." -ForegroundColor Red
    Write-Host "Docker Desktop should include docker-compose." -ForegroundColor Yellow
    exit 1
}

Write-Host "Docker found. Checking Docker daemon..." -ForegroundColor Green

# Check if Docker daemon is running
try {
    $dockerInfo = docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Docker daemon not running"
    }
} catch {
    Write-Host "ERROR: Docker daemon is not running." -ForegroundColor Red
    Write-Host "Please start Docker Desktop first." -ForegroundColor Yellow
    exit 1
}

Write-Host "Docker daemon is running.`n" -ForegroundColor Green

# Start services
Write-Host "Starting all Echoes services..." -ForegroundColor Yellow
Write-Host "This may take a few minutes on first run.`n" -ForegroundColor Yellow

try {
    docker-compose up -d
    if ($LASTEXITCODE -ne 0) {
        throw "docker-compose up failed"
    }
} catch {
    Write-Host "ERROR: Failed to start services." -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}

# Wait for services to be ready
Write-Host "`nWaiting for services to initialize..." -ForegroundColor Yellow
for ($i = 10; $i -gt 0; $i--) {
    Write-Host "  Starting in $i seconds..." -ForegroundColor DarkGray
    Start-Sleep -Seconds 1
}

# Check service status
Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  Echoes Environment Ready!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Web Frontend:   http://localhost:3000" -ForegroundColor Cyan
Write-Host "  API Gateway:    http://localhost:8188" -ForegroundColor Cyan
Write-Host "  PostgreSQL:     localhost:5432" -ForegroundColor Cyan
Write-Host "  Redis:          localhost:6379" -ForegroundColor Cyan
Write-Host "  MinIO Console:  http://localhost:9001" -ForegroundColor Cyan
Write-Host ""
Write-Host "Database Credentials:" -ForegroundColor Yellow
Write-Host "  Database: echoes" -ForegroundColor White
Write-Host "  User:     echoes_user" -ForegroundColor White
Write-Host "  Password: echoes_password" -ForegroundColor White
Write-Host ""
Write-Host "Useful Commands:" -ForegroundColor Yellow
Write-Host "  docker-compose logs -f    # View logs" -ForegroundColor White
Write-Host "  docker-compose down       # Stop all services" -ForegroundColor White
Write-Host "  make migrate              # Run DB migrations" -ForegroundColor White
Write-Host ""
Write-Host "For WSL2 development, run: wsl make dev-start" -ForegroundColor Magenta
Write-Host ""

# Check if services are actually running
$containers = @("echoes-postgres", "echoes-redis", "echoes-gateway", "echoes-web")
$allRunning = $true

foreach ($container in $containers) {
    $status = docker ps --filter "name=$container" --format "{{.Status}}" 2>$null
    if ($status) {
        Write-Host "  [OK] $container is running" -ForegroundColor Green
    } else {
        Write-Host "  [WARN] $container may not be running yet" -ForegroundColor Yellow
        $allRunning = $false
    }
}

if (!$allRunning) {
    Write-Host "`nSome services are still starting. Wait a moment and run:" -ForegroundColor Yellow
    Write-Host "  docker-compose ps" -ForegroundColor White
}

Write-Host ""
