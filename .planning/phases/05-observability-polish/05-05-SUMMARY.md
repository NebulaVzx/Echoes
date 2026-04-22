---
phase: 05-observability-polish
plan: 05
subsystem: api
tags: [gin, cors, rate-limiting, validator, go-playground, middleware, security]

requires:
  - phase: 05-01
    provides: Zap logger, OTel tracing, Prometheus metrics middleware

provides:
  - Gateway CORS middleware using gin-contrib/cors with env-configurable origins
  - Per-user rate limiting via X-User-ID header with IP fallback
  - Unified ErrorResponse format with field-level validation details
  - go-playground/validator tags on all request structs (User + Memory services)
  - Internal error logging with generic client-facing messages

affects:
  - 05-06
  - 05-07

tech-stack:
  added:
    - github.com/gin-contrib/cors v1.7.7
  patterns:
    - "respondWithError / respondWithValidationError helper pattern in handlers"
    - "KeyExtractor pattern for flexible rate limiting"
    - "Validation tags on all request DTOs"

key-files:
  created:
    - services/gateway/internal/middleware/cors.go
  modified:
    - services/gateway/internal/middleware/ratelimit.go
    - services/gateway/internal/router/router.go
    - services/user-service/internal/domain/auth.go
    - services/user-service/internal/transport/auth_handler.go
    - services/memory-service/internal/domain/memory.go
    - services/memory-service/internal/transport/memory_handler.go

key-decisions:
  - "Use gin-contrib/cors instead of manual CORS for proper Vary header and origin matching"
  - "Extend existing RateLimiter with KeyExtractor interface rather than separate struct"
  - "Duplicate error helper functions per service instead of shared package (simpler, no circular deps)"
  - "Keep RateLimit() backward-compatible wrapper using IP extractor"

patterns-established:
  - "Handler error response: always use respondWithError/respondWithValidationError, never raw gin.H"
  - "Internal errors: log with Zap, return generic INTERNAL_ERROR to client"
  - "Rate limiting: auth routes = IP-based (strict), protected routes = per-user (lenient per user)"

requirements-completed:
  - R6.5
  - R6.6
  - R6.7

duration: 25min
completed: 2026-04-21
---

# Phase 05 Plan 05: Backend Polish Summary

**Gateway CORS with gin-contrib/cors, per-user rate limiting, go-playground/validator tags, and unified ErrorResponse across all Go handlers**

## Performance

- **Duration:** 25 min
- **Started:** 2026-04-21T12:53:00Z
- **Completed:** 2026-04-21T13:18:37Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Replaced manual CORS with gin-contrib/cors supporting env-configurable origins
- Extended token bucket rate limiter with KeyExtractor for per-user limiting
- Added validation tags (email, password length, URL, enums) to all request structs
- Unified all handler error responses with field-level validation details
- Internal errors now logged server-side but hidden from client responses

## Task Commits

Each task was committed atomically:

1. **Task 1: Enhance Gateway CORS and rate limiting** - `9a19c3a` (feat)
2. **Task 2: Add validation tags and unified error responses to User Service** - `2827ed4` (feat)
3. **Task 3: Add validation tags and unified error responses to Memory Service** - `0770bbd` (feat)

## Files Created/Modified
- `services/gateway/internal/middleware/cors.go` - New CORS middleware using gin-contrib/cors
- `services/gateway/internal/middleware/ratelimit.go` - Added KeyExtractor, RateLimitByUser, userIDExtractor
- `services/gateway/internal/router/router.go` - Uses middleware.CORS() and middleware.RateLimitByUser()
- `services/user-service/internal/domain/auth.go` - Validation tags on RegisterRequest, LoginRequest, LLMSettings
- `services/user-service/internal/transport/auth_handler.go` - Unified error helpers, all errors use respondWithError
- `services/memory-service/internal/domain/memory.go` - Validation tags on CreateMemoryRequest, UpdateMemoryRequest
- `services/memory-service/internal/transport/memory_handler.go` - Unified error helpers, Zap logging for internal errors

## Decisions Made
- Used gin-contrib/cors instead of manual CORS for proper Vary header and origin matching
- Extended existing RateLimiter with KeyExtractor interface rather than creating a separate struct
- Duplicated error helper functions per service to avoid introducing a shared package and potential circular dependencies
- Kept RateLimit() as a backward-compatible wrapper using the IP extractor

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Gateway build failed initially because gin-contrib/cors was not persisted in go.mod after first `go get`. Re-ran `go get` and `go mod tidy` to resolve.
- Unused `strings` import in router.go after removing inline corsMiddleware(). Removed import and recompiled.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: info_disclosure_mitigated | services/user-service/internal/transport/auth_handler.go | OAuth errors now return generic message instead of err.Error() |
| threat_flag: info_disclosure_mitigated | services/memory-service/internal/transport/memory_handler.go | Internal errors logged with Zap, generic INTERNAL_ERROR returned to client |
| threat_flag: dos_mitigated | services/gateway/internal/middleware/ratelimit.go | Per-user rate limiting prevents single user from exhausting global quota |
| threat_flag: spoofing_mitigated | services/gateway/internal/middleware/cors.go | gin-contrib/cors handles origin validation and Vary: Origin correctly |

## Self-Check: PASSED

- [x] `services/gateway/internal/middleware/cors.go` exists
- [x] `services/gateway/internal/middleware/ratelimit.go` modified
- [x] `services/gateway/internal/router/router.go` modified
- [x] `services/user-service/internal/domain/auth.go` modified
- [x] `services/user-service/internal/transport/auth_handler.go` modified
- [x] `services/memory-service/internal/domain/memory.go` modified
- [x] `services/memory-service/internal/transport/memory_handler.go` modified
- [x] Commit `9a19c3a` exists (gateway)
- [x] Commit `2827ed4` exists (user-service)
- [x] Commit `0770bbd` exists (memory-service)
- [x] All 3 Go services compile successfully

## Next Phase Readiness
- Backend polish complete. Ready for frontend error handling (05-06) and e2e testing (05-07).
- No blockers.

---
*Phase: 05-observability-polish*
*Completed: 2026-04-21*
