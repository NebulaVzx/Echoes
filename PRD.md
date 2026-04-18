# 拾忆 (Echoes) - 产品需求文档 v7.0 (Claude Code 开发版 - 含 Windows 支持)

## 1. 产品概述

### 1.1 产品名称
- **中文：拾忆** — 捡拾遗落的记忆
- **英文：Echoes** — 回声、回响
- **Slogan：** "拾起遗落的记忆"
- **传播点：** "拾忆" ↔ "失忆" 谐音，天然话题性

### 1.2 一句话定义
个人语义搜索引擎。用户随手保存的文字、链接，自动向量化存储，支持自然语言语义检索和相似内容推荐。

**AI 层级：**
- **后台 AI（MVP）：** LLM 自动生成标签 + BGE-M3 向量化
- **Echo Assistant（Phase 2）：** 对话式 AI 助手，基于 RAG 回答关于用户记忆的问题
- **Agent 平台（Phase 3 预留）：** 架构预留扩展性，支持未来第三方 Agent 接入（当前不实现）

### 1.3 核心价值
- **捕获 friction 极低**：看到就存，无需整理
- **找回能力极强**：语义搜索，不用记得关键词
- **发现意外关联**："原来我之前还存过类似的"

### 1.4 目标用户
- 信息囤积者：收藏100篇文章，需要时找不到
- 知识工作者：需要建立个人知识库
- 终身学习者：囤积课程/论文/教程

---

## 2. 设计原则（必须遵守）

### 2.1 美学原则（Notion-like）

| 原则 | 具体定义 |
|------|---------|
| **极简主义** | 界面元素做减法，每个元素必须有明确目的 |
| **呼吸感** | 充足的留白（Padding 16-24px），不拥挤 |
| **字体克制** | 使用 Inter 或系统默认无衬线字体，最多2种字重 |
| **色彩低调** | 主色调使用灰度（Gray 50-900），强调色仅用于交互 |
| **无框设计** | 减少边框使用，用背景色/阴影区分层次 |
| **细腻动效** | 所有交互有过渡动画（200-300ms，ease-out） |
| **暗黑模式** | 必须支持，且暗黑模式不是简单反色，需单独设计 |

### 2.2 交互原则

| 原则 | 定义 |
|------|------|
| **即时反馈** | 任何操作1秒内必须有视觉响应 |
| **渐进披露** | 高级功能隐藏，核心功能一眼可见 |
| **手势友好** | 移动端（未来）考虑，Web端考虑键盘快捷键 |
| **容错设计** | 误操作可撤销，危险操作需确认 |

### 2.3 内容密度参考

```
Notion 的密度：适中（舒适阅读）
Twitter 的密度：高（信息流）

本产品的密度：介于 Notion 和 Twitter 之间
- 时间轴列表：每条记忆卡片高度 80-120px
- 内容预览：最多3行文字
- 间距：元素间距16px，区块间距24px
```

---

## 3. 功能范围（严格限定）

### 3.1 Phase 1 必须实现（MVP）

| 模块 | 功能点 | 优先级 |
|------|--------|--------|
| **认证** | 邮箱注册/登录 | P0 |
| | GitHub OAuth | P0 |
| | JWT Token 体系 | P0 |
| **记忆捕获** | 文字快速输入（支持#标签） | P0 |
| | 链接保存（自动抓取标题摘要） | P0 |
| | 自动标签生成 | P1 |
| **记忆管理** | 时间轴浏览（无限滚动） | P0 |
| | 记忆详情查看 | P0 |
| | 编辑标签/笔记 | P1 |
| | 删除记忆 | P0 |
| **搜索** | 自然语言语义搜索 | P0 |
| | 相似内容推荐 | P0 |
| | 标签筛选 | P1 |
| **AI 能力** | LLM 抽象层（OpenAI/Anthropic 可切换） | P1 |
| | 自动标签生成（LLM + fallback） | P1 |
| | 文本向量化（BGE-M3） | P0 |
| | 语义搜索（pgvector cosine） | P0 |

