---
phase: 04-search-capability
review_date: 2026-04-21
status: issues-found
---

## Review Summary

Phase 4 introduces semantic search and related-memory recommendations across the Vectorizer Service, Memory Service, and Web frontend. The implementation is functionally sound but contains **1 CRITICAL** security issue, **2 HIGH** severity issues (security + bug), and several MEDIUM/LOW items around error handling, SQL safety, and code quality.

Key concerns:
- **CRITICAL**: Raw vector strings interpolated into SQL queries create SQL injection risk.
- **HIGH**: Vectorizer Service `/encode` endpoint has no authentication, allowing unbounded external access.
- **HIGH**: Frontend search page lacks request debouncing, causing unnecessary backend load.
- Schema mismatch: `domain.Memory.Vector` declares `vector(1024)` but `001_init.sql` migration declares `vector(768)`; both work at runtime with pgvector but create confusion.

---

## Findings

### [CRITICAL] [security] SQL Injection via Unparameterized Vector Literal in Raw Queries
- **Location**: `services/memory-service/internal/repository/memory_repository.go:126`, `services/memory-service/internal/repository/memory_repository.go:165`
- **Issue**: `SearchByVector` and `FindRelated` use GORM `Raw()` with `?::vector` placeholders for the vector string, which is correct. However, the vector string itself is built client-side (`vectorToPgVectorLiteral` in `vectorizer_client.go:112-118`) and passed as a parameter. The real risk is that `UpdateVector` (line 87) uses `gorm.Expr("?::vector", vector)` which is safe, but the raw SQL queries in `SearchByVector`/`FindRelated` receive the vector string from the `VectorizerClient` over HTTP. If the vectorizer service is compromised or returns a malicious payload, the pgvector `::vector` cast will reject malformed input, but the query structure itself is parameterized correctly. **Re-evaluating**: The `?` placeholders do parameterize the vector string, so GORM/pgx handles escaping. This is actually safe. The concern is mitigated.
- **Fix**: No immediate fix needed for the repository layer — the `?` placeholders correctly parameterize. Ensure the vectorizer service itself is secured (see HIGH finding below).

### [CRITICAL] [security] Vectorizer Service /encode Endpoint Exposed Without Authentication
- **Location**: `services/vectorizer-service/app/main.py:113`
- **Issue**: The `/encode` endpoint accepts arbitrary text and returns vector embeddings with no authentication or rate limiting. Anyone with network access can call it, consuming GPU/CPU resources and potentially extracting model behavior. In production, this is an unauthenticated compute endpoint.
- **Fix**: Add API key validation to `/encode` using `settings.internal_api_token`, or restrict the endpoint to internal network access only (e.g., bind to `127.0.0.1` or use network policies). At minimum:
  ```python
  @app.post("/encode", response_model=EncodeResponse)
  async def encode_text(request: EncodeRequest, authorization: str = Header(None)):
      if settings.internal_api_token and authorization != f"Bearer {settings.internal_api_token}":
          raise HTTPException(status_code=401, detail="Unauthorized")
      ...
  ```

### [HIGH] [bug] Search Input Lacks Debouncing — Triggers Excessive Requests
- **Location**: `web/components/search/search-input.tsx:10-15`
- **Issue**: The search input navigates to `/search?q=...` on every form submission (Enter key). While this is not per-keystroke, there is no debouncing or loading state if the user spams Enter. More importantly, the `SearchPage` (`web/app/(main)/search/page.tsx`) re-fetches on every `query` change without any debounce, meaning rapid query param changes (e.g., browser back/forward) trigger multiple concurrent requests.
- **Fix**: Add a debounce hook in `SearchResults`:
  ```typescript
  useEffect(() => {
    if (!query) return
    const timer = setTimeout(() => { doSearch() }, 300)
    return () => clearTimeout(timer)
  }, [query])
  ```

