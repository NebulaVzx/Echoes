# 架构

**分析日期：** 2026-04-19

## 模式概览

**整体：** 微服务 + API Gateway 模式

**关键特征：**
- 单入口网关，反向代理路由到后端服务
- 每个 Go 服务内采用分层架构（domain/service/repository/transport）
- 通过 Redis Streams 进行异步任务处理（从生产者视角看是即发即弃）
- 基于 JWT 的无状态认证，双重验证（Gateway + Service）
- PostgreSQL 作为关系数据和向量数据的单一事实来源（pgvector）

## 服务拓扑

```
浏览器/Next.js
       |
       v
   Gateway (Go + Gin) :8080
       |  - JWT 验证
       |  - CORS 处理
       |  - 反向代理
       |
   +---+---+---------------+
   |       |               |
   v       v               v
User   Memory         (Redis Streams)
Service Service            |
:8001   :8002            +--+----------------+--+
   |       |             |  |                |  |
   v       v             v  v                v  v
PostgreSQL           Processor         Vectorizer
(pgvector)           (Python)          (Python)
                     :8003             :8004
```

## 分层

**Gateway 层：**
- 用途：单一入口、认证中间件、反向代理、CORS
- 位置：`services/gateway/`
- 包含：HTTP 路由器、JWT 中间件、反向代理配置
- 依赖：服务 URL 和 JWT 密钥的环境变量
- 使用者：所有前端客户端

**User Service 层：**
- 用途：用户注册、认证、OAuth、Token 管理
- 位置：`services/user-service/`
- 包含：认证处理器、认证服务、用户仓库、用户领域模型
- 依赖：PostgreSQL（GORM）、JWT 库、bcrypt、GitHub OAuth API
- 使用者：Gateway（通过 `/api/v1/auth/*` 路由）

**Memory Service 层：**
- 用途：记忆 CRUD、时间轴列表、搜索、异步任务发布
- 位置：`services/memory-service/`
- 包含：记忆处理器、记忆服务、记忆仓库、Redis 队列发布器
- 依赖：PostgreSQL（GORM + pgvector）、Redis Streams
- 使用者：Gateway（通过 `/api/v1/memories/*`、`/api/v1/search` 路由）

**Processor Service（异步 Worker）：**
- 用途：链接抓取、内容提取、自动生成标签
- 位置：`services/processor-service/`
- 包含：FastAPI 应用（桩，Sprint 3 实现）
- 依赖：Redis Streams（消费者）
- 消费：`link:fetch`、`tag:generate` Streams

**Vectorizer Service（异步 Worker）：**
- 用途：BGE-M3 文本嵌入生成
- 位置：`services/vectorizer-service/`
- 包含：FastAPI 应用（桩，Sprint 3 实现）
- 依赖：Redis Streams（消费者）
- 消费：`text:vectorize` Stream

**前端层：**
- 用途：通过 Next.js App Router 的 React SPA（支持 SSR/SSG）
- 位置：`web/`
- 包含：页面、组件、API 客户端、认证 Provider、主题 Provider
- 依赖：Gateway API（`NEXT_PUBLIC_API_URL`）

## 数据流

**认证流程（邮箱/密码）：**

1. 浏览器提交 `POST /api/v1/auth/register` 或 `POST /api/v1/auth/login`
2. Gateway 接收请求，`JWTAuth()` 中间件跳过（公开路由）
3. Gateway 反向代理到 User Service（`:8001`）
4. User Service 验证凭据，生成 JWT Token 对（access 15分钟、refresh 7天）
5. 响应返回 `{user, token}` 到浏览器
6. 浏览器将 token 存入 `localStorage` + cookie（`echoes_token`）
7. 后续请求携带 `Authorization: Bearer <token>` 头

**认证流程（GitHub OAuth）：**

