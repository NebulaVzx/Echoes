---
phase: 08
plan: 02
name: "Backend - Memory Service Suggestion Layer"
subsystem: backend
tags: [memory-service, ai-suggestions, repository, redis-stream, api-handlers]
dependency_graph:
  requires: [08-01]
  provides: [08-03, 08-04, 08-05]
  affects: [services/memory-service]
tech_stack:
  added: []
  patterns: [GORM repository, Redis Stream, Gin handlers, service layer]
key_files:
  created:
    - services/memory-service/internal/repository/suggestion_repository.go
  modified:
    - services/memory-service/internal/service/redis_queue.go
    - services/memory-service/internal/service/memory_service.go
    - services/memory-service/internal/transport/memory_handler.go
    - services/memory-service/cmd/main.go
    - services/memory-service/internal/domain/memory.go
decisions:
  - "D-08-02-01: Create method returns (*Memory, string, error) with suggestion_status to avoid separate DB query"
  - "D-08-02-02: getUserSuggestionStyle defaults to 'inspiring' when user settings unavailable"
  - "D-08-02-03: Suggestion generation failure is non-blocking - memory creation succeeds even if Redis publish fails"
metrics:
  duration: "25 minutes"
  completed_date: "2026-04-25"
  tasks: 5
  files_created: 1
  files_modified: 5
---

# Phase 8 Plan 02: Backend - Memory Service Suggestion Layer Summary

**One-liner:** Implemented the complete Memory Service suggestion layer: repository, Redis Stream publishing, service business logic with ownership verification, and HTTP handlers with internal API for Processor callback.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create Suggestion Repository | c9f6cff | services/memory-service/internal/repository/suggestion_repository.go |
| 2 | Extend Redis Queue and TaskQueue Interface | 4444ec8 | services/memory-service/internal/service/redis_queue.go, memory_service.go |
| 3 | Extend MemoryService with Suggestion Logic | bb1df65 | services/memory-service/internal/service/memory_service.go |
| 4 | Extend MemoryHandler with Suggestion Routes | 8b95d67 | services/memory-service/internal/transport/memory_handler.go |
| 5 | Wire Suggestion Repository in main.go | 375f39e | services/memory-service/cmd/main.go |
| - | Fix: Add EnableAISuggestion to domain model | df99be1 | services/memory-service/internal/domain/memory.go |

## What Was Built

### Suggestion Repository (suggestion_repository.go)
- **SuggestionRepository** interface with 4 methods: Create, GetByMemoryID, UpdateFeedback, DeleteByMemoryID
- **GormSuggestionRepository** implementation using GORM with context propagation
- **ErrSuggestionNotFound** error for not-found cases
- UpdateFeedback uses `RowsAffected` check to return ErrSuggestionNotFound when no row matches

### Redis Stream Integration (redis_queue.go)
- **PublishSuggestionGenerate** method added to RedisTaskQueue
- Publishes to `suggestion:generate` stream with fields: memory_id, content_type, content, style, note (if present), llmConfig (merged)
- TaskQueue interface extended with new method signature

### MemoryService Suggestion Logic (memory_service.go)
- **suggestionRepo** field added to MemoryService struct
- **NewMemoryService** now accepts 5 arguments including suggestionRepo
- **Create** returns `(*domain.Memory, string, error)` where string is suggestion_status ("pending", "skipped", "failed")
- **getUserSuggestionStyle** fetches user's AI style from settings JSONB, defaults to "inspiring"
- **GetSuggestion** verifies memory ownership before returning suggestion
- **CreateSuggestion** creates suggestion from internal API (Processor callback)
- **UpdateSuggestionFeedback** updates user feedback with ownership verification
- **ErrSuggestionNotFound** added to error variables

### HTTP Handlers (memory_handler.go)
- **GET /memories/:id/suggestion** - returns suggestion with ownership check
- **PATCH /memories/:id/suggestion/feedback** - updates feedback with validation
- **POST /internal/memories/:id/suggestion** - internal API for Processor, protected by internalAuthMiddleware, validates memory_id mismatch
- **Create** handler updated to return `{data: {memory, suggestion_status}}`
- All suggestion endpoints properly handle ErrMemoryNotFound, ErrUnauthorized, ErrSuggestionNotFound

### Wiring (main.go)
- **NewGormSuggestionRepository(db)** created and passed to NewMemoryService

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] EnableAISuggestion field missing from domain model**
- **Found during:** Task 3 verification (build failure)
- **Issue:** `CreateMemoryRequest` in domain/memory.go was missing the `EnableAISuggestion bool` field despite being specified in 08-01 plan
- **Fix:** Added `EnableAISuggestion bool` field with `json:"enable_ai_suggestion" binding:"omitempty"` tag
- **Files modified:** services/memory-service/internal/domain/memory.go
- **Commit:** df99be1

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: elevation | services/memory-service/internal/transport/memory_handler.go | GetSuggestion and UpdateSuggestionFeedback call Get() first to verify memory ownership before operating on suggestions (mitigates T-08-04, T-08-05) |
| threat_flag: spoofing | services/memory-service/internal/transport/memory_handler.go | POST /internal/memories/:id/suggestion protected by internalAuthMiddleware Bearer token validation (mitigates T-08-03) |

## Self-Check: PASSED

- [x] `services/memory-service/internal/repository/suggestion_repository.go` exists with SuggestionRepository interface and GormSuggestionRepository implementation
- [x] `services/memory-service/internal/service/redis_queue.go` has PublishSuggestionGenerate with correct signature
- [x] `services/memory-service/internal/service/memory_service.go` has suggestionRepo field, updated constructor, Create returns suggestion_status, getUserSuggestionStyle, GetSuggestion, CreateSuggestion, UpdateSuggestionFeedback
- [x] `services/memory-service/internal/transport/memory_handler.go` has GetSuggestion, UpdateSuggestionFeedback, CreateSuggestion handlers, updated Create handler with suggestion_status
- [x] `services/memory-service/cmd/main.go` wires suggestionRepo into NewMemoryService
- [x] `services/memory-service/internal/domain/memory.go` has EnableAISuggestion field in CreateMemoryRequest
- [x] `go build ./services/memory-service/...` compiles without errors
- [x] Internal API endpoint protected by internalAuthMiddleware
- [x] All 6 commits verified in git log