### 3.2 关键约束

**LLM 提供商配置：**
- 必须支持 OpenAI 和 Anthropic 两种提供商
- 通过环境变量 `LLM_PROVIDER` 切换（`openai` / `anthropic`）
- 工厂模式创建对应 Provider 实例
- 接口统一：`GenerateTags(content string) ([]string, error)`

**异步与降级：**
- 所有 LLM 调用必须异步，不阻塞用户操作
- LLM 失败时必须降级：使用本地关键词提取逻辑（TF-IDF / 简单分词）
- 重试机制：最多 3 次，指数退避

**向量检索：**
- 向量模型必须中文优化：BGE-M3（768 维）
- 相似度计算使用余弦距离（cosine similarity）
- 搜索阈值：0.75（低于阈值的结果过滤）
- 向量启动时预加载，避免请求时重复加载
- CPU/GPU 自动检测

### 3.3 Phase 2 规划（Echo Assistant）

**后台 AI（MVP 已包含）：**
- 自动标签生成（调用 LLM）
- 语义搜索、相似推荐

**Echo Assistant（轻量级 Agent）：**
- **形态：** 内置于 Web 界面的对话窗口（类似 ChatGPT 侧边栏）
- **能力：**
  - 基于 RAG 回答关于用户记忆的问题
  - 示例："我上周存的关于 Go 协程的文章有哪些？" "总结我关于 AI 的所有收藏"
- **技术：** Memory Service 搜索结果 + LLM Provider 生成回答（复用 Sprint 3 的 LLMProvider）
- **引用来源展示：** LLM 回答中标注引用的记忆来源（标题 + 链接）
- **开发量：** 1-2 周（Chat UI + RAG 逻辑）

### 3.4 Phase 3 预留（Agent 平台架构）

**架构预留，当前不实现，但设计时考虑扩展性：**

- 数据库字段预留 `agent_id`、`agent_type`
- 预留 Agent 配置表结构
- 微服务架构支持未来接入 Agent Service
- 第三方 Agent 市场（SDK、沙盒、分成机制）—— **仅预留，不做**

**明确不做（其他）：**
- 语音捕获、图片/OCR、文件上传
- 社交分享卡片、移动端适配、微信 OAuth

---

## 4. 技术架构

### 4.1 技术栈（强制遵循）

| 层级 | 技术 | 版本/说明 |
|------|------|----------|
| **前端** | Next.js 14 (App Router) | React Server Components |
| | Tailwind CSS | 样式系统 |
| | shadcn/ui | 基础组件库 |
| | Framer Motion | 动效库 |
| **后端 Gateway** | Go + Gin | v1.9+ |
| **后端服务** | Go + GORM | 标准微服务模式 |
| **数据库** | PostgreSQL 15 | 必需插件：pgvector |
| **缓存/队列** | Redis 7 | Stream 用于消息队列 |
| **向量服务** | Python + FastAPI | BGE-M3 向量化 |
| **处理服务** | Python + FastAPI | 链接抓取、自动标签（调用 LLM） |
| **LLM Provider** | OpenAI API / Anthropic API | 工厂模式切换，环境变量 `LLM_PROVIDER` |
| **对象存储** | MinIO | 兼容 S3 API |
| **部署** | Docker Compose / K8s | 本地/生产双模式 |

### 4.1.1 技术栈选型原则

> **原则：能力 > 工具名称。** 有偏好的说明理由后可用平替。

| 能力需求 | 首选 | 可平替 | 关键要求 |
|----------|------|--------|----------|
| **ReAct 推理框架** | 自研 Go | 任何多步推理+工具调用框架 | Agent 思考-行动-观察循环 |
| **MCP 协议** | 自研 | gRPC / HTTP / OpenAPI | 标准化接口 |
| **LLM 框架** | 轻量抽象层 | LangChain / LlamaIndex | 多模型切换、RAG |
| **向量数据库** | pgvector | Milvus / Pinecone / Weaviate | 768维、Cosine、可扩展 |
| **可观测性** | Prometheus + OTel | StatsD + Zipkin / Jaeger | Metrics/Tracing/Logging |

