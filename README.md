# Echoes (拾忆)

> 个人语义搜索引擎 - 拾起遗落的记忆

[![Version](https://img.shields.io/badge/version-0.2.0-blue)](CHANGELOG.md)
[![Go](https://img.shields.io/badge/Go-1.23+-00ADD8?logo=go)](https://golang.org)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-000?logo=next.js)](https://nextjs.org)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python)](https://python.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?logo=postgresql)](https://postgresql.org)
[![License](https://img.shields.io/badge/license-MIT-green)]()

## 产品简介

**Echoes (拾忆)** 是一个个人语义搜索引擎。用户随手保存的文字、链接，自动向量化存储，支持自然语言语义检索和相似内容推荐。

- **捕获 friction 极低**：看到就存，无需整理
- **找回能力极强**：语义搜索，不用记得关键词
- **发现意外关联**："原来我之前还存过类似的"

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | Next.js 14 + Tailwind CSS + shadcn/ui | App Router, RSC, Framer Motion |
| API 网关 | Go + Gin | 路由、JWT 认证、限流 |
| 用户服务 | Go + GORM | 注册/登录/GitHub OAuth/JWT |
| 记忆服务 | Go + GORM | CRUD、标签、语义搜索 |
| 处理服务 | Python + FastAPI | 链接抓取、自动标签（LLM） |
| 向量服务 | Python + FastAPI | BGE-M3 向量化 |
| LLM Provider | OpenAI / Anthropic | 工厂模式切换 |
| 数据库 | PostgreSQL 15 + pgvector | 向量相似度搜索 |
| 缓存/队列 | Redis 7 | Stream 消息队列 |
| 对象存储 | MinIO | S3 兼容 |
| 可观测性 | Prometheus + OTel + Zap | Metrics/Tracing/Logging |

## 快速开始

### 环境要求

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (推荐 WSL2 backend)
- [Git](https://git-scm.com/)
- Windows: 建议使用 WSL2 运行 `make` 命令

### 启动开发环境

```bash
# 克隆仓库
git clone https://github.com/NebulaVzx/Echoes.git
cd Echoes

# 启动所有服务
docker-compose up -d

# 或者使用 Make
make dev-start

# Windows PowerShell 备选
.\dev-start.ps1
```

服务启动后访问：

| 服务 | 地址 |
|------|------|
| Web 前端 | http://localhost:3000 |
| API 网关 | http://localhost:8088 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |
| MinIO 控制台 | http://localhost:9001 |

### 数据库迁移

```bash
make migrate
```

### 停止服务

```bash
make dev-stop
# 或
docker-compose down
```

## 开发指南

### 目录结构

```
Echoes/
├── docker-compose.yml          # 本地开发环境
├── docker-compose.prod.yml     # 生产环境
├── Makefile                    # 常用命令
├── dev-start.ps1               # Windows 启动脚本
├── dev-start.sh                # macOS/Linux 启动脚本
├── k8s/                        # Kubernetes 部署配置
├── web/                        # Next.js 前端
├── services/                   # 后端微服务
│   ├── gateway/                # Go - API 网关
│   ├── user-service/           # Go - 用户服务
│   ├── memory-service/         # Go - 记忆服务
│   ├── processor-service/      # Python - 链接处理
│   └── vectorizer-service/     # Python - 向量化
├── shared/
│   ├── migrations/             # 数据库迁移
│   └── proto/                  # gRPC protobuf (预留)
└── docs/                       # 文档
    ├── PROGRESS.md             # 开发进度
    ├── ARCHITECTURE.md         # 架构说明
    ├── API.md                  # 接口文档
    └── CHANGELOG.md            # 版本日志
```

### 常用命令

```bash
# 查看所有可用命令
make help

# 启动/停止
make dev-start
make dev-stop

# 查看日志
make dev-logs
make dev-logs-gateway

# 测试
make test
make test-gateway
make test-user
make test-memory

# 格式化
make fmt-go
make fmt-web
```

## 开发计划

| Sprint | 周 | 目标 | 状态 |
|--------|----|------|------|
| 0 | 1 | 基础设施 - Docker Compose、数据库、目录结构 | 已完成 |
| 1 | 2 | 认证体系 - User Service、Gateway、OAuth、Zod验证 | 已完成 |
| 2 | 3 | 记忆捕获 - Memory Service、文字/链接、时间轴 | 未开始 |
| 3 | 4 | 处理能力 - Processor、Vectorizer、自动标签 | 未开始 |
| 4 | 5 | 搜索能力 - 语义搜索、相似推荐、暗黑模式 | 未开始 |
| 5 | 6 | 可观测性 + 打磨上线 - Prometheus/OTel/Zap | 未开始 |

## 文档

- [开发进度](docs/PROGRESS.md) - Sprint 进度和每日更新
- [架构说明](docs/ARCHITECTURE.md) - 系统架构和微服务设计
- [API 文档](docs/API.md) - 接口详细定义
- [变更日志](CHANGELOG.md) - 版本变更记录

## 设计原则

- **极简主义**：界面元素做减法，每个元素必须有明确目的
- **呼吸感**：充足的留白（Padding 16-24px），不拥挤
- **色彩低调**：主色调使用灰度，强调色仅用于交互
- **无框设计**：减少边框使用，用背景色/阴影区分层次
- **细腻动效**：所有交互有过渡动画（200-300ms，ease-out）
- **暗黑模式**：必须支持，且暗黑模式不是简单反色

## 贡献

本项目采用 [Conventional Commits](https://www.conventionalcommits.org/) 提交规范。

分支策略：`main` / `develop` / `feature/*`

## 许可

MIT License
