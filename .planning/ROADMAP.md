---
name: Echoes Roadmap
description: 拾忆产品开发路线图
---

# 路线图

## 里程碑

- ✅ **v1.0 MVP** — Phases 0-5 (shipped 2026-04-22)
- ✅ **v1.1 Echo Assistant** — Phases 6-7 (shipped 2026-04-25)
- ✅ **v1.2 "记忆的温度"** — Phases 8-10 (shipped 2026-04-26)

## 已发布

<details>
<summary>✅ v1.0 MVP (Sprint 0-5) — SHIPPED 2026-04-22</summary>

| Phase | 名称 | 计划数 | 完成日期 |
|-------|------|--------|----------|
| 0 | 基础设施 | — | 2026-04-19 |
| 1 | 认证体系 | — | 2026-04-19 |
| 2 | 记忆捕获 | — | 2026-04-19 |
| 3 | AI 处理层 | 4 | 2026-04-19 |
| 4 | 搜索能力 | 4 | 2026-04-21 |
| 5 | 可观测性 + 打磨 | 7 | 2026-04-22 |

完整归档见 `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v1.1 Echo Assistant (Phases 6-7) — SHIPPED 2026-04-25</summary>

| Phase | 名称 | 计划数 | 完成日期 |
|-------|------|--------|----------|
| 6 | Echo Assistant | 5 | 2026-04-22 |
| 7 | Bug Fixes & Quality | 4 | 2026-04-25 |

完整归档见 `.planning/milestones/v1.1-ROADMAP.md`

</details>

<details>
<summary>✅ v1.2 "记忆的温度" (Phases 8-10) — SHIPPED 2026-04-26</summary>

| Phase | 名称 | 计划数 | 完成日期 |
|-------|------|--------|----------|
| 8 | AI 陪伴建议 | 5 | 2026-04-25 |
| 9 | 标签重生 | 4 | 2026-04-25 |
| 10 | 记忆的温度 | 4 | 2026-04-26 |

**核心方向：**
1. **AI 陪伴建议** — 保存记忆后生成温情的、有建设性的 AI 反馈，持久化保存
2. **标签重生** — 标签从静态附属品变为可过滤、可管理、可发现的知识节点
3. **记忆的温度** — Streaks、那年今日、时间胶囊，让记忆有情感价值

完整归档见 `.planning/milestones/v1.2-ROADMAP.md`

</details>

## 进行中

### 🚀 v1.3 "记忆的回响" — Phases 11-17 (规划中)

| Phase | 名称 | 目标 | 计划数 | 状态 |
|-------|------|------|--------|------|
| 11 | UI 架构重设计 | 三栏自适应工作台、Command Palette、AI 时代交互特征 | 12 | ✅ 已完成 (2026-05-03) |
| 12 | 记忆捕获扩展 | 文件上传(txt/md/docx)、记忆匣命名、快速模板、星标、来源标注 | 1 (12-01) | ✅ 核心功能完成，存在缺口 (2026-05-04) |

**Plans:**
| Plan | 目标 | Wave |
|------|------|------|
| 11-01 | 安装 shadcn 组件 + 提取 design-tokens 到 shared/ | 1 |
| 11-02 | CSS Grid 布局基础 + 主题过渡动画 + Tailwind preset 集成 | 1 |
| 11-03 | 创建 LayoutProvider、DensityProvider、ThemeColorProvider | 1 |
| 11-04 | Provider tree 接入 + AppShell 三栏 Grid 容器 + (main)/layout.tsx | 2 |
| 11-05 | 精简 Header (Logo + Search + Avatar) + UserMenu 下拉菜单 | 2 |
| 11-06 | Sidebar 导航 (4 分类 9 项) + SidebarItem (active 指示器/badge) | 2 |
| 11-07 | RightPanel (上下文面板) + RightPanelWidget + MobileDock (底部导航) | 2 |
| 11-08 | Command Palette (Cmd+K, fuzzy search, /prefix, >prefix) | 3 |
| 11-09 | ConfettiLite + StreakFlame + ThemeColorPicker | 2 |
| 11-10 | PWA 基础 (manifest + icons + Serwist service worker) | 3 |
| 11-11 | Tauri 2.0 桌面端最小封装 (config + Rust ~50 行) | 1 |
| 11-12 | 现有页面迁移 (去 inline header) + 6 新路由占位页 | 4 |

| Phase | 名称 | 目标 | 计划数 | 状态 |
|-------|------|------|--------|------|
| 12 | 记忆捕获扩展 | 文件上传(txt/md/docx)、记忆匣命名、快速模板、星标、来源标注、草稿自动保存 | 1 (12-01) | ✅ 已完成 (2026-05-08) |
| 13 | 记忆星图与探索 | 向量关联可视化、无限钻取探索模式、AI 关联说明 | 待定 | 📋 规划中 |
| 13 | 记忆星图与探索 | 向量关联可视化、无限钻取探索模式、AI 关联说明 | 待定 | 📋 规划中 |
| 14 | 记忆封面与编织 | AI 生成封面图、多条记忆编织成文章 | 待定 | 📋 规划中 |
| 15 | 情绪与回响 | 情绪分析日历、每日记忆回响推送 | 待定 | 📋 规划中 |
| 16 | 用户管理中心 | 记忆 DNA、AI 助手人格、数据主权、学习路径、账户基础 | 待定 | 📋 规划中 |
| 17 | 浏览器插件与桥梁 | Web Clipper、记忆间隐藏联系发现 | 待定 | 📋 规划中 |

**核心方向：**
1. **从"保存"到"发现"** —— 让记忆不只是被检索，而是被重新遇见、被连接
2. **Flipbook 启发** —— 视觉优先、无限钻取、状态化探索（不照搬像素流，吸收交互精髓）
3. **捕获能力升级** —— 从单调表单升级为"记忆工作台"
4. **从"账户"到"数字孪生"** —— 用户管理升级为 AI 画像管理中心
5. **从"页面"到"工作台"** —— 三栏自适应布局，融入 AI 时代的交互特征（Command Palette、智能密度、流式反馈）

---

**Phase 12 Plans:**
| Plan | 目标 | 状态 |
|------|------|------|
| 12-01 | 文件上传 + 记忆匣 + 快速模板 + 星标/来源/草稿 | ✅ 已完成（Task 1-7，端到端验证通过） |

**Phase 12 验收记录:**
- 2026-05-08 端到端验证：文字记忆创建 ✅ | 文件上传 + 文本提取 ✅ | 语义搜索找到文件内容 ✅ | 星标筛选返回 2 条 ✅
- 2026-05-09 端到端验证：批量导入 3 文件全部成功 ✅ | 智能粘贴识别（代码/链接/待办/读书笔记检测）✅
- tag:generate 和 suggestion:generate 因测试环境 API key 无效返回 401，非代码问题

*Roadmap updated: 2026-05-09 — Phase 12 全部完成（含 P2）*

## 待规划

### 🔮 v1.4 "稳固之基" — 技术债务清理 + 安全加固

v1.3 密集交付 7 个 Phase 后，代码库积累了结构性技术债务和安全缺口。v1.4 不新增功能，专注**清理债务、加固安全、提升工程效率**。

#### 重构路线图

| 优先级 | 问题 | 位置 | 方案 | 预估工时 |
|--------|------|------|------|----------|
| P0 | **observability/zap.go 字节级重复** | memory-service + user-service | 提取到 `shared/go/observability`，两个服务 import | 2h |
| P0 | **config/database.go 连接逻辑重复** | memory-service + user-service | 提取通用 `NewDatabase(dsn string, models ...interface{})` 到 `shared/go/database` | 2h |
| P0 | **Python Settings 基类重复** | processor-service + vectorizer-service | 提取 `shared/python/config.py` 基类，服务继承扩展 | 2h |
| P1 | **api.ts 497 行职责过重** | web/lib/api.ts | 按领域拆分为 `auth.ts` / `memory.ts` / `search.ts` / `tag.ts` / `chat.ts` / `warmth.ts`，`api.ts` 做 re-export | 4h |
| P1 | **Gateway Chat 业务逻辑下沉** | gateway/internal/chat/ | 将 Chat repository + service + handler 迁移到独立 `chat-service` 或合并到 `user-service` | 8h |
| P1 | **Memory domain 僵尸字段** | memory-service/internal/domain/memory.go | 删除 `MediaURL`、`MediaDuration`、`OCRText`、`TranscriptText`（PRD 已明确不做语音/图片） | 1h |
| P2 | **User 领域模型重复定义** | memory-service + user-service | 评估是否用 `shared/proto` 或 `shared/go/domain` 统一（注意微服务边界） | 4h |
| P2 | **docker-compose 网络扁平化** | docker-compose.yml | 划分 `public` / `backend` / `data` 三层网络，内部服务不暴露宿主机端口 | 2h |

#### 安全审计与加固

**✅ 已做好的防护**

| 层面 | 措施 | 证据 |
|------|------|------|
| 认证 | JWT + Bearer 解析，alg=HS256 校验 | `gateway/internal/middleware/auth.go:59-64` |
| 密码存储 | bcrypt cost=12 | `user-service/internal/service/auth_service.go:52` |
| CORS | gin-contrib/cors，Origin 白名单 | `gateway/internal/middleware/cors.go` |
| 限流 | Token Bucket，支持 per-IP 和 per-User | `gateway/internal/middleware/ratelimit.go` |
| 路径遍历 | `path.Clean` 规范化 + 精确前缀匹配 | `auth.go:88-106`（CR-02 已修复） |
| SQL 注入 | GORM 参数化查询 + Raw SQL 参数化 | `memory_repository.go` 使用 `?` 占位符 |
| API Key 存储 | AES-256-GCM 加密 + 掩码显示 | `user-service/internal/crypto/encrypt.go` |
| 服务间认证 | Bearer INTERNAL_API_TOKEN | `memory_handler.go:267` |

**⚠️ 已发现的安全缺口**

| 风险等级 | 问题 | 影响 | 修复方案 | 负责人 |
|----------|------|------|----------|--------|
| 🔴 **高** | **Refresh Token 无轮换** | Token 被盗后 7 天内攻击者可持续使用 | 实现 Refresh Token Rotation：每次刷新后旧 token 失效，Redis 存储 token 家族状态 | Backend |
| 🔴 **高** | **Rate Limiter 内存存储** | 多 Gateway 实例不共享限流状态，单 IP 可绕过 | 替换为 Redis 分布式限流（`go-redis` + `rate` 包） | Backend |
| 🔴 **高** | **Zap Logger 不遮蔽敏感信息** | Authorization header、password、api_key 可能写入日志 | 在 `zap_logger.go` 中添加敏感字段过滤（`password`、`token`、`api_key`、`authorization`） | Backend |
| 🟠 **中** | **docker-compose 内部服务端口全暴露** | memory-service(8002)、user-service(8001) 等可从宿主机直接访问，绕过 Gateway | 移除内部服务的 `ports:` 映射，仅保留 Gateway(8088) 和 Web(3000) | DevOps |
| 🟠 **中** | **Docker 网络无隔离** | 所有服务在同一扁平网络，攻击者突破一个容器可横向移动 | 划分三层网络：`echoes-public`(Gateway+Web)、`echoes-backend`(服务层)、`echoes-data`(DB+Redis+MinIO) | DevOps |
| 🟠 **中** | **数据库密码明文硬编码** | docker-compose 中 `POSTGRES_PASSWORD=echoes_password` 为明文 | 使用 Docker Secrets（Swarm）或 K8s Secrets；本地开发用 `.env` 注入 | DevOps |
| 🟠 **中** | **默认 INTERNAL_API_TOKEN 弱密钥** | `dev-internal-token` 为可预测默认值，生产环境若未覆盖则形同虚设 | 启动时若 token 长度<32 或匹配默认模式，服务拒绝启动并 Fatal | Backend |
| 🟡 **低** | **无 HTTPS/TLS** | 开发环境无 TLS 可接受，但生产必须有 | 为 K8s 增加 Ingress TLS 配置；本地用 mkcert 生成自签名证书 | DevOps |
| 🟡 **低** | **无密码强度策略** | 用户可注册 "123456" 等弱密码 | 添加 zxcvbn 或正则策略（最小 8 位，含大小写+数字） | Backend |
| 🟡 **低** | **无账户锁定机制** | 暴力破解无惩罚，可无限尝试登录 | 登录失败 5 次后锁定 15 分钟，Redis 存储失败计数 | Backend |
| 🟡 **低** | **MinIO/Redis 无认证** | Redis 无密码，MinIO 使用默认凭据 | Redis 启用 `requirepass`；MinIO 强密码 + 访问策略 | DevOps |
| 🟡 **低** | **Gateway Chat 直接访问 DB** | Gateway 作为路由层却直接持有 DB 连接，违反分层 | Chat 数据访问下沉到 Chat Service，Gateway 仅做 HTTP 代理 | Backend |

#### v1.4 Phase 建议划分

| Phase | 名称 | 内容 | 计划数 |
|-------|------|------|--------|
| 18 | 公共模块提取 | shared/go + shared/python 提取，消灭重复代码 | 4 |
| 19 | 前端架构清理 | api.ts 拆分、组件目录重组、清理死代码 | 3 |
| 20 | 安全加固（认证层） | Refresh Token 轮换、密码策略、账户锁定、敏感日志遮蔽 | 4 |
| 21 | 安全加固（基础设施） | Docker 网络隔离、端口收敛、TLS、Secrets 管理 | 3 |
| 22 | 服务边界治理 | Chat 下沉、Gateway 纯路由化、User 模型统一评估 | 3 |

**核心方向：**
1. **从"能跑"到"稳跑"** —— 技术债务不杀人但拖慢迭代速度
2. **安全左移** —— 在功能爆发期后补上安全基线
3. **工程效率** —— 公共模块减少重复劳动，新服务开发更快

*Security audit completed: 2026-04-26 by static code analysis + configuration review*