1. 浏览器点击"GitHub 登录" → `GET /api/v1/auth/github`
2. Gateway 代理到 User Service，生成 state 并重定向到 GitHub
3. GitHub 重定向到 `GET /api/v1/auth/github/callback?code=...&state=...`
4. User Service 用 code 交换 token，获取用户信息，创建/关联用户
5. 将浏览器重定向到 `http://localhost:3000/login#token=...&refresh_token=...`
6. `AuthProvider` 检测到 hash，提取 token，清除 URL，设置认证状态

**记忆创建流程：**

1. 浏览器提交 `POST /api/v1/memories`，携带 `Authorization: Bearer <token>`
2. Gateway `JWTAuth()` 验证 token，提取 `userID`，设置 `X-User-ID` 头
3. Gateway 反向代理到 Memory Service（`:8002`）
4. Memory Service 创建记忆记录，`processing_status = 'pending'`
5. Memory Service 向 Redis Streams 发布异步任务：
   - `link:fetch`（如果 content_type = link）
   - `text:vectorize`（所有记忆）
   - `tag:generate`（所有记忆）
6. 响应返回记忆到浏览器
7. Processor/Vectorizer 服务（未来）消费 Streams 并更新记忆

**记忆列表/时间轴流程：**

1. 浏览器请求 `GET /api/v1/memories?page=1&limit=20`
2. Gateway 验证 JWT，注入 `X-User-ID`
3. Memory Service 查询 `memories` 表，按 `user_id` 过滤，`created_at DESC` 排序
4. 可选标签过滤：`WHERE ? = ANY(tags)`
5. 响应返回带总数的分页列表

## 关键抽象

**仓库模式：**
- 用途：数据访问抽象，支持可测试性
- 示例：`services/user-service/internal/repository/user_repository.go`、`services/memory-service/internal/repository/memory_repository.go`
- 模式：接口定义 + GORM 实现

**服务层：**
- 用途：业务逻辑，编排仓库和外部调用
- 示例：`services/user-service/internal/service/auth_service.go`、`services/memory-service/internal/service/memory_service.go`
- 模式：通过构造函数注入依赖的结构体

**处理器/传输层：**
- 用途：HTTP 请求/响应处理，输入验证
- 示例：`services/user-service/internal/transport/auth_handler.go`、`services/memory-service/internal/transport/memory_handler.go`
- 模式：Gin 处理函数，JSON 绑定，`gin.H{}` 响应

**TaskQueue 接口：**
- 用途：抽象异步任务发布以支持可测试性
- 位置：`services/memory-service/internal/service/memory_service.go`（接口）、`services/memory-service/internal/service/redis_queue.go`（实现）
- 模式：接口含 `PublishLinkFetch`、`PublishTextVectorize`、`PublishTagGenerate`

## 入口点

**Gateway Service：**
- 位置：`services/gateway/cmd/main.go`
- 触发：Docker 容器启动、`go run cmd/main.go`
- 职责：配置 Gin 路由器、附加中间件、在 `:8080` 启动 HTTP 服务器

**User Service：**
- 位置：`services/user-service/cmd/main.go`
- 触发：Docker 容器启动、`go run cmd/main.go`
- 职责：连接 DB、初始化仓库/服务/处理器层、在 `:8001` 启动 HTTP 服务器

**Memory Service：**
- 位置：`services/memory-service/cmd/main.go`
- 触发：Docker 容器启动、`go run cmd/main.go`
- 职责：连接 DB、初始化仓库/队列/服务/处理器层、在 `:8002` 启动 HTTP 服务器

**Processor Service：**
- 位置：`services/processor-service/app/main.py`
- 触发：Docker 容器启动、`uvicorn app.main:app --reload --port 8003`
- 职责：FastAPI 应用，带 lifespan 管理器用于后台 Redis 消费者

**Vectorizer Service：**
- 位置：`services/vectorizer-service/app/main.py`
- 触发：Docker 容器启动、`uvicorn app.main:app --reload --port 8004`
- 职责：FastAPI 应用，带 lifespan 管理器用于 BGE-M3 模型加载和 Redis 消费者

