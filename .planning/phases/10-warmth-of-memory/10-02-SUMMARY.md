---
phase: 10-warmth-of-memory
plan: 10-02
status: complete
date: 2026-04-26
tasks_completed: 4
---

# 10-02 Summary: Time Capsule Backend APIs

## What Was Built

Implemented seal/unseal/list APIs for time capsule functionality, enabling users to seal memories until a future date and detect recently unlocked ones when loading the app.

### 1. Repository Layer (`services/memory-service/internal/repository/memory_repository.go`)

Extended `MemoryRepository` interface and `GormMemoryRepository` implementation with four new methods:

- **`SealMemory`** — Sets `sealed_until` on a memory, scoped by `user_id`
- **`UnsealMemory`** — Clears `sealed_until` on a memory, scoped by `user_id`
- **`ListSealedMemories`** — Returns paginated currently-sealed memories (`sealed_until > NOW()`), ordered by `sealed_until ASC`
- **`GetRecentlyUnsealed`** — Returns memories whose seal expired within a given time window, with `updated_at >= since` to ensure they were recently unsealed

### 2. Service Layer (`services/memory-service/internal/service/memory_service.go`)

Added four business logic methods to `MemoryService`:

- **`SealMemory`** — Validates that `sealedUntil` is in the future (rejects past dates with `ErrInvalidRequest`), then delegates to repository
- **`UnsealMemory`** — Direct passthrough to repository
- **`ListSealedMemories`** — Returns paginated `ListMemoriesResponse` with `HasMore` calculation
- **`GetRecentlyUnsealed`** — Checks for memories unsealed in the last 24 hours

Also added `ErrInvalidRequest` to the service error variables.

### 3. HTTP Handlers (`services/memory-service/internal/transport/memory_handler.go`)

Registered four new endpoints in `RegisterRoutes`:

| Method | Endpoint | Handler | Purpose |
|--------|----------|---------|---------|
| POST | `/api/v1/memories/:id/seal` | `SealMemory` | Seal a memory until a future date |
| DELETE | `/api/v1/memories/:id/seal` | `UnsealMemory` | Remove the seal from a memory |
| GET | `/api/v1/memories/sealed` | `ListSealedMemories` | List all currently sealed memories |
| GET | `/api/v1/memories/unsealed` | `GetRecentlyUnsealed` | Get memories unlocked in last 24h |

All handlers validate `X-User-ID` authentication and return unified error responses.

### 4. Frontend API Client (`web/lib/api.ts`)

Added four methods to `ApiClient`:

- **`sealMemory(id, sealedUntil)`** — POST with `sealed_until` body
- **`unsealMemory(id)`** — DELETE
- **`listSealedMemories(params?)`** — GET with optional page/limit query params
- **`getRecentlyUnsealed()`** — GET, returns `{ memories: Memory[] }`

### 5. Test Fixes (`services/memory-service/internal/service/memory_service_test.go`)

Added mock implementations for the four new repository interface methods to satisfy the `MemoryRepository` interface in tests.

## Key Decisions

- **Past-date rejection:** `SealMemory` service method rejects dates in the past (Rule 2 — correctness requirement)
- **24-hour window:** `GetRecentlyUnsealed` checks the last 24 hours for unlock detection on app load
- **Route design:** Used `POST /:id/seal` and `DELETE /:id/seal` for seal/unseal (RESTful toggle pattern)
- **Error handling:** Seal failures return `INVALID_REQUEST` for past dates, `INTERNAL_ERROR` for DB failures

## Self-Check

- [x] `go build ./...` passes
- [x] `go test ./...` passes (all service tests green)
- [x] TypeScript `tsc --noEmit --skipLibCheck` passes
- [x] All four API endpoints registered in router
- [x] All handlers validate user_id scope
- [x] Frontend API client methods match backend endpoints

## Deviations

### Auto-fixed Issues

**1. [Rule 3 — Blocking Issue] Missing mock repository methods**
- **Found during:** Task 3 (after adding handlers, running tests)
- **Issue:** `mockMemoryRepository` in tests did not implement the four new `MemoryRepository` interface methods, causing compile failure
- **Fix:** Added `SealMemory`, `UnsealMemory`, `ListSealedMemories`, `GetRecentlyUnsealed` to the mock with in-memory logic
- **Files modified:** `services/memory-service/internal/service/memory_service_test.go`
- **Commit:** `3722251`

## Self-Check Verification

- All 5 modified/created files exist and are tracked
- All 4 task commits verified in git log
- `go build ./...` — PASSED
- `go test ./...` — PASSED (all service tests green)
- TypeScript compilation — PASSED

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `4727aa7` | feat(10-02): add time capsule repository methods |
| 2 | `ac2333d` | feat(10-02): add time capsule service methods |
| 3 | `3722251` | feat(10-02): add time capsule HTTP handlers |
| 4 | `66dc022` | feat(10-02): add time capsule API client methods |
