# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Echoes (拾忆)** — A personal semantic search engine. Users save text snippets and links, which are automatically vectorized and stored, enabling natural language semantic retrieval and similar-content recommendations.

- **Product motto:** "拾起遗落的记忆" (Pick up lost memories)
- **Design aesthetic:** Notion-like minimalism, generous whitespace, dark mode support, subtle animations (200-300ms ease-out)
- **Content density:** Between Notion and Twitter — memory cards 80-120px, 3-line previews, 16px element spacing

## Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | Next.js 14 (App Router), Tailwind CSS, shadcn/ui, Framer Motion | SSR/SSG, RSC, Notion-like design system |
| API Gateway | Go + Gin | v1.9+, lightweight, high performance |
| Backend Services | Go + GORM | Standard microservice pattern, type-safe |
| Vector/ML Services | Python + FastAPI, BGE-M3 model | FastAPI for async ML workloads, BGE-M3 optimized for Chinese |
| LLM Provider | OpenAI / Anthropic | Factory pattern switch via `LLM_PROVIDER` env var. Lightweight abstraction (200 lines) instead of LangChain/LlamaIndex |
| Database | PostgreSQL 15 + pgvector extension | Single database for relational + vector; IVFFlat index sufficient for 10k+ rows |
| Cache/Queue | Redis 7 (Stream for message queue) | Lightweight, reliable, supports consumer groups |
| Object Storage | MinIO (S3-compatible) | Compatible with AWS S3 SDK |
| Observability | Prometheus + OpenTelemetry + Zap | Metrics/Tracing/Logging. Sprint 5 **must** implement. Alternative: StatsD + Zipkin/Jaeger |
| Deployment | Docker Compose (local), Kubernetes (production) | Progressive deployment |

### Tech Stack Selection Principle

> **Capability > Tool Name.** If a preferred tool is unavailable, use a substitute that provides the same capability. Always document the substitution.

| Capability | Primary | Alternatives | Key Requirements |
|------------|---------|--------------|------------------|
| ReAct Reasoning | Self-built Go | Any multi-step reasoning + tool-call framework | Agent think-act-observe loop |
| MCP Protocol | Self-built | gRPC / HTTP / OpenAPI | Standardized interface |
| LLM Framework | Lightweight abstraction | LangChain / LlamaIndex | Multi-model switch, RAG |
| Vector DB | pgvector | Milvus / Pinecone / Weaviate | 768-dim, cosine, scalable |
| Observability | Prometheus + OTel | StatsD + Zipkin / Jaeger | Metrics/Tracing/Logging |

**Rationale for self-built over off-the-shelf:**
- **ReAct / MCP**: Agent logic is lightweight (auto-tag + RAG QA). Self-built keeps code simple and controllable.
- **LLM abstraction**: Only need multi-model switch + basic RAG. LangChain is overkill; 200 lines of custom code suffices.
- **pgvector**: Same database as relational data, reduces ops complexity. IVFFlat performs well at 10k+ row scale.

## Architecture

Microservices layout (Phase 1):

```
Next.js Web App
       |
Gateway Service (Go) — routing, auth middleware, rate limiting
       |
       +--------+----------------+
       |        |                |
User Service  Memory Service    (Async via Redis Stream)
(Go)          (Go)                |
                               +--+----------------+--+
                               |  |                |  |
                          Processor          Vectorizer
                          (Python)           (Python)
                          - link scraping    - BGE-M3 vectorization
                          - auto-tagging
                               |
                         PostgreSQL + Redis
```

Search lives in Memory Service for Phase 1; will split to dedicated Search Service if query volume grows.

## Directory Structure

```
Echoes/
├── docker-compose.yml          # Local dev environment
├── docker-compose.prod.yml     # Production environment
├── Makefile                    # Common commands
├── dev-start.ps1               # Windows startup script
├── dev-start.sh                # macOS/Linux startup script
├── k8s/                        # Kubernetes manifests (00-50 numbered)
├── web/                        # Next.js frontend
│   ├── app/                    # App Router
│   │   ├── (auth)/             # Login, register (grouped route)
│   │   └── (main)/             # Timeline, search, memory detail
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── memory/
│   │   ├── search/
│   │   └── layout/
│   └── package.json
├── services/                   # Backend microservices
│   ├── gateway/                # Go, cmd/main.go + internal/
│   ├── user-service/           # Go, domain/repository/service/transport layers
│   ├── memory-service/         # Go, same structure as user-service
│   ├── processor-service/      # Python FastAPI, app/main.py + app/services/
│   └── vectorizer-service/     # Python FastAPI, same structure
└── shared/
    ├── migrations/             # SQL migrations (001_init.sql)
    └── proto/                  # gRPC protobuf definitions (reserved)
```

