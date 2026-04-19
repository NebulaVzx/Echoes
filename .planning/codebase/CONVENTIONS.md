# Coding Conventions

**Analysis Date:** 2026-04-19

## Naming Patterns

**Go Files:**
- Package directories use lowercase with hyphens for service names: `user-service/`, `memory-service/`
- Go files use snake_case: `auth_handler.go`, `memory_service.go`, `user_repository.go`
- Internal packages follow Clean Architecture layers: `domain/`, `repository/`, `service/`, `transport/`, `config/`

**React/TypeScript Files:**
- Components use PascalCase: `MemoryCard.tsx`, `CreateMemoryForm.tsx`, `Logo.tsx`
- Hooks and utilities use camelCase: `useAuth.ts` (convention, though `useAuth` is in `auth-provider.tsx`)
- Page files use lowercase: `page.tsx`, `layout.tsx`
- Route groups use parentheses: `(auth)/`, `(main)/`

**Functions:**
- Go: PascalCase for exported, camelCase for unexported
  - Exported: `NewAuthService`, `RegisterRoutes`, `SafeResponse`
  - Unexported: `generateState`, `validateState`, `extractContent`, `publishTasks`
- TypeScript: camelCase for all functions
  - `login`, `logout`, `loadMemories`, `handleDelete`

**Variables:**
- Go: camelCase for local variables, PascalCase for exported struct fields
- TypeScript: camelCase for variables, PascalCase for types/interfaces

**Types:**
- Go: PascalCase structs with descriptive names: `AuthResponse`, `TokenPair`, `CreateMemoryRequest`
- TypeScript: PascalCase interfaces in `web/lib/api.ts`: `ApiResponse<T>`, `Memory`, `User`

## Code Style

**Formatting:**
- Go: `gofmt` enforced via Makefile (`make fmt-go`)
- TypeScript: ESLint via Next.js config (`next lint`, `next lint --fix`)
- No Prettier config detected; relies on Next.js defaults

**Linting:**
- Web: `eslint-config-next` (ESLint 8.57.0)
- Go: No explicit linter config; `gofmt` is the standard
- Python: No linting config detected

**Line Endings:**
- LF enforced via `.gitattributes`

## Import Organization

**Go Import Order:**
1. Standard library
2. Third-party packages
3. Internal project packages

Example from `services/user-service/internal/transport/auth_handler.go`:
```go
import (
    "crypto/rand"           // stdlib
    "encoding/hex"
    "fmt"
    "net/http"
    "os"
    "sync"
    "time"

    "github.com/gin-gonic/gin"      // third-party
    "github.com/google/uuid"

    "github.com/NebulaVzx/Echoes/services/user-service/internal/domain"       // internal
    "github.com/NebulaVzx/Echoes/services/user-service/internal/service"
)
```

**TypeScript Import Order:**
1. React/core libraries
2. Third-party packages (zod, framer-motion, etc.)
3. Internal project imports (`@/lib/api`, `@/components/*`, `@/app/providers/*`)

## Go Clean Architecture Layers

Each Go service follows a consistent 4-layer structure:

```
services/{service}/
├── cmd/main.go              # Entry point, dependency injection
├── internal/
│   ├── config/              # Database/config initialization
│   ├── domain/              # Business entities, request/response structs
│   ├── repository/          # Data access layer (GORM)
│   ├── service/             # Business logic layer
│   └── transport/           # HTTP handlers (Gin)
```

**Dependency Rule:** `transport` -> `service` -> `repository` -> `domain`
- `domain` has no external dependencies
- `repository` depends only on `domain` and GORM
- `service` depends on `domain` and `repository` interfaces
- `transport` depends on `domain` and `service`

**Interface Pattern:**
- Repository interfaces defined in `repository/` package
- Service structs accept repository interfaces, not concrete types
- Enables testability (though no tests exist yet)

Example from `services/user-service/internal/repository/user_repository.go`:
```go
type UserRepository interface {
    Create(ctx context.Context, user *domain.User) error
    GetByID(ctx context.Context, id uuid.UUID) (*domain.User, error)
    GetByEmail(ctx context.Context, email string) (*domain.User, error)
    GetByOAuth(ctx context.Context, provider, oauthID string) (*domain.User, error)
    Update(ctx context.Context, user *domain.User) error
}
```

## API Response Format

**Unified JSON Response Structure (all services):**
```go
gin.H{
    "success": true/false,
    "data":    <payload>,           // on success
    "error":   gin.H{"code": "...", "message": "..."},  // on error
    "message": "...",               // optional simple message
}
```

**Error Code Conventions:**
- `VALIDATION_ERROR` - 400, malformed request
- `UNAUTHORIZED` - 401, missing/invalid auth
- `TOKEN_EXPIRED` - 401, expired JWT
- `FORBIDDEN` - 403, access denied (wrong user)
- `NOT_FOUND` - 404, resource not found
- `USER_EXISTS` - 409, duplicate email
- `INTERNAL_ERROR` - 500, server error
- `OAUTH_NOT_CONFIGURED` - 503, missing OAuth env vars
- `OAUTH_ERROR` - 500, OAuth flow failure

