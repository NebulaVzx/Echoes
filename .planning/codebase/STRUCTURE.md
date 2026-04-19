# 代码结构

**分析日期：** 2026-04-19

## 目录布局

```
Echoes/
├── docker-compose.yml              # 本地开发环境（所有服务 + 基础设施）
├── docker-compose.prod.yml         # 生产环境
├── Makefile                        # 常用开发命令（dev-start、migrate）
├── dev-start.ps1                   # Windows PowerShell 启动脚本
├── dev-start.sh                    # macOS/Linux 启动脚本
├── PRD.md                          # 完整产品需求文档
├── CLAUDE.md                       # Claude Code 项目指引
├── .env                            # 环境变量（未提交）
├── k8s/                            # Kubernetes 清单（为空，预留）
├── shared/
│   ├── migrations/
│   │   └── 001_init.sql            # 数据库 Schema 初始化
│   └── proto/                      # gRPC protobuf 定义（预留）
├── services/
│   ├── gateway/                    # Go API Gateway（反向代理 + 认证）
│   │   ├── cmd/main.go
│   │   ├── internal/middleware/auth.go
│   │   └── internal/router/router.go
│   ├── user-service/               # Go User Service（认证、OAuth）
│   │   ├── cmd/main.go
│   │   └── internal/
│   │       ├── config/database.go
│   │       ├── domain/
│   │       │   ├── user.go
│   │       │   └── auth.go
│   │       ├── repository/user_repository.go
│   │       ├── service/auth_service.go
│   │       └── transport/auth_handler.go
│   ├── memory-service/             # Go Memory Service（CRUD、搜索、队列）
│   │   ├── cmd/main.go
│   │   └── internal/
│   │       ├── config/database.go
│   │       ├── domain/memory.go
│   │       ├── repository/memory_repository.go
│   │       ├── service/
│   │       │   ├── memory_service.go
│   │       │   └── redis_queue.go
│   │       └── transport/memory_handler.go
│   ├── processor-service/          # Python FastAPI（链接抓取、自动标签）
│   │   ├── app/main.py
│   │   └── Dockerfile
│   └── vectorizer-service/         # Python FastAPI（BGE-M3 嵌入）
│       ├── app/main.py
│       └── Dockerfile
└── web/                            # Next.js 14 前端
    ├── app/                        # App Router
    │   ├── layout.tsx              # 根布局（Providers）
    │   ├── globals.css             # Tailwind + 自定义样式
    │   ├── (auth)/                 # 认证路由组
    │   │   ├── login/page.tsx
    │   │   └── register/page.tsx
    │   ├── (main)/                 # 主应用路由组
    │   │   ├── layout.tsx
    │   │   ├── page.tsx              # 首页 / 时间轴
    │   │   └── memory/[id]/page.tsx  # 记忆详情
    │   ├── memory/[id]/page.tsx      # 重复的详情页（遗留）
    │   ├── providers/
    │   │   ├── auth-provider.tsx
    │   │   └── theme-provider.tsx
    │   └── search/                 # 搜索页（为空，预留）
    ├── components/
    │   ├── logo.tsx
    │   ├── memory/
    │   │   ├── create-memory-form.tsx
    │   │   └── memory-card.tsx
    │   ├── search/                 # 为空，预留
    │   ├── layout/                 # 为空，预留
    │   └── ui/                     # 为空，shadcn/ui 预留
    ├── lib/api.ts                  # 集中式 API 客户端
    ├── hooks/                      # 为空，预留
    ├── middleware.ts               # Next.js 路由保护
    ├── next.config.js
    ├── tailwind.config.ts
    └── package.json
```

## 目录用途

**`services/gateway/`：**
- 用途：API Gateway — 所有客户端请求的单一入口
- 包含：Go 源码、Dockerfile、go.mod
- 关键文件：`cmd/main.go`、`internal/router/router.go`、`internal/middleware/auth.go`

**`services/user-service/`：**
- 用途：用户管理、认证、OAuth
- 包含：带分层架构的 Go 源码
- 关键文件：`internal/transport/auth_handler.go`（277 行）、`internal/service/auth_service.go`

**`services/memory-service/`：**
- 用途：记忆 CRUD、时间轴、搜索、异步任务发布
- 包含：带分层架构的 Go 源码 + Redis 队列
- 关键文件：`internal/transport/memory_handler.go`（192 行）、`internal/service/memory_service.go`（170 行）

**`services/processor-service/`：**
- 用途：链接抓取和自动标签（Sprint 3）
- 包含：Python FastAPI 桩
- 关键文件：`app/main.py`

**`services/vectorizer-service/`：**
- 用途：BGE-M3 文本嵌入生成（Sprint 3）
- 包含：Python FastAPI 桩
- 关键文件：`app/main.py`

**`web/`：**
- 用途：Next.js 14 前端，使用 App Router
- 包含：React 组件、页面、API 客户端、Providers
- 关键文件：`app/layout.tsx`、`lib/api.ts`（188 行）、`app/(main)/page.tsx`（145 行）

**`shared/migrations/`：**
- 用途：数据库 Schema 定义
- 包含：SQL 迁移文件
- 关键文件：`001_init.sql`

**`shared/proto/`：**
- 用途：gRPC protobuf 定义（为未来预留）
- 包含：空

**`k8s/`：**
- 用途：Kubernetes 部署清单（为未来预留）
- 包含：空

