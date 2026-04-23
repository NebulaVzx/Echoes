---
name: Phase 7 Context
description: Bug Fixes & Quality - Context for research and planning
type: context
---

# Phase 7: Bug Fixes & Quality - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning

<domain>
## Phase Boundary

修复 v1.0 已知问题并补充质量基线。本阶段不新增功能，专注现有系统的稳定性、可维护性和测试覆盖。

### 在范围内
- OAuth state 内存泄漏修复（定期清理过期 state）
- Gateway 健康检查增强（下游服务状态聚合）
- 前端时间轴分页 UI（Load more 模式）
- Go 单元测试补充（Service 层核心逻辑）
- 现有代码审查问题的修复（CR-02, WR-01, WR-02 等）

### 不在范围内
- 新功能开发（如 SSE 流式输出）
- 性能优化（如数据库查询优化）
- 集成测试 / E2E 测试（已有 Playwright 覆盖）
- 基础设施变更（如 K8s 配置、CI/CD）

</domain>

<decisions>
## Implementation Decisions

### OAuth State 清理机制
- **D-01: 后台 goroutine + time.Ticker 定期清理**
  - 每 5 分钟扫描一次 `oauthStates` map，删除过期条目
  - 保持现有 `map[string]time.Time` + `sync.Mutex` 结构，改动最小
  - 不引入 Redis（当前单机部署，无高可用需求，Redis 是过度设计）
  - 在 `auth_handler.go` 的 `init()` 或首次 `generateState()` 时启动清理 goroutine
  - 清理逻辑：遍历 map，删除 `time.Now().After(expiry)` 的条目

### Gateway 健康检查深度
- **D-02: 聚合式下游健康检查**
  - `/health` 端点除了返回 gateway 自身状态外，并行检查下游服务可达性
  - 检查目标：User Service (`/api/v1/auth/me` 或根路径)、Memory Service (`/api/v1/memories` 或根路径)
  - 响应格式：
    ```json
    {
      "status": "healthy|degraded|unhealthy",
      "gateway": "ok",
      "services": {
        "user": "ok|unreachable",
        "memory": "ok|unreachable"
      }
    }
    ```
  - HTTP 状态码：全部 ok 时 200，任一关键服务不可用时 503
  - 检查超时：每个下游 2 秒，使用 `context.WithTimeout`
  - 反向代理增加连接超时和错误处理（非无限阻塞）

### 前端分页交互模式
- **D-03: "加载更多" 按钮模式**
  - 时间轴页面每次加载固定数量（如 10-20 条），底部显示 "加载更多" 按钮
  - 理由：与 Notion-like 极简美学一致；保留用户滚动位置；比无限滚动更可控
  - 不采用页码组件（移动端体验差，不符合 Notion 风格）
  - 不采用无限滚动（难以实现 BUG-08 的"保留滚动位置"需求）
  - API 分页参数：`page` + `limit` 或 `cursor` + `limit`
  - 鉴于现有 API 使用 offset/limit，继续沿用：GET `/api/v1/memories?page=1&limit=20`

### Go 单元测试范围与策略
- **D-04: 聚焦 Service 层，Mock Repository 接口**
  - 测试目标：User Service（注册验证、密码哈希、JWT 签发/验证）、Memory Service（CRUD、搜索逻辑）
  - 不测 Handler 层（HTTP 框架代码，性价比低）
  - 不测 Repository 层（GORM 代码，需要真实 DB，testcontainers 过重）
  - Mock 策略：利用已有 Repository 接口，手动实现 mock 或引入 `testify/mock`
  - 测试框架：Go 标准库 `testing` + `testify/assert`（如项目中未引入则使用标准库）
  - 关键测试场景：
    - Auth：邮箱格式验证、密码长度、重复注册、错误密码、JWT 生成/解析
    - Memory：创建记忆字段验证、搜索参数处理、软删除逻辑

### 代码审查问题修复
- **D-05: 一并修复 Phase 6 遗留问题**
  - CR-02: `isPublicRoute` 使用 `filepath.Clean` 规范化路径，防止路径遍历绕过
  - WR-01: `buildMessages` 中系统消息只 prepend 一次，不随每条历史消息重复插入
  - WR-02: `json.Marshal(citations)` 错误显式处理，失败时记录日志并使用空数组
  - IN-01: 删除未使用的 `isNewConversation` 标志

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 产品需求
- `.planning/REQUIREMENTS.md` — v1.1 需求规格（BUG-01 ~ BUG-11）
- `.planning/ROADMAP.md` — Phase 7 目标与成功标准
- `.planning/PROJECT.md` — 项目上下文与技术栈
- `.planning/phases/06-echo-assistant/06-VERIFICATION.md` — Phase 6 验证报告（含遗留问题清单）