**选型理由：**
- **自研 ReAct / MCP**：本项目 Agent 逻辑相对轻量（自动标签、RAG 问答），自研可保持代码简洁可控，避免引入过重的外部框架依赖。
- **轻量 LLM 抽象层**：仅需要多模型切换和基础 RAG 能力，LangChain 过于庞大，自研 200 行代码即可满足。
- **pgvector**：与 PostgreSQL 同一数据库，减少运维复杂度；IVFFlat 索引在万级数据量下性能足够。
- **Prometheus + OTel**：云原生标准栈，Go 生态支持成熟，社区仪表盘模板丰富。

### 4.2 微服务划分（Phase 1 简化版）

```
┌─────────────────────────────────────────┐
│              Next.js Web App            │
└──────────────────┬──────────────────────┘
                   │ HTTPS
┌──────────────────▼──────────────────────┐
│           Gateway Service (Go)          │
│    - 路由 / 认证中间件 / 限流 / 日志     │
└──────────────────┬──────────────────────┘
                   │ gRPC / HTTP
       ┌───────────┴───────────┐
       ▼                       ▼
┌──────────────┐      ┌──────────────┐
│ User Service │      │ Memory Service│
│   (Go)       │      │    (Go)       │
│ - 注册/登录   │      │ - CRUD        │
│ - OAuth      │      │ - 标签管理    │
│ - JWT        │      │ - 搜索接口    │
└──────────────┘      └──────┬───────┘
                             │ Async (Redis Stream)
       ┌─────────────────────┴─────────────────────┐
       ▼                       ▼                   ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  Processor   │      │  Vectorizer  │      │  PostgreSQL  │
│  (Python)    │      │  (Python)    │      │   + Redis    │
│ - 链接抓取   │      │ - BGE-M3     │      │              │
│ - 自动标签   │      │   向量化     │      │              │
└──────────────┘      └──────────────┘      └──────────────┘
```

**说明：**
- Phase 1 先实现 Gateway + User + Memory + Processor + Vectorizer + LLM Provider
- Search 功能先放在 Memory Service 内
- 后期搜索量大时，再拆独立 Search Service
- LLM Provider 作为共享模块，被 Processor Service 调用（自动标签）

### 4.3 目录结构（强制遵循）

```
echoes/                         # 项目根目录
├── README.md
├── docker-compose.yml          # 本地开发环境
├── docker-compose.prod.yml     # 生产环境
├── Makefile                    # 常用命令
├── .gitattributes              # 强制 LF 换行符
├── dev-start.ps1               # Windows 启动脚本
├── dev-start.sh                # macOS/Linux 启动脚本
│
├── k8s/                        # K8s 部署配置
│   ├── 00-namespace.yaml
│   ├── 01-configmap.yaml
│   ├── 02-secret.yaml
│   ├── 10-postgres.yaml
│   ├── 11-redis.yaml
│   ├── 12-minio.yaml
│   ├── 20-gateway.yaml
│   ├── 21-user-service.yaml
│   ├── 22-memory-service.yaml
│   ├── 23-processor-service.yaml
│   ├── 24-vectorizer-service.yaml
│   ├── 30-web.yaml
│   ├── 40-ingress.yaml
│   └── 50-hpa.yaml
│
├── web/                        # Next.js 前端
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (main)/
│   │   │   ├── page.tsx         # 时间轴首页
│   │   │   ├── search/page.tsx  # 搜索页
│   │   │   └── memory/[id]/page.tsx
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                  # shadcn/ui 组件
│   │   ├── memory/
│   │   ├── search/
│   │   └── layout/
│   ├── lib/
│   ├── hooks/
│   ├── types/
│   └── package.json
│
├── services/                   # 后端微服务
│   ├── gateway/
│   │   ├── cmd/main.go
│   │   ├── internal/
│   │   │   ├── middleware/
│   │   │   ├── router/
│   │   │   └── handler/
│   │   ├── Dockerfile
│   │   └── go.mod
│   │
│   ├── user-service/
│   │   ├── cmd/main.go
│   │   ├── internal/
│   │   │   ├── domain/
│   │   │   ├── repository/
│   │   │   ├── service/
│   │   │   └── transport/
│   │   ├── Dockerfile
│   │   └── go.mod
│   │
│   ├── memory-service/
│   │   └── ...（同上结构）
│   │
│   ├── processor-service/      # Python
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   └── services/
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   │
│   └── vectorizer-service/     # Python
│       └── ...
│
├── shared/                     # 共享资源
│   ├── migrations/
│   │   └── 001_init.sql
│   └── proto/                  # gRPC proto（预留）
│
└── docs/
    └── API.md
```

