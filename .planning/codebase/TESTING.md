# 测试模式

**分析日期：** 2026-04-19

## 测试框架

**Web 前端：**
- 运行器：Jest 29.7.0
- 断言：Jest 内置 + `@testing-library/jest-dom` 6.4.2
- React 测试：`@testing-library/react` 14.2.1
- 配置：未检测到自定义配置文件；使用 Jest 默认配置
- 命令：
  ```bash
  npm test          # 运行所有测试
  npm run test:watch # 监视模式
  ```

**Go 服务：**
- 运行器：Go 内置 `go test`
- 断言：标准 `testing` 包 + `testify`（尚未导入）
- 命令：
  ```bash
  go test ./...                    # 运行所有测试
  go test ./... -run TestFunction  # 运行特定测试
  ```

**Python 服务：**
- 运行器：pytest（`Makefile` 中引用但未配置）
- 命令：
  ```bash
  python -m pytest  # 运行所有测试
  ```

## 测试文件组织

**当前状态：零个测试文件**

代码库中任何地方都不存在 `*_test.go`、`*_test.py` 或 `*.test.*` 文件。

```
# 预期位置（都不存在）：
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

## 测试覆盖缺口

### 关键未测试区域

**1. 认证流程（user-service）**
- 文件：`services/user-service/internal/service/auth_service.go`、`services/user-service/internal/transport/auth_handler.go`
- 未测试内容：
  - 密码哈希和验证（bcrypt cost 12）
  - JWT token 生成和验证
  - Token 刷新逻辑
  - OAuth GitHub 回调流程
  - 错误场景：无效凭据、过期 token、重复邮箱
- 风险：认证是安全边界。此处的 bug 会危及整个应用。
- 优先级：**高**

**2. Gateway JWT 中间件**
- 文件：`services/gateway/internal/middleware/auth.go`
- 未测试内容：
  - 使用 `jwt.ParseWithClaims` 解析 token
  - 公开路由绕过逻辑
  - 为下游服务注入 `X-User-ID` 头
  - 无效 token 场景（格式错误、过期、错误签名方法）
- 风险：Gateway 是单一入口点。中间件 bug 影响所有路由。
- 优先级：**高**

**3. 记忆 CRUD 操作**
- 文件：`services/memory-service/internal/service/memory_service.go`、`services/memory-service/internal/repository/memory_repository.go`
- 未测试内容：
  - 使用 text 与 link 内容类型创建
  - 分页逻辑（page/limit 边界）
  - 使用 PostgreSQL 数组 `ANY(tags)` 进行标签过滤
  - 用户所有权强制（未授权访问）
  - 使用 `RowsAffected` 检查删除
- 风险：核心业务逻辑。数据完整性问题可能导致记忆在用户间泄漏。
- 优先级：**高**

**4. Redis 任务队列**
- 文件：`services/memory-service/internal/service/redis_queue.go`
- 未测试内容：
  - `link:fetch`、`text:vectorize`、`tag:generate` 的 Stream 发布
  - Redis URL 解析（去除 `redis://` 前缀）
  - Redis 不可用时错误处理
- 风险：异步处理管道依赖于此。失败会静默丢弃任务（`_ = s.queue.Publish...`）
- 优先级：**中**

**5. API 客户端（web）**
- 文件：`web/lib/api.ts`
- 未测试内容：
  - Token 存储/检索（localStorage + cookie 同步）
  - 请求/响应拦截器
  - 网络失败错误处理
  - Token 刷新流程
- 风险：前端认证状态不同步导致 UX 问题。
- 优先级：**中**

**6. React 组件**
- 文件：`web/components/memory/memory-card.tsx`、`web/components/memory/create-memory-form.tsx`
- 未测试内容：
  - 表单验证（Zod schema）
  - 组件在亮/暗模式下的渲染
  - 用户交互（提交、删除、主题切换）
  - 空状态和加载状态
- 风险：UI 回归、可访问性问题。
- 优先级：**中**