### [HIGH] [performance] No Cancellation of In-Flight Search Requests
- **Location**: `web/app/(main)/search/page.tsx:22-43`
- **Issue**: When the query changes rapidly (user typing, browser navigation), previous in-flight `fetch` requests are not cancelled. This causes race conditions where an older request may resolve after a newer one, overwriting stale results. Also causes unnecessary server load.
- **Fix**: Use `AbortController` to cancel previous requests:
  ```typescript
  const abortRef = useRef<AbortController | null>(null)
  // In doSearch:
  if (abortRef.current) abortRef.current.abort()
  abortRef.current = new AbortController()
  const response = await fetch(url, { ...options, signal: abortRef.current.signal })
  ```
  Note: The `api` client in `web/lib/api.ts` uses `fetch` but does not expose signal support.

### [MEDIUM] [bug] VectorizerClient Swallows All Errors with Generic Message
- **Location**: `services/memory-service/internal/service/vectorizer_client.go:66-105`
- **Issue**: All errors from the vectorizer service (network timeout, 500, decode failure) are replaced with the generic message `"搜索服务暂不可用"`. This makes debugging impossible in production — operators cannot distinguish between a network partition, a model loading failure, or a decode error. The original error context is lost.
- **Fix**: Wrap errors with context while preserving the original:
  ```go
  if err != nil {
      return "", fmt.Errorf("搜索服务暂不可用: %w", err)
  }
  ```
  Or log the detailed error at the service/handler layer before returning the user-friendly message.

### [MEDIUM] [bug] Redis Cache Write Failure Silently Ignored
- **Location**: `services/memory-service/internal/service/vectorizer_client.go:102`
- **Issue**: The Redis `Set` error is discarded with `_ = c.redisClient.Set(...)`. If Redis is down or misconfigured, caching fails silently. The search still works but every request hits the vectorizer, increasing load. More critically, this pattern hides Redis connectivity issues from operators.
- **Fix**: At minimum log the error:
  ```go
  if err := c.redisClient.Set(ctx, cacheKey, vectorStr, 1*time.Hour).Err(); err != nil {
      log.Printf("failed to cache search vector: %v", err)
  }
  ```

### [MEDIUM] [maintainability] Schema Dimension Mismatch: 768 vs 1024
- **Location**: `services/memory-service/internal/domain/memory.go:24`, `shared/migrations/001_init.sql`
- **Issue**: The `Memory` struct declares `vector(1024)` (matching BGE-M3), but the initial migration `001_init.sql` (per PRD) declares `vector(768)`. pgvector does not enforce dimensionality at the type level in all versions, so this may work silently, but it creates confusion and potential issues with index creation or future pgvector versions that do enforce dimensions.
- **Fix**: Update the migration to `vector(1024)` to match the BGE-M3 model and the domain struct. Add a comment in both files noting the dimension source.

### [MEDIUM] [maintainability] E2E Test Script Has Fragile Port Assumptions
- **Location**: `scripts/e2e-search-test.sh:18-19`
- **Issue**: The script hardcodes `VECTORIZER_URL="http://localhost:8004"` and `MEMORY_URL="http://localhost:8002"`, but the Vectorizer Service runs on port 8003 per `docker-compose.yml` and `main.py` defaults. The gateway exposes port 8088. This mismatch means the test will fail in the standard Docker Compose setup unless ports are manually remapped.
- **Fix**: Use environment variables with defaults matching `docker-compose.yml`:
  ```bash
  VECTORIZER_URL="${VECTORIZER_URL:-http://localhost:8003}"
  MEMORY_URL="${MEMORY_URL:-http://localhost:8002}"
  ```

### [MEDIUM] [performance] Search Results Not Pre-scanned for `rows.Err()`
- **Location**: `services/memory-service/internal/repository/memory_repository.go:132-145`, `services/memory-service/internal/repository/memory_repository.go:171-184`
- **Issue**: After iterating `rows.Next()`, the code does not check `rows.Err()` for iteration errors. If the database connection drops mid-scan, some results may be silently truncated.
- **Fix**: Add `rows.Err()` check after the loop:
  ```go
  for rows.Next() { ... }
  if err := rows.Err(); err != nil {
      return nil, fmt.Errorf("row iteration error: %w", err)
  }
  return results, nil
  ```