---

## 5. 数据模型

### 5.1 PostgreSQL Schema

```sql
-- 用户表
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    username VARCHAR(100),
    avatar_url TEXT,
    oauth_provider VARCHAR(50),
    oauth_id VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 记忆表
CREATE TABLE memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('text', 'link')),
    
    text_content TEXT,
    link_url TEXT,
    link_title TEXT,
    link_summary TEXT,
    
    -- 预留字段
    media_url TEXT,
    media_duration INT,
    ocr_text TEXT,
    transcript_text TEXT,
    
    vector VECTOR(768),
    tags VARCHAR(50)[] DEFAULT '{}',
    note TEXT,
    metadata JSONB DEFAULT '{}',
    processing_status VARCHAR(20) DEFAULT 'pending',
    visibility VARCHAR(20) DEFAULT 'private',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX idx_memories_user_id ON memories(user_id);
CREATE INDEX idx_memories_user_created ON memories(user_id, created_at DESC);
CREATE INDEX idx_memories_vector ON memories USING ivfflat (vector vector_cosine_ops);
CREATE INDEX idx_memories_tags ON memories USING GIN (tags);

-- 更新触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_memories_updated_at BEFORE UPDATE ON memories 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## 6. API 接口定义

### 6.1 认证接口

| 接口 | 方法 | 描述 |
|------|------|------|
| /api/v1/auth/register | POST | 邮箱注册 |
| /api/v1/auth/login | POST | 邮箱登录 |
| /api/v1/auth/github | GET | GitHub OAuth 入口 |
| /api/v1/auth/github/callback | GET | OAuth 回调 |
| /api/v1/auth/refresh | POST | 刷新 Token |
| /api/v1/auth/logout | POST | 登出 |
| /api/v1/auth/me | GET | 获取当前用户 |

### 6.2 记忆接口

| 接口 | 方法 | 描述 |
|------|------|------|
| /api/v1/memories | POST | 创建记忆 |
| /api/v1/memories | GET | 时间轴列表（分页） |
| /api/v1/memories/:id | GET | 详情 |
| /api/v1/memories/:id | PUT | 更新（仅标签/备注） |
| /api/v1/memories/:id | DELETE | 删除 |
| /api/v1/memories/:id/related | GET | 相似推荐 |

### 6.3 搜索接口

| 接口 | 方法 | 描述 |
|------|------|------|
| /api/v1/search | GET | 语义搜索（?q=查询&limit=10） |

---

## 7. 异步任务处理

### 7.1 任务类型

| 任务 | 生产者 | 消费者 | 队列名 |
|------|--------|--------|--------|
| 链接抓取 | Memory Service | Processor | `link:fetch` |
| 文本向量化 | Memory Service | Vectorizer | `text:vectorize` |
| 自动标签 | Memory Service | Processor | `tag:generate` |

### 7.2 状态流转

```
pending → processing → completed/failed
```

---

## 8. Windows 环境开发指南（重要）

### 8.1 推荐方案：WSL2

```powershell
# 安装 WSL2（管理员 PowerShell）
wsl --install

# 重启后进入 Ubuntu
wsl

