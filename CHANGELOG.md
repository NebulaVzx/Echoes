# 变更日志 (CHANGELOG)

> Echoes (拾忆) 版本变更记录
> 遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/) 规范
> 遵循 [语义化版本](https://semver.org/lang/zh-CN/)

## [Unreleased]

### 进行中

## [1.2.0] - 2026-04-26

### v1.2 "记忆的温度"（Phase 8-10）

#### 新增

- **AI 陪伴建议（Phase 8）**
  - 保存记忆后异步调用 LLM 生成温情/实用/启发型建议
  - 文字/链接内容采用不同提示策略
  - 建议持久化到 `ai_suggestions` 表，与记忆关联（ON DELETE CASCADE）
  - 创建表单可选开启/关闭 AI 建议（默认关闭，不打扰原则）
  - 三种建议风格：温柔型 / 实用型 / 启发型
  - 生成失败不阻塞保存，指数退避重试 3 次
  - 前端 Sparkles 图标 hover 展开，详情页完整展示 + 反馈按钮（有用/不用了）
  - 用户反馈记录偏好（liked/disliked）
  - 高级选项：超时 10-60s（默认 30s）、最大重试 1-5（默认 3）

- **标签重生（Phase 9）**
  - 首页横向标签栏（TagFilterBar），多选 AND 过滤 + 清除全部
  - 新增 `/tags` 标签管理页，支持三种视图：云图 / 卡片 / 列表
  - 标签颜色预设调色板（16 色），按用户存储在 `users.settings` JSONB 中
  - 标签合并（AI 检测相似标签 + 手动选择合并目标）
  - 记忆详情页相关标签（基于共现统计的关联发现）
  - LLM 自动分类标签

- **记忆的温度（Phase 10）**
  - 记忆 Streaks：连续记录天数统计，创建表单下方显示状态（支持 1 天容错）
  - 那年今日：首页顶部展示一年前的记忆，无数据时选随机高价值旧记忆
  - 时间胶囊：保存时可选择 7/30/100 天封印，到期解锁仪式卡片
  - 时间胶囊独立入口 `/capsules`，封印期间记忆不显示在时间轴
  - 每日回顾：可折叠卡片展示今日保存数量、主题标签、值得回顾的旧记忆

#### 修复

- Docker Next.js 构建缓存冲突（`.next/` 目录 volume mount 问题）
- Gin 路由顺序：特定路由必须在参数化路由之前注册
- Zod v4 + @hookform/resolvers v5 表单验证兼容性
- `bool + omitempty` 导致 `false` 值被跳过的问题

#### 技术栈更新

| 组件 | 版本 |
|------|------|
| @hookform/resolvers | v5 |
| zod | v4 |

---

## [1.1.0] - 2026-04-25

### v1.1 "Echo Assistant"（Phase 6-7）

#### 新增

- **Echo Assistant 对话式 AI（Phase 6）**
  - Chat 侧边栏组件（Web 界面），支持展开/收起
  - RAG 检索逻辑：用户问题 -> 语义搜索 -> 获取相关记忆 -> LLM 生成回答
  - 多轮对话支持，对话历史管理
  - 引用来源展示（回答中标注引用的记忆标题/链接）
  - 复用 Processor Service 的 LLMProvider（工厂模式切换）

- **质量提升（Phase 7）**
  - 双模式分页：cursor 分页（高效）+ offset 分页（传统）
  - Go 单元测试 55 个全部通过
  - OAuth state 内存泄漏修复
  - Gateway 健康检查完善
  - 路径遍历漏洞修复
  - Chat 服务稳定性修复

---

## [1.0.0] - 2026-04-22

### v1.0 MVP（Sprint 2-5）

#### Sprint 2：记忆捕获

- **Memory Service（Go + GORM）**
  - Memory domain 模型与 CRUD 完整实现
  - Repository 层（Create / GetByID / GetByUser / Update / Delete）
  - Service 层：创建记忆（文字/链接）、时间轴列表、详情、更新、删除
  - Transport 层：`POST /memories`, `GET /memories`, `GET /memories/:id`, `PUT /memories/:id`, `DELETE /memories/:id`
  - 异步任务发布（Redis Stream）：`link:fetch` / `text:vectorize` / `tag:generate`
- **前端**
  - 时间轴首页（记忆卡片列表，80-120px 高度，3行预览）
  - 记忆创建表单（文字输入 + 链接输入 + #标签）
  - 记忆详情页（编辑/删除）
- **Gateway**
  - 路由转发：记忆路由 -> Memory Service

#### Sprint 3：AI 处理层

- **LLM Provider（Python）**
  - `LLMProvider` 接口 + `OpenAIProvider` + `AnthropicProvider`
  - 工厂函数 `LLMFactory.create()`
  - Prompt 工程：生成 3-5 个中文标签
- **Processor Service**
  - Redis Stream 消费者（`link:fetch` / `tag:generate`）
  - 链接抓取（httpx + BeautifulSoup）：title / description / favicon / 摘要
  - 自动标签生成（调用 LLM Provider）
  - 状态更新：`pending -> processing -> completed/failed`
- **Vectorizer Service**
  - BGE-M3 模型加载（启动时预加载）
  - CPU/GPU 自动检测
  - HTTP `/encode` API
  - 文本编码为向量（1024 维 BGE-M3）
- **Per-user LLM 配置**
  - `users.settings` JSONB 存储 per-user LLM 配置
  - Memory Service：publish 时附加配置到 Redis Stream
  - Processor Service：消费时读取配置覆盖环境变量默认值
  - 前端 Settings 页面：provider / model / temperature 配置

#### Sprint 4：搜索能力

- **语义搜索 API**：`GET /api/v1/search?q=&limit=`
  - 查询文本向量化 -> pgvector 余弦相似度查询
  - 用户可配置相似度阈值（默认 0.40）
- **相似内容推荐**：`GET /api/v1/memories/:id/related`
- **前端搜索页面**：自然语言输入 + 结果含相似度百分比
- **暗黑模式**：系统偏好 + 手动切换，完整暗黑设计（非简单反色）

#### Sprint 5：可观测性 + 打磨上线

- **可观测性三件套**
  - Prometheus Metrics：`/metrics` 端点、`http_requests_total` / `http_request_duration_seconds`
  - OpenTelemetry Tracing：Gateway 生成 trace_id，HTTP 调用 Span
  - Zap 结构化日志：JSON 格式，含 trace_id / span_id
  - Docker Compose 增加 Prometheus + Jaeger + Grafana
- **前端打磨**
  - Framer Motion 动效（页面切换、卡片入场）
  - 加载状态 / 骨架屏
  - 错误处理（Toast 通知）
  - 空状态设计
- **测试**
  - Playwright E2E 测试：注册 -> 登录 -> 创建记忆 -> 搜索
  - Go 单元测试骨架

---

## [0.2.0] - 2026-04-19

### Sprint 1：认证体系

#### 新增

- **User Service（Go + GORM）**
  - 用户注册/登录 API（bcrypt 密码哈希，cost=12）
  - JWT Token 体系（Access Token 15min + Refresh Token 7days）
  - Repository 层（Create / GetByEmail / GetByID / GetByOAuth / Update）
  - HTTP Handler 层：`POST /register`, `POST /login`, `POST /refresh`, `POST /logout`, `GET /me`
  - GitHub OAuth 完整实现（授权入口 `/auth/github` + Callback `/auth/github/callback` + 用户自动创建/绑定）
  - 内存state存储 + CSRF防护（10分钟过期）

- **Gateway Service（Go + Gin）**
  - JWT 认证中间件（Bearer Token 验证 + 公开路由白名单）
  - 公开路由包含：`/auth/register`, `/auth/login`, `/auth/github`, `/auth/github/callback`, `/auth/refresh`
  - 反向代理到 User Service（`/api/v1/auth/*`）
  - X-User-ID 请求头透传

- **前端（Next.js 14）**
  - 登录页面（`app/(auth)/login/page.tsx`）
  - 注册页面（`app/(auth)/register/page.tsx`）
  - 表单验证（Zod + React Hook Form，邮箱/密码/用户名实时校验）
  - AuthProvider（React Context，全局登录状态管理，页面刷新自动恢复会话）
  - 首页显示当前用户信息 + 退出登录按钮
  - GitHub 登录按钮（SVG图标 + 分隔线）
  - API 客户端封装（`lib/api.ts`，含 Token 自动注入和 localStorage 管理）
  - 路由保护中间件（`middleware.ts`，未认证重定向至 `/login`）
  - 图标设计迭代：stroke-based SVG + currentColor 暗黑/明亮模式自适应

#### 技术栈更新

| 组件 | 版本 |
|------|------|
| Go | 1.23（从 1.22 升级，解决依赖兼容） |
| golang-jwt/jwt | v5 |
| bcrypt | golang.org/x/crypto |

#### 修复

- Go 服务 Dockerfile 移除 `go.sum` 依赖，改用 `go mod tidy`
- User Service 重复注册返回 `USER_EXISTS` (409) 而非 `INTERNAL_ERROR`
- 网关端口 8080 → 8088（避免本地端口占用）
- Next.js CSS 变量修复（移除未定义的 Tailwind 类）

## [0.1.0] - 2026-04-18

### Sprint 0：基础设施搭建

#### 新增

- **项目初始化**
  - Git 仓库初始化并关联远程仓库 `https://github.com/NebulaVzx/Echoes.git`
  - `.gitattributes` 强制 LF 换行符，确保跨平台一致性
  - `.gitignore` Windows 环境配置

- **Docker Compose 环境**
  - `docker-compose.yml` - 本地开发环境，包含所有服务
  - `docker-compose.prod.yml` - 生产环境，支持环境变量注入
  - 服务列表：PostgreSQL 15 + pgvector, Redis 7, MinIO, Gateway, User Service, Memory Service, Processor Service, Vectorizer Service, Next.js Web

- **数据库**
  - `shared/migrations/001_init.sql` - 初始数据库迁移
  - `users` 表：用户注册/登录/OAuth 支持
  - `memories` 表：核心记忆实体，含向量字段 `vector(768)`
  - pgvector 扩展和 IVFFlat 向量索引
  - 触发器自动更新 `updated_at`

- **开发工具**
  - `Makefile` - 常用开发命令（启动/停止/日志/测试/迁移）
  - `dev-start.ps1` - Windows PowerShell 启动脚本
  - `dev-start.sh` - macOS/Linux 启动脚本

- **微服务骨架**
  - **Gateway Service** (Go + Gin) - API 网关，含健康检查
  - **User Service** (Go + GORM) - 用户管理，含健康检查
  - **Memory Service** (Go + GORM) - 记忆管理，含健康检查
  - **Processor Service** (Python + FastAPI) - 链接处理，含健康检查
  - **Vectorizer Service** (Python + FastAPI) - 文本向量化，含健康检查
  - 各服务均含 Dockerfile（多阶段构建：builder/production/development）

- **前端骨架**
  - Next.js 14 App Router 配置
  - Tailwind CSS 配置（含 Notion-like 设计系统变量）
  - 暗黑模式 CSS 变量支持
  - 基础布局组件和首页

- **文档**
  - `README.md` - 项目简介、快速开始、技术栈
  - `docs/PROGRESS.md` - 开发进度跟踪
  - `docs/ARCHITECTURE.md` - 系统架构设计
  - `docs/API.md` - API 接口详细定义（占位）
  - `CLAUDE.md` - Claude Code 工作指南

#### 技术栈

| 组件 | 版本 |
|------|------|
| Next.js | 14.2.0 |
| React | 18.2.0 |
| Tailwind CSS | 3.4.1 |
| Go | 1.22 |
| Gin | 1.9.1 |
| Python | 3.11 |
| FastAPI | 0.110.0 |
| PostgreSQL | 15 + pgvector v0.5.1 |
| Redis | 7 |
| MinIO | latest |

[Unreleased]: https://github.com/NebulaVzx/Echoes/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/NebulaVzx/Echoes/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/NebulaVzx/Echoes/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/NebulaVzx/Echoes/compare/v0.2.0...v1.0.0
[0.2.0]: https://github.com/NebulaVzx/Echoes/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/NebulaVzx/Echoes/releases/tag/v0.1.0
