---
phase: 05-observability-polish
plan: 04
subsystem: python-services
requires: [05-01]
provides: [R7.1, R7.2, R7.3, R7.4, R7.6]
tags: [prometheus, opentelemetry, fastapi, python, tracing, metrics]
tech-stack:
  added:
    - prometheus-client
    - opentelemetry-api==1.35.0
    - opentelemetry-sdk==1.35.0
    - opentelemetry-instrumentation-fastapi==0.56b0
    - opentelemetry-exporter-otlp==1.35.0
  patterns:
    - make_asgi_app for /metrics endpoint
    - FastAPIInstrumentor for auto HTTP spans
    - W3C Trace Context propagation via Redis Stream
    - start_as_current_span with parent context for child spans
key-files:
  created:
    - services/processor-service/app/observability.py
    - services/vectorizer-service/app/observability.py
  modified:
    - services/processor-service/app/main.py
    - services/processor-service/app/consumers/base.py
    - services/processor-service/requirements.txt
    - services/vectorizer-service/app/main.py
    - services/vectorizer-service/app/consumers/base.py
    - services/vectorizer-service/requirements.txt
decisions:
  - D-01: Python services use prometheus-client + opentelemetry-python. FastAPIInstrumentor for auto-instrumentation. Redis Stream manual traceparent extraction.
  - D-02: W3C Trace Context propagation. Python side extracts traceparent from Redis Stream messages.
  - D-06: Prometheus metrics: http_requests_total, http_request_duration_seconds. NO user_id label.
metrics:
  duration: 25 minutes
  completed-date: 2026-04-21
  tasks: 3
  files: 8
---

# Phase 05 Plan 04: Python Services Observability Summary

**One-liner:** Prometheus metrics and OpenTelemetry tracing for Processor and Vectorizer services, with traceparent extraction from Redis Streams for cross-service distributed tracing.

---

## What Was Built

### Processor Service
- **observability.py**: Unified initialization function `setup_observability(app, service_name)` that:
  - Mounts `/metrics` endpoint via `make_asgi_app()`
  - Creates `TracerProvider` with OTLP HTTP exporter to Jaeger
  - Auto-instruments FastAPI with `FastAPIInstrumentor`
  - Configures structured logging
- **main.py**: Calls `setup_observability()` at module level (per RESEARCH.md Pitfall 6), adds tracer provider shutdown in lifespan
- **consumers/base.py**: Extracts `traceparent` from Redis Stream message fields, creates child span with `start_as_current_span()`, sets span attributes (stream, message_id, memory_id, success/error), adds trace_id to log messages

### Vectorizer Service
- Identical observability setup replicated from Processor Service
- Same `/metrics` endpoint, OTel tracing, and traceparent extraction

### Dependencies
- Both `requirements.txt` updated with:
  - `prometheus-client`
  - `opentelemetry-api==1.35.0`
  - `opentelemetry-sdk==1.35.0`
  - `opentelemetry-instrumentation-fastapi==0.56b0`
  - `opentelemetry-exporter-otlp==1.35.0`

---

## Deviations from Plan

**None.** Plan executed exactly as written.

---

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: information_disclosure | services/processor-service/app/observability.py | /metrics endpoint exposes HTTP-level metrics only, no user_id label (per D-06, T-05-10 mitigated) |
| threat_flag: spoofing | services/processor-service/app/consumers/base.py | traceparent validated by OTel extract(); invalid traceparent ignored, new root span created (T-05-11 mitigated) |
| threat_flag: information_disclosure | services/vectorizer-service/app/observability.py | Same as processor-service (T-05-10 mitigated) |
| threat_flag: spoofing | services/vectorizer-service/app/consumers/base.py | Same as processor-service (T-05-11 mitigated) |

---

## Known Stubs

**None.** All observability functionality is fully wired.

---

## Self-Check: PASSED

- [x] `services/processor-service/app/observability.py` exists
- [x] `services/vectorizer-service/app/observability.py` exists
- [x] `services/processor-service/app/main.py` calls `setup_observability()` at module level
- [x] `services/vectorizer-service/app/main.py` calls `setup_observability()` at module level
- [x] Both services mount `/metrics` via `make_asgi_app()`
- [x] Both services use `FastAPIInstrumentor.instrument_app()`
- [x] Both consumers extract `traceparent` and create child spans
- [x] Both `requirements.txt` have all observability dependencies
- [x] Syntax verification passed for all 6 modified files (Python AST parse)
- [x] Commit `80487fa`: Processor Service observability
- [x] Commit `d10a6e`: Processor Service traceparent extraction
- [x] Commit `cfc1b69`: Vectorizer Service observability replication
- [x] No accidental file deletions detected

---

## Commits

| Hash | Message | Files |
|------|---------|-------|
| `80487fa` | feat(05-04): add Prometheus + OTel observability to Processor Service | observability.py, main.py, requirements.txt |
| `d10a6e` | feat(05-04): extract traceparent in Processor Service Redis consumer | consumers/base.py |
| `cfc1b69` | feat(05-04): replicate observability setup to Vectorizer Service | observability.py, main.py, consumers/base.py, requirements.txt |
