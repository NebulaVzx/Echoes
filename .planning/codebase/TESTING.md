# Testing Patterns

**Analysis Date:** 2026-04-19

## Test Framework

**Web Frontend:**
- Runner: Jest 29.7.0
- Assertion: Jest built-in + `@testing-library/jest-dom` 6.4.2
- React Testing: `@testing-library/react` 14.2.1
- Config: No custom config file detected; uses Jest defaults
- Commands:
  ```bash
  npm test          # Run all tests
  npm run test:watch # Watch mode
  ```

**Go Services:**
- Runner: Go built-in `go test`
- Assertion: Standard `testing` package + `testify` (not imported yet)
- Commands:
  ```bash
  go test ./...                    # Run all tests
  go test ./... -run TestFunction  # Run specific test
  ```

**Python Services:**
- Runner: pytest (referenced in Makefile but not configured)
- Commands:
  ```bash
  python -m pytest  # Run all tests
  ```

## Test File Organization

**Current State: Zero Test Files**

No `*_test.go`, `*_test.py`, or `*.test.*` files exist anywhere in the codebase.

```
# Expected locations (none exist):
services/gateway/internal/middleware/auth_test.go
services/gateway/internal/router/router_test.go
services/user-service/internal/service/auth_service_test.go
services/user-service/internal/repository/user_repository_test.go
services/memory-service/internal/service/memory_service_test.go
services/memory-service/internal/repository/memory_repository_test.go
services/processor-service/app/test_main.py
services/vectorizer-service/app/test_main.py
web/__tests__/api.test.ts
web/__tests__/components/memory-card.test.tsx
```

## Test Coverage Gaps

### Critical Untested Areas

**1. Authentication Flow (user-service)**
- Files: `services/user-service/internal/service/auth_service.go`, `services/user-service/internal/transport/auth_handler.go`
- What's not tested:
  - Password hashing and verification (bcrypt cost 12)
  - JWT token generation and validation
  - Token refresh logic
  - OAuth GitHub callback flow
  - Error cases: invalid credentials, expired tokens, duplicate emails
- Risk: Authentication is the security boundary. Bugs here compromise the entire application.
- Priority: **High**

**2. Gateway JWT Middleware**
- File: `services/gateway/internal/middleware/auth.go`
- What's not tested:
  - Token parsing with `jwt.ParseWithClaims`
  - Public route bypass logic
  - `X-User-ID` header injection for downstream services
  - Invalid token scenarios (malformed, expired, wrong signing method)
- Risk: Gateway is the single entry point. Middleware bugs affect all routes.
- Priority: **High**

**3. Memory CRUD Operations**
- Files: `services/memory-service/internal/service/memory_service.go`, `services/memory-service/internal/repository/memory_repository.go`
- What's not tested:
  - Create with text vs link content types
  - Pagination logic (page/limit boundaries)
  - Tag filtering with PostgreSQL array `ANY(tags)`
  - User ownership enforcement (unauthorized access)
  - Delete with `RowsAffected` check
- Risk: Core business logic. Data integrity issues could leak memories between users.
- Priority: **High**

**4. Redis Task Queue**
- File: `services/memory-service/internal/service/redis_queue.go`
- What's not tested:
  - Stream publishing for `link:fetch`, `text:vectorize`, `tag:generate`
  - Redis URL parsing (strip `redis://` prefix)
  - Error handling when Redis is unavailable
- Risk: Async processing pipeline depends on this. Failures silently drop tasks (`_ = s.queue.Publish...`)
- Priority: **Medium**

**5. API Client (web)**
- File: `web/lib/api.ts`
- What's not tested:
  - Token storage/retrieval (localStorage + cookie sync)
  - Request/response interceptors
  - Error handling for network failures
  - Token refresh flow
- Risk: Frontend auth state desync causes UX issues.
- Priority: **Medium**

**6. React Components**
- Files: `web/components/memory/memory-card.tsx`, `web/components/memory/create-memory-form.tsx`
- What's not tested:
  - Form validation (Zod schemas)
  - Component rendering in light/dark mode
  - User interactions (submit, delete, theme toggle)
  - Empty states and loading states
- Risk: UI regressions, accessibility issues.
- Priority: **Medium**

**7. Python Services (processor, vectorizer)**
- Files: `services/processor-service/app/main.py`, `servicesvectorizer-service/app/main.py`
- What's not tested:
  - Health check endpoints
  - Lifespan startup/shutdown
  - Redis Stream consumption (not implemented yet)
  - BGE-M3 model loading (not implemented yet)
- Risk: These are stubs. Testing framework should be set up before Sprint 3 implementation.
- Priority: **Low** (services not yet functional)

## Recommended Test Structure

### Go Service Tests

