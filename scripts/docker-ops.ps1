# Echoes Docker Operations Script
# Usage: .\docker-ops.ps1 [command] [args]
# Commands: status, check, fix-web, fix-all, logs, restart

param(
    [Parameter(Position=0)]
    [ValidateSet('status','check','fix-web','fix-all','logs','restart','help')]
    [string]$Command = 'status',

    [Parameter(Position=1)]
    [string]$Arg
)

$ErrorActionPreference = 'Stop'

$containers = @(
    @{ Name='echoes-web'; Port=3000; HealthPath='/login'; Critical=$true },
    @{ Name='echoes-gateway'; Port=8088; HealthPath='/api/v1/auth/register'; Critical=$true; Method='GET' },
    @{ Name='echoes-user-service'; Port=0; HealthPath=''; Critical=$true },
    @{ Name='echoes-memory-service'; Port=8002; HealthPath='/health'; Critical=$true },
    @{ Name='echoes-processor'; Port=8003; HealthPath='/health'; Critical=$false },
    @{ Name='echoes-vectorizer'; Port=8004; HealthPath='/health'; Critical=$false },
    @{ Name='echoes-postgres'; Port=5432; HealthPath=''; Critical=$true },
    @{ Name='echoes-redis'; Port=6379; HealthPath=''; Critical=$true },
    @{ Name='echoes-minio'; Port=9000; HealthPath='/minio/health/live'; Critical=$false }
)

function Write-Header($text) {
    Write-Host "`n=== $text ===" -ForegroundColor Cyan
}

function Write-Ok($text) {
    Write-Host "  OK   $text" -ForegroundColor Green
}

function Write-Warn($text) {
    Write-Host "  WARN $text" -ForegroundColor Yellow
}

function Write-Err($text) {
    Write-Host "  ERR  $text" -ForegroundColor Red
}

function Get-ContainerStatus {
    $all = docker ps --format "{{.Names}}|{{.Status}}|{{.Ports}}"
    $statusMap = @{}
    foreach ($line in $all) {
        if ($line -match '^([^|]+)\|([^|]+)\|(.*)$') {
            $statusMap[$matches[1]] = @{ Status=$matches[2]; Ports=$matches[3] }
        }
    }
    return $statusMap
}

function Test-HttpHealth($port, $path, $method='GET') {
    try {
        $uri = "http://localhost:$port$path"
        if ($method -eq 'POST') {
            $body = '{"email":"health@check.local","password":"test123"}' | ConvertTo-Json -Depth 1
            $response = Invoke-WebRequest -Uri $uri -Method POST -ContentType 'application/json' -Body $body -TimeoutSec 5 -UseBasicParsing
            return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
        } else {
            $response = Invoke-WebRequest -Uri $uri -Method $method -TimeoutSec 5 -UseBasicParsing
            return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
        }
    } catch {
        # 4xx means the server is reachable (404 = route exists but wrong method, 401 = needs auth)
        $statusCode = $_.Exception.Response.StatusCode.value__
        return $statusCode -eq 404 -or $statusCode -eq 401 -or $statusCode -eq 405
    }
}

function Show-Status {
    Write-Header "Container Status"
    $statusMap = Get-ContainerStatus

    foreach ($c in $containers) {
        $name = $c.Name
        if ($statusMap.ContainsKey($name)) {
            $s = $statusMap[$name]
            if ($s.Status -match 'healthy') {
                Write-Ok "$name`: $($s.Status)"
            } elseif ($s.Status -match 'unhealthy') {
                Write-Err "$name`: $($s.Status)"
            } else {
                Write-Warn "$name`: $($s.Status)"
            }
        } else {
            Write-Err "$name`: NOT RUNNING"
        }
    }
}

function Show-Check {
    Write-Header "Deep Health Check"
    $statusMap = Get-ContainerStatus
    $issues = @()

    foreach ($c in $containers) {
        $name = $c.Name
        if (-not $statusMap.ContainsKey($name)) {
            Write-Err "$name`: container not running"
            $issues += "$name not running"
            continue
        }

        $s = $statusMap[$name]
        if ($s.Status -match 'unhealthy') {
            Write-Err "$name`: unhealthy"
            $issues += "$name unhealthy"
        }

        # HTTP health check for services with endpoints
        if ($c.Port -gt 0 -and $c.HealthPath -ne '') {
            $method = if ($c.Method) { $c.Method } else { 'GET' }
            $ok = Test-HttpHealth $c.Port $c.HealthPath $method
            if ($ok) {
                Write-Ok "$name`: HTTP $method $($c.HealthPath) reachable"
            } else {
                Write-Err "$name`: HTTP $method $($c.HealthPath) FAILED"
                $issues += "$name HTTP health check failed"
            }
        }

        # Check recent logs for errors
        $recentLogs = docker logs --since 5m $name 2>&1 | Select-String -Pattern 'error|Error|ERROR|panic|fatal|FATAL' | Select-Object -First 3
        if ($recentLogs) {
            Write-Warn "$name`: recent errors in logs:"
            foreach ($line in $recentLogs) {
                Write-Warn "    $line"
            }
        }
    }

    Write-Header "Check Summary"
    if ($issues.Count -eq 0) {
        Write-Ok "All checks passed"
    } else {
        Write-Err "Found $($issues.Count) issue(s):"
        foreach ($issue in $issues) {
            Write-Err "  - $issue"
        }
    }
    return $issues
}

