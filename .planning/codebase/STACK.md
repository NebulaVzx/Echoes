# Technology Stack

**Analysis Date:** 2026-04-19

## Languages

**Primary:**
- **Go** 1.22/1.23 — Backend microservices (gateway, user-service, memory-service)
- **TypeScript** 5.3.3 — Next.js frontend (`web/`)
- **Python** 3.11 — ML/AI services (processor-service, vectorizer-service)
- **SQL** — Database migrations and schema definitions

**Secondary:**
- **Bash/PowerShell** — Dev startup scripts (`dev-start.sh`, `dev-start.ps1`)
- **Dockerfile** — Multi-stage container builds for all services

## Runtime

**Environment:**
- **Node.js** 20 (Alpine) — Frontend runtime, via `node:20-alpine` Docker image
- **Go** 1.23 (Alpine) — Backend runtime, via `golang:1.23-alpine` Docker image
- **Python** 3.11 (slim) — ML services runtime, via `python:3.11-slim` Docker image

**Package Manager:**
- **npm** — Frontend (`web/package.json`, `web/package-lock.json`)
- **Go modules** — Backend (`go.mod`, `go.sum` in each service)
- **pip** — Python services (`requirements.txt` in each service)
- Lockfiles: `package-lock.json` present for frontend; `go.sum` present for Go services

## Frameworks

**Core:**
- **Next.js** 14.2.0 — React frontend framework with App Router (`web/`)
- **React** 18.2.0 — UI library
- **Gin** 1.9.1 — Go HTTP web framework (gateway, user-service, memory-service)
- **FastAPI** 0.110.0 — Python async web framework (processor-service, vectorizer-service)
- **GORM** 1.25.7 — Go ORM for PostgreSQL (user-service, memory-service)

**UI/Styling:**
- **Tailwind CSS** 3.4.1 — Utility-first CSS framework
- **Framer Motion** 11.0.8 — React animation library
- **shadcn/ui** — Component primitives (class-variance-authority 0.7.0, tailwind-merge 2.2.1)
- **Lucide React** 0.344.0 — Icon library

**Testing:**
- **Jest** 29.7.0 — JavaScript/TypeScript test runner (`web/`)
- **React Testing Library** 14.2.1 + jest-dom 6.4.2 — React component testing
- **Go test** — Built-in Go testing (`go test ./...`)
- **pytest** — Python testing (referenced in `Makefile`)

**Build/Dev:**
- **Docker** + **Docker Compose** 3.8 — Container orchestration
- **PostCSS** 8.4.35 + **Autoprefixer** 10.4.18 — CSS processing
- **Uvicorn** 0.27.1 — ASGI server for Python services

## Key Dependencies

**Critical:**
- **pgvector** (PostgreSQL extension) — Vector similarity search for 768-dim embeddings
- **BGE-M3** (via `sentence-transformers` 2.5.1 + `transformers` 4.38.2) — Chinese-optimized text embedding model
- **PyTorch** 2.2.1 — Deep learning framework for vectorizer service
- **JWT** (`golang-jwt/jwt/v5` 5.2.0) — Token-based authentication
- **bcrypt** (`golang.org/x/crypto` 0.21.0) — Password hashing (cost=12)

**Infrastructure:**
- **go-redis/v9** 9.5.1 — Redis client for Go (memory-service)
- **redis** 5.0.3 (Python) — Redis client for Python services
- **pgx** (via GORM) — PostgreSQL driver
- **httpx** 0.27.0 — Async HTTP client for Python (link scraping)
- **BeautifulSoup4** 4.12.3 + **lxml** 5.1.0 — HTML parsing for link scraping
- **Pydantic** 2.6.4 — Python data validation
- **Zod** 4.3.6 — TypeScript schema validation
- **Zap** 1.27.0 — Structured logging (gateway)
- **React Hook Form** 7.72.1 + **@hookform/resolvers** 5.2.2 — Form handling

## Configuration

**Environment:**
- `.env` file present at project root (contains `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`)
- Environment-specific Docker Compose files:
  - `docker-compose.yml` — Local development
  - `docker-compose.prod.yml` — Production
- Service-specific env vars configured in Docker Compose

**Build:**
- `web/next.config.js` — Next.js standalone output, unoptimized images
- `web/tsconfig.json` — TypeScript with path alias `@/*`
- `web/tailwind.config.ts` — Custom gray scale, dark mode via class
- `web/postcss.config.js` — Tailwind + Autoprefixer
- Each service has its own `Dockerfile` with multi-stage builds (builder/production/development)

**Key Config Files:**
- `D:/xProjects/Vibe/Echoes/docker-compose.yml` — Local dev orchestration
- `D:/xProjects/Vibe/Echoes/docker-compose.prod.yml` — Production orchestration
- `D:/xProjects/Vibe/Echoes/Makefile` — Common development commands
- `D:/xProjects/Vibe/Echoes/web/next.config.js` — Frontend build config
- `D:/xProjects/Vibe/Echoes/web/tailwind.config.ts` — Design system tokens

## Platform Requirements

**Development:**
- Docker Desktop with WSL2 (recommended on Windows)
- Docker Compose
- Make (or `mingw32-make` on Windows natively)
- Ports required: 3000 (web), 8088/8080 (gateway), 8001 (user), 8002 (memory), 8003 (processor), 8004 (vectorizer), 5432 (PostgreSQL), 6379 (Redis), 9000/9001 (MinIO)

**Production:**
- Docker Compose or Kubernetes (K8s manifests reserved in `k8s/` directory, currently empty)
- PostgreSQL 15+ with pgvector extension
- Redis 7+ with persistence
- MinIO object storage

---

*Stack analysis: 2026-04-19*
