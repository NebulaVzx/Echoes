# 技术栈

**分析日期：** 2026-04-19

## 编程语言

**主要：**
- **Go** 1.22/1.23 — 后端微服务（gateway、user-service、memory-service）
- **TypeScript** 5.3.3 — Next.js 前端（`web/`）
- **Python** 3.11 — ML/AI 服务（processor-service、vectorizer-service）
- **SQL** — 数据库迁移和 Schema 定义

**次要：**
- **Bash/PowerShell** — 开发启动脚本（`dev-start.sh`、`dev-start.ps1`）
- **Dockerfile** — 所有服务的多阶段容器构建

## 运行时

**环境：**
- **Node.js** 20 (Alpine) — 前端运行时，通过 `node:20-alpine` Docker 镜像
- **Go** 1.23 (Alpine) — 后端运行时，通过 `golang:1.23-alpine` Docker 镜像
- **Python** 3.11 (slim) — ML 服务运行时，通过 `python:3.11-slim` Docker 镜像

**包管理器：**
- **npm** — 前端（`web/package.json`、`web/package-lock.json`）
- **Go modules** — 后端（每个服务的 `go.mod`、`go.sum`）
- **pip** — Python 服务（每个服务的 `requirements.txt`）
- 锁文件：前端有 `package-lock.json`；Go 服务有 `go.sum`

## 框架

**核心：**
- **Next.js** 14.2.0 — React 前端框架，使用 App Router（`web/`）
- **React** 18.2.0 — UI 库
- **Gin** 1.9.1 — Go HTTP Web 框架（gateway、user-service、memory-service）
- **FastAPI** 0.110.0 — Python 异步 Web 框架（processor-service、vectorizer-service）
- **GORM** 1.25.7 — Go ORM，用于 PostgreSQL（user-service、memory-service）

**UI/样式：**
- **Tailwind CSS** 3.4.1 — 实用优先的 CSS 框架
- **Framer Motion** 11.0.8 — React 动画库
- **shadcn/ui** — 组件基础（class-variance-authority 0.7.0、tailwind-merge 2.2.1）
- **Lucide React** 0.344.0 — 图标库

**测试：**
- **Jest** 29.7.0 — JavaScript/TypeScript 测试运行器（`web/`）
- **React Testing Library** 14.2.1 + jest-dom 6.4.2 — React 组件测试
- **Go test** — Go 内置测试（`go test ./...`）
- **pytest** — Python 测试（`Makefile` 中引用）

**构建/开发：**
- **Docker** + **Docker Compose** 3.8 — 容器编排
- **PostCSS** 8.4.35 + **Autoprefixer** 10.4.18 — CSS 处理
- **Uvicorn** 0.27.1 — Python 服务的 ASGI 服务器

## 关键依赖

**关键：**
- **pgvector** (PostgreSQL 扩展) — 用于 768 维嵌入向量的向量相似度搜索
- **BGE-M3**（通过 `sentence-transformers` 2.5.1 + `transformers` 4.38.2）— 中文优化的文本嵌入模型
- **PyTorch** 2.2.1 — Vectorizer 服务的深度学习框架
- **JWT** (`golang-jwt/jwt/v5` 5.2.0) — 基于 Token 的认证
- **bcrypt** (`golang.org/x/crypto` 0.21.0) — 密码哈希（cost=12）

**基础设施：**
- **go-redis/v9** 9.5.1 — Go 的 Redis 客户端（memory-service）
- **redis** 5.0.3 (Python) — Python 服务的 Redis 客户端
- **pgx**（通过 GORM）— PostgreSQL 驱动
- **httpx** 0.27.0 — Python 的异步 HTTP 客户端（链接抓取）
- **BeautifulSoup4** 4.12.3 + **lxml** 5.1.0 — 链接抓取的 HTML 解析
- **Pydantic** 2.6.4 — Python 数据验证
- **Zod** 4.3.6 — TypeScript Schema 验证
- **Zap** 1.27.0 — 结构化日志（gateway）
- **React Hook Form** 7.72.1 + **@hookform/resolvers** 5.2.2 — 表单处理

## 配置

**环境：**
- 项目根目录有 `.env` 文件（包含 `GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`）
- 环境特定的 Docker Compose 文件：
  - `docker-compose.yml` — 本地开发
  - `docker-compose.prod.yml` — 生产环境
- Docker Compose 中配置服务特定的环境变量

**构建：**
- `web/next.config.js` — Next.js standalone 输出、未优化图片
- `web/tsconfig.json` — TypeScript，路径别名 `@/*`
- `web/tailwind.config.ts` — 自定义灰度、通过 class 的暗黑模式
- `web/postcss.config.js` — Tailwind + Autoprefixer
- 每个服务都有自己的 `Dockerfile`，采用多阶段构建（builder/production/development）

**关键配置文件：**
- `D:/xProjects/Vibe/Echoes/docker-compose.yml` — 本地开发编排
- `D:/xProjects/Vibe/Echoes/docker-compose.prod.yml` — 生产编排
- `D:/xProjects/Vibe/Echoes/Makefile` — 常用开发命令
- `D:/xProjects/Vibe/Echoes/web/next.config.js` — 前端构建配置
- `D:/xProjects/Vibe/Echoes/web/tailwind.config.ts` — 设计系统 Token

## 平台要求

**开发：**
- Docker Desktop + WSL2（Windows 上推荐）
- Docker Compose
- Make（或 Windows 原生使用 `mingw32-make`）
- 所需端口：3000（web）、8088/8080（gateway）、8001（user）、8002（memory）、8003（processor）、8004（vectorizer）、5432（PostgreSQL）、6379（Redis）、9000/9001（MinIO）

**生产：**
- Docker Compose 或 Kubernetes（K8s 清单保留在 `k8s/` 目录，当前为空）
- PostgreSQL 15+，带 pgvector 扩展
- Redis 7+，带持久化
- MinIO 对象存储

---

*技术栈分析：2026-04-19*