function Show-Logs {
    param([string]$containerName)

    if (-not $containerName) {
        Write-Err "Usage: .\docker-ops.ps1 logs <container-name>"
        Write-Host "Available containers:"
        foreach ($c in $containers) { Write-Host "  $($c.Name)" }
        return
    }

    $valid = $containers | Where-Object { $_.Name -eq $containerName }
    if (-not $valid) {
        Write-Err "Unknown container: $containerName"
        return
    }

    Write-Header "Logs for $containerName (last 50 lines)"
    docker logs --tail 50 $containerName 2>&1
}

function Restart-Container {
    param([string]$containerName)

    if (-not $containerName) {
        Write-Err "Usage: .\docker-ops.ps1 restart <container-name>"
        return
    }

    $valid = $containers | Where-Object { $_.Name -eq $containerName }
    if (-not $valid) {
        Write-Err "Unknown container: $containerName"
        return
    }

    Write-Header "Restarting $containerName"
    docker restart $containerName
    Write-Ok "$containerName restarted"
}

function Repair-Web {
    Write-Header "Fixing Web Container"

    # Step 1: Check for host dev server conflict
    $hostNode = Get-NetTCPConnection -LocalPort 3002 -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($hostNode) {
        $proc = Get-Process -Id $hostNode.OwningProcess -ErrorAction SilentlyContinue
        if ($proc -and $proc.ProcessName -match 'node') {
            Write-Warn "Host Node.js process found on port 3002 (PID $($proc.Id)) - stopping to avoid cache conflict"
            Stop-Process -Id $proc.Id -Force
            Start-Sleep -Seconds 2
            Write-Ok "Host dev server stopped"
        }
    }

    # Step 2: Clean .next cache
    $nextDir = Join-Path $PSScriptRoot '..' 'web' '.next'
    if (Test-Path $nextDir) {
        Write-Warn "Removing .next cache directory..."
        Remove-Item -Recurse -Force $nextDir
        Write-Ok ".next cache cleared"
    }

    # Step 3: Restart web container
    Write-Warn "Restarting echoes-web container..."
    docker restart echoes-web
    Start-Sleep -Seconds 5

    # Step 4: Wait for startup and verify
    Write-Warn "Waiting for dev server to compile..."
    $maxWait = 60
    $elapsed = 0
    while ($elapsed -lt $maxWait) {
        Start-Sleep -Seconds 3
        $elapsed += 3

        $logs = docker logs --tail 5 echoes-web 2>&1
        if ($logs -match 'Ready in') {
            Write-Ok "Dev server ready after ${elapsed}s"
            break
        }
    }

    # Step 5: HTTP check
    Start-Sleep -Seconds 5
    $ok = Test-HttpHealth 3000 '/login'
    if ($ok) {
        Write-Ok "http://localhost:3000/login reachable"
    } else {
        Write-Err "http://localhost:3000/login NOT reachable"
        Write-Warn "Recent logs:"
        docker logs --tail 20 echoes-web 2>&1
    }
}

function Repair-All {
    Write-Header "One-Click Fix All"

    # 1. Fix web first (most problematic)
    Repair-Web

    # 2. Check and restart unhealthy critical services
    $statusMap = Get-ContainerStatus
    foreach ($c in $containers) {
        $name = $c.Name
        if ($name -eq 'echoes-web') { continue } # already handled

        if (-not $statusMap.ContainsKey($name)) {
            Write-Err "$name not running - attempting restart"
            docker restart $name
            Start-Sleep -Seconds 3
            continue
        }

        $s = $statusMap[$name]
        if ($s.Status -match 'unhealthy') {
            Write-Warn "$name unhealthy - restarting"
            docker restart $name
            Start-Sleep -Seconds 3
        }
    }

    # 3. Final health check
    Write-Header "Running final health check..."
    Start-Sleep -Seconds 10
    $issues = Show-Check

    if ($issues.Count -eq 0) {
        Write-Header "All services are healthy"
    } else {
        Write-Header "Some issues remain - run '.\docker-ops.ps1 logs <name>' for details"
    }
}

function Show-Help {
    Write-Host @"
Echoes Docker Operations Script

Usage: .\docker-ops.ps1 [command] [args]

Commands:
  status                Show all container statuses
  check                 Deep health check (HTTP probes + log scanning)
  fix-web               Fix web container (clear cache, stop conflicts, restart)
  fix-all               One-click fix: web + restart unhealthy containers + check
  logs <container>      Show last 50 lines of container logs
  restart <container>   Restart a specific container
  help                  Show this help message

Examples:
  .\docker-ops.ps1 status
  .\docker-ops.ps1 check
  .\docker-ops.ps1 fix-web
  .\docker-ops.ps1 fix-all
  .\docker-ops.ps1 logs echoes-web
  .\docker-ops.ps1 restart echoes-memory-service
"@
}

# Main dispatch
switch ($Command) {
    'status'   { Show-Status }
    'check'    { Show-Check }
    'fix-web'  { Repair-Web }
    'fix-all'  { Repair-All }
    'logs'     { Show-Logs $Arg }
    'restart'  { Restart-Container $Arg }
    'help'     { Show-Help }
    default    { Show-Status }
}
