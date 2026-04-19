# 开发进度 (PROGRESS)

> Echoes (拾忆) 项目开发进度跟踪
> 创建日期：2026-04-18
> 预计完成：2026-05-30

---

## Sprint 0：基础设施搭建（Week 1: 2026-04-18 ~ 2026-04-25）

### 状态：已完成

### 目标

**后端：**
- [x] Docker Compose 配置（postgres + redis + minio + 所有服务）
- [x] 数据库迁移（users / memories 表 + pgvector 扩展 + 索引）
- [x] 各服务 Dockerfile（多阶段构建：builder / development / production）
- [x] Go 服务骨架（Gateway / User / Memory）含 `/health` 端点
- [x] Python 服务骨架（Processor / Vectorizer）含 `/health` 端点

**前端：**
- [x] Next.js 14 + Tailwind CSS + TypeScript 项目初始化
- [x] 暗黑模式 CSS 变量系统
- [x] 基础布局组件

**DevOps：**
- [x] Makefile（常用命令：dev-start / dev-stop / dev-logs / migrate / test）
- [x] Windows PowerShell 启动脚本（`dev-start.ps1`）
- [x] macOS/Linux 启动脚本（`dev-start.sh`）
- [x] `.gitattributes` 强制 LF 换行符

**文档：**
- [x] README.md（项目简介、快速开始、技术栈、目录结构）
- [x] docs/ARCHITECTURE.md（微服务划分、数据流、部署架构）
- [x] docs/API.md（接口详细定义）
- [x] docs/PROGRESS.md（开发进度跟踪）
- [x] CHANGELOG.md（版本变更日志）

### 完成情况

#### Day 1 (2026-04-18)

- 完成 Git 仓库初始化和远程关联
- 创建 `.gitattributes` 强制 LF 换行符
- 创建完整项目目录结构
- 创建 `docker-compose.yml`（本地开发环境）
  - PostgreSQL 15 + pgvector
  - Redis 7
  - MinIO 对象存储
  - Gateway / User / Memory / Processor / Vectorizer 服务
  - Next.js Web 前端
- 创建 `docker-compose.prod.yml`（生产环境）
- 创建数据库迁移文件 `shared/migrations/001_init.sql`
  - users 表
  - memories 表（含 vector 向量字段）
  - 索引和触发器
- 创建 `Makefile`（开发常用命令）
- 创建 `dev-start.ps1`（Windows PowerShell 启动脚本）
- 创建 `dev-start.sh`（macOS/Linux 启动脚本）

#### Day 2 (2026-04-19)

- 创建各微服务基础文件：
  - Gateway Service（Go + Gin）
  - User Service（Go + GORM）
  - Memory Service（Go + GORM）
  - Processor Service（Python + FastAPI）
  - Vectorizer Service（Python + FastAPI + BGE-M3）
- 创建 Next.js 前端基础配置：
  - package.json / tsconfig.json
  - tailwind.config.ts / postcss.config.js / next.config.js
  - globals.css（含暗黑模式变量）
  - layout.tsx / page.tsx
- 创建项目文档：
  - README.md
  - docs/PROGRESS.md
  - docs/ARCHITECTURE.md
  - docs/API.md
  - CHANGELOG.md

#### Day 2 补充 (2026-04-19)

- Docker Compose 启动测试成功
  - 基础设施服务（PostgreSQL, Redis, MinIO）全部 healthy
  - Gateway / User / Memory 服务运行正常
  - Processor Service 运行正常
  - Web 前端运行正常（端口 3000）
  - Vectorizer Service 构建就绪（PyTorch 依赖构建较慢，Sprint 3 再验证）
- 修复问题：
  - Go 服务 Dockerfile 移除 `go.sum` 依赖（使用 `go mod tidy`）
  - Web 前端 CSS 变量修复（移除未定义的 Tailwind 类）
  - 网关端口 8080 被占用，切换至 8088
- 第一次提交并推送至 GitHub：`feat: Sprint 0 基础设施搭建`

### 里程碑验证

- [x] `docker-compose up -d` 后所有服务 running
- [x] Gateway `/health` 返回 200

### 待解决问题

- [ ] Vectorizer Service 完整构建（PyTorch + BGE-M3，Sprint 3 处理）
- [ ] 数据库迁移手动执行（`make migrate` 待验证）
- [ ] K8s 部署配置待创建（Sprint 5）

---

## Sprint 1：认证体系（Week 2: 2026-04-26 ~ 2026-05-02）

### 状态：已完成

### 目标