**Repository Tests (use testcontainers or sqlite):**
```go
// services/user-service/internal/repository/user_repository_test.go
package repository

import (
    "context"
    "testing"

    "github.com/NebulaVzx/Echoes/services/user-service/internal/domain"
    "github.com/google/uuid"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

func TestGormUserRepository_Create(t *testing.T) {
    // Setup: create in-memory SQLite or testcontainer PostgreSQL
    // Test: create user, verify no error
    // Test: create duplicate email, verify ErrEmailExists
}

func TestGormUserRepository_GetByEmail(t *testing.T) {
    // Test: get existing user
    // Test: get non-existent user, verify ErrUserNotFound
}
```

**Service Tests (mock repository):**
```go
// services/user-service/internal/service/auth_service_test.go
package service

import (
    "context"
    "testing"

    "github.com/NebulaVzx/Echoes/services/user-service/internal/domain"
    "github.com/stretchr/testify/mock"
)

type mockUserRepository struct {
    mock.Mock
}

func (m *mockUserRepository) Create(ctx context.Context, user *domain.User) error {
    args := m.Called(ctx, user)
    return args.Error(0)
}
// ... implement other methods

func TestAuthService_Register(t *testing.T) {
    // Test: successful registration
    // Test: duplicate email returns ErrEmailExists
    // Test: password is hashed (not stored plaintext)
}
```

**Handler Tests (httptest + mock service):**
```go
// services/user-service/internal/transport/auth_handler_test.go
package transport

import (
    "net/http"
    "net/http/httptest"
    "strings"
    "testing"

    "github.com/gin-gonic/gin"
    "github.com/stretchr/testify/assert"
)

func TestAuthHandler_Register(t *testing.T) {
    gin.SetMode(gin.TestMode)
    // Setup router with mock service
    // Test: valid registration returns 201
    // Test: invalid JSON returns 400
    // Test: duplicate email returns 409
}
```

### TypeScript/React Tests

**API Client Tests:**
```typescript
// web/__tests__/lib/api.test.ts
import { api } from '@/lib/api'

describe('ApiClient', () => {
  beforeEach(() => {
    localStorage.clear()
    api.setToken(null)
  })

  it('should store token in localStorage and cookie', () => {
    api.setToken('test-token')
    expect(localStorage.getItem('echoes_token')).toBe('test-token')
  })

  it('should include Authorization header when token exists', async () => {
    // Mock fetch and verify headers
  })
})
```

**Component Tests:**
```typescript
// web/__tests__/components/memory-card.test.tsx
import { render, screen } from '@testing-library/react'
import MemoryCard from '@/components/memory/memory-card'

describe('MemoryCard', () => {
  it('renders text memory correctly', () => {
    const memory = {
      id: 'test-id',
      content_type: 'text',
      text_content: 'Test content',
      tags: ['tag1'],
      processing_status: 'completed',
      // ... other fields
    }
    render(<MemoryCard memory={memory} />)
    expect(screen.getByText('Test content')).toBeInTheDocument()
  })
})
```

## Mocking Strategy

**Go:**
- Use `testify/mock` for repository interfaces
- Use `httptest` for HTTP handler tests
- Use `jwt` package test helpers for token generation

**TypeScript:**
- Mock `fetch` globally for API tests
- Use React Testing Library for DOM assertions
- Mock `localStorage` in test setup

## Test Data

**No fixtures or factories exist.**

Recommended approach:
- Go: Inline test data in each test function
- TypeScript: Create factory functions in `web/__tests__/factories.ts`

## CI/CD Integration

**Makefile targets exist but will fail:**
```bash
make test          # Runs go test ./... for all Go services + pytest + npm test
make test-gateway  # cd services/gateway && go test ./...
make test-user     # cd services/user-service && go test ./...
make test-memory   # cd services/memory-service && go test ./...
make test-web      # cd web && npm test
```

All these commands currently execute successfully (Go returns "no test files"), providing false confidence.

## Coverage Requirements

**No coverage targets are enforced.**

Recommended minimums:
- Gateway middleware: 90% (security critical)
- Auth service: 85% (security critical)
- Memory service: 80% (core business logic)
- API client: 70%
- React components: 60%

## Testing Infrastructure Needed

1. **Go testify/mock** - Add to go.mod for mocking
2. **Testcontainers** or **SQLite in-memory** - For repository integration tests
3. **Jest config** - Custom config for path aliases (`@/*`)
4. **pytest fixtures** - For Python service tests
5. **GitHub Actions** or similar CI - To run tests on every PR

## Sprint 5 Testing Goals (per PRD)

The PRD specifies Sprint 5 focus includes "e2e testing":
- End-to-end tests for full user flows
- Auth: register -> login -> create memory -> view memory -> delete memory
- Search: create memory -> wait for processing -> semantic search
- Recommended tools: Playwright or Cypress

---

*Testing analysis: 2026-04-19*
