---
plan: 10-01
phase: 10-warmth-of-memory
status: complete
date: 2026-04-26
tasks_completed: 8
---

# 10-01 Summary: Database Schema + Streaks & Daily Stats APIs

## What Was Built

Implemented the backend foundation for Phase 10 "记忆的温度":

1. **Database migration** (`shared/migrations/003_time_capsule.sql`)
   - Added `sealed_until` TIMESTAMP column to `memories` table
   - Created `idx_memories_sealed_until` index for efficient filtering

2. **Domain model updates** (`services/memory-service/internal/domain/memory.go`)
   - Added `SealedUntil *time.Time` field to `Memory` struct
   - Added `SealMemoryRequest`, `UnsealMemoryRequest`, `SerendipityResponse`, `DailyReview` structs
   - Updated `SafeResponse()` to include `sealed_until`

3. **Repository extensions** (`services/memory-service/internal/repository/memory_repository.go`)
   - Updated `ListByUser` signature with `excludeSealed bool` parameter
   - Added `GetMemoriesByDateRange`, `GetRandomMemory`, `GetMemoriesByDay`, `GetMemoriesOnDate`, `CountMemoriesSince`
   - All warmth queries exclude sealed memories appropriately

4. **Service methods** (`services/memory-service/internal/service/memory_service.go`)
   - `GetStreak`: Grace-based streak calculation (1-day gap allowed), returns current/longest/has_recorded_today
   - `GetSerendipity`: Prioritizes memory from ~1 year ago, falls back to random memory older than 30 days
   - `GetDailyReview`: Counts today's memories, extracts top 3 tags, picks a worth-reviewing old memory
   - Updated `Create` to support `sealed_until` in creation flow

5. **HTTP handlers** (`services/memory-service/internal/transport/memory_handler.go`)
   - `GET /api/v1/memories/streaks` — returns streak stats
   - `GET /api/v1/memories/serendipity` — returns "that day in history" memory
   - `GET /api/v1/memories/daily-review` — returns daily review stats

6. **Post-execution fixes**
   - Removed unused `oneYearAgo` variable in `GetSerendipity`
   - Added missing mock repository methods for tests (`CountMemoriesSince`, `GetMemoriesByDateRange`, etc.)

## Key Decisions

- Grace-based streaks: 1-day gap allowed (Day 2 without recording doesn't break streak)
- Serendipity fallback: random memory older than 30 days when no exact 1-year match
- Daily review "worth reviewing" pick: oldest memory not from today

## Self-Check

- [x] `go build ./services/memory-service/...` passes
- [x] All new API endpoints registered in router
- [x] Domain structs include proper JSON tags
- [x] Repository methods properly scoped by user_id

## Deviations

None.
