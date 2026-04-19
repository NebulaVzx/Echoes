# Codebase Concerns

**Analysis Date:** 2026-04-19

---

## Severity Legend

| Level | Description |
|-------|-------------|
| **CRITICAL** | Immediate security risk, data loss, or production outage potential. Fix before any deployment. |
| **HIGH** | Significant functional gap or architectural flaw. Blocks scaling or introduces major technical debt. |
| **MEDIUM** | Should be addressed in next sprint. Workarounds exist but degrade quality or maintainability. |
| **LOW** | Nice-to-have improvements. Does not block current functionality. |

---

## CRITICAL

### C1: Hardcoded JWT Secret in Source Code

- **Issue:** The JWT signing secret has a hardcoded fallback value `"echoes_dev_secret_key_change_in_production"` that is compiled into the binary.
- **Files:**
  - `services/gateway/internal/middleware/auth.go` (line 17-21)
  - `services/user-service/internal/service/auth_service.go` (line 36-39)
  - `docker-compose.yml` (line 80) — also hardcoded in container env
- **Impact:** If `JWT_SECRET` env var is unset in production, all tokens are signed with a publicly known secret from the Git repository. Complete authentication bypass.
- **Fix:** Remove the fallback entirely. Fail fast (panic/log.Fatal) if `JWT_SECRET` is not set. Rotate any tokens ever signed with the dev secret.

### C2: GitHub OAuth Credentials Committed to `.env`

- **Issue:** `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are stored in the committed `.env` file at repository root.
- **Files:** `.env`
- **Impact:** Leaked OAuth credentials allow attackers to impersonate the application in GitHub OAuth flows. The `.env` file is tracked by git (not in `.gitignore`).
- **Fix:**
  1. Immediately revoke the leaked GitHub OAuth app credentials.
  2. Add `.env` to `.gitignore`.
  3. Rotate to new credentials stored only in deployment secrets (Docker secrets, K8s secrets, or CI env vars).
  4. Scrub git history or treat these credentials as permanently compromised.

### C3: Permissive CORS — Reflects Any Origin with Credentials

- **Issue:** The gateway CORS middleware reflects the request's `Origin` header verbatim and sets `Access-Control-Allow-Credentials: true`.
- **Files:** `services/gateway/internal/router/router.go` (line 16-34)
- **Impact:** Any malicious website can make authenticated cross-origin requests on behalf of logged-in users. Classic CSRF bypass via CORS misconfiguration.
- **Fix:** Whitelist exact origins. In development: `http://localhost:3000`. In production: the deployed frontend domain(s). Never reflect arbitrary origins when credentials are allowed.

### C4: No Rate Limiting on Any Endpoint

- **Issue:** No rate limiting middleware is applied to any route. Login, register, and OAuth endpoints are fully exposed to brute-force and enumeration attacks.
- **Files:**
  - `services/gateway/internal/router/router.go`
  - `services/user-service/internal/transport/auth_handler.go`
  - `services/memory-service/internal/transport/memory_handler.go`
- **Impact:** Credential stuffing, user enumeration, DDoS via expensive endpoints (e.g., memory creation with async task publishing).
- **Fix:** Add per-IP and per-user rate limiting in the Gateway. Start with strict limits on `/api/v1/auth/*` (e.g., 5 req/min per IP).

### C5: No Input Sanitization / XSS Risk in Memory Content

- **Issue:** User-provided `text_content`, `link_url`, `note`, and `tags` are stored and returned without any HTML sanitization. The frontend renders `text_content` with `whitespace-pre-wrap` and `link_url` as an `<a>` href.
- **Files:**
  - `services/memory-service/internal/service/memory_service.go` (Create, Update)
  - `web/app/(main)/memory/[id]/page.tsx` (line 188 — renders text_content directly)
  - `web/components/memory/memory-card.tsx` (line 56 — renders preview directly)
- **Impact:** Stored XSS. An attacker can inject `<script>` tags or `javascript:` URLs into memory content. When another user views the memory, the script executes in their session.
- **Fix:** Sanitize all user text inputs server-side (e.g., `bluemonday` in Go, or DOMPurify on frontend). Validate `link_url` is a valid HTTP(S) URL before storing.

---

## HIGH

