# 代码库问题

**分析日期：** 2026-04-19

---

## 严重级别图例

| 级别 | 描述 |
|------|------|
| **严重** | 即时安全风险、数据丢失或生产中断潜力。任何部署前必须修复。 |
| **高** | 重大功能缺口或架构缺陷。阻碍扩展或引入重大技术债务。 |
| **中** | 应在下个 Sprint 解决。存在变通方案但降低质量或可维护性。 |
| **低** | 锦上添花改进。不阻碍当前功能。 |

---

## 严重

### C1：源代码中硬编码 JWT 密钥

- **问题：** JWT 签名密钥有硬编码回退值 `"echoes_dev_secret_key_change_in_production"`，被编译进二进制文件。
- **文件：**
  - `services/gateway/internal/middleware/auth.go`（第 17-21 行）
  - `services/user-service/internal/service/auth_service.go`（第 36-39 行）
  - `docker-compose.yml`（第 80 行）— 容器环境也硬编码
- **影响：** 如果生产环境未设置 `JWT_SECRET` 环境变量，所有 token 都使用来自 Git 仓库的公开已知密钥签名。完全绕过认证。
- **修复：** 完全移除回退。如果 `JWT_SECRET` 未设置则快速失败（panic/log.Fatal）。轮换任何用开发密钥签名的 token。

### C2：GitHub OAuth 凭据提交到 `.env`

- **问题：** `GITHUB_CLIENT_ID` 和 `GITHUB_CLIENT_SECRET` 存储在仓库根目录已提交的 `.env` 文件中。
- **文件：** `.env`
- **影响：** 泄露的 OAuth 凭据允许攻击者在 GitHub OAuth 流程中冒充应用。`.env` 文件被 git 追踪（不在 `.gitignore` 中）。
- **修复：**
  1. 立即撤销泄露的 GitHub OAuth 应用凭据。
  2. 将 `.env` 添加到 `.gitignore`。
  3. 轮换为仅存储在部署密钥中的新凭据（Docker secrets、K8s secrets 或 CI 环境变量）。
  4. 清理 git 历史或将这些凭据视为永久泄露。

### C3：宽松 CORS — 反射任意 Origin 并允许 Credentials

- **问题：** Gateway CORS 中间件逐字反射请求的 `Origin` 头并设置 `Access-Control-Allow-Credentials: true`。
- **文件：** `services/gateway/internal/router/router.go`（第 16-34 行）
- **影响：** 任何恶意网站都可以代表已登录用户发起认证的跨域请求。经典的 CORS 配置错误导致的 CSRF 绕过。
- **修复：** 将 Origin 加入白名单。开发环境：`http://localhost:3000`。生产环境：部署的前端域名。当允许 credentials 时，绝不反射任意 Origin。

### C4：任何端点都无限流

- **问题：** 没有任何路由应用限流中间件。登录、注册和 OAuth 端点完全暴露于暴力破解和枚举攻击。
- **文件：**
  - `services/gateway/internal/router/router.go`
  - `services/user-service/internal/transport/auth_handler.go`
  - `services/memory-service/internal/transport/memory_handler.go`
- **影响：** 凭据填充、用户枚举、通过昂贵端点的 DDoS（如带异步任务发布的记忆创建）。
- **修复：** 在 Gateway 添加按 IP 和按用户的限流。从 `/api/v1/auth/*` 的严格限制开始（如每个 IP 5 请求/分钟）。

### C5：记忆内容无输入清理 / XSS 风险

- **问题：** 用户提供的 `text_content`、`link_url`、`note` 和 `tags` 未经任何 HTML 清理即存储和返回。前端使用 `whitespace-pre-wrap` 渲染 `text_content`，将 `link_url` 作为 `<a>` href。
- **文件：**
  - `services/memory-service/internal/service/memory_service.go`（创建、更新）
  - `web/app/(main)/memory/[id]/page.tsx`（第 188 行 — 直接渲染 text_content）
  - `web/components/memory/memory-card.tsx`（第 56 行 — 直接渲染预览）
- **影响：** 存储型 XSS。攻击者可以将 `<script>` 标签或 `javascript:` URL 注入记忆内容。当其他用户查看该记忆时，脚本在其会话中执行。
- **修复：** 服务端清理所有用户文本输入（如 Go 使用 `bluemonday`，或前端使用 DOMPurify）。存储前验证 `link_url` 是否为有效 HTTP(S) URL。

---

## 高

### H1：OAuth State 参数存储在内存中（无 TTL 清理）