## Development Commands

### Start Local Environment

```bash
# Full stack (recommended)
make dev-start

# Or manually with Docker Compose
docker-compose up -d

# Windows PowerShell alternative
./dev-start.ps1
```

### Database Migrations

```bash
# After services are running
make migrate

# Or manually with psql
psql postgres://echoes_user:password@localhost:5432/echoes -f shared/migrations/001_init.sql
```

### Service Development (individual)

```bash
# Go services
cd services/gateway && go run cmd/main.go
cd services/user-service && go run cmd/main.go
cd services/memory-service && go run cmd/main.go

# Python services
cd services/processor-service && uvicorn app.main:app --reload --port 8001
cd services/vectorizer-service && uvicorn app.main:app --reload --port 8002

# Next.js frontend
cd web && npm run dev
```

### Testing a Single Service

```bash
# Go
go test ./... -run TestFunctionName

# Next.js
npm test -- --testNamePattern="pattern"
```

## Windows Development

**WSL2 is the recommended development environment.** All `make` commands, shell scripts, and Go/Python tooling should run inside WSL2.

If `make` is unavailable on Windows natively, use `mingw32-make` or run `wsl make`.

The repository enforces LF line endings via `.gitattributes`. Do not commit CRLF line endings.

## Async Task Flow

Memory creation triggers background jobs via Redis Streams:

| Task | Queue Name | Producer | Consumer |
|------|-----------|----------|----------|
| Link scraping | `link:fetch` | Memory Service | Processor |
| Text vectorization | `text:vectorize` | Memory Service | Vectorizer |
| Auto-tagging | `tag:generate` | Memory Service | Processor |

Processing status field: `pending → processing → completed/failed`

## Database Schema Notes

Key tables: `users`, `memories`

- `memories.vector` is `VECTOR(768)` (pgvector extension required)
- `memories.tags` is `VARCHAR(50)[]` (PostgreSQL array)
- `memories.metadata` is `JSONB`
- Both tables have `update_updated_at_column()` trigger

## API Conventions

- Base path: `/api/v1/`
- Auth endpoints: `/api/v1/auth/*`
- Memory endpoints: `/api/v1/memories/*`
- Search endpoint: `/api/v1/search?q=...&limit=10`
- JWT token auth required for all endpoints except auth routes

## Naming Conventions

| Resource | Name |
|----------|------|
| Project directory | `Echoes` |
| Database | `echoes` |
| Database user | `echoes_user` |
| Kubernetes namespace | `echoes` |
| Docker container prefix | `echoes-` |
| Code package/module | `echoes` |
| Web page title | `拾忆 - Echoes` (Chinese priority) or `Echoes` (English mode) |
| API base path | `/api/v1/...` |

## Git Conventions

**Branch strategy:**
- `main`: Stable branch, merged at end of each Sprint
- `develop`: Development branch, daily commits
- `feature/*`: Feature branches, single feature per branch

**Commit frequency:** At least once per day when there is progress.

**Commit format:** Conventional Commits
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation update
- `refactor:` Code refactoring
- `test:` Test-related changes
- `chore:` Build/config changes

**Pre-commit checks:**
- Code compiles/builds successfully
- No sensitive info (grep for password/key/secret in diff)
- All changed files reviewed in `git diff`

**Push strategy:**
- Sprint end: **must** push to GitHub
- Key milestones: **must** push (DB model complete, auth working, search working, etc.)
- Daily end: **should** push

## Development Plan (Sprint-Based)

The project is built in 6 one-week sprints:

| Sprint | Week | Focus |
|--------|------|-------|
| 0 | 1 | Infrastructure — Docker Compose, DB, directory structure |
| 1 | 2 | Auth — User Service, Gateway, OAuth, login pages |
| 2 | 3 | Capture — Memory Service, text/link input, timeline UI |
| 3 | 4 | Processing — Processor, Vectorizer, auto-tags, async queue |
| 4 | 5 | Search — Semantic search, similar recommendations, dark mode |
| 5 | 6 | Observability + Polish — Prometheus/OTel/Zap, animations, responsive, error handling, e2e testing |

Each sprint must produce a runnable version. Check `PRD.md` for full API definitions, data models, and UI specifications.

## Important Files

- `PRD.md` — Full product requirements, API specs, database schema, K8s deployment guide
- `docker-compose.yml` — Local service orchestration
- `Makefile` — Common development tasks
- `shared/migrations/001_init.sql` — Database initialization
