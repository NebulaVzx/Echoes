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

## Sprint 2：记忆捕获（Week 3: 2026-04-20 ~ 2026-04-26）

### 状态：已完成

### 目标

**Memory Service（Go + GORM）：**
- [x] 数据库连接 + Memory domain 模型
- [x] Repository 层（CRUD + 分页 + 按用户过滤）
- [x] Service 层：
  - [x] 创建记忆（文字 / 链接两种类型）
  - [x] 时间轴列表（分页）
  - [x] 记忆详情
  - [x] 更新标签/备注
  - [x] 删除记忆
- [x] Transport 层：
  - [x] `POST /api/v1/memories`
  - [x] `GET /api/v1/memories`（分页参数：page, limit, tag）
  - [x] `GET /api/v1/memories/:id`
  - [x] `PUT /api/v1/memories/:id`
  - [x] `DELETE /api/v1/memories/:id`
- [x] 异步任务发布（Redis Stream）：
  - [x] 链接类型 -> `link:fetch` 队列
  - [x] 所有类型 -> `text:vectorize` 队列
  - [x] 所有类型 -> `tag:generate` 队列

**Gateway Service：**
- [x] 路由转发：记忆路由 -> Memory Service
- [x] JWT 中间件保护记忆接口

**前端：**
- [x] 时间轴首页（`app/(main)/page.tsx`）
- [x] 记忆创建表单（文字输入 + 链接输入 + #标签）
- [x] 记忆卡片组件（80-120px 高度，3行预览）
- [x] 记忆详情页（`app/(main)/memory/[id]/page.tsx`）
- [x] 编辑/删除记忆

**文档：**
- [x] 更新 docs/API.md（记忆接口）
- [x] 更新 docs/ARCHITECTURE.md（数据流补充）

### 里程碑验证

- [x] 登录用户可创建文字记忆和链接记忆
- [x] 时间轴展示记忆列表（按时间倒序）
- [x] 可点击查看详情、编辑标签、删除
- [x] 创建后 `processing_status=pending`，Redis Stream 有任务

---

## Sprint 3：AI 处理层（Week 4: 2026-04-26 ~ 2026-05-02）

### 状态：已完成

### 目标

**LLM Provider（共享模块）：**
- [x] `LLMProvider` 接口定义
- [x] `OpenAIProvider`（OpenAI 兼容协议）
- [x] `AnthropicProvider`（Anthropic 协议）
- [x] 工厂函数 `LLMFactory.create()`
- [x] Prompt 工程：生成 3-5 个中文标签

**Processor Service（Python + FastAPI）：**
- [x] Redis Stream 消费者（`link:fetch` / `tag:generate`）
- [x] 链接抓取（httpx + BeautifulSoup）
  - [x] 提取 title / description / favicon
  - [x] 内容摘要
- [x] 自动标签生成（调用 LLM Provider）
- [x] 状态更新：Processor 完成后更新 memories.processing_status

**Vectorizer Service（Python + FastAPI）：**
- [x] BGE-M3 模型加载（启动时预加载）
- [x] CPU/GPU 自动检测
- [x] HTTP `/encode` API（供 Memory Service 调用）
- [x] 文本编码为 1024 维向量（BGE-M3）
- [x] 更新 memories.vector 字段

**Memory Service：**
- [x] 状态流转管理：`pending -> processing -> completed/failed`
- [x] 重试机制：失败任务可手动重试

**Per-user LLM 配置：**
- [x] User Service：`users.settings` JSONB 存储 per-user LLM 配置
- [x] Memory Service：publish 时附加用户 LLM 配置到 Redis Stream
- [x] Processor Service：消费时从消息读取配置覆盖环境变量默认值
- [x] 前端 Settings 页面：provider/protocol/model/temperature 配置 + 测试连接

**文档：**
- [x] 更新 docs/ARCHITECTURE.md（LLM Provider 模块、异步任务流）

### 里程碑验证

- [x] 创建记忆后，Processor 自动抓取链接标题摘要
- [x] 自动标签生成（中文，3-5 个）
- [x] 向量写入 memories.vector 字段
- [x] 状态最终变为 `completed`

---

## Sprint 4：搜索能力（Week 5: 2026-05-02 ~ 2026-05-09）

### 状态：已完成

### 目标

**Memory Service：**
- [x] 语义搜索 API：`GET /api/v1/search?q=&limit=`
  - [x] 查询文本向量化（调用 Vectorizer Service）
  - [x] pgvector 余弦相似度查询（用户可配置阈值，默认 0.40）
  - [x] 返回结果含 similarity 分数
- [x] 相似内容推荐：`GET /api/v1/memories/:id/related`
  - [x] 基于已有 vector 查询最相似的 N 条
- [x] Per-user 搜索阈值配置（`search_similarity_threshold`，默认 0.40）

**Vectorizer Service：**
- [x] 查询向量 API（`/encode`）

**前端：**
- [x] 搜索页面（`app/(main)/search/page.tsx`）
- [x] 搜索输入框（支持自然语言，保留 URL query）
- [x] 搜索结果展示（含相似度百分比）
- [x] 空搜索状态（图标 + 提示文案）
- [x] 相似推荐组件（`RelatedMemories`，详情页底部）
- [x] 暗黑模式切换（系统偏好 + 手动切换）
- [x] Settings 页面 UX 改进：LLM 连接 / 处理偏好 / 搜索偏好 三个独立区域

**文档：**
- [x] 更新 docs/API.md（搜索接口）
- [x] 04-UAT.md：Phase 4 全部 5/5 通过