- **问题：** GitHub OAuth CSRF `state` 值存储在进程本地的 `map[string]time.Time` 中，10 分钟过期，但过期条目从未清理。该 map 无界增长。
- **文件：** `services/user-service/internal/transport/auth_handler.go`（第 20-46 行）
- **影响：** user-service 进程中的内存泄漏。在高 OAuth 流量下，服务将 OOM。此外，非生产环境中的 state 验证放宽（第 185-191 行），创建了绕过向量。
- **修复：** 将内存存储替换为 Redis（带 TTL）。第 20 行的注释甚至说"生产应使用 Redis + TTL" — 这是已承认的债务。

### H2：异步任务错误被静默忽略

- **问题：** `publishTasks()` 中的 Redis Stream 发布错误被 `_ =` 静默丢弃。
- **文件：** `services/memory-service/internal/service/memory_service.go`（第 75-87 行）
- **影响：** 如果 Redis 不可用，记忆被创建但永不处理（链接抓取、向量化、标签）。用户永远看到"pending"，无重试机制。DB 和队列之间数据不一致。
- **修复：**
  1. 不要静默忽略发布错误。将其返回给调用者或至少用 `zap` 记录。
  2. 实现发件箱模式：将任务写入 `pending_tasks` DB 表，然后让后台 worker 发布到 Redis。这保证至少一次交付。

### H3：无数据库连接池配置

- **问题：** GORM 以默认连接池设置打开。未配置 `SetMaxOpenConns`、`SetMaxIdleConns` 或 `SetConnMaxLifetime`。
- **文件：**
  - `services/user-service/internal/config/database.go`
  - `services/memory-service/internal/config/database.go`
- **影响：** 在高负载下，服务可能耗尽 PostgreSQL 连接限制或无限期持有陈旧连接。默认 GORM 池对生产环境通常过于激进。
- **修复：** 配置显式池限制（如最多 25 个打开、最多 5 个空闲、30 分钟生命周期），基于预期并发。

### H4：Processor 和 Vectorizer 服务是桩

- **问题：** Python processor-service 和 vectorizer-service 只有健康检查端点。它们不从 Redis Streams 消费或实现任何业务逻辑。
- **文件：**
  - `services/processor-service/app/main.py`
  - `services/vectorizer-service/app/main.py`
- **影响：** 创建时 `processing_status: "pending"` 的记忆永远不会变为"completed"。语义搜索不可用。自动标签不可用。链接抓取不可用。核心产品价值主张未实现。
- **修复：** Sprint 3 必须实现 Redis Stream 消费者、BGE-M3 模型加载和链接抓取逻辑。在此之前，产品功能不完整。

### H5：Gateway 对后端无健康检查 / 熔断器

- **问题：** Gateway 中的反向代理将请求转发到 user-service 和 memory-service，而不检查它们是否健康。如果后端宕机，Gateway 返回通用的 502/503，无优雅降级。
- **文件：** `services/gateway/internal/router/router.go`（第 60-82 行）
- **影响：** 级联故障。如果 memory-service 宕机，即使不需要记忆数据的认证请求也会失败。用户体验差。
- **修复：** 为后端实现健康检查轮询。当服务不可用时返回结构化错误。为瞬时故障考虑熔断器模式。

### H6：任何配置中无 TLS / SSL

- **问题：** 所有 Docker Compose 配置使用 `sslmode=disable`（开发）或无显式 TLS 终止。服务在 Docker 网络内通过纯 HTTP 通信。
- **文件：**
  - `docker-compose.yml`（第 101、127 行）
  - `docker-compose.prod.yml`（第 81 行）
- **影响：** 凭据和 JWT token 在网络上以明文传输。在多节点部署中，这是关键安全缺口。
- **修复：** 生产环境使用 `sslmode=require`。在 Gateway 添加 TLS 终止（或通过 Traefik/Nginx 等反向代理）。为 K8s 部署启用服务间 mTLS。

---

## 中

### M1：无 Refresh Token 轮换或撤销

- **问题：** Refresh token 有效 7 天，使用时无轮换。没有服务端 token 黑名单。`Logout` 处理器是空操作（第 157-161 行）。
- **文件：**
  - `services/user-service/internal/service/auth_service.go`（第 176-183 行）
  - `services/user-service/internal/transport/auth_handler.go`（第 157-161 行）
