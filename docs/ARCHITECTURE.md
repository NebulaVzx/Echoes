# 架构说明 (ARCHITECTURE)

> Echoes (拾忆) 系统架构设计文档
> 版本：v1.0.0
> 日期：2026-04-18

## 1. 架构概述

Echoes 采用**微服务架构**，将系统拆分为独立部署的服务单元，通过 API 网关统一对外提供服务。

### 核心设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 前端框架 | Next.js 14 App Router | SSR/SSG 支持，React Server Components |
| API 风格 | REST + JSON | 简单、通用、开发效率高 |
| 服务通信 | HTTP (内部) | Phase 1 简化，Phase 2 引入 gRPC |
| 异步消息 | Redis Stream | 轻量、可靠、支持消费组 |
| 向量检索 | pgvector (IVFFlat) | 与 PostgreSQL 集成，无需额外向量数据库 |
| 部署方式 | Docker Compose → K8s | 渐进式部署 |

## 2. 微服务划分

```
┌─────────────────────────────────────────────┐
│            Next.js Web App                   │
│    - React Server Components                 │
│    - Tailwind CSS + shadcn/ui               │
│    - Framer Motion 动效                      │
└──────────────────┬──────────────────────────┘
                   │ HTTPS
┌──────────────────▼──────────────────────────┐
│           Gateway Service (Go + Gin)        │
│    - 路由转发                                │
│    - JWT 认证中间件                          │
│    - 请求限流                                │
│    - 日志记录                                │
└──────────────────┬──────────────────────────┘
                   │ HTTP
       ┌───────────┴───────────┐
       ▼                       ▼
┌──────────────┐      ┌────────────────┐
│ User Service │      │ Memory Service │
│   (Go/GORM)  │      │   (Go/GORM)    │
│              │      │                │
│ - 注册/登录   │      │ - 记忆 CRUD    │
│ - OAuth      │      │ - 标签管理     │
│ - JWT 签发   │      │ - 语义搜索     │
│ - 用户资料   │      │ - 相似推荐     │
└──────────────┘      └───────┬────────┘
                              │ Async (Redis Stream)
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  Processor   │      │  Vectorizer  │      │  PostgreSQL  │
│  (Python)    │      │  (Python)    │      │  + pgvector  │
│              │      │              │      │              │
│ - 链接抓取   │      │ - BGE-M3     │      │ - users      │
│ - 内容摘要   │      │   向量化     │      │ - memories   │
│ - 自动标签   │      │              │      │ - 向量索引   │
└──────────────┘      └──────────────┘      └──────────────┘
                                                    │
                                               Redis 7
                                          (缓存 + 消息队列)
```

### 服务职责

#### Gateway Service
- **职责**：统一入口，路由分发，认证鉴权
- **端口**：8080
- **路由规则**：
  - `/api/v1/auth/*` → User Service
  - `/api/v1/memories/*` → Memory Service
  - `/api/v1/search` → Memory Service
- **中间件**：JWT 验证、请求日志、限流

#### User Service
- **职责**：用户生命周期管理
- **端口**：8001
- **数据库**：PostgreSQL (users 表)
- **核心功能**：
  - 邮箱注册/登录（bcrypt 密码）
  - GitHub OAuth 2.0
  - JWT Token 签发与刷新
  - 用户资料管理

#### Memory Service
- **职责**：记忆内容管理
- **端口**：8002
- **数据库**：PostgreSQL (memories 表)
- **缓存**：Redis
- **核心功能**：
  - 记忆 CRUD（文字、链接）
  - 标签管理
  - 语义搜索（pgvector 余弦相似度）
  - 相似内容推荐
  - 异步任务发布（Redis Stream）

#### Processor Service
- **职责**：内容处理与增强
- **端口**：8003
- **核心功能**：
  - 链接抓取（HTTP 请求 + HTML 解析）
  - 内容摘要生成
  - 自动标签生成
  - 消费 Redis Stream 任务

#### Vectorizer Service
- **职责**：文本向量化
- **端口**：8004
- **模型**：BGE-M3（768 维向量）
- **核心功能**：
  - 文本编码为向量
  - 消费 Redis Stream 任务
  - 模型热加载

## 3. 数据流

### 3.1 用户注册流程

```
User → Gateway → User Service → PostgreSQL
              ← JWT Token ←
```

### 3.2 创建记忆流程

```
User → Gateway → Memory Service → PostgreSQL (insert, status=pending)
                                    ↓
                              Redis Stream (text:vectorize)
                                    ↓
                              Vectorizer Service → PostgreSQL (update vector)
                                    ↓
                              Memory Service (update status=completed)
```

### 3.3 语义搜索流程

```
User → Gateway → Memory Service
                    ↓
              Vectorizer Service (query → vector)
                    ↓
              PostgreSQL pgvector (cosine similarity)
                    ↓
              User ← Results
```

### 3.4 链接保存流程

```
User → Gateway → Memory Service → PostgreSQL (insert, status=pending)
                                    ↓
                              Redis Stream (link:fetch)
                                    ↓
                              Processor Service → Fetch URL
                                    ↓
                              PostgreSQL (update title, summary)
                                    ↓
                              Redis Stream (text:vectorize, tag:generate)
                                    ↓
                              Vectorizer + Processor → PostgreSQL
                                    ↓
                              Memory Service (update status=completed)
```

