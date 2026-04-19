# 编码规范

**分析日期：** 2026-04-19

## 命名模式

**Go 文件：**
- 包目录使用小写加连字符作为服务名：`user-service/`、`memory-service/`
- Go 文件使用 snake_case：`auth_handler.go`、`memory_service.go`、`user_repository.go`
- 内部包遵循整洁架构分层：`domain/`、`repository/`、`service/`、`transport/`、`config/`

**React/TypeScript 文件：**
- 组件使用 PascalCase：`MemoryCard.tsx`、`CreateMemoryForm.tsx`、`Logo.tsx`
- Hooks 和工具使用 camelCase：`useAuth.ts`（约定如此，尽管 `useAuth` 在 `auth-provider.tsx` 中）
- 页面文件使用小写：`page.tsx`、`layout.tsx`
- 路由组使用括号：`(auth)/`、`(main)/`

**函数：**
- Go：导出用 PascalCase，未导出用 camelCase
  - 导出：`NewAuthService`、`RegisterRoutes`、`SafeResponse`
  - 未导出：`generateState`、`validateState`、`extractContent`、`publishTasks`
- TypeScript：所有函数使用 camelCase
  - `login`、`logout`、`loadMemories`、`handleDelete`

**变量：**
- Go：局部变量用 camelCase，导出结构体字段用 PascalCase
- TypeScript：变量用 camelCase，类型/接口用 PascalCase

**类型：**
- Go：PascalCase 结构体，描述性名称：`AuthResponse`、`TokenPair`、`CreateMemoryRequest`
- TypeScript：`web/lib/api.ts` 中的 PascalCase 接口：`ApiResponse<T>`、`Memory`、`User`

## 代码风格

**格式化：**
- Go：通过 Makefile 强制使用 `gofmt`（`make fmt-go`）
- TypeScript：通过 Next.js 配置使用 ESLint（`next lint`、`next lint --fix`）
- 未检测到 Prettier 配置；依赖 Next.js 默认值

**Lint：**
- Web：`eslint-config-next`（ESLint 8.57.0）
- Go：无显式 linter 配置；`gofmt` 是标准
- Python：未检测到 linting 配置

**换行符：**
- 通过 `.gitattributes` 强制使用 LF

## 导入组织

**Go 导入顺序：**
1. 标准库
2. 第三方包
3. 内部项目包

示例（来自 `services/user-service/internal/transport/auth_handler.go`）：
```go
import (
    "crypto/rand"           // stdlib
    "encoding/hex"
    "fmt"
    "net/http"
    "os"
    "sync"
    "time"

    "github.com/gin-gonic/gin"      // 第三方
    "github.com/google/uuid"

    "github.com/NebulaVzx/Echoes/services/user-service/internal/domain"       // 内部
    "github.com/NebulaVzx/Echoes/services/user-service/internal/service"
)
```

**TypeScript 导入顺序：**
1. React/核心库
2. 第三方包（zod、framer-motion 等）
3. 内部项目导入（`@/lib/api`、`@/components/*`、`@/app/providers/*`）

## Go 整洁架构分层

每个 Go 服务遵循一致的 4 层结构：

```
services/{service}/
├── cmd/main.go              # 入口点，依赖注入
├── internal/
│   ├── config/              # 数据库/配置初始化
│   ├── domain/              # 业务实体、请求/响应结构体
│   ├── repository/          # 数据访问层（GORM）
│   ├── service/             # 业务逻辑层
│   └── transport/           # HTTP 处理器（Gin）
```

**依赖规则：** `transport` -> `service` -> `repository` -> `domain`
- `domain` 无外部依赖
- `repository` 仅依赖 `domain` 和 GORM
- `service` 依赖 `domain` 和 repository 接口
- `transport` 依赖 `domain` 和 `service`

**接口模式：**
- Repository 接口定义在 `repository/` 包中
- Service 结构体接收 repository 接口，而非具体类型
- 支持可测试性（尽管目前尚无测试）

示例（来自 `services/user-service/internal/repository/user_repository.go`）：
```go
type UserRepository interface {
    Create(ctx context.Context, user *domain.User) error
    GetByID(ctx context.Context, id uuid.UUID) (*domain.User, error)
    GetByEmail(ctx context.Context, email string) (*domain.User, error)
    GetByOAuth(ctx context.Context, provider, oauthID string) (*domain.User, error)
    Update(ctx context.Context, user *domain.User) error
}
```

## API 响应格式

**所有服务的统一 JSON 响应结构：**
```go
gin.H{
    "success": true/false,
    "data":    <payload>,           // 成功时
    "error":   gin.H{"code": "...", "message": "..."},  // 错误时
    "message": "...",               // 可选简单消息
}
```

**错误码约定：**
- `VALIDATION_ERROR` - 400，请求格式错误
- `UNAUTHORIZED` - 401，认证缺失/无效
- `TOKEN_EXPIRED` - 401，JWT 已过期
- `FORBIDDEN` - 403，访问被拒绝（错误用户）
- `NOT_FOUND` - 404，资源未找到
- `USER_EXISTS` - 409，邮箱重复
- `INTERNAL_ERROR` - 500，服务器错误
- `OAUTH_NOT_CONFIGURED` - 503，缺少 OAuth 环境变量
- `OAUTH_ERROR` - 500，OAuth 流程失败