### H1: OAuth State Parameter Stored In-Memory (No TTL Cleanup)

- **Issue:** GitHub OAuth CSRF `state` values are stored in a process-local `map[string]time.Time` with a 10-minute expiry, but expired entries are never cleaned up. The map grows unbounded.
- **Files:** `services/user-service/internal/transport/auth_handler.go` (line 20-46)
- **Impact:** Memory leak in the user-service process. Under high OAuth traffic, the service will OOM. Also, state validation is relaxed in non-production environments (lines 185-191), creating a bypass vector.
- **Fix:** Replace in-memory store with Redis (with TTL). The comment on line 20 even says "Production should use Redis with TTL" — this is acknowledged debt.

### H2: Async Task Errors Silently Ignored

- **Issue:** Redis Stream publish errors in `publishTasks()` are silently discarded with `_ =`.
- **Files:** `services/memory-service/internal/service/memory_service.go` (line 75-87)
- **Impact:** If Redis is unavailable, memories are created but never processed (link scraping, vectorization, tagging). Users see "pending" forever with no retry mechanism. Data inconsistency between DB and queue.
- **Fix:**
  1. Do not silently ignore publish errors. Return them to the caller or at least log them with `zap`.
  2. Implement an outbox pattern: write tasks to a `pending_tasks` DB table, then have a background worker publish to Redis. This guarantees at-least-once delivery.

### H3: No Database Connection Pool Configuration

- **Issue:** GORM is opened with default connection pool settings. No `SetMaxOpenConns`, `SetMaxIdleConns`, or `SetConnMaxLifetime` is configured.
- **Files:**
  - `services/user-service/internal/config/database.go`
  - `services/memory-service/internal/config/database.go`
- **Impact:** Under load, the services can exhaust PostgreSQL connection limits or hold stale connections indefinitely. Default GORM pools are often too aggressive for production.
- **Fix:** Configure explicit pool limits (e.g., max 25 open, max 5 idle, 30min lifetime) based on expected concurrency.

### H4: Processor and Vectorizer Services Are Stubs

- **Issue:** The Python processor-service and vectorizer-service only have health check endpoints. They do not consume from Redis Streams or implement any business logic.
- **Files:**
  - `services/processor-service/app/main.py`
  - `services/vectorizer-service/app/main.py`
- **Impact:** Memories created with `processing_status: "pending"` will never transition to "completed". Semantic search is non-functional. Auto-tagging is non-functional. Link scraping is non-functional. The core product value proposition is unimplemented.
- **Fix:** Sprint 3 must implement Redis Stream consumers, BGE-M3 model loading, and link scraping logic. Until then, the product is not feature-complete.

### H5: Gateway Has No Health Check / Circuit Breaker for Backends

- **Issue:** The reverse proxy in the Gateway forwards requests to user-service and memory-service without checking if they are healthy. If a backend is down, the Gateway returns a generic 502/503 with no graceful degradation.
- **Files:** `services/gateway/internal/router/router.go` (line 60-82)
- **Impact:** Cascading failures. If memory-service is down, all authenticated requests fail even if they don't need memory data. Poor user experience.
- **Fix:** Implement health check polling for backends. Return a structured error when a service is unavailable. Consider circuit breaker pattern for transient failures.

### H6: No TLS / SSL in Any Configuration

- **Issue:** All Docker Compose configurations use `sslmode=disable` (dev) or no explicit TLS termination. Services communicate over plain HTTP inside the Docker network.
- **Files:**
  - `docker-compose.yml` (line 101, 127)
  - `docker-compose.prod.yml` (line 81)
- **Impact:** Credentials and JWT tokens traverse the network in plaintext. In a multi-node deployment, this is a critical security gap.
- **Fix:** Use `sslmode=require` in production. Add TLS termination at the Gateway (or via reverse proxy like Traefik/Nginx). Enable inter-service mTLS for K8s deployments.

---

## MEDIUM

### M1: No Refresh Token Rotation or Revocation

- **Issue:** Refresh tokens are valid for 7 days with no rotation on use. There is no server-side token blacklist. The `Logout` handler is a no-op (line 157-161).
- **Files:**
  - `services/user-service/internal/service/auth_service.go` (line 176-183)
  - `services/user-service/internal/transport/auth_handler.go` (line 157-161)