**7. Python 服务（processor、vectorizer）**
- 文件：`services/processor-service/app/main.py`、`servicesvectorizer-service/app/main.py`
- 未测试内容：
  - 健康检查端点
  - Lifespan 启动/关闭
  - Redis Stream 消费（尚未实现）
  - BGE-M3 模型加载（尚未实现）
- 风险：这些是桩。应在 Sprint 3 实现前设置测试框架。
- 优先级：**低**（服务尚未功能完整）

## 推荐测试结构

### Go 服务测试

**仓库测试（使用 testcontainers 或 sqlite）：**
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
    // 设置：创建内存 SQLite 或 testcontainer PostgreSQL
    // 测试：创建用户，验证无错误
    // 测试：创建重复邮箱，验证 ErrEmailExists
}

func TestGormUserRepository_GetByEmail(t *testing.T) {
    // 测试：获取现有用户
    // 测试：获取不存在的用户，验证 ErrUserNotFound
}
```

**服务测试（mock 仓库）：**
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
// ... 实现其他方法

func TestAuthService_Register(t *testing.T) {
    // 测试：成功注册
    // 测试：重复邮箱返回 ErrEmailExists
    // 测试：密码已哈希（非明文存储）
}
```

**处理器测试（httptest + mock 服务）：**
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
    // 设置带 mock 服务的路由器
    // 测试：有效注册返回 201
    // 测试：无效 JSON 返回 400
    // 测试：重复邮箱返回 409
}
```

### TypeScript/React 测试

**API 客户端测试：**
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
    // Mock fetch 并验证 headers
  })
})
```

**组件测试：**
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
      // ... 其他字段
    }
    render(<MemoryCard memory={memory} />)
    expect(screen.getByText('Test content')).toBeInTheDocument()
  })
})
```

## Mock 策略

**Go：**
- 使用 `testify/mock` 进行 repository 接口 mock
- 使用 `httptest` 进行 HTTP 处理器测试
- 使用 `jwt` 包测试助手进行 token 生成

**TypeScript：**
- API 测试中全局 mock `fetch`
- 使用 React Testing Library 进行 DOM 断言
- 测试设置中 mock `localStorage`

## 测试数据

**不存在 fixtures 或 factories。**

推荐方法：
- Go：每个测试函数中内联测试数据
- TypeScript：在 `web/__tests__/factories.ts` 中创建工厂函数

## CI/CD 集成

**Makefile target 存在但会失败：**
```bash
make test          # 为所有 Go 服务运行 go test ./... + pytest + npm test
make test-gateway  # cd services/gateway && go test ./...
make test-user     # cd services/user-service && go test ./...
make test-memory   # cd services/memory-service && go test ./...
make test-web      # cd web && npm test
```

所有这些命令当前都能成功执行（Go 返回 "no test files"），提供了虚假的安心感。

## 覆盖要求

**未强制执行覆盖目标。**

推荐最低值：
- Gateway 中间件：90%（安全关键）
- Auth service：85%（安全关键）
- Memory service：80%（核心业务逻辑）
- API 客户端：70%
- React 组件：60%

## 测试基础设施需求

1. **Go testify/mock** - 添加到 go.mod 用于 mock
2. **Testcontainers** 或 **SQLite 内存** - 用于仓库集成测试
3. **Jest 配置** - 路径别名（`@/*`）的自定义配置
4. **pytest fixtures** - 用于 Python 服务测试
5. **GitHub Actions** 或类似 CI - 每次 PR 时运行测试

## Sprint 5 测试目标（根据 PRD）

PRD 指定 Sprint 5 重点包含"端到端测试"：
- 完整用户流程的端到端测试
- 认证：注册 -> 登录 -> 创建记忆 -> 查看记忆 -> 删除记忆
- 搜索：创建记忆 -> 等待处理 -> 语义搜索
- 推荐工具：Playwright 或 Cypress

---

*测试分析：2026-04-19*
