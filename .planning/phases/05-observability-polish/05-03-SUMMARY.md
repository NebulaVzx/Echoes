---
phase: 05-observability-polish
plan: 03
subsystem: observability
tags: [opentelemetry, tracing, distributed-tracing, jaeger, redis-streams]
dependency_graph:
  requires: [05-01]
  provides: [05-04]
  affects: [services/gateway, services/memory-service, services/user-service]
tech_stack:
  added: []
  patterns:
    - otelhttp.NewTransport for HTTP trace propagation
    - propagation.MapCarrier + otel.GetTextMapPropagator for Redis trace injection
    - Manual tracer.Start spans with otel.Tracer("service-name")
key_files:
  created: []
  modified:
    - services/gateway/internal/router/router.go
    - services/gateway/internal/middleware/zap_logger.go
    - services/gateway/internal/observability/trace.go
    - services/memory-service/internal/service/redis_queue.go
    - services/memory-service/internal/service/memory_service.go
    - services/memory-service/internal/transport/memory_handler.go
    - services/user-service/internal/transport/auth_handler.go
    - services/user-service/internal/observability/trace.go
decisions:
  - D-02 enforced: W3C Trace Context propagator across HTTP and Redis
  - D-04 enforced: trace_id and span_id in all Zap logs
  - traceparent stored in Redis Stream message fields for Python consumer extraction (Plan 04)
metrics:
  duration: "25 minutes"
  completed_date: "2026-04-21"
  tasks: 3
  files_modified: 8
---

# Phase 05 Plan 03: OpenTelemetry Tracing Implementation Summary

**One-liner:** Distributed tracing across all Go services with W3C trace context propagation via HTTP headers (Gateway -> downstream) and Redis Stream message fields (Memory Service -> Python consumers).

## What Was Built

### Trace Propagation Paths

```
Client Request
    |
    v
Gateway (otelgin.Middleware generates trace)
    |  otelhttp.NewTransport injects traceparent header
    +--------+----------------+
    |        |                |
User    Memory Service    (async via Redis Stream)
Service    |                   |
           |              +----+--------------------+
           |              |    |                    |
           |         Processor            Vectorizer
           |         (Python)             (Python)
           |         - extracts           - extracts
           |           traceparent          traceparent
           |           from Redis           from Redis
           v
    Manual spans:
    - CreateMemory
    - SearchMemories
    - GetRelatedMemories
```

### Task 1: Gateway HTTP Trace Propagation (Verified - Pre-existing from 05-01)

- **File:** `services/gateway/internal/router/router.go`
- `otelhttp.NewTransport` wraps the reverse proxy transport, automatically injecting `traceparent` headers into all proxied requests to User and Memory services
- Creates client spans for each outgoing HTTP request
- Already present from Plan 01; verified compilation

### Task 2: Redis Stream Traceparent Injection

- **File:** `services/memory-service/internal/service/redis_queue.go`
- `PublishTask` injects W3C trace context into Redis Stream message fields:
  ```go
  carrier := propagation.MapCarrier{}
  propagator := otel.GetTextMapPropagator()
  propagator.Inject(ctx, carrier)
  if traceparent := carrier["traceparent"]; traceparent != "" {
      fields["traceparent"] = traceparent
  }
  ```
- All publish methods (`PublishLinkFetch`, `PublishTextVectorize`, `PublishTagGenerate`) now accept `context.Context` for trace propagation
- `TaskQueue` interface updated with ctx parameters
- `memory_service.go` `publishTasks` helper passes request context through to Redis

### Task 3: Manual Spans in Key Handlers

**Memory Service** (`services/memory-service/internal/transport/memory_handler.go`):
- `CreateMemory` span with `memory_id` attribute
- `SearchMemories` span with `query`, `limit`, `result_count` attributes
- `GetRelatedMemories` span with `memory_id`, `limit`, `result_count` attributes

**User Service** (`services/user-service/internal/transport/auth_handler.go`):
- `Register` span with `user_id` attribute (no PII like email)
- `Login` span with `user_id` attribute

**Gateway** (`services/gateway/internal/middleware/zap_logger.go`):
- Already extracts `trace_id` and `span_id` from OTel span context per D-04
- Logs include trace context on every HTTP request

### Tracer Initialization (All Services)

All three services have identical `observability/trace.go` with:
- OTLP HTTP exporter to `jaeger:4318`
- W3C TraceContext + Baggage propagators
- Proper shutdown function deferred in `main.go`

## Deviations from Plan

None - plan executed exactly as written.

## Auth Gates

None.

## Known Stubs

None. All tracing is fully wired with real context propagation.

## Threat Flags

None. The threat model in the plan correctly assessed:
- T-05-07 (Forged traceparent): Mitigated by OTel W3C propagator validation (invalid format creates new root span)
- T-05-08 (traceparent in Redis): Accepted - contains only random trace_id/span_id, no PII
- T-05-09 (Large trace context): Accepted - traceparent is ~55 bytes, negligible overhead

## Self-Check: PASSED

- [x] `services/gateway/internal/router/router.go` contains `otelhttp.NewTransport`
- [x] `services/memory-service/internal/service/redis_queue.go` contains `propagator.Inject` with traceparent
- [x] `services/gateway/internal/middleware/zap_logger.go` logs trace_id and span_id
- [x] `services/memory-service/internal/transport/memory_handler.go` has `tracer.Start` for Create, Search, GetRelated
- [x] `services/user-service/internal/transport/auth_handler.go` has `tracer.Start` for Register, Login
- [x] All 3 services compile without errors
- [x] Trace shutdown deferred in all main.go files

## Commits

| Hash | Message |
|------|---------|
| f8e6fe8 | feat(05-03): inject traceparent into Redis Stream messages for distributed tracing |
| 85786be | feat(05-03): add manual OTel spans to key handlers in Memory and User services |