# 在 WSL2 中执行所有开发命令
cd /mnt/c/Users/yourname/projects
git clone <repo>
cd echoes
make dev-start
```

### 8.2 备选方案：Docker Desktop

```powershell
# 确保 Docker Desktop 启用 WSL2 backend
# 在项目根目录执行：
docker-compose up -d

# Windows 执行迁移（需要安装 psql）
psql postgres://echoes_user:password@localhost:5432/echoes -f shared/migrations/001_init.sql
```

### 8.3 Windows 常见问题

| 问题 | 解决 |
|------|------|
| `make` 不存在 | 使用 `mingw32-make` 或 `wsl make` |
| 换行符 CRLF | 已配置 `.gitattributes` 强制 LF |
| 路径问题 | 使用 WSL2 统一处理 |

### 8.4 .gitattributes（项目根目录必须创建）

```
* text=auto eol=lf
*.sh text eol=lf
*.go text eol=lf
*.js text eol=lf
*.ts text eol=lf
*.yaml text eol=lf
*.yml text eol=lf
*.json text eol=lf
*.md text eol=lf
```

### 8.5 Windows 启动脚本（dev-start.ps1）

```powershell
Write-Host "Starting Echoes (拾忆) development environment..." -ForegroundColor Green

if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker not found. Install Docker Desktop with WSL2 backend." -ForegroundColor Red
    exit 1
}

docker-compose up -d
Write-Host "Waiting for services..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

Write-Host "Run migrations in WSL2: wsl make migrate" -ForegroundColor Cyan
Write-Host "Or manually: psql postgres://echoes_user:password@localhost:5432/echoes -f shared/migrations/001_init.sql" -ForegroundColor Cyan

Write-Host "Environment ready!" -ForegroundColor Green
Write-Host "API: http://localhost:8080" -ForegroundColor Cyan
```

---

## 9. K8s 生产部署

### 9.1 部署文件清单

| 文件 | 用途 |
|------|------|
| k8s/00-namespace.yaml | 命名空间 echoes |
| k8s/01-configmap.yaml | 非敏感配置 |
| k8s/02-secret.yaml | 敏感配置（需修改） |
| k8s/10-postgres.yaml | PostgreSQL + pgvector |
| k8s/11-redis.yaml | Redis |
| k8s/12-minio.yaml | MinIO 对象存储 |
| k8s/20-gateway.yaml | API 网关 |
| k8s/21-*.yaml | 各微服务 |
| k8s/40-ingress.yaml | 入口/SSL |
| k8s/50-hpa.yaml | 自动扩缩容 |

### 9.2 部署命令

```bash
# 一键部署
kubectl apply -f k8s/