## 4. 数据模型

### 4.1 核心实体

#### User
```
id: UUID (PK)
email: string (unique)
password_hash: string (nullable, for OAuth users)
username: string
avatar_url: string
oauth_provider: string (github, etc.)
oauth_id: string
is_active: boolean
created_at: timestamp
updated_at: timestamp
```

#### Memory
```
id: UUID (PK)
user_id: UUID (FK → users.id)
content_type: enum (text, link)
text_content: text (nullable)
link_url: text (nullable)
link_title: text (nullable)
link_summary: text (nullable)
media_url: text (nullable, reserved)
media_duration: int (nullable, reserved)
ocr_text: text (nullable, reserved)
transcript_text: text (nullable, reserved)
vector: vector(768) (pgvector, nullable until processed)
tags: string[] (PostgreSQL array)
note: text (nullable)
metadata: jsonb
processing_status: enum (pending, processing, completed, failed)
visibility: enum (private, public)
created_at: timestamp
updated_at: timestamp
```

### 4.2 向量索引策略

使用 IVFFlat 索引进行近似最近邻搜索：

```sql
CREATE INDEX idx_memories_vector ON memories
USING ivfflat (vector vector_cosine_ops);
```

- **距离度量**：余弦相似度（cosine similarity）
- **索引类型**：IVFFlat（倒排文件索引）
- **维度**：768（BGE-M3 模型输出）

## 5. 异步任务设计

### 5.1 Redis Stream 队列

| 队列名 | 任务类型 | 生产者 | 消费者 |
|--------|---------|--------|--------|
| `link:fetch` | 链接抓取 | Memory Service | Processor |
| `text:vectorize` | 文本向量化 | Memory Service | Vectorizer |
| `tag:generate` | 自动标签 | Memory Service | Processor |

### 5.2 任务消息格式

```json
{
  "task_id": "uuid",
  "memory_id": "uuid",
  "user_id": "uuid",
  "type": "text|link",
  "content": "文本内容或链接",
  "created_at": "2026-04-18T12:00:00Z"
}
```

### 5.3 状态流转

```
        ┌─────────┐
   ┌───→│ pending │←── 创建记忆
   │    └────┬────┘
   │         │ 发布到 Redis Stream
   │    ┌────▼────┐
   │    │processing│
   │    └────┬────┘
   │         │
   │    ┌────┴────┐
   └───┤ failed   │←── 处理失败（可重试）
        └─────────┘
        ┌─────────┐
        │completed │←── 处理成功
        └─────────┘
```

## 6. 安全设计

### 6.1 认证
- JWT Token（HS256 签名）
- Access Token：15 分钟有效期
- Refresh Token：7 天有效期
- Token 存储：HttpOnly Cookie

### 6.2 密码存储
- bcrypt 算法（cost factor 12）
- 密码最小长度：8 位

### 6.3 OAuth
- GitHub OAuth 2.0
- State 参数防止 CSRF
- 仅请求必要权限（read:user, user:email）

### 6.4 API 安全
- Gateway 层限流（Rate Limiting）
- CORS 配置
- 输入验证（Pydantic / Go validator）
- SQL 注入防护（GORM 参数化查询）

## 7. 部署架构

### 7.1 本地开发（Docker Compose）

所有服务运行在同一 Docker 网络中，通过服务名访问：
- `postgres:5432`
- `redis:6379`
- `minio:9000`

### 7.2 生产部署（Kubernetes）

```
┌─────────────────────────────┐
│         Ingress              │
│    (Nginx / Traefik)        │
└─────────────┬───────────────┘
              │
┌─────────────▼───────────────┐
│       Gateway Service        │
│      (Deployment + HPA)      │
└─────────────┬───────────────┘
              │
    ┌─────────┴─────────┐
    ▼                   ▼
┌─────────┐       ┌─────────┐
│  User   │       │ Memory  │
│ Service │       │ Service │
└────┬────┘       └────┬────┘
     │                 │
     └────────┬────────┘
              ▼
       ┌─────────────┐
       │ PostgreSQL  │
       │  (Stateful) │
       └─────────────┘
              │
       ┌──────┴──────┐
       ▼             ▼
   ┌───────┐    ┌────────┐
   │ Redis │    │ MinIO  │
   └───────┘    └────────┘
```

K8s 配置位于 `k8s/` 目录，按编号顺序应用：
1. `00-namespace.yaml` - 命名空间
2. `01-configmap.yaml` - 非敏感配置
3. `02-secret.yaml` - 敏感配置（需手动修改）
4. `10-*.yaml` - 基础设施（PostgreSQL, Redis, MinIO）
5. `20-*.yaml` - 应用服务（Gateway, User, Memory）
6. `30-web.yaml` - Web 前端
7. `40-ingress.yaml` - 入口/SSL
8. `50-hpa.yaml` - 自动扩缩容

## 8. 监控与日志

### 8.1 日志规范
- 结构化 JSON 日志
- 包含：timestamp, level, service, trace_id, message, context
- Gateway 统一生成 trace_id，透传到下游服务

### 8.2 健康检查
- 每个服务提供 `/health` 端点
- Docker / K8s 使用健康检查决定容器状态

### 8.3 未来扩展
- Prometheus 指标收集
- Grafana 可视化仪表盘
- Jaeger 分布式链路追踪