**TypeScript API Client mirrors this structure:**
```typescript
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: { code: string; message: string }
  message?: string
}
```

## Error Handling

**Go Patterns:**
- Sentinel errors in service and repository layers:
  ```go
  var (
      ErrInvalidCredentials = errors.New("invalid email or password")
      ErrEmailExists        = errors.New("email already registered")
      ErrMemoryNotFound     = errors.New("memory not found")
  )
  ```
- Error wrapping with `fmt.Errorf("...: %w", err)` for context
- `errors.Is()` for sentinel comparison across layers
- Handler layer maps errors to HTTP status codes via switch

**TypeScript Patterns:**
- Try/catch with `err instanceof Error ? err.message : 'default'`
- Server errors displayed in UI alert boxes
- Form validation errors from Zod displayed inline

## Logging

**Go:**
- `log.Printf` for startup messages in `cmd/main.go`
- `fmt.Printf` for development warnings (OAuth state validation)
- Zap imported in gateway (`go.uber.org/zap`) but not actively used
- No structured logging configuration

**Python:**
- `print()` statements in lifespan handlers
- No logging framework configured

**TypeScript:**
- No logging framework; console output not used in production code

## Configuration Management

**Environment Variables (all services):**
- `PORT` - service port (defaults: gateway 8080, user 8001, memory 8002)
- `DATABASE_URL` - PostgreSQL DSN
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - shared secret for token signing
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` - OAuth credentials
- `USER_SERVICE_URL` / `MEMORY_SERVICE_URL` - internal service URLs
- `ENV` - `development` or `production`

**Defaults Pattern:**
All services use `os.Getenv()` with hardcoded development defaults:
```go
port := os.Getenv("PORT")
if port == "" {
    port = "8001"
}
```

**Security Note:** `JWT_SECRET` has a hardcoded development fallback (`echoes_dev_secret_key_change_in_production`) in both gateway and user-service.

## Type Safety

**Go:**
- Go 1.22-1.23 with generics (GORM uses them)
- UUID types from `github.com/google/uuid` throughout
- GORM struct tags for DB mapping: `gorm:"type:uuid;primary_key"`
- JSON struct tags for API serialization: `json:"email"`
- Gin binding tags for validation: `binding:"required,email"`

**TypeScript:**
- Strict mode enabled in `tsconfig.json` (`"strict": true`)
- Zod schemas for form validation with type inference
- Explicit interface definitions in `web/lib/api.ts`
- Path alias `@/*` mapped to `./*`

**Python:**
- FastAPI with Pydantic v2
- Type hints in lifespan functions
- No Pydantic models defined yet (services are stubs)

## Git Conventions

**Branch Strategy:**
- `main` - stable, merged at sprint end
- `develop` - daily development
- `feature/*` - single feature branches

**Commit Format:** Conventional Commits
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation update
- `refactor:` Code refactoring
- `test:` Test-related changes
- `chore:` Build/config changes

**Recent commit examples:**
```
fix(auth): OAuth callback redirect to /login to preserve URL hash
feat(memory): Sprint 2 - memory capture and timeline
fix(auth): sync token between localStorage and cookie for middleware compatibility
```

## Comments

**Go:**
- Package-level comments explain purpose: `// Package transport provides HTTP handlers...`
- Exported items have doc comments
- Unexported items rarely commented
- Inline comments for non-obvious logic

**TypeScript:**
- Minimal commenting
- Component files have no JSDoc
- Complex logic occasionally commented inline

## Function Design

**Go:**
- Handlers accept `*gin.Context` as first parameter
- Service methods accept `context.Context` as first parameter
- Repository methods follow same pattern
- Constructor functions: `New{Type}({dependencies})`

**TypeScript/React:**
- Components are default exports
- Props interfaces defined inline or in component file
- Custom hooks use `use` prefix (though `useAuth` is in provider file)
- Event handlers prefixed with `handle`: `handleSubmit`, `handleDelete`

## Module Design

**Go:**
- No barrel files; each package is imported directly
- Service `cmd/main.go` performs manual dependency injection
- No DI framework used

**TypeScript:**
- `web/lib/api.ts` exports singleton `api` instance and all types
- Providers exported from individual files
- Components exported as default from their files

## Security Conventions

**Password Handling:**
- Bcrypt with cost 12: `bcrypt.GenerateFromPassword([]byte(req.Password), 12)`
- Password hash excluded from JSON: `json:"-"`

**JWT:**
- Access token: 15 minutes
- Refresh token: 7 days
- HS256 signing method
- Tokens delivered via URL hash for OAuth callback (to avoid middleware interception)

**OAuth State:**
- In-memory map with mutex (production should use Redis with TTL)
- 10-minute expiration
- Relaxed validation in development mode

---

*Convention analysis: 2026-04-19*
