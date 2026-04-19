# 开发进度 (PROGRESS)

> Echoes (拾忆) 项目开发进度跟踪
> 创建日期：2026-04-18
> 预计完成：2026-05-30

## Sprint 0：基础设施搭建 (Week 1: 2026-04-18 ~ 2026-04-25)

### 目标
- [x] 初始化 Git 仓库并关联远程仓库
- [x] 创建 .gitattributes 强制 LF 换行符
- [x] 创建项目目录结构
- [x] 创建 Docker Compose 配置文件（开发/生产）
- [x] 创建数据库迁移文件（PostgreSQL + pgvector）
- [x] 创建 Makefile 和启动脚本（Windows/macOS/Linux）
- [x] 创建各服务基础 Dockerfile 和入口文件
- [x] 创建 Next.js 前端基础配置
- [x] 创建项目文档（README, PROGRESS, ARCHITECTURE, CHANGELOG, API）
- [x] 测试 Docker Compose 启动所有服务
- [x] 第一次提交并推送

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

### Day 2 补充 (2026-04-19)

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

### 待解决问题
- [ ] Vectorizer Service 完整构建（PyTorch + BGE-M3，Sprint 3 处理）
- [ ] 数据库迁移手动执行（`make migrate` 待验证）
- [ ] K8s 部署配置待创建（Sprint 5）

## Sprint 1：认证体系 (Week 2: 2026-04-26 ~ 2026-05-02)

### 状态：进行中（核心认证链路已完成，剩余：GitHub OAuth / Zod验证 / Auth状态管理）

### 目标
- [x] User Service - 用户注册/登录 API
- [x] User Service - JWT Token 体系（Access Token 15min + Refresh Token 7days）
- [ ] User Service - GitHub OAuth 集成（Placeholder，待实现）
- [x] Gateway - 认证中间件（JWT验证 + 公开路由白名单）
- [x] Gateway - 路由转发（/api/v1/auth/* → User Service）
- [x] 前端 - 登录页面
- [x] 前端 - 注册页面
- [x] 前端 - 路由保护（middleware.ts 未认证重定向至 /login）
- [ ] 前端 - 表单验证（Zod，目前仅 HTML5 验证）
- [ ] 前端 - 登录状态管理（React Context / Zustand）

### Day 1 (2026-04-19)

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
  - [x] 路由配置（/api/v1/auth/* → User Service）
- 完成前端登录/注册页面：
  - [x] API 客户端封装（lib/api.ts，含 Token 自动注入）
  - [x] 登录页面（app/(auth)/login/page.tsx）
  - [x] 注册页面（app/(auth)/register/page.tsx）
  - [x] 表单验证（HTML5）+ 错误提示
  - [x] 登录后跳转首页
  - [x] 路由保护中间件（web/middleware.ts）
- 测试验证：
  - [x] 注册成功 → 返回 JWT Token + 用户信息
  - [x] 登录成功 → 返回新 Token
  - [x] 获取当前用户 → 返回用户信息
  - [x] 重复注册 → 返回 USER_EXISTS (409)
  - [x] 错误密码 → 返回 INVALID_CREDENTIALS (401)
  - [x] 无 Token 访问 → 返回 UNAUTHORIZED (401)
  - [x] 未认证访问首页 → 307 重定向至 /login
- Go 版本升级：1.22 → 1.23（解决依赖兼容问题）

### 待完成（Sprint 1 收尾）
- [ ] GitHub OAuth 完整实现（授权入口 + Callback + 用户绑定）
- [ ] Zod 表单验证（替代 HTML5 验证）
- [ ] React Context 登录状态管理（全局 auth state）
- [ ] Logout 按钮（首页显示当前用户 + 登出功能）
- [ ] 文档同步：PRD.md / PROGRESS.md / CHANGELOG.md / API.md

## Sprint 2：记忆捕获 (Week 3: 2026-05-03 ~ 2026-05-09)

### 目标
- [ ] Memory Service - 记忆 CRUD API
- [ ] Memory Service - 标签管理
- [ ] 前端 - 时间轴首页（无限滚动）
- [ ] 前端 - 记忆创建（文字/链接）
- [ ] 前端 - 记忆详情页
- [ ] 前端 - 记忆编辑/删除

### 状态：未开始

## Sprint 3：处理能力 (Week 4: 2026-05-10 ~ 2026-05-16)

### 目标
- [ ] Processor Service - 链接抓取
- [ ] Processor Service - 内容摘要
- [ ] Processor Service - 自动标签生成
- [ ] Vectorizer Service - BGE-M3 模型加载
- [ ] Vectorizer Service - 文本向量化
- [ ] Redis Stream - 异步任务队列
- [ ] 状态流转：pending → processing → completed/failed

### 状态：未开始

## Sprint 4：搜索能力 (Week 5: 2026-05-17 ~ 2026-05-23)

### 目标
- [ ] Memory Service - 语义搜索（pgvector 余弦相似度）
- [ ] Memory Service - 相似内容推荐
- [ ] 前端 - 搜索页面
- [ ] 前端 - 搜索结果展示
- [ ] 前端 - 暗黑模式完善
- [ ] 前端 - 动效优化（Framer Motion）

### 状态：未开始

## Sprint 5：打磨上线 (Week 6: 2026-05-24 ~ 2026-05-30)

### 目标
- [ ] 前端 - 响应式适配
- [ ] 前端 - 错误处理/加载状态
- [ ] 全局 - 错误处理和日志
- [ ] 全局 - 性能优化
- [ ] K8s 部署配置验证
- [ ] 端到端测试
- [ ] 代码审查和清理

### 状态：未开始
