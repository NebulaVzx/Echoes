---
phase: 03-ai-processing
plan: 01
subsystem: api
tags: [go, gin, gorm, pgvector, redis-stream, jsonb, internal-api]

requires:
  - phase: 02-memory-capture
    provides: "Memory Service CRUD, Redis Stream publishing, domain models"
provides:
  - "Database schema updated to VECTOR(1024) for BGE-M3 compatibility"
  - "SubTaskState, TaskStatusUpdate, AggregateStatus domain types"
  - "Internal API endpoint PATCH /api/v1/internal/memories/:id/tasks with Bearer auth"
  - "Internal API endpoint POST /api/v1/internal/memories/:id/tasks/:task_type/retry"
  - "MemoryService.UpdateTaskStatus with result field application and status aggregation"
  - "MemoryService.RetryTask with Redis Stream re-publish and retry_count tracking"
  - "Repository.UpdateVector with pgvector syntax"
affects:
  - "03-02 (Processor Service) - consumes internal API"
  - "03-03 (Vectorizer Service) - consumes internal API"

tech-stack:
  added: []
  patterns:
    - "Service-to-service auth via INTERNAL_API_TOKEN env var + Bearer middleware"
    - "Sub-task state tracking in JSONB metadata with aggregated status computation"
    - "Generic PublishTask on TaskQueue interface for retry scenarios"

key-files:
  created:
    - "shared/migrations/002_vector_1024.sql"
  modified:
    - "shared/migrations/001_init.sql"
    - "services/memory-service/internal/domain/memory.go"
    - "services/memory-service/internal/repository/memory_repository.go"
    - "services/memory-service/internal/service/memory_service.go"
    - "services/memory-service/internal/service/redis_queue.go"
    - "services/memory-service/internal/transport/memory_handler.go"

key-decisions:
  - "BGE-M3 outputs 1024 dimensions; schema must match (not 768)"
  - "Internal API uses simple Bearer token via INTERNAL_API_TOKEN env var"
  - "Processor/Vectorizer call Memory Service internal API; no direct DB access (D-12)"
  - "RetryTask uses generic PublishTask to re-publish to any Redis Stream"
  - "UpdateVector uses gorm.Expr with pgvector cast for safe vector updates"

patterns-established:
  - "Internal API routes grouped under /api/v1/internal with dedicated auth middleware"
  - "Sub-task JSONB tracking: metadata.tasks.{task_type} = {status, error, updated_at, retry_count}"
  - "AggregateStatus per D-14: processing > partial_failed > failed > completed > pending"

requirements-completed: [R5.4, R5.5, R5.6, R5.7, R2.6]

# Metrics
duration: 5min
completed: 2026-04-19
---

# Phase 3 Plan 1: AI Processing Foundation Summary

**BGE-M3 vector schema migration to 1024-dim, sub-task state tracking in JSONB, and authenticated internal API for Processor/Vectorizer callback**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-19T08:16:40Z
- **Completed:** 2026-04-19T08:22:06Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Database schema migrated from VECTOR(768) to VECTOR(1024) with migration file and index recreation
- Sub-task state types (SubTaskState, TaskStatusUpdate) and AggregateStatus logic per D-14
- Internal API with Bearer token auth: PATCH task status + POST retry endpoint
- MemoryService.UpdateTaskStatus applies result fields and recomputes aggregated status
- MemoryService.RetryTask re-publishes to Redis Stream with retry_count tracking
- Repository.UpdateVector with pgvector syntax for safe vector field updates

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migration VECTOR(768) to VECTOR(1024)** - `7034479` (feat)
2. **Task 2: Add sub-task state types and aggregation logic** - `f5510e9` (feat)
3. **Task 3: Memory Service internal API + auth middleware + retry endpoint + repository update** - `c03a0c2` (feat)

