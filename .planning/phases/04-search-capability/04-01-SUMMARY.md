---
phase: 04-search-capability
plan: 01
subsystem: vectorizer-service
tags: [vectorization, bge-m3, encode-endpoint, cors, fastapi]
dependency_graph:
  requires: [03-03]
  provides: [04-02]
  affects: [vectorizer-service]
tech-stack:
  added: []
  patterns: [FastAPI endpoint, Pydantic validation, CORS middleware, app.state reuse]
key-files:
  created: []
  modified:
    - services/vectorizer-service/app/main.py
    - services/vectorizer-service/app/config.py
decisions:
  - "Reuse app.state.embedder from lifespan instead of creating new instance to avoid duplicate model loading"
  - "Default cors_origins='*' acceptable for internal Docker network; production should restrict to Gateway IP"
  - "ValueError from embedder.encode() mapped to HTTP 400; model not loaded mapped to HTTP 503"
metrics:
  duration: "~10 minutes"
  completed_date: "2026-04-21"
  tasks: 2
  files: 2
---

# Phase 04 Plan 01: Vectorizer Service POST /encode Endpoint Summary

**One-liner:** Added a POST /encode HTTP endpoint to the Vectorizer Service that converts text to 1024-dim BGE-M3 vectors, enabling the Memory Service to vectorize search queries for pgvector similarity search.

---

## Tasks Completed

### Task 1: Add POST /encode endpoint to Vectorizer Service
**Commit:** `337428f`
**File:** `services/vectorizer-service/app/main.py`

- Added `HTTPException` import from `fastapi`, `BaseModel` from `pydantic`
- Defined `EncodeRequest` (text: str) and `EncodeResponse` (vector: list, dimension: int) Pydantic models
- Added `POST /encode` endpoint with `response_model=EncodeResponse`
- Endpoint reuses `app.state.embedder` from lifespan (no duplicate model loading)
- Returns HTTP 503 when model is not loaded
- Catches `ValueError` from `embedder.encode()` and returns HTTP 400 (e.g., empty text)
- Response includes vector (list of floats) and dimension (1024)

### Task 2: Add CORS middleware to Vectorizer Service
**Commit:** `337428f` (same commit as Task 1)
**Files:** `services/vectorizer-service/app/main.py`, `services/vectorizer-service/app/config.py`

- Added `cors_origins: str = "*"` setting to `Settings` class in `config.py`
- Added `CORSMiddleware` import from `fastapi.middleware.cors`
- Registered CORS middleware after `app = FastAPI(...)` with configurable origins
- Allows credentials, all methods, and all headers

---

## Deviations from Plan

None - plan executed exactly as written.

---

## Threat Model Compliance

| Threat ID | Status | Notes |
|-----------|--------|-------|
| T-04-01 (DoS) | Mitigated | Input text validated by Pydantic; model inference is CPU-bound (~100ms); no additional rate limiting added per plan |
| T-04-02 (Info Disclosure) | Accepted | Returns only vector embeddings, no PII. Vectors are not reversible to text at this scale. |
| T-04-03 (Tampering) | Mitigated | Default `cors_origins="*"` acceptable for internal Docker network; production should restrict to Gateway IP |

---

## Known Stubs

None. All functionality is fully wired to the existing BGE-M3 embedder loaded at startup.

---

## Self-Check: PASSED

- [x] `services/vectorizer-service/app/main.py` contains `POST /encode` endpoint
- [x] `services/vectorizer-service/app/main.py` imports `HTTPException` from `fastapi`
- [x] `services/vectorizer-service/app/main.py` imports `CORSMiddleware` from `fastapi.middleware.cors`
- [x] `services/vectorizer-service/app/main.py` imports `BaseModel` from `pydantic`
- [x] `services/vectorizer-service/app/main.py` defines `EncodeRequest` and `EncodeResponse` classes
- [x] `services/vectorizer-service/app/main.py` references `app.state.embedder`
- [x] `services/vectorizer-service/app/main.py` raises `HTTPException(status_code=503)` for unloaded model
- [x] `services/vectorizer-service/app/main.py` raises `HTTPException(status_code=400)` for invalid input
- [x] `services/vectorizer-service/app/main.py` registers `CORSMiddleware` via `app.add_middleware`
- [x] `services/vectorizer-service/app/config.py` contains `cors_origins: str = "*"`
- [x] Commit `337428f` exists and contains the changes
- [x] No accidental file deletions in the commit
