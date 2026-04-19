# Architecture

**Analysis Date:** 2026-04-19

## Pattern Overview

**Overall:** Microservices with API Gateway pattern

**Key Characteristics:**
- Single-entry gateway with reverse proxy routing to backend services
- Layered architecture within each Go service (domain/service/repository/transport)
- Async task processing via Redis Streams (fire-and-forget from producer perspective)
- JWT-based stateless authentication with dual validation (Gateway + Service)
- PostgreSQL as single source of truth for relational and vector data (pgvector)

## Service Topology

```
Browser/Next.js
       |
       v
   Gateway (Go + Gin) :8080
       |  - JWT validation
       |  - CORS handling
       |  - Reverse proxy
       |
   +---+---+-------------------+
   |       |                   |
   v       v                   v
User    Memory            (Redis Streams)
Service Service               |
:8001   :8002               +--+----------------+--+
   |       |                |  |                |  |
   v       v                v  v                v  v
PostgreSQL              Processor          Vectorizer
(pgvector)              (Python)           (Python)
                        :8003              :8004
```

## Layers

**Gateway Layer:**
- Purpose: Single entry point, auth middleware, reverse proxy, CORS
- Location: `services/gateway/`
- Contains: HTTP router, JWT middleware, reverse proxy configuration
- Depends on: Environment variables for service URLs and JWT secret
- Used by: All frontend clients

**User Service Layer:**
- Purpose: User registration, authentication, OAuth, token management
- Location: `services/user-service/`
- Contains: Auth handlers, auth service, user repository, user domain models
- Depends on: PostgreSQL (GORM), JWT library, bcrypt, GitHub OAuth API
- Used by: Gateway (routed via `/api/v1/auth/*`)

**Memory Service Layer:**
- Purpose: Memory CRUD, timeline listing, search, async task publishing
- Location: `services/memory-service/`
- Contains: Memory handlers, memory service, memory repository, Redis queue publisher
- Depends on: PostgreSQL (GORM + pgvector), Redis Streams
- Used by: Gateway (routed via `/api/v1/memories/*`, `/api/v1/search`)

**Processor Service (Async Worker):**
- Purpose: Link scraping, content extraction, auto-tag generation
- Location: `services/processor-service/`
- Contains: FastAPI app (stub, Sprint 3 implementation)
- Depends on: Redis Streams (consumer)
- Consumes from: `link:fetch`, `tag:generate` streams

**Vectorizer Service (Async Worker):**
- Purpose: BGE-M3 text embedding generation
- Location: `services/vectorizer-service/`
- Contains: FastAPI app (stub, Sprint 3 implementation)
- Depends on: Redis Streams (consumer)
- Consumes from: `text:vectorize` stream

**Frontend Layer:**
- Purpose: React SPA with SSR/SSG via Next.js App Router
- Location: `web/`
- Contains: Pages, components, API client, auth provider, theme provider
- Depends on: Gateway API (`NEXT_PUBLIC_API_URL`)

## Data Flow

**Authentication Flow (Email/Password):**

1. Browser submits `POST /api/v1/auth/register` or `POST /api/v1/auth/login`
2. Gateway receives request, `JWTAuth()` middleware skips (public route)
3. Gateway reverse-proxies to User Service (`:8001`)
4. User Service validates credentials, generates JWT token pair (access 15min, refresh 7d)
5. Response returns `{user, token}` to browser
6. Browser stores token in `localStorage` + cookie (`echoes_token`)
7. Subsequent requests include `Authorization: Bearer <token>` header

**Authentication Flow (GitHub OAuth):**

1. Browser clicks "GitHub Login" → `GET /api/v1/auth/github`
2. Gateway proxies to User Service, which generates state and redirects to GitHub
3. GitHub redirects to `GET /api/v1/auth/github/callback?code=...&state=...`
4. User Service exchanges code for token, fetches user info, creates/links user
5. Redirects browser to `http://localhost:3000/login#token=...&refresh_token=...`
6. `AuthProvider` detects hash, extracts tokens, clears URL, sets auth state

**Memory Creation Flow:**

1. Browser submits `POST /api/v1/memories` with `Authorization: Bearer <token>`
2. Gateway `JWTAuth()` validates token, extracts `userID`, sets `X-User-ID` header
3. Gateway reverse-proxies to Memory Service (`:8002`)
4. Memory Service creates memory record with `processing_status = 'pending'`
5. Memory Service publishes async tasks to Redis Streams:
   - `link:fetch` (if content_type = link)
   - `text:vectorize` (for all memories)
   - `tag:generate` (for all memories)
6. Response returns memory to browser
7. Processor/Vectorizer services (future) consume streams and update memory

**Memory List/Timeline Flow:**

1. Browser requests `GET /api/v1/memories?page=1&limit=20`
2. Gateway validates JWT, injects `X-User-ID`
3. Memory Service queries `memories` table filtered by `user_id`, ordered by `created_at DESC`
4. Optional tag filter: `WHERE ? = ANY(tags)`
5. Response returns paginated list with total count

## Key Abstractions

**Repository Pattern:**
- Purpose: Data access abstraction, enables testability
- Examples: `services/user-service/internal/repository/user_repository.go`, `services/memory-service/internal/repository/memory_repository.go`
- Pattern: Interface definition + GORM implementation

**Service Layer:**
- Purpose: Business logic, orchestrates repositories and external calls
- Examples: `services/user-service/internal/service/auth_service.go`, `services/memory-service/internal/service/memory_service.go`
- Pattern: Struct with dependencies injected via constructor

