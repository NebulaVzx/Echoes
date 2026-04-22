---
phase: 05-observability-polish
plan: 06
subsystem: infrastructure
phase: 05-observability-polish
plan: 06
subsystem: infrastructure
tags: [observability, prometheus, jaeger, grafana, docker-compose]
dependency_graph:
  requires: [05-01, 05-03, 05-04]
  provides: [observability-stack]
  affects: [docker-compose.yml, prometheus.yml, shared/grafana/]
tech_stack:
  added:
    - Prometheus v3.0.0 (metrics collection)
    - Jaeger 1.76 all-in-one (distributed tracing)
    - Grafana 11.0.0 (metrics and trace visualization)
  patterns: [docker-compose, grafana-provisioning, prometheus-scraping]
key_files:
  created:
    - prometheus.yml
    - shared/grafana/provisioning/datasources/datasources.yaml
    - shared/grafana/provisioning/dashboards/dashboards.yaml
    - shared/grafana/dashboards/echoes-overview.json
  modified:
    - docker-compose.yml
    - .env.example
    - Makefile
    - services/gateway/internal/observability/trace.go
    - services/user-service/internal/observability/trace.go
    - services/memory-service/internal/observability/trace.go
decisions:
  - D-07: Grafana dashboard JSON + Provisioning auto-import. Prometheus scrapes all services /metrics. Jaeger receives OTLP HTTP.
metrics:
  duration: 12m
  completed_date: 2026-04-21
---

# Phase 05 Plan 06: Extend Docker Compose with Prometheus + Jaeger + Grafana Summary

One-liner: Docker Compose observability stack with Prometheus scraping all 5 services, Jaeger OTLP trace collection, and Grafana auto-provisioned with the Echoes Overview dashboard.

## What Was Built

### Observability Services (docker-compose.yml)

| Service | Image | Host Port | Purpose |
|---------|-------|-----------|---------|
| Prometheus | prom/prometheus:v3.0.0 | 9090 | Metrics collection from all 5 app services |
| Jaeger | jaegertracing/all-in-one:1.76 | 16686 (UI), 4317 (OTLP gRPC), 4318 (OTLP HTTP) | Distributed tracing |
| Grafana | grafana/grafana:11.0.0 | 3001 | Metrics and trace visualization |

### Prometheus Configuration (prometheus.yml)
- Scrape interval: 15s
- 5 scrape targets: gateway:8080, user-service:8001, memory-service:8002, processor-service:8003, vectorizer-service:8004
- Each target labeled with its service name

### Grafana Provisioning
- **Datasources**: Auto-configures Prometheus (default) and Jaeger datasources
- **Dashboards**: File provider watches `/var/lib/grafana/dashboards` for JSON files
- **Volumes**: Provisioning configs and dashboard JSON mounted read-only (`:ro`)

### Echoes Overview Dashboard
Dashboard UID: `echoes-overview` with 7 panels:

| Panel | Type | Query |
|-------|------|-------|
| QPS | Stat | `sum(rate(http_requests_total[1m]))` |
| Error Rate | Stat | `sum(rate(http_requests_total{status_code=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100` |
| Latency P99 | Timeseries | `histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, service))` |
| Request Rate by Service | Timeseries | `sum(rate(http_requests_total[1m])) by (service)` |
| Memory Processing Status | Stat | `sum(memory_processing_total) by (status)` |
| Response Status Distribution | Pie Chart | `sum(http_requests_total) by (status_code)` |
| Recent Traces (Gateway) | Table | Jaeger search for gateway service |

### Environment Variables Added to All Services
- `OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318` — OTLP trace export endpoint
- `LOG_LEVEL=info` — Structured logging level
- `SERVICE_VERSION=0.2.0` — Service version for trace attributes

### Go trace.go Updates
All 3 Go services (gateway, user-service, memory-service) now read `OTEL_EXPORTER_OTLP_ENDPOINT` from environment with fallback to `jaeger:4318`.

## Deviations from Plan

None — plan executed exactly as written.

## Auth Gates

None.

## Known Stubs

| File | Line | Description |
|------|------|-------------|
| shared/grafana/dashboards/echoes-overview.json | Panel 5 | `memory_processing_total` metric panel will show "No data" until the metric is emitted by services. This metric was defined in Plan 01 but may not yet be instrumented in all code paths. |

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: info_disclosure | docker-compose.yml | Grafana anonymous access enabled (Viewer role). Mitigated: `allowUiUpdates: false`, provisioning mounted read-only. Production should disable anonymous access. |
| threat_flag: info_disclosure | docker-compose.yml | Prometheus UI exposed on host port 9090. Low risk in local dev — metrics contain no PII. |

## Self-Check: PASSED

- [x] `prometheus.yml` exists with scrape configs for all 5 services
- [x] `shared/grafana/provisioning/datasources/datasources.yaml` exists with Prometheus + Jaeger
- [x] `shared/grafana/provisioning/dashboards/dashboards.yaml` exists with file provider
- [x] `shared/grafana/dashboards/echoes-overview.json` exists with 7 panels
- [x] docker-compose.yml includes prometheus, jaeger, grafana services
- [x] All 5 app services have OTEL_EXPORTER_OTLP_ENDPOINT, LOG_LEVEL, SERVICE_VERSION
- [x] .env.example documents observability variables
- [x] Makefile has observability convenience targets
- [x] docker-compose config validates without errors
- [x] All Go services compile with updated trace.go
- [x] Commit `4e20aa6` exists (config files)
- [x] Commit `9d0fc02` exists (docker-compose + Makefile + .env.example)
- [x] Commit `18f9b51` exists (trace.go env var reading)

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 4e20aa6 | feat | Add prometheus config, grafana provisioning, and echoes dashboard |
| 9d0fc02 | feat | Add prometheus, jaeger, grafana to docker-compose |
| 18f9b51 | feat | Read OTLP endpoint from env in Go trace.go |