# Windows 使用 PowerShell 执行相同命令
```

---

## 10. 开发计划（6周 + 扩展）

### 10.0 总体节奏

| Sprint | 周期 | 主题 | 里程碑 |
|--------|------|------|--------|
| 0 | Week 1 | 基础设施 | Docker Compose 一键启动，所有服务健康检查通过 |
| 1 | Week 2 | 认证体系 | 用户可注册/登录，JWT 认证链路通 |
| 2 | Week 3 | 记忆捕获 | 可创建/查看记忆，时间轴 UI 可用 |
| 3 | Week 4 | AI 处理层 | 自动标签 + 文本向量化，异步队列工作 |
| 4 | Week 5 | 搜索能力 | 语义搜索可用，相似推荐可用 |
| 5 | Week 6 | 可观测性 + 打磨 | Prometheus + OTel + Zap 接入，动效/暗黑模式 |

---

### Sprint 0：基础设施搭建（Week 1）

**目标**：一键启动完整的开发环境。

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

**里程碑验证：** `docker-compose up -d` 后所有服务 running，Gateway `/health` 返回 200。

---

### Sprint 1：认证体系（Week 2）

**目标**：用户可注册、登录，JWT 认证链路贯穿 Gateway → User Service。

**User Service（Go + GORM）：**
- [ ] 数据库连接（GORM + PostgreSQL）
- [ ] User domain 模型（与 `001_init.sql` 对应）
- [ ] Repository 层（Create / GetByEmail / GetByID / Update）
- [ ] Service 层：
  - [ ] 注册（bcrypt 密码哈希，cost=12）
  - [ ] 登录（密码校验 + JWT 签发）
  - [ ] GitHub OAuth（授权入口 + Callback + 用户绑定）
  - [ ] Token 刷新（Refresh Token 机制）
- [ ] Transport 层（Gin HTTP Handler）：
  - [ ] `POST /api/v1/auth/register`
  - [ ] `POST /api/v1/auth/login`
  - [ ] `GET /api/v1/auth/github`
  - [ ] `GET /api/v1/auth/github/callback`
  - [ ] `POST /api/v1/auth/refresh`
  - [ ] `POST /api/v1/auth/logout`
  - [ ] `GET /api/v1/auth/me`

**Gateway Service（Go + Gin）：**
- [ ] 反向代理：认证路由 → User Service
- [ ] JWT 认证中间件（验证 Access Token，透传 user_id）
- [ ] 路由转发：记忆路由 → Memory Service（预留，Sprint 2 接入）

**前端（Next.js）：**
- [ ] 登录页面（`app/(auth)/login/page.tsx`）
- [ ] 注册页面（`app/(auth)/register/page.tsx`）
- [ ] 表单验证（Zod / React Hook Form）
- [ ] API 客户端封装（fetch wrapper + token 自动注入）
- [ ] 登录状态管理（React Context / Zustand）

**文档：**
- [ ] 更新 docs/API.md（认证接口详细定义）
- [ ] 更新 docs/PROGRESS.md（Sprint 1 完成标记）
- [ ] 更新 CHANGELOG.md（v0.2.0）

**里程碑验证：**
- 用户可通过邮箱注册、登录
- 登录后获取 JWT Token
- Gateway 中间件拒绝无 Token 请求
- GitHub OAuth 可完成授权并创建/绑定用户

---

### Sprint 2：记忆捕获（Week 3）

**目标**：用户可保存文字/链接，时间轴浏览记忆。

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
  - [ ] 链接类型 → `link:fetch` 队列
  - [ ] 所有类型 → `text:vectorize` 队列
  - [ ] 所有类型 → `tag:generate` 队列

**Gateway Service：**
- [ ] 路由转发：记忆路由 → Memory Service
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

**里程碑验证：**
- 登录用户可创建文字记忆和链接记忆
- 时间轴展示记忆列表（按时间倒序）
- 可点击查看详情、编辑标签、删除
- 创建后 `processing_status=pending`，Redis Stream 有任务

---

### Sprint 3：AI 处理层（Week 4）

**目标**：自动标签 + 文本向量化，异步队列消费者工作。

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
- [ ] 状态流转管理：`pending → processing → completed/failed`
- [ ] 重试机制：失败任务最多重试 3 次

**文档：**
- [ ] 更新 docs/ARCHITECTURE.md（LLM Provider 模块、异步任务流）

**里程碑验证：**
- 创建记忆后，Processor 自动抓取链接标题摘要
- 自动标签生成（中文，3-5 个）
- 向量写入 memories.vector 字段
- 状态最终变为 `completed`
- LLM 失败时降级为本地关键词提取

---

### Sprint 4：搜索能力（Week 5）

**目标**：语义搜索可用，相似推荐可用，暗黑模式完成。

**Memory Service：**
- [ ] 语义搜索 API：`GET /api/v1/search?q=&limit=`
  - [ ] 查询文本向量化（调用 Vectorizer Service 或本地缓存）
  - [ ] pgvector 余弦相似度查询（阈值 ≥ 0.75）
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

**里程碑验证：**
- 搜索"Go 协程"可找到相关记忆
- 相似推荐展示"你可能还感兴趣"
- 暗黑模式完整可用（非简单反色）

---

### Sprint 5：可观测性 + 打磨上线（Week 6）

**目标：必须接入可观测性三件套，产品达到可用状态。**

**可观测性（所有 Go 服务）：**
- [ ] Prometheus Metrics：
  - [ ] `/metrics` 端点暴露
  - [ ] `http_requests_total` / `http_request_duration_seconds`
  - [ ] `memory_processing_status` / `llm_requests_total`
- [ ] OpenTelemetry Tracing：
  - [ ] Gateway 生成 trace_id
  - [ ] HTTP 调用 Span（Gateway → User/Memory）
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
- [ ] 端到端测试：注册 → 登录 → 创建记忆 → 搜索
- [ ] 各服务单元测试

**文档：**
- [ ] README.md 最终版（完整快速开始）
- [ ] 更新 CHANGELOG.md（v1.0.0）
- [ ] 可观测性部署文档

**里程碑验证：**
- Prometheus 可抓取所有 Go 服务指标
- Jaeger 可查看跨服务调用链路
- Grafana 仪表盘展示 QPS / 延迟 / 错误率
- 端到端流程无阻塞通过

---

### Phase 2 扩展：Echo Assistant（+1-2 周）

**目标**：对话式 AI 助手，基于 RAG 回答用户记忆相关问题。

- [ ] Chat UI 侧边栏组件（Web 界面）
- [ ] RAG 检索逻辑：
  - [ ] 用户问题 → 语义搜索 → 获取相关记忆
  - [ ] 记忆上下文 + 问题 → LLM Provider 生成回答
- [ ] 引用来源展示（LLM 回答中标注引用的记忆标题/链接）
- [ ] 对话历史管理（数据库存储）
- [ ] 复用 Sprint 3 的 LLMProvider（无需新开发）

**里程碑验证：** "我上周存的关于 Go 的文章有哪些？" → 列出相关记忆 + 总结回答

### Phase 3 预留：Agent 平台

- [ ] 数据库字段预留 `agent_id`、`agent_type`
- [ ] 预留 Agent 配置表结构
- [ ] 微服务架构支持未来接入 Agent Service
- **不做**：第三方 Agent 市场、SDK、沙盒

---

## 10.1 Go 可观测性技术栈

> Sprint 5 前必须接入可观测性三件套。

### Metrics

- **工具**：Prometheus Counter / Histogram / Gauge
- **暴露**：每个 Go 服务提供 `/metrics` 端点
- **关键指标**：
  - `http_requests_total`（按方法、路径、状态码分桶）
  - `http_request_duration_seconds`（Histogram，P50/P95/P99）
  - `memory_processing_status`（按状态计数：pending/processing/completed/failed）
  - `llm_requests_total`（按 provider、状态分桶）
  - `vector_embedding_duration_seconds`

### Tracing

- **工具**：OpenTelemetry + Jaeger
- **要求**：
  - Gateway 生成 `trace_id`，透传到所有下游服务
  - 每个 HTTP/gRPC 调用生成 Span
  - Redis Stream 消费也记录 Span
- **数据**：`trace_id` / `span_id` / `parent_span_id` 写入日志

### Logging

- **工具**：Zap 结构化日志（Go 标准）
- **格式**：JSON，字段统一
- **必含字段**：`timestamp` / `level` / `service` / `trace_id` / `span_id` / `message` / `context`
- **级别**：DEBUG（开发）/ INFO（默认）/ WARN / ERROR

### 可视化

- **工具**：Grafana 仪表盘
- **预设面板**：
  - 服务 QPS / 延迟 / 错误率
  - Redis Stream 队列深度
  - PostgreSQL 连接数 / 慢查询
  - LLM 调用成功率 / 延迟

### 部署

| 环境 | 方式 |
|------|------|
| 本地 | Docker Compose（Prometheus + Jaeger + Grafana） |
| 生产 | K8s（Sidecar 模式或 DaemonSet） |

---

## 11. 给 Claude Code 的启动指令

```markdown
你是一个全栈开发专家，精通 Next.js、Go、PostgreSQL、Docker 和 K8s。

