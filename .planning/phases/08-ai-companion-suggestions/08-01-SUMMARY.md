---
phase: 08
plan: 01
name: "Database Schema and API Types"
subsystem: backend + frontend
tags: [database, domain-models, api-types, ai-suggestions]
dependency_graph:
  requires: []
  provides: [08-02, 08-03, 08-04, 08-05]
  affects: [services/memory-service, services/user-service, web]
tech_stack:
  added: []
  patterns: [GORM domain models, TypeScript interfaces, PostgreSQL migration]
key_files:
  created:
    - shared/migrations/002_ai_suggestions.sql
  modified:
    - services/memory-service/internal/domain/memory.go
    - services/user-service/internal/domain/auth.go
    - web/lib/api.ts
decisions:
  - "D-01: ai_suggestions independent table with ON DELETE CASCADE, per 08-CONTEXT.md"
  - "D-10: User settings stored in users.settings JSONB: ai_suggestion_enabled, ai_suggestion_style"
  - "D-12: Configurable timeout (10-60s, default 30s) and max_retries (1-5, default 3) in users.settings"
metrics:
  duration: "15 minutes"
  completed_date: "2026-04-25"
  tasks: 3
  files_created: 1
  files_modified: 3
---

# Phase 8 Plan 01: Database Schema and API Types Summary

**One-liner:** Created ai_suggestions table migration, extended Go domain models with AISuggestion types and user AI settings, and added corresponding TypeScript API interfaces for the frontend.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create ai_suggestions database migration | fc915ed | shared/migrations/002_ai_suggestions.sql |
| 2 | Extend Memory Service domain models | 93211a3 | services/memory-service/internal/domain/memory.go |
| 3 | Extend User Settings domain and frontend types | f8aec62 | services/user-service/internal/domain/auth.go, web/lib/api.ts |

## What Was Built

### Database Migration (002_ai_suggestions.sql)
- **Table:** `ai_suggestions` with 6 columns matching D-01 from 08-CONTEXT.md
  - `id` (UUID PK), `memory_id` (UUID FK -> memories ON DELETE CASCADE)
  - `content` (TEXT NOT NULL), `suggestion_type` (VARCHAR(20))
  - `created_at` (TIMESTAMP WITH TIME ZONE), `user_feedback` (VARCHAR(20))
  - `metadata` (JSONB DEFAULT '{}')
- **Index:** `idx_ai_suggestions_memory_id` for fast memory lookup
- **Comments:** All table and columns documented

### Memory Service Domain Models
- **`AISuggestion`** — GORM struct with `TableName() "ai_suggestions"`, all 6 DB columns mapped
- **`CreateSuggestionRequest`** — Internal API request with validation (`required`, `max=500`, `oneof` for type)
- **`UpdateSuggestionFeedbackRequest`** — User feedback update (`liked|disliked|ignored`)
- **`SuggestionResponse`** — API response struct omitting metadata
- **`TaskStatusUpdate`** — Extended to include `suggestion:generate` in valid task types

### User Service Domain Models
- **`UserSettings`** — 4 new AI fields: `AISuggestionEnabled`, `AISuggestionStyle`, `AISuggestionTimeout`, `AISuggestionMaxRetries`
- **`AISettings`** — New struct with validation: style `oneof=gentle practical inspiring`, timeout `gte=10,lte=60`, max_retries `gte=1,lte=5`
- **`UpdateSettingsRequest`** — New `AI *AISettings` field for partial updates

### Frontend API Types (web/lib/api.ts)
- **`AISettings`** interface with 4 optional fields
- **`UserSettings`** extended with 4 AI fields
- **`UpdateSettingsRequest`** extended with `ai?: AISettings`
- **`AISuggestion`** interface with typed `suggestion_type` and `user_feedback` unions
- **`CreateMemoryResponse`** interface with `suggestion_status: 'pending'|'completed'|'skipped'|'failed'`

## Deviations from Plan

None — plan executed exactly as written.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: XSS-surface | web/lib/api.ts | `AISuggestion.content` will be rendered in UI; downstream plans must sanitize before rendering |

## Self-Check: PASSED

- [x] `shared/migrations/002_ai_suggestions.sql` exists with all required columns
- [x] `services/memory-service/internal/domain/memory.go` has AISuggestion, CreateSuggestionRequest, UpdateSuggestionFeedbackRequest, SuggestionResponse, and suggestion:generate in TaskStatusUpdate
- [x] `services/user-service/internal/domain/auth.go` has 4 AI fields in UserSettings, AISettings struct, and AI field in UpdateSettingsRequest
- [x] `web/lib/api.ts` has AISettings, AISuggestion, CreateMemoryResponse, and extended UserSettings/UpdateSettingsRequest
- [x] All style enum values consistent: gentle/practical/inspiring
- [x] All suggestion_type values consistent: emotion_support, knowledge_expand, action_suggest, connection, general
- [x] Timeout range 10-60, max_retries range 1-5
- [x] All 3 commits verified in git log