**User Service（Go + GORM）：**
- [x] 数据库连接（GORM + PostgreSQL）
- [x] User domain 模型（与 `001_init.sql` 对应）
- [x] Repository 层（Create / GetByEmail / GetByID / Update）
- [x] Service 层：
  - [x] 注册（bcrypt 密码哈希，cost=12）
  - [x] 登录（密码校验 + JWT 签发）
  - [x] GitHub OAuth（授权入口 + Callback + 用户绑定）
  - [x] Token 刷新（Refresh Token 机制）
- [x] Transport 层（Gin HTTP Handler）：
  - [x] `POST /api/v1/auth/register`
  - [x] `POST /api/v1/auth/login`
  - [x] `GET /api/v1/auth/github`
  - [x] `GET /api/v1/auth/github/callback`
  - [x] `POST /api/v1/auth/refresh`
  - [x] `POST /api/v1/auth/logout`
  - [x] `GET /api/v1/auth/me`

**Gateway Service（Go + Gin）：**
- [x] 反向代理：认证路由 -> User Service
- [x] JWT 认证中间件（验证 Access Token，透传 user_id）
- [ ] 路由转发：记忆路由 -> Memory Service（预留，Sprint 2 接入）

**前端（Next.js）：**
- [x] 登录页面（`app/(auth)/login/page.tsx`）
- [x] 注册页面（`app/(auth)/register/page.tsx`）
- [x] 表单验证（Zod / React Hook Form）
- [x] API 客户端封装（fetch wrapper + token 自动注入）
- [x] 登录状态管理（React Context / Zustand）
- [x] 路由保护（middleware.ts 未认证重定向至登录页）

**文档：**
- [x] 更新 docs/API.md（认证接口详细定义：错误码表补充 OAUTH_ERROR/INVALID_STATE、GitHub OAuth 回调响应、健康检查版本 0.2.0）
- [x] 更新 docs/PROGRESS.md（Sprint 1 完成标记）
- [x] 更新 CHANGELOG.md（v0.2.0）

### 完成情况

#### Day 1 (2026-04-19)

- 创建 `develop` 分支，Sprint 1 启动
- 更新 PRD.md 第10章开发计划（详细任务分解）
- 完成 User Service 实现：
  - [x] 用户模型（domain/user.go, domain/auth.go）
  - [x] 数据库连接配置（internal/config/database.go）
  - [x] Repository 层（GORM + 重复检测）
  - [x] Service 层（bcrypt 密码哈希 + JWT Token 体系）
  - [x] HTTP Handler 层（注册/登录/刷新/登出/获取用户）