- **影响：** 被盗的 refresh token 可在最多 7 天内使用，无法撤销。用户点击"登出"实际上不会在服务端使其会话无效。
- **修复：** 实现 refresh token 轮换（每次使用时发放新 refresh token）。将 token jti 存储在 Redis 中并设置过期时间以支持撤销。让登出将 token 添加到 Redis 黑名单。

### M2：前端 Cookie `max-age` 硬编码为 15 分钟（与 Token 不匹配）

- **问题：** `api.ts` 设置 cookie，`max-age=900`（15 分钟）以匹配 access token 过期，但 Next.js 中间件只检查 cookie 存在性，不检查过期。
- **文件：** `web/lib/api.ts`（第 72 行）
- **影响：** 15 分钟后，cookie 过期但 localStorage 仍有 token。中间件可能重定向到登录页而 API 客户端仍有有效 token（或反之）。服务端和客户端之间认证状态不一致。
- **修复：** 使用更长期限的会话 cookie 或实现滑动过期。确保中间件和 API 客户端使用相同的 token 源和过期逻辑。

### M3：记忆列表无分页（前端硬编码第 1 页）

- **问题：** 首页 `loadMemories` 总是请求 `page: 1, limit: 20`。没有无限滚动或分页 UI。
- **文件：** `web/app/(main)/page.tsx`（第 42 行）
- **影响：** 用户无法查看超过 20 条记忆。API 支持分页但 UI 不支持。
- **修复：** 在时间轴 UI 中实现无限滚动或分页控件。

### M4：记忆更新不重新触发向量化

- **问题：** 当通过 `Update()` 更新记忆的标签或备注时，内容可能已显著变化，但不发布新的向量化任务。
- **文件：** `services/memory-service/internal/service/memory_service.go`（第 145-159 行）
- **影响：** 更新后语义搜索结果变得陈旧。向量嵌入不再代表当前内容。
- **修复：** 如果 `text_content` 或 `link_url` 变化，在更新时重新发布 `text:vectorize` 任务。当前只有 `tags` 和 `note` 可更新 — 考虑允许内容编辑。

### M5：生产 Dockerfile 目标中使用 `gin.DebugMode`

- **问题：** user-service 和 memory-service 都无条件设置 `gin.SetMode(gin.DebugMode)`。生产 Docker 镜像以 debug 模式运行。
- **文件：**
  - `services/user-service/cmd/main.go`（第 33 行）
  - `services/memory-service/cmd/main.go`（第 41 行）
- **影响：** Debug 模式在 HTTP 响应中暴露堆栈跟踪和详细日志。信息泄露风险。
- **修复：** 基于 `ENV` 或 `GIN_MODE` 环境变量设置模式：当 `ENV=production` 时 `gin.SetMode(gin.ReleaseMode)`。

### M6：无请求体大小限制

- **问题：** Gin 路由器未配置 `MaxMultipartMemory` 或请求体大小限制。用户可以上传任意大的文本内容。
- **文件：** 所有服务 `cmd/main.go` 文件。
- **影响：** 内存耗尽 DoS。单个请求携带数 MB 的 JSON 体可能使服务崩溃。
- **修复：** 添加 `c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 1<<20)`（1MB）或配置 Gin 限制。

### M7：`isPublicRoute` 使用 `strings.HasPrefix` — 潜在路径绕过

- **问题：** 公开路由检查使用 `strings.HasPrefix`，可被 `/api/v1/auth/register/evil` 等路径欺骗。
- **文件：** `services/gateway/internal/middleware/auth.go`（第 85-101 行）
- **影响：** `/api/v1/auth/register/x` 等路径会被视为公开，绕过 JWT 验证。然而，Gin 路由会返回 404，所以实际风险较低，除非添加匹配该前缀的新路由。
- **修复：** 使用精确路径匹配，或确保路由列表以 `/` 结尾且检查包含尾部斜杠要求。

### M8：Docker Compose `depends_on` 不等待服务就绪

- **问题：** 使用 `condition: service_started`（或默认）的 `depends_on` 只等待容器启动，不等待服务实际接受连接。
- **文件：** `docker-compose.yml`（第 84-88 行、132-136 行）
- **影响：** 启动时竞态条件。Gateway 可能在 user-service 就绪前启动，导致初始请求失败。
- **修复：** 对所有服务依赖使用 `condition: service_healthy`（postgres/redis 已这样做，但缺少 gateway -> user/memory 服务）。

---

## 低

### L1：无结构化日志（只有 `log.Printf`）