### 待修复的已知问题
- `services/gateway/internal/middleware/auth.go:86-103` — CR-02: isPublicRoute 路径遍历
- `services/gateway/internal/chat/service/chat_service.go:330-367` — WR-01: 系统消息重复
- `services/gateway/internal/chat/service/chat_service.go:157` — WR-02: 静默 JSON marshal 错误

### 现有代码（复用与修改目标）
- `services/user-service/internal/transport/auth_handler.go:68-95` — OAuth state 存储（需加清理）
- `services/gateway/internal/router/router.go:42-49` — /health 端点（需增强）
- `services/gateway/internal/router/router.go:103-132` — 反向代理（需加超时）
- `web/components/memory/memory-list.tsx` — 记忆列表（需加分页支持）
- `web/app/(main)/page.tsx` — 时间轴页面（需集成分页 API）
- `services/user-service/internal/service/auth_service.go` — 认证逻辑（需加测试）
- `services/memory-service/internal/service/memory_service.go` — 记忆逻辑（需加测试）

### 架构文档
- `CLAUDE.md` — 开发指南与命令速查
- `PRD.md` — 完整产品需求与 API 定义

</canonical_refs>

<code_context>
## Existing Code Insights

### 需要修复的问题资产
- **OAuth State 存储** (`services/user-service/internal/transport/auth_handler.go:68-95`):
  - 全局变量 `oauthStates map[string]time.Time` + `oauthStateMux sync.Mutex`
  - 已设置 10 分钟过期时间，但无清理机制，内存只增不减
  - 代码注释已意识到问题："Production should use Redis with TTL"

- **Gateway /health** (`services/gateway/internal/router/router.go:42-49`):
  - 仅返回静态 JSON，不检查 User Service / Memory Service 可用性
  - 反向代理 `httputil.ReverseProxy` 使用默认 `proxy.Transport`，无显式超时配置

- **Chat Service 已知问题** (`services/gateway/internal/chat/service/chat_service.go`):
  - `buildMessages()` 循环中每条历史消息前都插入 system message（WR-01）
  - `citationsJSON, _ := json.Marshal(citations)` 静默丢弃错误（WR-02）
  - `isNewConversation` 声明后未使用（IN-01）

### 可复用资产
- **MemoryList 组件** (`web/components/memory/memory-list.tsx`): 纯展示组件，接收 `Memory[]`，易于扩展为支持分页状态
- **ApiClient** (`web/lib/api.ts`): 已封装 `request()` 方法，新增分页参数即可
- **Repository 接口** (`services/user-service/internal/repository/user_repository.go` 等): 已有接口定义，便于 mock 测试

### 集成点
- **Gateway → 下游服务**: 通过 `httputil.ReverseProxy` 代理，健康检查需直接 HTTP 探测
- **前端 → Memory Service**: 通过 Gateway 代理，分页参数透传
- **User Service OAuth**: GitHub OAuth 回调使用 state 验证，清理不能影响正常验证流程

</code_context>

<specifics>
## Specific Ideas

### OAuth 清理触发时机
- 在 `generateState()` 首次被调用时启动后台 goroutine（lazy init，避免服务启动即占用资源）
- 或使用 `sync.Once` 确保只启动一次清理 goroutine

### 健康检查响应设计
- 参考 Kubernetes liveness/readiness probe 风格
- 下游检查使用轻量级 HTTP 请求（HEAD 请求减少负载）
- 避免在健康检查中触发数据库查询（防止雪崩）

### 分页 API 设计
- 请求：`GET /api/v1/memories?page=1&limit=20`
- 响应：保留现有格式，新增 `pagination` 字段
  ```json
  {
    "success": true,
    "data": {
      "memories": [...],
      "pagination": {
        "page": 1,
        "limit": 20,
        "total": 156,
        "has_more": true
      }
    }
  }
  ```

</specifics>

<deferred>
## Deferred Ideas

- **Redis TTL for OAuth state** — 若未来部署多实例，需改用 Redis。当前单机部署，map+goroutine 足够。
- **testcontainers 集成测试** — 当前阶段聚焦单元测试，集成测试后续阶段考虑。
- **数据库连接池健康检查** — 当前健康检查仅做 HTTP 级探测，DB 健康可后续扩展。
- **Gateway 熔断器模式** — 超时重试是基础，熔断器是进阶，后续 milestone 考虑。

## Reviewed Todos (not folded)
- 无
</deferred>

---

*Phase: 07-bug-fixes-quality*
*Context gathered: 2026-04-23*