**TypeScript API 客户端镜像此结构：**
```typescript
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: { code: string; message: string }
  message?: string
}
```

## 错误处理

**Go 模式：**
- 服务和仓库层中的哨兵错误：
  ```go
  var (
      ErrInvalidCredentials = errors.New("invalid email or password")
      ErrEmailExists        = errors.New("email already registered")
      ErrMemoryNotFound     = errors.New("memory not found")
  )
  ```
- 使用 `fmt.Errorf("...: %w", err)` 进行错误包装以添加上下文
- 使用 `errors.Is()` 进行跨层的哨兵比较
- 处理器层通过 switch 将错误映射到 HTTP 状态码

**TypeScript 模式：**
- Try/catch，使用 `err instanceof Error ? err.message : 'default'`
- UI 弹窗中显示服务器错误
- Zod 的表单验证错误以内联方式显示

## 日志

**Go：**
- `cmd/main.go` 中使用 `log.Printf` 输出启动消息
- 开发警告使用 `fmt.Printf`（OAuth state 验证）
- Gateway 中导入 Zap（`go.uber.org/zap`）但未主动使用
- 无结构化日志配置

**Python：**
- lifespan 处理器中使用 `print()` 语句
- 未配置日志框架

**TypeScript：**
- 无日志框架；生产代码中不使用 console 输出

## 配置管理

**环境变量（所有服务）：**
- `PORT` - 服务端口（默认值：gateway 8080、user 8001、memory 8002）
- `DATABASE_URL` - PostgreSQL DSN
- `REDIS_URL` - Redis 连接字符串
- `JWT_SECRET` - Token 签名的共享密钥
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` - OAuth 凭据
- `USER_SERVICE_URL` / `MEMORY_SERVICE_URL` - 内部服务 URL
- `ENV` - `development` 或 `production`

**默认值模式：**
所有服务使用 `os.Getenv()` 并带有硬编码开发默认值：
```go
port := os.Getenv("PORT")
if port == "" {
    port = "8001"
}
```

**安全注意：** `JWT_SECRET` 在 gateway 和 user-service 中都有硬编码开发回退值（`echoes_dev_secret_key_change_in_production`）。

## 类型安全

**Go：**
- Go 1.22-1.23 含泛型（GORM 使用泛型）
- 全程使用 `github.com/google/uuid` 的 UUID 类型
- GORM 结构体标签用于 DB 映射：`gorm:"type:uuid;primary_key"`
- JSON 结构体标签用于 API 序列化：`json:"email"`
- Gin 绑定标签用于验证：`binding:"required,email"`

**TypeScript：**
- `tsconfig.json` 中启用严格模式（`"strict": true`）
- Zod schema 用于表单验证和类型推断
- `web/lib/api.ts` 中的显式接口定义
- 路径别名 `@/*` 映射到 `./*`

**Python：**
- FastAPI 配合 Pydantic v2
- lifespan 函数中的类型提示
- 尚未定义 Pydantic 模型（服务是桩）

## Git 约定

**分支策略：**
- `main` - 稳定版，Sprint 结束时合并
- `develop` - 日常开发
- `feature/*` - 单功能分支

**提交格式：** Conventional Commits
- `feat:` 新功能
- `fix:` Bug 修复
- `docs:` 文档更新
- `refactor:` 代码重构
- `test:` 测试相关变更
- `chore:` 构建/配置变更

**近期提交示例：**
```
fix(auth): OAuth callback redirect to /login to preserve URL hash
feat(memory): Sprint 2 - memory capture and timeline
fix(auth): sync token between localStorage and cookie for middleware compatibility
```

## 注释

**Go：**
- 包级注释解释用途：`// Package transport provides HTTP handlers...`
- 导出项有文档注释
- 未导出项很少注释
- 非显而易见逻辑的行内注释

**TypeScript：**
- 注释最少
- 组件文件无 JSDoc
- 复杂逻辑偶尔有行内注释

## 函数设计

**Go：**
- 处理器接收 `*gin.Context` 作为第一个参数
- 服务方法接收 `context.Context` 作为第一个参数
- 仓库方法遵循相同模式
- 构造函数：`New{类型}({依赖})`

**TypeScript/React：**
- 组件为默认导出
- Props 接口在组件文件中内联定义或单独定义
- 自定义 Hooks 使用 `use` 前缀（尽管 `useAuth` 在 provider 文件中）
- 事件处理器以 `handle` 为前缀：`handleSubmit`、`handleDelete`

## 模块设计

**Go：**
- 无 barrel 文件；每个包直接导入
- 服务 `cmd/main.go` 执行手动依赖注入
- 未使用 DI 框架

**TypeScript：**
- `web/lib/api.ts` 导出单例 `api` 实例和所有类型
- Providers 从单独文件导出
- 组件作为默认导出从其文件导出

## 安全约定

**密码处理：**
- Bcrypt cost 12：`bcrypt.GenerateFromPassword([]byte(req.Password), 12)`
- 密码哈希从 JSON 中排除：`json:"-"`

**JWT：**
- Access token：15 分钟
- Refresh token：7 天
- HS256 签名方法
- OAuth 回调通过 URL hash 传递 Token（避免中间件拦截）

**OAuth State：**
- 内存 map + 互斥锁（生产应使用 Redis + TTL）
- 10 分钟过期
- 开发模式下放宽验证

---

*规范分析：2026-04-19*