- **问题：** 所有 Go 服务使用标准库 `log` 而非结构化日志（Zap 在 gateway 的 `go.mod` 中但未使用）。
- **文件：** 所有 `cmd/main.go` 文件和处理器。
- **影响：** 日志不可机器解析。分布式追踪无关联 ID。调试生产问题困难。
- **修复：** 用 `zap.Logger` 替换 `log.Printf`。为所有日志添加请求 ID。根据 `CLAUDE.md` 计划在 Sprint 5 实现。

### L2：无 API 版本策略（URL 路径之外）

- **问题：** API 使用 `/api/v1/`，但没有 v2 的迁移或弃用策略。
- **文件：** 所有路由定义。
- **影响：** 未来 API 变更将具有破坏性，无优雅过渡路径。
- **修复：** 记录版本策略。考虑使用 Accept header 版本控制作为替代方案。

### L3：前端使用 `window.location.href` 进行导航

- **问题：** 多个页面使用 `window.location.href = '/'` 而非 Next.js `router.push()` 或 `<Link>`。
- **文件：**
  - `web/app/(auth)/login/page.tsx`（第 27、59 行）
  - `web/app/(auth)/register/page.tsx`（第 44 行）
  - `web/app/providers/auth-provider.tsx`（第 64 行）
- **影响：** 完整页面重载而非客户端过渡。UX 更差且丢失 React 状态。
- **修复：** 使用 `next/navigation` 的 `useRouter` 进行编程式导航。

### L4：空的 K8s 目录

- **问题：** `k8s/` 目录存在但为空。没有 Kubernetes 清单。
- **文件：** `k8s/`
- **影响：** 生产部署计划引用 K8s 但没有实现。
- **修复：** 创建 K8s 清单（deployment、service、ingress、configmap、secret）或如果 Docker Compose 是唯一目标则删除该目录。

### L5：`go.mod` Go 版本不一致

- **问题：** Gateway 和 memory-service 使用 `go 1.22`，但 user-service 使用 `go 1.23`。
- **文件：** 所有 `go.mod` 文件。
- **影响：** 较小，但不一致的工具链版本可能导致构建可重复性问题。
- **修复：** 所有服务统一使用单一 Go 版本（1.23）。

### L6：不存在测试文件

- **问题：** 整个代码库零个测试文件。`make test` 将失败或运行空测试套件。
- **文件：** 整个代码库。
- **影响：** 重构无自动化安全网。bug 只能手动发现。
- **修复：** 为服务层、repository mock 和 API 处理器边界情况添加单元测试。为 React 组件添加 Jest 测试。

### L7：`SafeResponse()` 手动构造 Map 而非使用 JSON 标签

- **问题：** `User.SafeResponse()` 和 `Memory.SafeResponse()` 都手动构建 `map[string]interface{}` 而非依赖 `json:"-"` 标签和直接结构体序列化。
- **文件：**
  - `services/user-service/internal/domain/user.go`（第 30-40 行）
  - `services/memory-service/internal/domain/memory.go`（第 40-56 行）
- **影响：** 字段漂移风险 — 当新字段添加到结构体时，`SafeResponse()` 可能忘记包含或排除它们。维护负担。
- **修复：** 使用带正确 JSON 标签的单独 DTO 结构体，或使用 `jsonapi` / `mapstructure` 等库进行序列化。

### L8：Vectorizer Dockerfile 每次构建都下载模型

- **问题：** vectorizer-service Dockerfile 安装 `torch`、`transformers` 和 `sentence-transformers`，但不预下载 BGE-M3 模型权重。模型将在容器启动时下载。
- **文件：** `services/vectorizer-service/Dockerfile`
- **影响：** 容器启动缓慢（首次运行需数分钟）。如果 HuggingFace 宕机则不可靠。运行时带宽使用大。
- **修复：** 添加构建步骤将模型权重下载并缓存到镜像中（如 `RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('BAAI/bge-m3')"`）。

---

## 按类别汇总

| 类别 | 严重 | 高 | 中 | 低 |
|------|------|-----|-----|-----|
| 安全 | 4 (C1-C5) | 1 (H6) | 2 (M1、M5) | 0 |
| 架构 | 0 | 3 (H2、H4、H5) | 2 (M3、M8) | 2 (L2、L4) |
| 性能 | 0 | 1 (H3) | 1 (M6) | 0 |
| 数据完整性 | 0 | 1 (H2) | 1 (M4) | 0 |
| 可维护性 | 0 | 0 | 1 (M7) | 4 (L1、L3、L5、L7) |
| 测试 | 0 | 0 | 0 | 1 (L6) |

---

*问题审计：2026-04-19*
