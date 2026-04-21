# 外部集成

**分析日期：** 2026-04-19

## API 与外部服务

**认证：**
- **GitHub OAuth** — 第三方登录提供商
  - 实现：`services/user-service/internal/service/auth_service.go` 中自建的 OAuth 流程
  - 端点：
    - 授权：`https://github.com/login/oauth/authorize`
    - Token 交换：`https://github.com/login/oauth/access_token`
    - 用户信息：`https://api.github.com/user`
  - 环境变量：`GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`、`GITHUB_REDIRECT_URI`
  - 请求范围：`user:email`
  - 回调处理器：`services/user-service/internal/transport/auth_handler.go`（重定向到前端 `/login#token=...`）

**LLM/AI（规划中）：**
- **OpenAI / Anthropic** — 计划用于 Sprint 4+ 的自动标签和 RAG 问答
  - 实现：轻量级工厂模式抽象层（约 200 行），替代 LangChain/LlamaIndex
  - 通过 `LLM_PROVIDER` 环境变量切换
  - 当前代码库中尚未实现

## 数据存储

**数据库：**
- **PostgreSQL 15** + **pgvector** 扩展
  - 本地镜像：`pgvector/pgvector:pg15`
  - 生产镜像：`ankane/pgvector:v0.5.1`
  - 连接：`DATABASE_URL` 环境变量
  - ORM：GORM（Go）、迁移使用原始 SQL
  - 关键 Schema：`users`、`memories` 表，`memories` 含 `VECTOR(768)` 用于嵌入
  - 索引：`memories.vector` 上的 `ivfflat`，使用 `vector_cosine_ops`
  - 迁移文件：`shared/migrations/001_init.sql`

**缓存/队列：**
- **Redis 7** (Alpine)
  - 镜像：`redis:7-alpine`
  - 本地：无认证；生产：`--requirepass ${REDIS_PASSWORD}`
  - 用途：消息队列（Redis Streams）、会话/缓存存储
  - 异步任务队列：
    - `link:fetch` — 链接抓取任务
    - `text:vectorize` — 文本嵌入任务
    - `tag:generate` — 自动标签任务
  - Go 客户端：`github.com/redis/go-redis/v9`
  - Python 客户端：`redis==5.0.3`

**文件存储：**
- **MinIO**（兼容 S3 的对象存储）
  - 镜像：`minio/minio:latest`
  - 控制台：9001 端口；API：9000 端口
  - 命令：`server /data --console-address ":9001"`
  - 当前已配置但应用代码中未主动使用（为未来媒体上传预留）

## 认证与身份

**认证提供商：**
- 自建 JWT 认证 + GitHub OAuth
- JWT 库：`github.com/golang-jwt/jwt/v5`
- Token 策略：
  - Access token：15 分钟过期（HS256）
  - Refresh token：7 天过期
  - 存储：localStorage（前端）+ cookie（用于 Next.js 中间件，15 分钟）
- OAuth state：内存 map，10 分钟 TTL（生产应使用 Redis）
- 中间件：Next.js `middleware.ts` 检查 `echoes_token` cookie；Gateway 验证 JWT Bearer token

## 监控与可观测性

**错误追踪：**
- 尚未实现（Sprint 6 计划）

**日志：**
- **Zap** 1.27.0 — Gateway 服务的结构化日志
- 其他 Go 服务使用标准 `log` 包
- Python 服务使用 print 语句（待替换为正式日志框架）

**指标/追踪（规划中）：**
- **Prometheus** + **OpenTelemetry** — Sprint 6 可观测性计划
- 备选方案：StatsD + Zipkin/Jaeger

## CI/CD 与部署

**托管：**
- 本地：Docker Compose
- 生产：Docker Compose 或 Kubernetes
- K8s 清单目录：`k8s/`（当前为空，为未来预留）

**CI 流水线：**
- 未配置（未检测到 `.github/workflows/` 或 CI 配置文件）

**容器仓库：**
- 仅本地构建；未配置外部仓库

## 环境配置

**必需的环境变量：**

| 变量 | 使用者 | 用途 |
|------|--------|------|
| `GITHUB_CLIENT_ID` | user-service | GitHub OAuth 应用 ID |
| `GITHUB_CLIENT_SECRET` | user-service | GitHub OAuth 应用密钥 |
| `GITHUB_REDIRECT_URI` | user-service | OAuth 回调 URL（默认 localhost） |
| `JWT_SECRET` | gateway、user-service | JWT 签名密钥 |
| `DATABASE_URL` | user-service、memory-service | PostgreSQL 连接字符串 |
| `REDIS_URL` | 所有服务 | Redis 连接字符串 |
| `POSTGRES_PASSWORD` | 仅生产 | PostgreSQL 密码 |
| `REDIS_PASSWORD` | 仅生产 | Redis 密码 |
| `MINIO_ROOT_USER` | 仅生产 | MinIO 管理员用户 |
| `MINIO_ROOT_PASSWORD` | 仅生产 | MinIO 管理员密码 |
| `NEXT_PUBLIC_API_URL` | web 前端 | 公共 API 基础 URL |
| `API_URL` | web（服务端） | 内部 API 基础 URL |
| `USER_SERVICE_URL` | gateway | 内部 user 服务地址 |
| `MEMORY_SERVICE_URL` | gateway | 内部 memory 服务地址 |
| `VECTORIZER_SERVICE_URL` | memory-service | 内部 vectorizer 服务地址 |
| `PROCESSOR_SERVICE_URL` | memory-service | 内部 processor 服务地址 |
| `LLM_PROVIDER` | 规划中（processor） | OpenAI/Anthropic 切换 |

**密钥存储位置：**
- 项目根目录的 `.env` 文件（未提交，在 `.gitignore` 中列出）
- Docker Compose 和源代码中的硬编码开发默认值（带有 `change_in_production` 注释）

## Webhook 与回调

**传入：**
- `GET /api/v1/auth/github/callback` — GitHub OAuth 回调处理器
  - 文件：`services/user-service/internal/transport/auth_handler.go`
  - 提取 `code` 和 `state` 查询参数
  - 用 code 交换 token，获取用户信息，创建/登录用户
  - 重定向到前端 `http://localhost:3000/login#token=...&refresh_token=...`

**传出：**
- GitHub OAuth token 交换：`POST https://github.com/login/oauth/access_token`
- GitHub 用户信息：`GET https://api.github.com/user`
- 内部服务间 HTTP 调用（gateway -> user-service/memory-service）

## 网络架构

**Docker 网络：**
- `echoes-network`（bridge 驱动）— 所有服务在此内部网络通信

**端口映射（本地）：**

| 服务 | 内部端口 | 外部端口 |
|------|---------|---------|
| web | 3000 | 3000 |
| gateway | 8080 | 8088 |
| user-service | 8001 | — |
| memory-service | 8002 | — |
| processor-service | 8003 | — |
| vectorizer-service | 8004 | — |
| postgres | 5432 | 5432 |
| redis | 6379 | 6379 |
| minio | 9000、9001 | 9000、9001 |

---

*集成审计：2026-04-19*