## 关键文件位置

**入口点：**
- `services/gateway/cmd/main.go`：Gateway 服务入口（8080 端口）
- `services/user-service/cmd/main.go`：User 服务入口（8001 端口）
- `services/memory-service/cmd/main.go`：Memory 服务入口（8002 端口）
- `services/processor-service/app/main.py`：Processor 服务入口（8003 端口）
- `services/vectorizer-service/app/main.py`：Vectorizer 服务入口（8004 端口）
- `web/app/layout.tsx`：Next.js 根布局

**配置：**
- `docker-compose.yml`：本地开发编排
- `web/next.config.js`：Next.js 构建配置（standalone 输出）
- `web/tailwind.config.ts`：Tailwind CSS，自定义灰度调色板
- `web/tsconfig.json`：TypeScript 配置，含 `@/*` 路径别名
- `services/*/go.mod`：Go 模块定义

**核心逻辑：**
- `services/gateway/internal/middleware/auth.go`：JWT 验证中间件
- `services/gateway/internal/router/router.go`：路由配置和反向代理
- `services/user-service/internal/service/auth_service.go`：认证业务逻辑
- `services/memory-service/internal/service/memory_service.go`：记忆业务逻辑
- `services/memory-service/internal/service/redis_queue.go`：Redis Stream 发布器
- `web/lib/api.ts`：带 Token 管理的前端 API 客户端

**数据库：**
- `shared/migrations/001_init.sql`：初始 Schema（users、memories、索引）
- `services/user-service/internal/config/database.go`：GORM 连接 + auto-migrate
- `services/memory-service/internal/config/database.go`：GORM 连接 + pgvector 扩展

**测试：**
- services/ 中未检测到测试文件
- `web/package.json` 已配置 jest（`npm test`）
- `services/user-service/user-service-test/` 目录存在（未追踪，可能是测试产物）

## 命名规范

**文件：**
- Go：`snake_case.go`（如 `auth_handler.go`、`memory_service.go`）
- TypeScript/React：`kebab-case.tsx`（如 `create-memory-form.tsx`、`auth-provider.tsx`）
- Python：`snake_case.py`（如 `main.py`）
- SQL：`NNN_description.sql`（如 `001_init.sql`）

**目录：**
- Go 服务：`cmd/`、`internal/config/`、`internal/domain/`、`internal/repository/`、`internal/service/`、`internal/transport/`
- Python 服务：`app/`、`app/services/`
- Next.js 路由：`(group)/`、`[param]/`

**Go 类型/接口：**
- 接口：`名词` + `Repository`/`Service`/`Handler` 后缀（如 `UserRepository`、`TaskQueue`）
- 实现接口的结构体：`Gorm` + `名词` + `Repository`（如 `GormUserRepository`）
- 领域结构体：PascalCase 名词（如 `User`、`Memory`、`TokenPair`）
- 请求/响应结构体：`动作` + `名词` + `Request`/`Response`（如 `CreateMemoryRequest`）

**React 组件：**
- 默认导出函数名与文件名匹配（PascalCase）
- Props 接口：`组件名` + `Props`（如 `MemoryCardProps`）

## 新增代码位置指南

**新增 API 端点：**
- Gateway 路由：`services/gateway/internal/router/router.go`
- 处理器：`services/{service}/internal/transport/{resource}_handler.go`
- 服务：`services/{service}/internal/service/{resource}_service.go`
- 仓库：`services/{service}/internal/repository/{resource}_repository.go`
- 领域：`services/{service}/internal/domain/{resource}.go`

**新增前端页面：**
- 路由：`web/app/(main)/{page-name}/page.tsx`（认证页面）
- 路由：`web/app/(auth)/{page-name}/page.tsx`（公开页面）

**新增 React 组件：**
- 功能特定：`web/components/{feature}/{component-name}.tsx`
- 共享 UI：`web/components/ui/{component-name}.tsx`（shadcn/ui 约定）

**新增 API 客户端方法：**
- 位置：`web/lib/api.ts`
- 在 `ApiClient` 类中添加带类型请求/响应的方法

**新增数据库迁移：**
- 位置：`shared/migrations/002_{description}.sql`
- 通过 `make migrate` 或 `docker-compose up`（initdb.d）运行

**新增异步任务 Stream：**
- 发布者：在 `services/memory-service/internal/service/memory_service.go` 中向 `TaskQueue` 接口添加方法
- 发布者实现：`services/memory-service/internal/service/redis_queue.go`
- 消费者：添加到 `services/processor-service/app/main.py` 或 `services/vectorizer-service/app/main.py`

## 特殊目录

**`.next/`：**
- 用途：Next.js 构建输出和缓存
- 生成：是
- 提交：否（在 `.gitignore` 中）

**`web/node_modules/`：**
- 用途：npm 依赖
- 生成：是
- 提交：否（在 `.gitignore` 中）

**`shared/proto/`：**
- 用途：gRPC protobuf 定义
- 生成：否
- 提交：是（为未来微服务通信预留）

**`k8s/`：**
- 用途：Kubernetes 部署清单
- 生成：否
- 提交：是（为空，为 Sprint 5/6 预留）

**`services/user-service/user-service-test/`：**
- 用途：未知（git 中未追踪）
- 生成：可能
- 提交：否

---

*结构分析：2026-04-19*