请根据 PRD.md 逐步实现「拾忆 (Echoes)」产品。

产品定位：个人语义搜索引擎，Notion-like 极简美学。

**核心要求：**
1. **严格遵循** 文档中的技术栈、目录结构、API 定义
2. **技术栈选型原则**：能力 > 工具名称，可用平替（Prometheus→StatsD, OTel→Zipkin），关键能力必须满足
3. **关键能力必须满足**：可观测性三件套（Metrics/Tracing/Logging）、向量数据库、LLM 多提供商
4. **Windows 兼容**：代码必须在 Windows (WSL2/Docker) 下可运行
5. **创建 .gitattributes** 强制 LF 换行符
6. **提供 Windows 启动脚本** (dev-start.ps1)
7. 先实现 Sprint 0（Docker Compose 基础设施）
8. 每个 Sprint 结束必须有可运行的版本
9. **Sprint 5 前必须接入可观测性**：Prometheus Metrics + OpenTelemetry Tracing + Zap 结构化日志
10. 代码简洁、有注释、可测试
11. 设计美观、暗黑模式、细腻动效

**命名约定（技术标识统一为 Echoes）：**
- **GitHub 仓库：** `Echoes`
- **项目目录：** `echoes`
- **数据库名：** `echoes`
- **数据库用户：** `echoes_user`
- **K8s 命名空间：** `echoes`
- **Docker 容器前缀：** `echoes-`
- **代码 package/module：** `echoes`
- **Web 页面标题：** `拾忆 - Echoes`（中文优先）或仅 `Echoes`（英文模式）
- **API 路径：** `/api/v1/...`（保持不变）

