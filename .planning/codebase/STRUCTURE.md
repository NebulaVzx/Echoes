# Codebase Structure

**Analysis Date:** 2026-04-19

## Directory Layout

```
Echoes/
├── docker-compose.yml              # Local dev environment (all services + infra)
├── docker-compose.prod.yml         # Production environment
├── Makefile                        # Common dev commands (dev-start, migrate)
├── dev-start.ps1                   # Windows PowerShell startup script
├── dev-start.sh                    # macOS/Linux startup script
├── PRD.md                          # Full product requirements doc
├── CLAUDE.md                       # Project instructions for Claude Code
├── .env                            # Environment variables (not committed)
├── k8s/                            # Kubernetes manifests (empty, reserved)
├── shared/
│   ├── migrations/
│   │   └── 001_init.sql            # Database schema initialization
│   └── proto/                      # gRPC protobuf definitions (reserved)
├── services/
│   ├── gateway/                    # Go API Gateway (reverse proxy + auth)
│   │   ├── cmd/main.go
│   │   ├── internal/middleware/auth.go
│   │   └── internal/router/router.go
│   ├── user-service/               # Go User Service (auth, OAuth)
│   │   ├── cmd/main.go
│   │   └── internal/
│   │       ├── config/database.go
│   │       ├── domain/
│   │       │   ├── user.go
│   │       │   └── auth.go
│   │       ├── repository/user_repository.go
│   │       ├── service/auth_service.go
│   │       └── transport/auth_handler.go
│   ├── memory-service/             # Go Memory Service (CRUD, search, queue)
│   │   ├── cmd/main.go
│   │   └── internal/
│   │       ├── config/database.go
│   │       ├── domain/memory.go
│   │       ├── repository/memory_repository.go
│   │       ├── service/
│   │       │   ├── memory_service.go
│   │       │   └── redis_queue.go
│   │       └── transport/memory_handler.go
│   ├── processor-service/          # Python FastAPI (link scraping, auto-tags)
│   │   ├── app/main.py
│   │   └── Dockerfile
│   └── vectorizer-service/         # Python FastAPI (BGE-M3 embeddings)
│       ├── app/main.py
│       └── Dockerfile
└── web/                            # Next.js 14 frontend
    ├── app/                        # App Router
    │   ├── layout.tsx              # Root layout (providers)
    │   ├── globals.css             # Tailwind + custom styles
    │   ├── (auth)/                 # Auth route group
    │   │   ├── login/page.tsx
    │   │   └── register/page.tsx
    │   ├── (main)/                 # Main app route group
    │   │   ├── layout.tsx
    │   │   ├── page.tsx              # Home / timeline
    │   │   └── memory/[id]/page.tsx  # Memory detail
    │   ├── memory/[id]/page.tsx      # Duplicate detail page (legacy)
    │   ├── providers/
    │   │   ├── auth-provider.tsx
    │   │   └── theme-provider.tsx
    │   └── search/                 # Search page (empty, reserved)
    ├── components/
    │   ├── logo.tsx
    │   ├── memory/
    │   │   ├── create-memory-form.tsx
    │   │   └── memory-card.tsx
    │   ├── search/                 # Empty, reserved
    │   ├── layout/                 # Empty, reserved
    │   └── ui/                     # Empty, reserved for shadcn/ui
    ├── lib/api.ts                  # Centralized API client
    ├── hooks/                      # Empty, reserved
    ├── middleware.ts               # Next.js route protection
    ├── next.config.js
    ├── tailwind.config.ts
    └── package.json
```

## Directory Purposes

**`services/gateway/`:**
- Purpose: API Gateway - single entry point for all client requests
- Contains: Go source, Dockerfile, go.mod
- Key files: `cmd/main.go`, `internal/router/router.go`, `internal/middleware/auth.go`

**`services/user-service/`:**
- Purpose: User management, authentication, OAuth
- Contains: Go source with layered architecture
- Key files: `internal/transport/auth_handler.go` (277 lines), `internal/service/auth_service.go`

**`services/memory-service/`:**
- Purpose: Memory CRUD, timeline, search, async task publishing
- Contains: Go source with layered architecture + Redis queue
- Key files: `internal/transport/memory_handler.go` (192 lines), `internal/service/memory_service.go` (170 lines)

**`services/processor-service/`:**
- Purpose: Link scraping and auto-tagging (Sprint 3)
- Contains: Python FastAPI stub
- Key files: `app/main.py`

**`services/vectorizer-service/`:**
- Purpose: BGE-M3 text embedding generation (Sprint 3)
- Contains: Python FastAPI stub
- Key files: `app/main.py`

**`web/`:**
- Purpose: Next.js 14 frontend with App Router
- Contains: React components, pages, API client, providers
- Key files: `app/layout.tsx`, `lib/api.ts` (188 lines), `app/(main)/page.tsx` (145 lines)

**`shared/migrations/`:**
- Purpose: Database schema definitions
- Contains: SQL migration files
- Key files: `001_init.sql`

**`shared/proto/`:**
- Purpose: gRPC protobuf definitions (reserved for future)
- Contains: Empty

