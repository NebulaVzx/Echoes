# 变更日志 (CHANGELOG)

> Echoes (拾忆) 版本变更记录
> 遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/) 规范
> 遵循 [语义化版本](https://semver.org/lang/zh-CN/)

## [Unreleased]

### 进行中

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

- **Gateway Service（Go + Gin）**
  - JWT 认证中间件（Bearer Token 验证 + 公开路由白名单）
  - 反向代理到 User Service（`/api/v1/auth/*`）
  - X-User-ID 请求头透传

- **前端（Next.js 14）**
  - 登录页面（`app/(auth)/login/page.tsx`）
  - 注册页面（`app/(auth)/register/page.tsx`）
  - API 客户端封装（`lib/api.ts`，含 Token 自动注入和 localStorage 管理）
  - 路由保护中间件（`middleware.ts`，未认证重定向至 `/login`）

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

[Unreleased]: https://github.com/NebulaVzx/Echoes/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/NebulaVzx/Echoes/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/NebulaVzx/Echoes/releases/tag/v0.1.0