- 完成 Gateway Service 实现：
  - [x] JWT 认证中间件（Bearer Token 验证 + 公开路由白名单）
  - [x] 反向代理到 User Service
  - [x] 路由配置（/api/v1/auth/* -> User Service）
- 完成前端登录/注册页面：
  - [x] API 客户端封装（lib/api.ts，含 Token 自动注入）
  - [x] 登录页面（app/(auth)/login/page.tsx）
  - [x] 注册页面（app/(auth)/register/page.tsx）
  - [x] 表单验证（HTML5）+ 错误提示
  - [x] 登录后跳转首页
  - [x] 路由保护中间件（web/middleware.ts）
- 测试验证：
  - [x] 注册成功 -> 返回 JWT Token + 用户信息
  - [x] 登录成功 -> 返回新 Token
  - [x] 获取当前用户 -> 返回用户信息
  - [x] 重复注册 -> 返回 USER_EXISTS (409)
  - [x] 错误密码 -> 返回 INVALID_CREDENTIALS (401)
  - [x] 无 Token 访问 -> 返回 UNAUTHORIZED (401)
  - [x] 未认证访问首页 -> 307 重定向至 /login
- Go 版本升级：1.22 -> 1.23（解决依赖兼容问题）

#### Day 2 ~ Day 3 (2026-04-19 ~ 2026-04-20)

- GitHub OAuth 完整实现：
  - [x] 授权入口 `/api/v1/auth/github`（生成 state，10分钟过期）
  - [x] Callback `/api/v1/auth/github/callback`（验证 state，获取用户信息）
  - [x] 用户自动创建/绑定（邮箱冲突时自动关联已有账户）
  - [x] 前端 GitHub 登录按钮（SVG 图标 + 分隔线设计）
- Zod 表单验证替代 HTML5 验证：
  - [x] 登录页：邮箱格式 + 密码最小8位
  - [x] 注册页：用户名必填 + 邮箱格式 + 密码最小8位
- React Context 登录状态管理：
  - [x] AuthProvider（全局 auth state，localStorage token 管理）
  - [x] 页面刷新自动恢复会话
  - [x] 首页显示当前用户 + 退出登录按钮
- 图标设计迭代（2轮）：
  - [x] 第一轮：Saul Bass 负空间 + Gris 水彩质感（用户反馈：不清晰）
  - [x] 第二轮：纯描边 SVG + currentColor，暗黑/明亮模式自动适配
  - [x] web/components/logo.tsx 内联组件
  - [x] web/public/logo.svg + favicon.svg 重写
  - [x] 登录页/首页应用新 Logo，移除 dark:invert hack
- 文档同步：
  - [x] PRD.md Sprint 1 状态更新
  - [x] docs/PROGRESS.md 本文件更新
  - [x] CHANGELOG.md v0.2.0 版本记录
  - [x] docs/API.md 认证接口更新（错误码、OAuth回调、健康检查版本）

### 里程碑验证

- [x] 用户可通过邮箱注册、登录
- [x] 登录后获取 JWT Token
- [x] Gateway 中间件拒绝无 Token 请求
- [x] GitHub OAuth 可完成授权并创建/绑定用户

---

## Sprint 2：记忆捕获（Week 3: 2026-05-03 ~ 2026-05-09）

### 状态：未开始

### 目标

**Memory Service（Go + GORM）：**
- [ ] 数据库连接 + Memory domain 模型
- [ ] Repository 层（CRUD + 分页 + 按用户过滤）
- [ ] Service 层：
  - [ ] 创建记忆（文字 / 链接两种类型）
  - [ ] 时间轴列表（分页 + 无限滚动）
  - [ ] 记忆详情
  - [ ] 更新标签/备注
  - [ ] 删除记忆
- [ ] Transport 层：
  - [ ] `POST /api/v1/memories`
  - [ ] `GET /api/v1/memories`（分页参数：page, limit, tag）
  - [ ] `GET /api/v1/memories/:id`
  - [ ] `PUT /api/v1/memories/:id`
  - [ ] `DELETE /api/v1/memories/:id`
- [ ] 异步任务发布（Redis Stream）：
  - [ ] 链接类型 -> `link:fetch` 队列
  - [ ] 所有类型 -> `text:vectorize` 队列
  - [ ] 所有类型 -> `tag:generate` 队列

**Gateway Service：**
- [ ] 路由转发：记忆路由 -> Memory Service
- [ ] JWT 中间件保护记忆接口

**前端：**
- [ ] 时间轴首页（`app/(main)/page.tsx`）
- [ ] 记忆创建表单（文字输入 + 链接输入 + #标签）
- [ ] 记忆卡片组件（80-120px 高度，3行预览）
- [ ] 记忆详情页（`app/(main)/memory/[id]/page.tsx`）
- [ ] 编辑/删除记忆
- [ ] 无限滚动（Intersection Observer）

**文档：**
- [ ] 更新 docs/API.md（记忆接口）
- [ ] 更新 docs/ARCHITECTURE.md（数据流补充）

### 里程碑验证

- [ ] 登录用户可创建文字记忆和链接记忆
- [ ] 时间轴展示记忆列表（按时间倒序）
- [ ] 可点击查看详情、编辑标签、删除
- [ ] 创建后 `processing_status=pending`，Redis Stream 有任务

---

## Sprint 3：AI 处理层（Week 4: 2026-05-10 ~ 2026-05-16）

### 状态：未开始

### 目标

**LLM Provider（共享模块）：**
- [ ] `LLMProvider` 接口定义（`GenerateTags(content string) ([]string, error)`）
- [ ] `OpenAIProvider`（调用 GPT-3.5/4 API）
- [ ] `AnthropicProvider`（调用 Claude API）
- [ ] 工厂函数 `NewLLMProvider(provider string) LLMProvider`
- [ ] 降级方案：LLM 失败时本地关键词提取（jieba / TF-IDF）
- [ ] Prompt 工程：生成 3-5 个中文标签

**Processor Service（Python + FastAPI）：**
- [ ] Redis Stream 消费者（`link:fetch` / `tag:generate`）
- [ ] 链接抓取（httpx + BeautifulSoup）
  - [ ] 提取 title / description / favicon
  - [ ] 内容摘要（可选，Sprint 4 扩展）
- [ ] 自动标签生成（调用 LLM Provider）
- [ ] 状态更新：Processor 完成后更新 memories.processing_status

**Vectorizer Service（Python + FastAPI）：**
- [ ] BGE-M3 模型加载（启动时预加载）
- [ ] CPU/GPU 自动检测（`torch.cuda.is_available()`）
- [ ] Redis Stream 消费者（`text:vectorize`）
- [ ] 文本编码为 768 维向量
- [ ] 更新 memories.vector 字段

**Memory Service：**
- [ ] 状态流转管理：`pending -> processing -> completed/failed`
- [ ] 重试机制：失败任务最多重试 3 次

**文档：**
- [ ] 更新 docs/ARCHITECTURE.md（LLM Provider 模块、异步任务流）

### 里程碑验证

- [ ] 创建记忆后，Processor 自动抓取链接标题摘要
- [ ] 自动标签生成（中文，3-5 个）
- [ ] 向量写入 memories.vector 字段
- [ ] 状态最终变为 `completed`
- [ ] LLM 失败时降级为本地关键词提取

---

## Sprint 4：搜索能力（Week 5: 2026-05-17 ~ 2026-05-23）

### 状态：未开始

### 目标

**Memory Service：**
- [ ] 语义搜索 API：`GET /api/v1/search?q=&limit=`
  - [ ] 查询文本向量化（调用 Vectorizer Service 或本地缓存）
  - [ ] pgvector 余弦相似度查询（阈值 >= 0.75）
  - [ ] 返回结果含 similarity 分数
- [ ] 相似内容推荐：`GET /api/v1/memories/:id/related`
  - [ ] 基于已有 vector 查询最相似的 N 条
- [ ] 标签筛选（与搜索组合）

**Vectorizer Service：**
- [ ] 查询向量 API（供 Memory Service 调用）
- [ ] 向量缓存（Redis 缓存高频查询）

**前端：**
- [ ] 搜索页面（`app/(main)/search/page.tsx`）
- [ ] 搜索输入框（支持自然语言）
- [ ] 搜索结果展示（含相似度分数）
- [ ] 暗黑模式切换（系统偏好 + 手动切换）
- [ ] 响应式适配（桌面 + 平板）

**文档：**
- [ ] 更新 docs/API.md（搜索接口）

### 里程碑验证

- [ ] 搜索"Go 协程"可找到相关记忆
- [ ] 相似推荐展示"你可能还感兴趣"
- [ ] 暗黑模式完整可用（非简单反色）

---

## Sprint 5：可观测性 + 打磨上线（Week 6: 2026-05-24 ~ 2026-05-30）

### 状态：未开始

### 目标

**可观测性（所有 Go 服务）：**
- [ ] Prometheus Metrics：
  - [ ] `/metrics` 端点暴露
  - [ ] `http_requests_total` / `http_request_duration_seconds`
  - [ ] `memory_processing_status` / `llm_requests_total`
- [ ] OpenTelemetry Tracing：
  - [ ] Gateway 生成 trace_id
  - [ ] HTTP 调用 Span（Gateway -> User/Memory）
  - [ ] Redis Stream Span
- [ ] Zap 结构化日志：
  - [ ] JSON 格式，含 trace_id / span_id
  - [ ] 按级别分级（INFO / WARN / ERROR）
- [ ] Docker Compose 增加：Prometheus + Jaeger + Grafana
- [ ] Grafana 仪表盘配置

**前端打磨：**
- [ ] Framer Motion 动效（页面切换、卡片入场）
- [ ] 加载状态 / 骨架屏
- [ ] 错误处理（Toast 通知）
- [ ] 空状态设计

**后端打磨：**
- [ ] 输入验证（Go validator / Pydantic）
- [ ] 统一错误响应格式
- [ ] 限流中间件（Token Bucket）
- [ ] CORS 配置

**测试：**
- [ ] 端到端测试：注册 -> 登录 -> 创建记忆 -> 搜索
- [ ] 各服务单元测试

**文档：**
- [ ] README.md 最终版（完整快速开始）
- [ ] 更新 CHANGELOG.md（v1.0.0）
- [ ] 可观测性部署文档

### 里程碑验证

- [ ] Prometheus 可抓取所有 Go 服务指标
- [ ] Jaeger 可查看跨服务调用链路
- [ ] Grafana 仪表盘展示 QPS / 延迟 / 错误率
- [ ] 端到端流程无阻塞通过

---

## Phase 2 扩展：Echo Assistant（+1-2 周）

### 状态：未开始

### 目标

- [ ] Chat UI 侧边栏组件（Web 界面）
- [ ] RAG 检索逻辑：
  - [ ] 用户问题 -> 语义搜索 -> 获取相关记忆
  - [ ] 记忆上下文 + 问题 -> LLM Provider 生成回答
- [ ] 引用来源展示（LLM 回答中标注引用的记忆标题/链接）
- [ ] 对话历史管理（数据库存储）
- [ ] 复用 Sprint 3 的 LLMProvider（无需新开发）

### 里程碑验证

- [ ] "我上周存的关于 Go 的文章有哪些？" -> 列出相关记忆 + 总结回答

---

## Phase 3 预留：Agent 平台

### 状态：预留（不实现）

### 目标

- [ ] 数据库字段预留 `agent_id`、`agent_type`
- [ ] 预留 Agent 配置表结构
- [ ] 微服务架构支持未来接入 Agent Service

### 明确不做

- [ ] 第三方 Agent 市场、SDK、沙盒