**`k8s/`:**
- Purpose: Kubernetes deployment manifests (reserved for future)
- Contains: Empty

## Key File Locations

**Entry Points:**
- `services/gateway/cmd/main.go`: Gateway service entry point (port 8080)
- `services/user-service/cmd/main.go`: User service entry point (port 8001)
- `services/memory-service/cmd/main.go`: Memory service entry point (port 8002)
- `services/processor-service/app/main.py`: Processor service entry point (port 8003)
- `services/vectorizer-service/app/main.py`: Vectorizer service entry point (port 8004)
- `web/app/layout.tsx`: Next.js root layout

**Configuration:**
- `docker-compose.yml`: Local development orchestration
- `web/next.config.js`: Next.js build config (standalone output)
- `web/tailwind.config.ts`: Tailwind CSS with custom gray palette
- `web/tsconfig.json`: TypeScript config with `@/*` path alias
- `services/*/go.mod`: Go module definitions

**Core Logic:**
- `services/gateway/internal/middleware/auth.go`: JWT validation middleware
- `services/gateway/internal/router/router.go`: Route configuration and reverse proxy
- `services/user-service/internal/service/auth_service.go`: Auth business logic
- `services/memory-service/internal/service/memory_service.go`: Memory business logic
- `services/memory-service/internal/service/redis_queue.go`: Redis Stream publisher
- `web/lib/api.ts`: Frontend API client with token management

**Database:**
- `shared/migrations/001_init.sql`: Initial schema (users, memories, indexes)
- `services/user-service/internal/config/database.go`: GORM connection + auto-migrate
- `services/memory-service/internal/config/database.go`: GORM connection + pgvector extension

**Testing:**
- No test files detected in services/
- `web/package.json` has jest configured (`npm test`)
- `services/user-service/user-service-test/` directory exists (untracked, likely test artifacts)

## Naming Conventions

**Files:**
- Go: `snake_case.go` (e.g., `auth_handler.go`, `memory_service.go`)
- TypeScript/React: `kebab-case.tsx` (e.g., `create-memory-form.tsx`, `auth-provider.tsx`)
- Python: `snake_case.py` (e.g., `main.py`)
- SQL: `NNN_description.sql` (e.g., `001_init.sql`)

**Directories:**
- Go services: `cmd/`, `internal/config/`, `internal/domain/`, `internal/repository/`, `internal/service/`, `internal/transport/`
- Python services: `app/`, `app/services/`
- Next.js routes: `(group)/`, `[param]/`

**Go Types/Interfaces:**
- Interfaces: `Noun` + `Repository`/`Service`/`Handler` suffix (e.g., `UserRepository`, `TaskQueue`)
- Structs implementing interfaces: `Gorm` + `Noun` + `Repository` (e.g., `GormUserRepository`)
- Domain structs: PascalCase noun (e.g., `User`, `Memory`, `TokenPair`)
- Request/Response structs: `Action` + `Noun` + `Request`/`Response` (e.g., `CreateMemoryRequest`)

**React Components:**
- Default export function name matches file name in PascalCase
- Props interface: `ComponentName` + `Props` (e.g., `MemoryCardProps`)

## Where to Add New Code

**New API Endpoint:**
- Gateway routing: `services/gateway/internal/router/router.go`
- Handler: `services/{service}/internal/transport/{resource}_handler.go`
- Service: `services/{service}/internal/service/{resource}_service.go`
- Repository: `services/{service}/internal/repository/{resource}_repository.go`
- Domain: `services/{service}/internal/domain/{resource}.go`

**New Frontend Page:**
- Route: `web/app/(main)/{page-name}/page.tsx` (for authenticated pages)
- Route: `web/app/(auth)/{page-name}/page.tsx` (for public pages)

**New React Component:**
- Feature-specific: `web/components/{feature}/{component-name}.tsx`
- Shared UI: `web/components/ui/{component-name}.tsx` (shadcn/ui convention)

**New API Client Method:**
- Location: `web/lib/api.ts`
- Add method to `ApiClient` class with typed request/response

**New Database Migration:**
- Location: `shared/migrations/002_{description}.sql`
- Run via `make migrate` or `docker-compose up` (initdb.d)

**New Async Task Stream:**
- Publisher: Add method to `TaskQueue` interface in `services/memory-service/internal/service/memory_service.go`
- Publisher implementation: `services/memory-service/internal/service/redis_queue.go`
- Consumer: Add to `services/processor-service/app/main.py` or `services/vectorizer-service/app/main.py`

## Special Directories

**`.next/`:**
- Purpose: Next.js build output and cache
- Generated: Yes
- Committed: No (in `.gitignore`)

**`web/node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes
- Committed: No (in `.gitignore`)

**`shared/proto/`:**
- Purpose: gRPC protobuf definitions
- Generated: No
- Committed: Yes (reserved for future microservice communication)

**`k8s/`:**
- Purpose: Kubernetes deployment manifests
- Generated: No
- Committed: Yes (empty, reserved for Sprint 5/6)

**`services/user-service/user-service-test/`:**
- Purpose: Unknown (untracked in git)
- Generated: Possibly
- Committed: No

---

*Structure analysis: 2026-04-19*
