# Echoes (拾忆)

> 个人语义搜索引擎 - 拾起遗落的记忆

[![Version](https://img.shields.io/badge/version-0.4.0-blue)](CHANGELOG.md)
[![Go](https://img.shields.io/badge/Go-1.23+-00ADD8?logo=go)](https://golang.org)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-000?logo=next.js)](https://nextjs.org)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python)](https://python.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?logo=postgresql)](https://postgresql.org)
[![License](https://img.shields.io/badge/license-MIT-green)]()

## 产品简介

**Echoes (拾忆)** 是一个个人语义搜索引擎。用户随手保存的文字、链接，自动向量化存储，支持自然语言语义检索和相似内容推荐。

**Slogan：** "拾起遗落的记忆"

**核心价值：**
- **捕获 friction 极低**：看到就存，无需整理
- **找回能力极强**：语义搜索，不用记得关键词
- **发现意外关联**："原来我之前还存过类似的"

**已实现功能：**
- 邮箱注册/登录 + GitHub OAuth
- 文字/链接记忆捕获（时间轴展示）
- 自动标签生成（LLM）+ 链接抓取（标题/摘要）
- BGE-M3 向量存储（pgvector）
- **语义搜索**（自然语言查询，返回相似度百分比）
- **相似内容推荐**（"你可能还感兴趣"）
- **Per-user LLM 配置**（模型/温度/协议独立设置，API Key 加密存储）
- **搜索相似度阈值可配置**（默认 40%，范围 0%-100%）
- 暗黑模式（系统偏好 + 手动切换）
- Token 自动刷新（15分钟 access token + 7天 refresh token）

**目标用户：**
- 信息囤积者：收藏100篇文章，需要时找不到
- 知识工作者：需要建立个人知识库
- 终身学习者：囤积课程/论文/教程

**AI 层级：**
- **Phase 1 (MVP)**：LLM 自动生成标签 + BGE-M3 向量化 + 语义搜索（已实现）
- **Phase 2 (Echo Assistant)**：对话式 AI 助手，基于 RAG 回答关于用户记忆的问题
- **Phase 3 (Agent 平台)**：架构预留扩展性，支持未来第三方 Agent 接入

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | Next.js 14 + Tailwind CSS + shadcn/ui | App Router, RSC, Framer Motion |
| API 网关 | Go + Gin | 路由、JWT 认证、限流 |
| 用户服务 | Go + GORM | 注册/登录/GitHub OAuth/JWT/用户 LLM 设置 |
| 记忆服务 | Go + GORM | CRUD、标签、语义搜索、相似推荐 |
| 处理服务 | Python + FastAPI | 链接抓取、自动标签（LLM） |
| 向量服务 | Python + FastAPI | BGE-M3 向量化 |
| LLM Provider | OpenAI / Anthropic + 国产兼容 | 工厂模式切换，per-user 配置 |
| 数据库 | PostgreSQL 15 + pgvector | 向量相似度搜索 |
| 缓存/队列 | Redis 7 | Stream 消息队列 |
| 对象存储 | MinIO | S3 兼容（预留） |
| 可观测性 | Prometheus + OTel + Zap | Metrics/Tracing/Logging（Sprint 5） |

**选型原则：能力 > 工具名称。** 有偏好的说明理由后可用平替。关键能力必须满足：可观测性三件套（Metrics/Tracing/Logging）、向量数据库、LLM 多提供商切换。

| 能力需求 | 首选 | 可平替 | 关键要求 |
|----------|------|--------|----------|
| ReAct 推理 | 自研 Go | 任何多步推理+工具调用框架 | Agent 思考-行动-观察循环 |
| MCP 协议 | 自研 | gRPC / HTTP / OpenAPI | 标准化接口 |
| LLM 框架 | 轻量抽象层 | LangChain / LlamaIndex | 多模型切换、RAG |
| 向量数据库 | pgvector | Milvus / Pinecone / Weaviate | 768维、Cosine、可扩展 |
| 可观测性 | Prometheus + OTel | StatsD + Zipkin / Jaeger | Metrics/Tracing/Logging |

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
│   ├── app/(auth)/             # 登录/注册
│   ├── app/(main)/             # 首页/搜索/详情/设置
│   ├── components/
│   └── lib/api.ts              # API 客户端（含自动 token 刷新）
├── services/                   # 后端微服务
│   ├── gateway/                # Go - API 网关
│   ├── user-service/           # Go - 用户服务
│   ├── memory-service/         # Go - 记忆服务
│   ├── processor-service/      # Python - 链接处理/LLM 标签
│   └── vectorizer-service/     # Python - BGE-M3 向量化
├── shared/
│   ├── migrations/             # 数据库迁移
│   └── proto/                  # gRPC protobuf (预留)
├── .planning/                  # 开发计划（GSD 工作流产物）
│   ├── phases/
│   │   ├── 02-memory-capture/
│   │   ├── 03-processing/
│   │   └── 04-search-capability/
│   └── codebase/               # 代码库分析文档
└── docs/                       # 项目文档
    ├── API.md                  # 接口文档
    ├── ARCHITECTURE.md         # 架构说明
    ├── CHECKLIST.md            # 检查清单
    └── PROGRESS.md             # 开发进度
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
| 2 | 3 | 记忆捕获 - Memory Service、文字/链接、时间轴 | 已完成 |
| 3 | 4 | 处理能力 - Processor、Vectorizer、自动标签、async queue | 已完成 |
| 4 | 5 | 搜索能力 - 语义搜索、相似推荐、暗黑模式、per-user LLM 配置 | 已完成 |
| 5 | 6 | 可观测性 + 打磨上线 - Prometheus/OTel/Zap、动画、响应式、E2E 测试 | 进行中 |
| Phase 2 | +1-2周 | Echo Assistant - 对话式 AI 助手，基于 RAG 回答记忆相关问题 | 未开始 |
| Phase 3 | 预留 | Agent 平台 - 架构预留，支持第三方 Agent 接入 | 预留 |

## 文档

- [开发进度](docs/PROGRESS.md) - Sprint 进度和每日更新
- [架构说明](docs/ARCHITECTURE.md) - 系统架构和微服务设计
- [API 文档](docs/API.md) - 接口详细定义
- [变更日志](CHANGELOG.md) - 版本变更记录

## 设计原则

### 美学原则（Notion-like）

- **极简主义**：界面元素做减法，每个元素必须有明确目的
- **呼吸感**：充足的留白（Padding 16-24px），不拥挤
- **字体克制**：使用 Inter 或系统默认无衬线字体，最多2种字重
- **色彩低调**：主色调使用灰度（Gray 50-900），强调色仅用于交互
- **无框设计**：减少边框使用，用背景色/阴影区分层次
- **细腻动效**：所有交互有过渡动画（200-300ms，ease-out）
- **暗黑模式**：必须支持，且暗黑模式不是简单反色，需单独设计

### 交互原则

- **即时反馈**：任何操作1秒内必须有视觉响应
- **渐进披露**：高级功能隐藏，核心功能一眼可见
- **手势友好**：移动端（未来）考虑，Web端考虑键盘快捷键
- **容错设计**：误操作可撤销，危险操作需确认

### 内容密度

介于 Notion 和 Twitter 之间：
- 时间轴列表：每条记忆卡片高度 80-120px
- 内容预览：最多3行文字
- 间距：元素间距16px，区块间距24px

## 贡献

本项目采用 [Conventional Commits](https://www.conventionalcommits.org/) 提交规范。

**分支策略：** `main`（稳定）/ `develop`（日常开发）/ `feature/*`（功能分支）

**提交频率：** 每天至少提交一次，有进度就提交

**提交格式：**
- `feat:` 新功能
- `fix:` 修复
- `docs:` 文档更新
- `refactor:` 重构

**提交前检查：**
- 代码可编译/运行
- `git diff` 查看变更，确认无意外修改
- 无敏感信息泄露（检查 password/key/secret）

**Push 策略：**
- Sprint 结束 **必须** push 到 GitHub
- 关键里程碑 **必须** push（数据库模型完成、认证可用、搜索可用等）
- 每日开发结束 **建议** push

## Windows 开发指南

**推荐方案：WSL2**

所有 `make` 命令、shell 脚本和 Go/Python 工具应在 WSL2 中运行。

```powershell
# 安装 WSL2（管理员 PowerShell）
wsl --install

# 重启后进入 Ubuntu，在项目目录执行
wsl make dev-start
```

**备选方案：Docker Desktop**

确保 Docker Desktop 启用 WSL2 backend，在项目根目录执行 `docker-compose up -d`。

**常见问题：**

| 问题 | 解决 |
|------|------|
| `make` 不存在 | 使用 `mingw32-make` 或 `wsl make` |
| 换行符 CRLF | 已配置 `.gitattributes` 强制 LF |
| 路径问题 | 使用 WSL2 统一处理 |

## 许可

MIT License
