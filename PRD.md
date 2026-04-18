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

### MVP 核心（6周）

| Sprint | 周 | 目标 | 核心任务 |
|--------|----|------|---------|
| 0 | 1 | 基础设施 | Docker Compose、数据库、目录结构 |
| 1 | 2 | 认证体系 | User Service、Gateway、OAuth、前端登录页 |
| 2 | 3 | 记忆捕获 | Memory Service、文字/链接捕获、时间轴 |
| 3 | 4 | AI 处理层 | LLM Provider 抽象层、Processor 自动标签、Vectorizer BGE-M3 向量化、异步队列 |
| 4 | 5 | 搜索能力 | 语义搜索（pgvector cosine）、相似推荐、暗黑模式 |
| 5 | 6 | 打磨上线 | 动效、响应式、错误处理、自我测试 |

### Phase 2 扩展（可选）

**Echo Assistant：** +1-2 周
- Chat UI 侧边栏组件
- RAG 检索逻辑（搜索结果 + LLM 回答）
- 对话历史管理

---

## 11. 给 Claude Code 的启动指令

```markdown
你是一个全栈开发专家，精通 Next.js、Go、PostgreSQL、Docker 和 K8s。

请根据 PRD.md 逐步实现「拾忆 (Echoes)」产品。

产品定位：个人语义搜索引擎，Notion-like 极简美学。

**核心要求：**
1. **严格遵循** 文档中的技术栈、目录结构、API 定义
2. **Windows 兼容**：代码必须在 Windows (WSL2/Docker) 下可运行
3. **创建 .gitattributes** 强制 LF 换行符
4. **提供 Windows 启动脚本** (dev-start.ps1)
5. 先实现 Sprint 0（Docker Compose 基础设施）
6. 每个 Sprint 结束必须有可运行的版本
7. 代码简洁、有注释、可测试
8. 设计美观、暗黑模式、细腻动效

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