**Handler/Transport Layer:**
- Purpose: HTTP request/response handling, input validation
- Examples: `services/user-service/internal/transport/auth_handler.go`, `services/memory-service/internal/transport/memory_handler.go`
- Pattern: Gin handler functions, JSON binding with `gin.H{}` responses

**TaskQueue Interface:**
- Purpose: Abstract async task publishing for testability
- Location: `services/memory-service/internal/service/memory_service.go` (interface), `services/memory-service/internal/service/redis_queue.go` (implementation)
- Pattern: Interface with `PublishLinkFetch`, `PublishTextVectorize`, `PublishTagGenerate`

## Entry Points

**Gateway Service:**
- Location: `services/gateway/cmd/main.go`
- Triggers: Docker container start, `go run cmd/main.go`
- Responsibilities: Configure Gin router, attach middleware, start HTTP server on `:8080`

**User Service:**
- Location: `services/user-service/cmd/main.go`
- Triggers: Docker container start, `go run cmd/main.go`
- Responsibilities: Connect to DB, initialize repository/service/handler layers, start HTTP server on `:8001`

**Memory Service:**
- Location: `services/memory-service/cmd/main.go`
- Triggers: Docker container start, `go run cmd/main.go`
- Responsibilities: Connect to DB, initialize repository/queue/service/handler layers, start HTTP server on `:8002`

**Processor Service:**
- Location: `services/processor-service/app/main.py`
- Triggers: Docker container start, `uvicorn app.main:app --reload --port 8003`
- Responsibilities: FastAPI app with lifespan manager for background Redis consumers

**Vectorizer Service:**
- Location: `services/vectorizer-service/app/main.py`
- Triggers: Docker container start, `uvicorn app.main:app --reload --port 8004`
- Responsibilities: FastAPI app with lifespan manager for BGE-M3 model loading and Redis consumers

**Next.js Frontend:**
- Location: `web/app/layout.tsx`
- Triggers: `npm run dev` (port 3000)
- Responsibilities: Root layout with ThemeProvider and AuthProvider wrapping all pages

## Authentication & Authorization

**JWT Token Strategy:**
- Access token: 15 minutes expiry, signed with HS256
- Refresh token: 7 days expiry, same secret
- Secret: `JWT_SECRET` env var (fallback to hardcoded dev secret)
- Library: `github.com/golang-jwt/jwt/v5`

**Dual Validation:**
- Gateway validates JWT and injects `X-User-ID` header (`services/gateway/internal/middleware/auth.go`)
- User Service also validates JWT directly for `/me` endpoint (`services/user-service/internal/transport/auth_handler.go`)
- Memory Service trusts `X-User-ID` header from Gateway (no re-validation)

**Public Routes (Gateway):**
- `/api/v1/auth/register`
- `/api/v1/auth/login`
- `/api/v1/auth/providers`
- `/api/v1/auth/github`
- `/api/v1/auth/github/callback`
- `/api/v1/auth/refresh`
- `/health`

**Frontend Auth:**
- Token stored in `localStorage` (key: `echoes_token`) and cookie (`echoes_token`)
- Cookie used by Next.js middleware (`web/middleware.ts`) for SSR route protection
- `AuthProvider` context provides `user`, `isAuthenticated`, `login()`, `logout()`

**OAuth State Management:**
- In-memory map with mutex and 10-minute TTL (`services/user-service/internal/transport/auth_handler.go`)
- Production note: should migrate to Redis

## Async Task Flow (Redis Streams)

**Producer:** Memory Service (`services/memory-service/internal/service/redis_queue.go`)

**Streams:**
| Stream Name | Purpose | Consumer |
|-------------|---------|----------|
| `link:fetch` | Scrape link content, extract title/summary | Processor Service |
| `text:vectorize` | Generate BGE-M3 embedding (768-dim) | Vectorizer Service |
| `tag:generate` | Auto-generate tags from content | Processor Service |

**Message Format:**
```go
map[string]interface{}{
    "memory_id": "<uuid>",
    "link_url":  "<url>",  // for link:fetch
    "content":   "<text>", // for vectorize/tag
}
```

**Processing Status Lifecycle:**
- `pending` → `processing` → `completed` / `failed`

## Error Handling

**Strategy:** Centralized error mapping in handlers with consistent JSON response format

**Response Format:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

**Error Codes:**
- `UNAUTHORIZED` - Missing/invalid token
- `TOKEN_EXPIRED` - Expired JWT
- `INVALID_CREDENTIALS` - Wrong email/password
- `USER_EXISTS` - Duplicate email
- `VALIDATION_ERROR` - Input validation failure
- `NOT_FOUND` - Resource not found
- `FORBIDDEN` - Access denied (wrong user)
- `INTERNAL_ERROR` - Server error
- `OAUTH_NOT_CONFIGURED` - Missing OAuth env vars
- `OAUTH_ERROR` - OAuth flow failure

## Cross-Cutting Concerns

**Logging:** Standard `log` package in Go services; `fmt.Printf` in development. Zap imported but not yet integrated (`go.uber.org/zap` in gateway go.mod).

**Validation:** Gin binding tags (`binding:"required,email"`) + manual validation in service layer

**CORS:** Handled at Gateway level (`services/gateway/internal/router/router.go`) with configurable origin, credentials, methods, headers

**Database Migrations:** SQL migration file at `shared/migrations/001_init.sql` + GORM AutoMigrate in service startup

---

*Architecture analysis: 2026-04-19*