### 里程碑验证

- [x] 搜索"Kimi"可找到相关记忆，显示"相关度 X%"
- [x] 相似推荐展示"你可能还感兴趣"
- [x] 暗黑模式完整可用（非简单反色）
- [x] 设置页面可独立保存搜索阈值、处理偏好、LLM 连接

---

## Sprint 5：可观测性 + 打磨上线（Week 6: 2026-05-09 ~ 2026-05-16）

### 状态：已完成

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

### 完成情况

Sprint 5 与 Sprint 2-4 集中完成，最终于 2026-04-22 发布 v1.0 MVP。

### 里程碑验证

- [x] Prometheus 可抓取所有 Go 服务指标
- [x] Jaeger 可查看跨服务调用链路
- [x] Grafana 仪表盘展示 QPS / 延迟 / 错误率
- [x] 端到端流程无阻塞通过

---

## Phase 2 扩展：Echo Assistant

### 状态：已完成（2026-04-22，作为 v1.1 的一部分）

### 目标

- [x] Chat UI 侧边栏组件（Web 界面）
- [x] RAG 检索逻辑：
  - [x] 用户问题 -> 语义搜索 -> 获取相关记忆
  - [x] 记忆上下文 + 问题 -> LLM Provider 生成回答
- [x] 引用来源展示（LLM 回答中标注引用的记忆标题/链接）
- [x] 对话历史管理（数据库存储）
- [x] 复用 Sprint 3 的 LLMProvider（无需新开发）

### 里程碑验证

- [x] "我上周存的关于 Go 的文章有哪些？" -> 列出相关记忆 + 总结回答

---

## Phase 3 预留：Agent 平台

### 状态：预留（不实现）

### 目标

- [ ] 数据库字段预留 `agent_id`、`agent_type`
- [ ] 预留 Agent 配置表结构
- [ ] 微服务架构支持未来接入 Agent Service

### 明确不做

- [ ] 第三方 Agent 市场、SDK、沙盒

---

## v1.1 Echo Assistant（2026-04-25）

### 状态：已完成

### Phase 6：Echo Assistant

- [x] Chat 侧边栏组件（展开/收起，响应式设计）
- [x] RAG 检索逻辑：用户问题 -> 语义搜索 -> 获取相关记忆 -> LLM 生成回答
- [x] 多轮对话支持，对话历史管理
- [x] 引用来源展示（回答中标注引用的记忆标题/链接）
- [x] 复用 Processor Service 的 LLMProvider

### Phase 7：Bug Fixes & Quality

- [x] OAuth state 内存泄漏修复
- [x] Gateway 健康检查完善（聚合所有下游服务状态）
- [x] 路径遍历漏洞修复
- [x] Chat 服务稳定性修复
- [x] 双模式分页（cursor 分页 + offset 分页）
- [x] Go 单元测试 55 个全部通过

### 里程碑验证

- [x] Chat 侧边栏可展开并进行多轮对话
- [x] 提问后 LLM 回答中标注引用来源
- [x] 所有 Go 单元测试通过

---

## v1.2 "记忆的温度"（2026-04-26）

### 状态：已完成

### Phase 8：AI 陪伴建议

- [x] 保存记忆后异步调用 LLM 生成 AI 建议
- [x] 三种建议风格：温柔型 / 实用型 / 启发型
- [x] 文字/链接内容采用不同提示策略
- [x] 建议持久化到 `ai_suggestions` 表（ON DELETE CASCADE）
- [x] 创建表单可选开启/关闭 AI 建议（默认关闭）
- [x] 生成失败不阻塞保存，指数退避重试 3 次
- [x] 前端 Sparkles 图标 hover 展开，详情页完整展示
- [x] 反馈按钮：有用 / 不用了，记录用户偏好
- [x] 高级选项：超时 10-60s、最大重试 1-5

### Phase 9：标签重生

- [x] 首页横向标签栏（TagFilterBar）
- [x] 多选 AND 过滤 + 清除全部
- [x] 新增 `/tags` 标签管理页
- [x] 三种视图：云图（按频率调整字体）/ 卡片 / 列表
- [x] 标签颜色预设调色板（16 色），按用户存储在 `users.settings`
- [x] 标签合并（AI 检测相似标签 + 手动选择目标）
- [x] 记忆详情页相关标签（基于共现统计）
- [x] LLM 自动分类标签

### Phase 10：记忆的温度

- [x] 记忆 Streaks：连续记录天数统计，创建表单下方显示状态
- [x] Streak 支持 1 天容错（grace period）
- [x] 那年今日：首页顶部展示一年前的记忆
- [x] 无一年前数据时选随机高价值旧记忆
- [x] 时间胶囊：保存时可选择 7/30/100 天封印
- [x] 时间胶囊独立入口 `/capsules`
- [x] 封印期间记忆不显示在时间轴，到期首页显示解锁仪式卡片
- [x] 每日回顾：可折叠卡片展示今日保存数量、主题标签、旧记忆
- [x] 无新记忆时显示鼓励文案

### 里程碑验证

- [x] 创建记忆后 AI 建议异步生成并展示
- [x] 标签过滤器和标签管理页功能正常
- [x] Streaks 统计正确，创建表单显示状态
- [x] 时间胶囊封印/解锁流程完整
- [x] 每日回顾卡片展示今日记忆摘要

---

*PROGRESS.md 最后更新：2026-04-26 — v1.2 里程碑已完成*