## Files Created/Modified
- `shared/migrations/002_vector_1024.sql` - Migration: ALTER TABLE to VECTOR(1024), drop/recreate index
- `shared/migrations/001_init.sql` - Updated init schema to VECTOR(1024) and comment
- `services/memory-service/internal/domain/memory.go` - SubTaskState, TaskStatusUpdate, AggregateStatus types
- `services/memory-service/internal/repository/memory_repository.go` - UpdateVector method with pgvector cast
- `services/memory-service/internal/service/memory_service.go` - UpdateTaskStatus, UpdateMemoryVector, RetryTask methods
- `services/memory-service/internal/service/redis_queue.go` - PublishTask generic method for retry
- `services/memory-service/internal/transport/memory_handler.go` - internalAuthMiddleware, UpdateTaskStatus, RetryTask handlers

## Decisions Made
- Followed plan exactly for schema migration and type definitions
- Added PublishTask to TaskQueue interface (deviation from plan) to enable RetryTask to publish to any stream generically
- Used `gorm.Expr("?::vector", vector)` for safe pgvector updates avoiding SQL injection
- Internal auth middleware allows unauthenticated access in dev when INTERNAL_API_TOKEN is unset (with warning)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added PublishTask to TaskQueue interface**
- **Found during:** Task 3 (RetryTask implementation)
- **Issue:** RetryTask needs to publish to arbitrary Redis Streams (link:fetch, text:vectorize, tag:generate), but TaskQueue interface only had typed methods (PublishLinkFetch, PublishTextVectorize, PublishTagGenerate)
- **Fix:** Added generic `PublishTask(ctx, stream, data)` to TaskQueue interface and RedisTaskQueue implementation; refactored existing `publish()` helper to use it
- **Files modified:** `services/memory-service/internal/service/memory_service.go`, `services/memory-service/internal/service/redis_queue.go`
- **Verification:** `go build ./...` compiles successfully
- **Committed in:** `c03a0c2` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Necessary for RetryTask to work correctly. No scope creep.

## Issues Encountered
None

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: internal_api_exposure | services/memory-service/internal/transport/memory_handler.go | Internal routes at `/api/v1/internal/*` must NOT be externally routable via Gateway. Gateway must exclude `/internal` paths. |

## Known Stubs
None - all implemented functionality is wired and operational.

## User Setup Required
None - INTERNAL_API_TOKEN is optional in development (middleware allows unauthenticated access when unset).

## Next Phase Readiness
- Processor Service (03-02) can now call `PATCH /api/v1/internal/memories/:id/tasks` to report link fetch and tag generation results
- Vectorizer Service (03-03) can call the same endpoint to report vectorization results
- Frontend can call retry endpoint (via Gateway) to let users retry failed sub-tasks

## Self-Check: PASSED

- [x] `shared/migrations/002_vector_1024.sql` exists
- [x] `grep "vector(1024)" shared/migrations/001_init.sql` returns 1 match
- [x] `grep "vector(1024)" services/memory-service/internal/domain/memory.go` returns 1 match
- [x] `grep "type SubTaskState struct" services/memory-service/internal/domain/memory.go` returns 1 match
- [x] `grep "func AggregateStatus" services/memory-service/internal/domain/memory.go` returns 1 match
- [x] `grep "func internalAuthMiddleware" services/memory-service/internal/transport/memory_handler.go` returns 1 match
- [x] `grep "internal.PATCH" services/memory-service/internal/transport/memory_handler.go` returns 1 match
- [x] `grep "internal.POST" services/memory-service/internal/transport/memory_handler.go` returns 1 match
- [x] `grep "func (s \*MemoryService) UpdateTaskStatus" services/memory-service/internal/service/memory_service.go` returns 1 match
- [x] `grep "func (s \*MemoryService) RetryTask" services/memory-service/internal/service/memory_service.go` returns 1 match
- [x] `grep "func (r \*GormMemoryRepository) UpdateVector" services/memory-service/internal/repository/memory_repository.go` returns 1 match
- [x] `cd services/memory-service && go build ./...` exits 0
- [x] Commit `7034479` exists
- [x] Commit `f5510e9` exists
- [x] Commit `c03a0c2` exists

---
*Phase: 03-ai-processing*
*Plan: 01*
*Completed: 2026-04-19*
