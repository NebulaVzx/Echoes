# External Integrations

**Analysis Date:** 2026-04-19

## APIs & External Services

**Authentication:**
- **GitHub OAuth** — Third-party login provider
  - Implementation: Self-built OAuth flow in `services/user-service/internal/service/auth_service.go`
  - Endpoints:
    - Authorization: `https://github.com/login/oauth/authorize`
    - Token exchange: `https://github.com/login/oauth/access_token`
    - User info: `https://api.github.com/user`
  - Env vars: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_REDIRECT_URI`
  - Scope requested: `user:email`
  - Callback handler: `services/user-service/internal/transport/auth_handler.go` (redirects to frontend `/login#token=...`)

**LLM/AI (Planned):**
- **OpenAI / Anthropic** — Planned for Sprint 4+ auto-tagging and RAG QA
  - Implementation: Lightweight factory pattern abstraction (~200 lines) instead of LangChain/LlamaIndex
  - Switch via `LLM_PROVIDER` env var
  - Not yet implemented in current codebase

## Data Storage

**Databases:**
- **PostgreSQL 15** with **pgvector** extension
  - Local image: `pgvector/pgvector:pg15`
  - Production image: `ankane/pgvector:v0.5.1`
  - Connection: `DATABASE_URL` env var
  - ORM: GORM (Go), raw SQL for migrations
  - Key schema: `users`, `memories` tables with `VECTOR(768)` for embeddings
  - Index: `ivfflat` on `memories.vector` with `vector_cosine_ops`
  - Migration file: `shared/migrations/001_init.sql`

**Cache/Queue:**
- **Redis 7** (Alpine)
  - Image: `redis:7-alpine`
  - Local: no auth; Production: `--requirepass ${REDIS_PASSWORD}`
  - Uses: Message queue (Redis Streams), session/cache store
  - Async task queues:
    - `link:fetch` — Link scraping tasks
    - `text:vectorize` — Text embedding tasks
    - `tag:generate` — Auto-tagging tasks
  - Go client: `github.com/redis/go-redis/v9`
  - Python client: `redis==5.0.3`

**File Storage:**
- **MinIO** (S3-compatible object storage)
  - Image: `minio/minio:latest`
  - Console: port 9001; API: port 9000
  - Command: `server /data --console-address ":9001"`
  - Currently configured but not actively used in application code (reserved for future media uploads)

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based authentication + GitHub OAuth
- JWT library: `github.com/golang-jwt/jwt/v5`
- Token strategy:
  - Access token: 15 minutes expiry (HS256)
  - Refresh token: 7 days expiry
  - Storage: localStorage (frontend) + cookie (for Next.js middleware, 15 min)
- OAuth state: In-memory map with 10-minute TTL (production should use Redis)
- Middleware: Next.js `middleware.ts` checks `echoes_token` cookie; Gateway validates JWT Bearer tokens

## Monitoring & Observability

**Error Tracking:**
- Not yet implemented (Sprint 6 planned)

**Logs:**
- **Zap** 1.27.0 — Structured logging in Gateway service
- Standard `log` package in other Go services
- Print statements in Python services (to be replaced with proper logging)

**Metrics/Tracing (Planned):**
- **Prometheus** + **OpenTelemetry** — Planned for Sprint 6 observability
- Alternative documented: StatsD + Zipkin/Jaeger

## CI/CD & Deployment

**Hosting:**
- Local: Docker Compose
- Production: Docker Compose or Kubernetes
- K8s manifests directory: `k8s/` (currently empty, reserved for future)

**CI Pipeline:**
- Not configured (no `.github/workflows/`, no CI config files detected)

**Container Registry:**
- Local builds only; no external registry configured

## Environment Configuration

**Required env vars:**

| Variable | Used By | Purpose |
|----------|---------|---------|
| `GITHUB_CLIENT_ID` | user-service | GitHub OAuth app ID |
| `GITHUB_CLIENT_SECRET` | user-service | GitHub OAuth app secret |
| `GITHUB_REDIRECT_URI` | user-service | OAuth callback URL (defaults to localhost) |
| `JWT_SECRET` | gateway, user-service | JWT signing key |
| `DATABASE_URL` | user-service, memory-service | PostgreSQL connection string |
| `REDIS_URL` | All services | Redis connection string |
| `POSTGRES_PASSWORD` | Production only | PostgreSQL password |
| `REDIS_PASSWORD` | Production only | Redis password |
| `MINIO_ROOT_USER` | Production only | MinIO admin user |
| `MINIO_ROOT_PASSWORD` | Production only | MinIO admin password |
| `NEXT_PUBLIC_API_URL` | web frontend | Public API base URL |
| `API_URL` | web (server-side) | Internal API base URL |
| `USER_SERVICE_URL` | gateway | Internal user service address |
| `MEMORY_SERVICE_URL` | gateway | Internal memory service address |
| `VECTORIZER_SERVICE_URL` | memory-service | Internal vectorizer service address |
| `PROCESSOR_SERVICE_URL` | memory-service | Internal processor service address |
| `LLM_PROVIDER` | Planned (processor) | Switch between OpenAI/Anthropic |

**Secrets location:**
- `.env` file at project root (not committed, listed in `.gitignore`)
- Hardcoded dev defaults in Docker Compose and source code (marked with `change_in_production` comments)

## Webhooks & Callbacks

**Incoming:**
- `GET /api/v1/auth/github/callback` — GitHub OAuth callback handler
  - File: `services/user-service/internal/transport/auth_handler.go`
  - Extracts `code` and `state` query params
  - Exchanges code for token, fetches user info, creates/logs in user
  - Redirects to frontend `http://localhost:3000/login#token=...&refresh_token=...`

**Outgoing:**
- GitHub OAuth token exchange: `POST https://github.com/login/oauth/access_token`
- GitHub user info: `GET https://api.github.com/user`
- Internal service-to-service HTTP calls (gateway -> user-service/memory-service)

## Network Architecture

**Docker Network:**
- `echoes-network` (bridge driver) — All services communicate on this internal network

**Port Mapping (Local):**
| Service | Internal Port | External Port |
|---------|--------------|---------------|
| web | 3000 | 3000 |
| gateway | 8080 | 8088 |
| user-service | 8001 | — |
| memory-service | 8002 | — |
| processor-service | 8003 | — |
| vectorizer-service | 8004 | — |
| postgres | 5432 | 5432 |
| redis | 6379 | 6379 |
| minio | 9000, 9001 | 9000, 9001 |

---

*Integration audit: 2026-04-19*