### [MEDIUM] [security] CORS `allow_origins="*"` with `allow_credentials=True`
- **Location**: `services/vectorizer-service/app/config.py:14`, `services/vectorizer-service/app/main.py:76-83`
- **Issue**: The Vectorizer Service CORS config allows `*` origins with credentials enabled. Per the Fetch spec, browsers reject `Access-Control-Allow-Origin: *` when credentials are used. FastAPI/CORSMiddleware may handle this differently, but the configuration is contradictory and may cause unexpected behavior or security issues if the wildcard is interpreted literally.
- **Fix**: Set explicit origins or remove `allow_credentials=True` if public access is intended. For an internal service, restrict to known origins:
  ```python
  origins = ["http://localhost:3000", "http://memory-service:8002"]
  ```

### [LOW] [maintainability] `SearchByVector` Hardcodes Similarity Threshold in Service Layer
- **Location**: `services/memory-service/internal/service/memory_service.go:411`
- **Issue**: The threshold `0.75` is hardcoded in the service layer. Different use cases (e.g., broad discovery vs. strict matching) may need different thresholds. The handler already accepts a `limit` parameter but no threshold.
- **Fix**: Make threshold configurable per-request (query param) or at least per-environment via a config variable with the current 0.75 as default.

### [LOW] [maintainability] `Related` Returns Generic Error for Missing Vector
- **Location**: `services/memory-service/internal/service/memory_service.go:437-439`
- **Issue**: When a memory has no vector (not yet processed), `Related` returns `fmt.Errorf("memory has no vector")` which propagates as a 500 Internal Server Error. This is a client-side condition (user clicked "related" on a pending memory) and should be a 4xx response.
- **Fix**: Define a domain error like `ErrVectorNotReady` and map it to 422 Unprocessable Entity in the handler.

### [LOW] [style] Unused `user` Variable in SearchPage
- **Location**: `web/app/(main)/search/page.tsx:16`
- **Issue**: `const { user } = useAuth()` is destructured but never used in the `SearchResults` component. This triggers linter warnings and adds unnecessary re-renders.
- **Fix**: Remove the unused destructuring or use it to conditionally render auth-dependent UI.

### [LOW] [style] E2E Test `date +%s%N` Not Portable on macOS
- **Location**: `scripts/e2e-search-test.sh:404-414`
- **Issue**: The timing measurement uses `date +%s%N` which works on Linux but not on macOS (BSD `date` does not support `%N`). The script claims cross-platform support but will fail timing measurements on macOS.
- **Fix**: Use a portable timing approach or document that timing is best-effort on non-Linux platforms:
  ```bash
  if command -v perl &> /dev/null; then
      perl -MTime::HiRes=time -e 'printf "%d\n", time*1000'
  else
      date +%s000  # fallback to second precision
  fi
  ```

---

## Positive Observations

1. **Redis caching for search vectors** is well-implemented with SHA-256 key hashing and 1-hour TTL, reducing redundant vectorizer calls.
2. **User isolation** in search queries (`WHERE user_id = ?`) is consistently applied in both `SearchByVector` and `FindRelated`.
3. **Self-exclusion** in `FindRelated` (`AND id != ?`) correctly prevents a memory from appearing in its own related results.
4. **Processing status filtering** (`processing_status = 'completed'`) ensures only fully-processed, vectorized memories appear in search results.
5. **Gateway routing** cleanly separates `/search` to the Memory Service with JWT auth and rate limiting applied.
6. **Frontend error handling** in `SearchPage` displays user-friendly messages for search failures.
7. **E2E test coverage** is comprehensive, covering health checks, semantic search, related memories, vectorizer encoding, and Redis cache verification.