**文档规范化（必须遵守）：**
1. **README.md**：项目根目录必须有，包含项目简介、技术栈、快速开始、目录结构
2. **docs/PROGRESS.md**：记录开发进度，每个 Sprint 更新完成情况、遇到的问题、下一步计划
3. **docs/ARCHITECTURE.md**：架构说明文档，包含服务划分、数据流、接口设计
4. **CHANGELOG.md**：版本变更日志，每个 Sprint 结束更新
5. **API.md**：接口详细文档（可引用 PRD 第6章）
6. 代码注释：每个函数必须有 doc comment，复杂逻辑需行内注释

**Git 规范化（必须遵守）：**
1. **初始化仓库**：`git init`，关联远程仓库 `https://github.com/NebulaVzx/Echoes.git`
2. **分支策略**：
   - main：稳定分支，Sprint 结束合并
   - develop：开发分支，日常提交
   - feature/*：功能分支，单个功能开发
3. **提交规范**：使用 Conventional Commits 格式
   - `feat: 添加用户登录功能`
   - `fix: 修复数据库连接超时问题`
   - `docs: 更新 README.md`
   - `refactor: 重构 Gateway 路由逻辑`
4. **提交频率**：每天至少提交一次，有进度就提交
5. **提交前检查**：代码可编译/运行，无敏感信息泄露
6. **Push 策略**：
   - Sprint 结束必须 push 到 GitHub
   - 关键里程碑必须 push（数据库模型完成、认证可用、搜索可用等）
   - 每日开发结束建议 push

**GitHub 仓库：** https://github.com/NebulaVzx/Echoes.git

**从 Sprint 0 开始：基础设施搭建**

**第一步任务：**
1. git init 并关联远程仓库
2. 创建 .gitattributes 强制 LF 换行符
3. 创建项目目录结构
4. 编写 README.md（基础版，后续迭代）
5. 创建 Docker Compose 配置
6. 创建数据库迁移文件
7. 编写 dev-start.ps1 和 dev-start.sh
8. 提交并 push 到 GitHub："feat: Sprint 0 基础设施搭建"

```

---

**文档版本：** v7.1 (Agent 修正版)
**产品名称：** 拾忆 (Echoes)
**创建日期：** 2026-04-18
**MVP 周期：** 6 周
**扩展周期：** +1-2 周（Echo Assistant）
**部署方式：** Docker Compose (本地) / K8s (生产)
**产品定位：** 个人语义搜索引擎 + 轻量级 AI 助手（Echo Assistant），Agent 平台架构预留
**状态：** 可立即开发
