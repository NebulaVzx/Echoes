---
phase: 04-search-capability
plan: 02
subsystem: memory-service
tags: [semantic-search, vector-similarity, pgvector, redis-cache, api]
dependency_graph:
  requires: [03-04]
  provides: [04-03]
  affects: [memory-service]
tech-stack:
  added: []
  patterns: [pgvector cosine similarity, Redis query vector caching, HTTP service client]
key-files:
  created:
    - services/memory-service/internal/service/vectorizer_client.go
  modified:
    - services/memory-service/internal/domain/memory.go
    - services/memory-service/internal/repository/memory_repository.go
    - services/memory-service/internal/service/memory_service.go
    - services/memory-service/internal/transport/memory_handler.go
    - services/memory-service/cmd/main.go
decisions:
  - "SearchResult wraps Memory + Similarity float64 for unified search/related responses"
  - "pgvector <=> operator returns cosine distance; similarity = 1 - distance; threshold 0.75 => distance <= 0.25"
  - "Query vectors cached in Redis with SHA256 hash key, TTL 1 hour to reduce Vectorizer Service load"
  - "Vectorizer failure returns exact error message '搜索服务暂不可用' for HTTP 503 mapping in handler"
  - "Search endpoint limit capped at 100, Related endpoint limit capped at 20 (default 3)"
  - "Both endpoints filter by user_id and processing_status='completed' with non-null vector check"
metrics:
  duration: "~15 minutes"
  completed_date: "2026-04-21"
  tasks: 3
  files: 6
---

# Phase 04 Plan 02: Semantic Search and Similar Recommendations Summary

**One-liner:** Implemented semantic search (`GET /api/v1/search`) and similar memory recommendations (`GET /api/v1/memories/:id/related`) using pgvector cosine similarity with Redis query vector caching and Vectorizer Service integration.

---

## Tasks Completed

### Task 1: Add search domain types and repository methods
**Commit:** `112f545`
**Files:** `domain/memory.go`, `repository/memory_repository.go`

- Added `SearchResult`, `SearchResponse`, `RelatedResponse` types to domain layer
- Extended `MemoryRepository` interface with `SearchByVector` and `FindRelated`
- Implemented `SearchByVector` using pgvector `<=>` cosine distance operator, filtering by user_id, completed status, and distance threshold
- Implemented `FindRelated` with additional `id != ?` exclusion of the source memory

### Task 2: Create Vectorizer client with Redis caching
**Commit:** `9600656`
**File:** `service/vectorizer_client.go` (new)

- Created `VectorizerClient` with HTTP client (10s timeout) to Vectorizer Service `POST /encode`
- Redis cache with key pattern `search_vector:{sha256(query)}` and 1-hour TTL
- Converts `[]float64` vector response to pgvector literal format `[a,b,c,...]`
- Returns uniform error message `搜索服务暂不可用` on any failure (network, decode, non-200)

### Task 3: Add Search and Related methods to MemoryService and handlers
**Commit:** `f965d79`
**Files:** `service/memory_service.go`, `transport/memory_handler.go`, `cmd/main.go`

- Added `vectorizer` field to `MemoryService`, updated `NewMemoryService` constructor
- `Search` method: validates limit (1-100, default 10), encodes query, searches with threshold 0.75
- `Related` method: fetches source memory, verifies ownership, finds similar with threshold 0.7 (default limit 3)
- `Search` handler: `GET /api/v1/search?q=...&limit=N`, returns 503 on vectorizer failure
- `GetRelated` handler: `GET /api/v1/memories/:id/related?limit=N`, returns 404/403 for not-found/unauthorized
- Both handlers attach `similarity` float to each result item in the response
- Wired `VectorizerClient` initialization in `main.go`

---

## Deviations from Plan

None - plan executed exactly as written.

---

## Threat Model Compliance

| Threat ID | Status | Notes |
|-----------|--------|-------|
| T-04-04 (Injection) | Mitigated | Query text passed to embedder (not SQL); vector literal built from float64 values, not string concatenation |
| T-04-05 (DoS) | Mitigated | Limit capped at 100; vectorizer timeout 10s; Redis cache reduces repeated query load |
| T-04-06 (Info Disclosure) | Mitigated | User ownership check in Related; both endpoints filter by user_id |
| T-04-07 (Elevation) | Mitigated | userID extracted from X-User-ID header set by Gateway JWT middleware |

---

## Known Stubs

None. All data sources are wired to real services (Vectorizer Service, PostgreSQL, Redis).

---

## Self-Check: PASSED

- [x] `services/memory-service/internal/domain/memory.go` contains SearchResult, SearchResponse, RelatedResponse
- [x] `services/memory-service/internal/repository/memory_repository.go` implements SearchByVector and FindRelated
- [x] `services/memory-service/internal/service/vectorizer_client.go` exists with EncodeQuery method
- [x] `services/memory-service/internal/service/memory_service.go` has Search and Related methods
- [x] `services/memory-service/internal/transport/memory_handler.go` has Search and GetRelated handlers
- [x] `services/memory-service/cmd/main.go` wires vectorizer client
- [x] All commits exist: `112f545`, `9600656`, `f965d79`
- [x] `go build ./...` succeeds in services/memory-service
