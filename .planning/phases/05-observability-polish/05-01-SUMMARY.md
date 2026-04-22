---
phase: 05
plan: 01
subsystem: observability
tags: [zap, prometheus, opentelemetry, gin, middleware]
dependency_graph:
  requires: []
  provides: ["05-02", "05-03", "05-04", "05-05", "05-06", "05-07"]
  affects: ["gateway", "user-service", "memory-service"]
tech_stack:
  added:
    - go.uber.org/zap@v1.27.1
    - github.com/prometheus/client_golang@v1.23.2
    - go.opentelemetry.io/otel@v1.28.0
    - go.opentelemetry.io/otel/sdk@v1.28.0
    - go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin@v0.53.0
    - go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp@v0.53.0
    - go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp@v1.28.0
  patterns:
    - "Middleware chain: Recovery -> OTelGin -> PrometheusMetrics -> ZapLogger -> CORS -> RateLimit -> JWTAuth"
    - "Path normalization via c.FullPath() for low-cardinality Prometheus labels"
    - "OTel W3C Trace Context propagation with traceparent injection to downstream services"
key_files:
  created:
    - services/gateway/internal/observability/zap.go
    - services/gateway/internal/observability/trace.go
    - services/gateway/internal/observability/metrics.go
    - services/gateway/internal/middleware/zap_logger.go
    - services/gateway/internal/middleware/metrics.go
    - services/user-service/internal/observability/zap.go
    - services/user-service/internal/observability/trace.go
    - services/user-service/internal/observability/metrics.go
    - services/user-service/internal/middleware/metrics.go
    - services/user-service/internal/middleware/zap_logger.go
    - services/memory-service/internal/observability/zap.go
    - services/memory-service/internal/observability/trace.go
    - services/memory-service/internal/observability/metrics.go
    - services/memory-service/internal/middleware/metrics.go
    - services/memory-service/internal/middleware/zap_logger.go
  modified:
    - services/gateway/cmd/main.go
    - services/gateway/internal/router/router.go
    - services/gateway/go.mod
    - services/user-service/cmd/main.go
    - services/user-service/go.mod
    - services/memory-service/cmd/main.go
    - services/memory-service/go.mod
decisions:
  - "D-04 enforced: Zap fully replaces Gin logger. JSON format with timestamp, level, msg, trace_id, span_id, service, path, method, status, duration_ms fields. LOG_LEVEL env var."
  - "D-06 enforced: Prometheus Counter http_requests_total (service,method,path,status_code) and Histogram http_request_duration_seconds (service,method,path). NO user_id label. FullPath() for path normalization."
  - "D-02 enforced: OTel W3C Trace Context propagator. otelgin + otelhttp."
  - "Gateway reverse proxy uses otelhttp.NewTransport for automatic trace header injection to downstream services."
  - "Go toolchain auto-upgraded to 1.25.9 across all services to satisfy OTel dependency requirements."
metrics:
  duration: "~35 minutes"
  completed_date: "2026-04-21"
  tasks: 3
  files_created: 15
  files_modified: 7
---

# Phase 05 Plan 01: Zap + Prometheus Observability Stack Summary

**One-liner:** Structured JSON logging with trace correlation and Prometheus HTTP metrics across all 3 Go services, replacing Gin's default logger with a production-grade observability pipeline.

## What Was Built

### Gateway Service
- **observability/zap.go**: `NewLogger(service)` — JSON formatter with ISO8601 timestamps, configurable LOG_LEVEL, static service field
- **observability/trace.go**: `InitTracer(serviceName)` — OTLP HTTP exporter to Jaeger, W3C Trace Context + Baggage propagator
- **observability/metrics.go**: `RegisterMetricsEndpoint(r)` — mounts GET /metrics with promhttp.Handler
- **middleware/zap_logger.go**: `ZapLogger(logger)` — extracts trace_id/span_id from OTel span context, logs after c.Next() with status, method, path, duration_ms, client_ip
- **middleware/metrics.go**: `PrometheusMetrics(service)` + `OTelGin(serviceName)` — records http_requests_total Counter and http_request_duration_seconds Histogram, skips /metrics self-scrapes
- **router.go**: Middleware chain = Recovery -> OTelGin -> PrometheusMetrics -> ZapLogger -> CORS -> RateLimit -> JWTAuth. Reverse proxy transport upgraded to otelhttp.NewTransport.
- **main.go**: Initializes Zap, OTel tracer, zap.ReplaceGlobals, passes logger to router.Setup()

### User Service & Memory Service
- Identical observability packages (zap.go, trace.go, metrics.go) and middleware (metrics.go, zap_logger.go)
- **main.go**: gin.New() + Recovery -> OTelGin -> PrometheusMetrics -> ZapLogger. All log.Printf/log.Fatalf replaced with logger.Info/logger.Fatal.
- Memory service also has propagation package available for future traceparent injection in Redis Streams (Plan 03).

## Verification Results

| Check | Result |
|-------|--------|
| Gateway builds | PASS |
| User Service builds | PASS |
| Memory Service builds | PASS |
| No `gin.Logger()` remains | PASS (grep returned empty) |
| No `gin.Default()` remains | PASS (grep returned empty) |
| `/metrics` endpoint registered in all 3 services | PASS (6 files match) |
| `FullPath()` used for path normalization | PASS (3 middleware files) |
| Zap logger used in all main.go | PASS (logger.Info/Fatal/Sync, zap.ReplaceGlobals) |

## Commits

| Hash | Message |
|------|---------|
| 8bb197e | feat(05-01): create observability packages and middleware for Gateway |
| 3d081d6 | feat(05-01): wire Gateway router and main.go with observability stack |
| 83143f7 | feat(05-01): replicate observability stack to User Service and Memory Service |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed zap.Errors type incompatibility with gin.errorMsgs**
- **Found during:** Task 1 (build verification)
- **Issue:** `zap.Errors("errors", c.Errors)` failed because `c.Errors` is `gin.errorMsgs` (not `[]error`)
- **Fix:** Converted to string slice via loop, used `zap.Strings("errors", errMsgs)`
- **Files modified:** services/gateway/internal/middleware/zap_logger.go (and replicated to user-service, memory-service)
- **Commit:** Included in 8bb197e

### Dependency Version Adjustments

- **OTel version**: Plan specified v1.43.0, but gateway uses Go 1.22 which cannot satisfy v1.43's Go >= 1.25 requirement. Go toolchain auto-upgraded all services to Go 1.25.9. OTel packages resolved to v1.28.0 / contrib v0.53.0.
- **Gin version**: Auto-upgraded from v1.9.1 to v1.10.0 during dependency resolution (backward-compatible).
- **Prometheus client**: Resolved to v1.23.2 (latest compatible).
- **Zap**: Resolved to v1.27.1 (latest stable).

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: info_disclosure | services/*/internal/middleware/metrics.go | Metrics contain only HTTP-level data (service/method/path/status). No user_id or PII labels per D-06 mitigation for T-05-01. |
| threat_flag: info_disclosure | services/*/internal/middleware/zap_logger.go | Logs contain path/method/status but NOT request body, user email, or JWT tokens per T-05-04. |

## Known Stubs

None. All files are fully wired with real data sources.

## Self-Check: PASSED

- [x] All created files exist on disk
- [x] All 3 commits exist in git log
- [x] All 3 services compile without errors
- [x] No gin.Logger() or gin.Default() remains
- [x] /metrics endpoint registered in all services
- [x] FullPath() used for path normalization