- **Impact:** Stolen refresh tokens can be used for up to 7 days with no way to revoke them. A user clicking "logout" does not actually invalidate their session server-side.
- **Fix:** Implement refresh token rotation (issue new refresh token on each use). Store token jti in Redis with expiry for revocation support. Make logout add the token to a Redis blacklist.

### M2: Frontend Cookie `max-age` Hardcoded to 15 Minutes (Mismatched with Token)

- **Issue:** The `api.ts` sets a cookie with `max-age=900` (15 minutes) to match the access token expiry, but the Next.js middleware only checks cookie presence, not expiry.
- **Files:** `web/lib/api.ts` (line 72)
- **Impact:** After 15 minutes, the cookie expires but localStorage still has the token. The middleware may redirect to login while the API client still has a valid token (or vice versa). Inconsistent auth state between server and client.
- **Fix:** Use a longer-lived session cookie or implement sliding expiry. Ensure middleware and API client use the same token source and expiry logic.

### M3: No Pagination on Memory List (Frontend Hardcodes Page 1)

- **Issue:** The homepage `loadMemories` always requests `page: 1, limit: 20`. There is no infinite scroll or pagination UI.
- **Files:** `web/app/(main)/page.tsx` (line 42)
- **Impact:** Users cannot view more than 20 memories. The API supports pagination but the UI does not.
- **Fix:** Implement infinite scroll or pagination controls in the timeline UI.

### M4: Memory Update Does Not Re-trigger Vectorization

- **Issue:** When a memory's tags or note are updated via `Update()`, the content may have changed significantly, but no new vectorization task is published.
- **Files:** `services/memory-service/internal/service/memory_service.go` (line 145-159)
- **Impact:** Semantic search results become stale after updates. The vector embedding no longer represents the current content.
- **Fix:** Re-publish `text:vectorize` task on update if `text_content` or `link_url` changes. Currently only `tags` and `note` are updatable — consider allowing content edits.

### M5: `gin.DebugMode` in Production Dockerfile Targets

- **Issue:** Both user-service and memory-service set `gin.SetMode(gin.DebugMode)` unconditionally. The production Docker images run with debug mode enabled.
- **Files:**
  - `services/user-service/cmd/main.go` (line 33)
  - `services/memory-service/cmd/main.go` (line 41)
- **Impact:** Debug mode exposes stack traces in HTTP responses and verbose logging. Information disclosure risk.
- **Fix:** Set mode based on `ENV` or `GIN_MODE` environment variable: `gin.SetMode(gin.ReleaseMode)` when `ENV=production`.

### M6: No Request Body Size Limits

- **Issue:** No `MaxMultipartMemory` or request body size limits are configured on Gin routers. Users can upload arbitrarily large text content.
- **Files:** All service `cmd/main.go` files.
- **Impact:** Memory exhaustion DoS. A single request with a multi-megabyte JSON body could crash the service.
- **Fix:** Add `c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 1<<20)` (1MB) or configure Gin limits.

### M7: `isPublicRoute` Uses `strings.HasPrefix` — Potential Path Bypass

- **Issue:** The public route check uses `strings.HasPrefix` which can be tricked by paths like `/api/v1/auth/register/evil`.
- **Files:** `services/gateway/internal/middleware/auth.go` (line 85-101)
- **Impact:** A path like `/api/v1/auth/register/x` would be treated as public, bypassing JWT validation. However, Gin routing would 404 this, so the practical risk is low unless new routes are added that match the prefix.
- **Fix:** Use exact path matching or ensure the route list ends with `/` and the check includes a trailing slash requirement.

### M8: Docker Compose `depends_on` Does Not Wait for Service Readiness

- **Issue:** `depends_on` with `condition: service_started` (or default) only waits for container start, not for the service to actually accept connections.
- **Files:** `docker-compose.yml` (lines 84-88, 132-136)
- **Impact:** Race conditions on startup. Gateway may start before user-service is ready, causing initial requests to fail.
- **Fix:** Use `condition: service_healthy` for all service dependencies (already done for postgres/redis, but missing for gateway -> user/memory services).

---

## LOW

### L1: No Structured Logging (Only `log.Printf`)