**Next.js 前端：**
- 位置：`web/app/layout.tsx`
- 触发：`npm run dev`（3000 端口）
- 职责：根布局，用 ThemeProvider 和 AuthProvider 包裹所有页面

## 认证与授权

**JWT Token 策略：**
- Access token：15 分钟过期，HS256 签名
- Refresh token：7 天过期，相同密钥
- 密钥：`JWT_SECRET` 环境变量（回退到硬编码开发密钥）
- 库：`github.com/golang-jwt/jwt/v5`

**双重验证：**
- Gateway 验证 JWT 并注入 `X-User-ID` 头（`services/gateway/internal/middleware/auth.go`）
- User Service 也直接验证 JWT（用于 `/me` 端点）（`services/user-service/internal/transport/auth_handler.go`）
- Memory Service 信任来自 Gateway 的 `X-User-ID` 头（不重新验证）

**公开路由（Gateway）：**
- `/api/v1/auth/register`
- `/api/v1/auth/login`
- `/api/v1/auth/providers`
- `/api/v1/auth/github`
- `/api/v1/auth/github/callback`
- `/api/v1/auth/refresh`
- `/health`

**前端认证：**
- Token 存储在 `localStorage`（键：`echoes_token`）和 cookie（`echoes_token`）
- Cookie 供 Next.js 中间件（`web/middleware.ts`）用于 SSR 路由保护
- `AuthProvider` Context 提供 `user`、`isAuthenticated`、`login()`、`logout()`

**OAuth State 管理：**
- 内存 map + 互斥锁 + 10 分钟 TTL（`services/user-service/internal/transport/auth_handler.go`）
- 生产备注：应迁移到 Redis

## 异步任务流（Redis Streams）

**生产者：** Memory Service（`services/memory-service/internal/service/redis_queue.go`）

**Streams：**
| Stream 名称 | 用途 | 消费者 |
|-------------|------|--------|
| `link:fetch` | 抓取链接内容，提取标题/摘要 | Processor Service |
| `text:vectorize` | 生成 BGE-M3 嵌入（768 维） | Vectorizer Service |
| `tag:generate` | 从内容自动生成标签 | Processor Service |

**消息格式：**
```go
map[string]interface{}{
    "memory_id": "<uuid>",
    "link_url":  "<url>",  // 用于 link:fetch
    "content":   "<text>", // 用于 vectorize/tag
}
```

**处理状态生命周期：**
- `pending` → `processing` → `completed` / `failed`

## 错误处理

**策略：** 处理器中集中式错误映射，一致的 JSON 响应格式

**响应格式：**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

**错误码：**
- `UNAUTHORIZED` — Token 缺失/无效
- `TOKEN_EXPIRED` — JWT 已过期
- `INVALID_CREDENTIALS` — 邮箱/密码错误
- `USER_EXISTS` — 邮箱重复
- `VALIDATION_ERROR` — 输入验证失败
- `NOT_FOUND` — 资源未找到
- `FORBIDDEN` — 访问被拒绝（错误用户）
- `INTERNAL_ERROR` — 服务器错误
- `OAUTH_NOT_CONFIGURED` — 缺少 OAuth 环境变量
- `OAUTH_ERROR` — OAuth 流程失败

## 横切关注点

**日志：** Go 服务使用标准 `log` 包；开发中使用 `fmt.Printf`。Zap 已导入但未集成（gateway 的 go.mod 中有 `go.uber.org/zap`）。

**验证：** Gin 绑定标签（`binding:"required,email"`）+ 服务层手动验证

**CORS：** 在 Gateway 层处理（`services/gateway/internal/router/router.go`），可配置 origin、credentials、methods、headers

**数据库迁移：** `shared/migrations/001_init.sql` 的 SQL 迁移文件 + 服务启动时的 GORM AutoMigrate

---

*架构分析：2026-04-19*