- **Issue:** All Go services use standard library `log` instead of structured logging (Zap is in gateway's `go.mod` but unused).
- **Files:** All `cmd/main.go` files and handlers.
- **Impact:** Logs are not machine-parseable. No correlation IDs for distributed tracing. Debugging production issues is difficult.
- **Fix:** Replace `log.Printf` with `zap.Logger`. Add request IDs to all logs. This is planned for Sprint 5 per `CLAUDE.md`.

### L2: No API Versioning Strategy Beyond URL Path

- **Issue:** The API uses `/api/v1/` but there is no migration or deprecation strategy for v2.
- **Files:** All route definitions.
- **Impact:** Future API changes will be breaking with no graceful transition path.
- **Fix:** Document versioning policy. Consider Accept header versioning as an alternative.

### L3: Frontend Uses `window.location.href` for Navigation

- **Issue:** Multiple pages use `window.location.href = '/'` instead of Next.js `router.push()` or `<Link>`.
- **Files:**
  - `web/app/(auth)/login/page.tsx` (line 27, 59)
  - `web/app/(auth)/register/page.tsx` (line 44)
  - `web/app/providers/auth-provider.tsx` (line 64)
- **Impact:** Full page reloads instead of client-side transitions. Worse UX and loses React state.
- **Fix:** Use `useRouter` from `next/navigation` for programmatic navigation.

### L4: Empty K8s Directory

- **Issue:** `k8s/` directory exists but is empty. No Kubernetes manifests are present.
- **Files:** `k8s/`
- **Impact:** Production deployment plan references K8s but has no implementation.
- **Fix:** Create K8s manifests (deployment, service, ingress, configmap, secret) or remove the directory if Docker Compose is the only target.

### L5: `go.mod` Go Version Inconsistency

- **Issue:** Gateway and memory-service use `go 1.22`, but user-service uses `go 1.23`.
- **Files:** All `go.mod` files.
- **Impact:** Minor, but inconsistent toolchain versions can cause build reproducibility issues.
- **Fix:** Standardize on a single Go version (1.23) across all services.

### L6: No Test Files Exist

- **Issue:** Zero test files across the entire codebase. `make test` will fail or run empty test suites.
- **Files:** Entire codebase.
- **Impact:** No automated safety net for refactors. Bugs can only be caught manually.
- **Fix:** Add unit tests for service layers, repository mocks, and API handler edge cases. Add Jest tests for React components.

### L7: `SafeResponse()` Manually Constructs Maps Instead of Using JSON Tags

- **Issue:** Both `User.SafeResponse()` and `Memory.SafeResponse()` manually build `map[string]interface{}` instead of relying on `json:"-"` tags and direct struct serialization.
- **Files:**
  - `services/user-service/internal/domain/user.go` (line 30-40)
  - `services/memory-service/internal/domain/memory.go` (line 40-56)
- **Impact:** Risk of field drift — when new fields are added to the struct, `SafeResponse()` may forget to include or exclude them. Maintenance burden.
- **Fix:** Use separate DTO structs with proper JSON tags, or use a library like `jsonapi` / `mapstructure` for serialization.

### L8: Vectorizer Dockerfile Downloads Model on Every Build

- **Issue:** The vectorizer-service Dockerfile installs `torch`, `transformers`, and `sentence-transformers` but does not pre-download the BGE-M3 model weights. The model will be downloaded at container startup.
- **Files:** `services/vectorizer-service/Dockerfile`
- **Impact:** Slow container startup (minutes on first run). Unreliable if HuggingFace is down. Large runtime bandwidth usage.
- **Fix:** Add a build step that downloads and caches model weights into the image (e.g., `RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('BAAI/bge-m3')"`).

---

## Summary by Category

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Security | 4 (C1-C5) | 1 (H6) | 2 (M1, M5) | 0 |
| Architecture | 0 | 3 (H2, H4, H5) | 2 (M3, M8) | 2 (L2, L4) |
| Performance | 0 | 1 (H3) | 1 (M6) | 0 |
| Data Integrity | 0 | 1 (H2) | 1 (M4) | 0 |
| Maintainability | 0 | 0 | 1 (M7) | 4 (L1, L3, L5, L7) |
| Testing | 0 | 0 | 0 | 1 (L6) |

---

*Concerns audit: 2026-04-19*
