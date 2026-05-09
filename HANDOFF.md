# HANDOFF — Echoes 项目交接文档

> 生成时间：2026-05-08
> 生成上下文：session 更新 Phase 12 实际执行状态

---

## 1. 项目概况

| 项目 | 说明 |
|------|------|
| **名称** | Echoes（拾忆）— 个人语义搜索引擎 |
| **当前版本** | v1.2.0 "记忆的温度"（2026-04-26） |
| **当前分支** | `develop`（领先 origin/develop 23+ commits） |
| **主分支** | `main` |
| **技术栈** | Next.js 14 + Go/Gin + Python/FastAPI + PostgreSQL/pgvector + Redis Stream |
| **部署方式** | Docker Compose（开发），Kubernetes（生产） |

---

## 2. 当前工作状态

### ✅ 已完成：Phase 11 — UI 架构重设计（12/12 plans）

**计划目录**: `.planning/phases/11-ui-redesign/`

**目标**: 构建三栏自适应工作台（Sidebar + Main + RightPanel）、Command Palette（Cmd+K）、AI 时代交互特征，为 v1.3 "记忆的回响" 奠定前端架构基础。

### ✅ Phase 12 — 记忆捕获扩展（文件上传）已完成

**目标**: 支持文件记忆上传（txt/md/docx），提取文本后走完整的 AI 处理链路（向量化、标签、建议）。

**已完成（P0 + P1 全部完成，P2 除外）**:
- [x] 数据库迁移 `004_file_upload.sql`（source, is_starred, cover_url, file_name, file_size + 索引）
- [x] Memory domain 模型扩展（5 个新字段，SafeResponse 包含，Create/Update Request 支持）
- [x] Memory handler 支持 multipart/form-data 文件上传（类型校验 .txt/.md/.docx，大小限制 10MB）
- [x] MinIO 文件存储 + UploadFile + PresignedGetURL(300*time.Second)
- [x] `PublishFileTasks()` 发布 `file:extract` 到 Redis Stream（含完整 LLM 配置传播）
- [x] processor `file_consumer.py` — MinIO 客户端直接下载（带认证，避免 presigned 过期）+ HTTP fallback
- [x] `file_extractor.py` — txt/md 直接读取，docx 用 python-docx 提取
- [x] 文件提取后自动发布 `text:vectorize` + `tag:generate` + `suggestion:generate`（含 `include_note_in_analysis`）
- [x] 前端 `create-memory-form.tsx` — "记忆匣"品牌、三类型切换（文字/链接/文件）、拖拽上传、5 个快速模板、来源字段、星标切换、**草稿自动保存**
- [x] 前端 `memory-card.tsx` — 文件图标、星标显示、来源标注
- [x] `api.ts` — 支持 FormData（`isFormData` 标志）
- [x] List handler 支持 `?starred=true` 查询参数，repository 层 `ListByUser` 支持 `starredOnly`
- [x] **星标筛选 UI** — `page.tsx` 添加 "只看星标" Switch toggle + URL 同步 + 标题适配
- [x] **端到端验证** — 2026-05-08 完成：文字记忆创建 ✅ | 文件上传 + 文本提取 ✅ | 语义搜索找到文件内容 ✅ | 星标筛选返回 2 条 ✅

**明确未完成（P2）**:
- [ ] **批量导入**（P2）— 多文件同时上传
- [ ] **智能粘贴识别**（P2）— 自动判断内容类型

**线上 Bug 修复** (2026-05-03 至 05-04):
1. **PublishFileTasks 静默忽略错误** — `_ = s.queue.PublishFileExtract(...)` 改为显式错误日志
2. **presigned URL 过期时间 0** — `PresignedGetObject` 过期时间从 `0` 改为 `300` 秒
3. **processor 漏发 suggestion:generate** — file_consumer 提取后补发 suggestion
4. **suggestion_consumer 不支持 content_type=file** — 添加 file 作为 text 别名
5. **file_consumer MinIO 403** — 新增 MinIO 客户端直接下载（带认证），不再依赖 presigned URL
6. **前端轮询间隔优化** — 按记忆类型区分刷新间隔（text 3s / link 5s / file 10s）
7. **Redis Stream 积压死循环** — 核心修复：
   - processor `base.py`：失败后**强制 ack**（原代码不 ack 导致消息永久 pending）
   - 消费者组创建从 `id="0"` 改为 `id="$"`（避免重启后重播所有历史）
   - Stream 自动 trim（maxlen=5000）防止无限增长
   - memory-service + processor 派生任务发布时均添加 maxlen=5000
8. **文件记忆处理链路根因修复** — `minio-go/v7` 的 `PresignedGetObject` 第三个参数是 `time.Duration`（纳秒），传 `300` 被解释为 300 纳秒 → MinIO 拒绝 → `file:extract` 任务未发布。修复：`300` → `300*time.Second`
9. **LLM 配置优先全链路审计** — 确认链路贯通：前端 → user-service 加密存储 → memory-service 读取传播 → processor-service 解密使用
10. **file_consumer 派生任务补传 `include_note_in_analysis`** — 之前只传播了基础 LLM 配置，漏了用户偏好配置
11. **LLM 协议根因治理** — 三层防线防 `Unknown LLM protocol`：
    - user-service `UpdateSettings` 强制校验 `llm_protocol` 必填
    - memory-service `getUserLLMConfig` 旧数据兜底推断（无 protocol 时按 provider 推断）
    - processor-service LLMFactory 删除 `_openai_compatible` 隐式映射，恢复严格校验（只认 openai/anthropic）

**时区统一** (2026-05-03):
- 所有 11 个服务的 Docker 容器添加 `TZ=Asia/Shanghai`
- Go zap logger 时间格式统一为本地时间（`time.Local`）
- Python logging 统一为本地时间格式
- Redis AOF 已启用（`appendonly yes`），确保数据持久化

**核心方向**:
1. **三栏自适应布局** — CSS Grid 桌面三栏 + 移动端底部导航（MobileDock）
2. **设计系统 Tokens** — shared/design-tokens/ 统一颜色/间距/断点/排版
3. **Provider 架构** — LayoutProvider / DensityProvider / ThemeColorProvider 管理全局状态
4. **Command Palette** — Cmd+K 模糊搜索，支持 /prefix 和 >prefix 命令
5. **AI 交互特征** — 生成式 UI、流式打字机、智能上下文面板

**Plan 清单**（12 个，分 3 个 Wave）:
| Plan | 目标 | Wave |
|------|------|------|
| 11-01 | 安装 shadcn 组件 + 提取 design-tokens 到 shared/ | 1 |
| 11-02 | CSS Grid 布局基础 + 主题过渡动画 + Tailwind preset 集成 | 1 |
| 11-03 | 创建 LayoutProvider、DensityProvider、ThemeColorProvider | 1 |
| 11-04 | Provider tree 接入 + AppShell 三栏 Grid 容器 | 2 |
| 11-05 | 精简 Header (Logo + Search + Avatar) + UserMenu | 2 |
| 11-06 | Sidebar 导航 (4 分类 9 项) + SidebarItem | 2 |
| 11-07 | RightPanel (上下文面板) + RightPanelWidget + MobileDock | 2 |
| 11-08 | Command Palette (Cmd+K, fuzzy search, /prefix, >prefix) | 3 |
| 11-09 ~ 11-12 | 后续 plan（见 .planning/phases/11-ui-redesign/）| 3 |

**涉及范围**: 前端（web/）+ shared/design-tokens/

### 近期提交（全部 Phase 11 相关）

| Commit | 描述 |
|--------|------|
| `5609f17` | docs: align PROGRESS.md and STATE.md with actual project status |
| `f00a429` | fix(11): resolve three visual issues — layout center, header sticky, dropdown blue ring |
| `ddb3d0d` | fix(11): viewport-center content and unify dropdown item focus styles |
| `13c78d9` | fix(11): fix content centering and dropdown focus outline |
| `4c4b8ae` | fix(11): remove active ring in collapsed sidebar, suppress dropdown outline, sticky header |
| `d6ed5aa` | fix(11): fix homepage errors and blue focus outlines |
| `7e04313` | fix(11): return 200 instead of 404 when serendipity has no match |
| `4a38e43` | fix(11): resolve hydration error caused by nested button in UserMenu |
| `7fd1655` | fix(11): suppress Chrome default blue focus-visible outline on navigation elements |
| `00df083` | fix(11): fix focus ring and sidebar scroll behavior |
| `fb9a1cd` | refactor(11): declutter timeline layout |

### 已修复问题（2026-05-03）

1. ~~首页报错（hydration 不匹配）~~ ✅ 已修复
2. ~~内容偏左（关闭 right panel 后未居中）~~ ✅ 已修复
3. ~~Header 滚动消失~~ ✅ 已修复
4. ~~收缩 sidebar active item 蓝框~~ ✅ 已修复
5. ~~Dropdown 聚焦蓝色边框~~ ✅ 已修复

### 待解决问题 / 已知限制

1. **Phase 12 状态（2026-05-09）**:
   - ✅ 星标筛选 UI — 已完成（Switch toggle + URL 同步）
   - ✅ 草稿自动保存 — 已完成（localStorage debounce 2s + 恢复 + 清除）
   - ✅ 批量导入 — 已完成（多文件选择、逐个上传、50MB 总量限制）
   - ✅ 智能粘贴识别 — 已完成（URL/代码/待办/读书笔记自动检测）
   - ✅ 端到端验证 — 2026-05-09 全部通过

2. **核心服务容器状态** (2026-05-08 已恢复):
   - ✅ 全部 12 个容器已启动并运行
   - Gateway 健康检查通过：`{"gateway":"ok","services":{"memory":"ok","user":"ok"}}`
   - 前端 `localhost:3000/login` 返回 200
   - 注意：Gateway 日志中有历史性的 `POST /api/v1/tags/categorize` 500 错误（30s 超时），非当前启动问题

3. **WSL2 localhost:3000 转发残留** — Docker Desktop 重启后可能出现 WSL2 端口映射残留，导致 `localhost:3000` 无法访问前端。
   - **Workaround**: 用 WSL2 IP 访问（如 `http://172.x.x.x:3000`），或重启 Docker Desktop
   - **根本解决**: 重启 Docker Desktop + 清理 WSL 网络（`wsl --shutdown`）

4. **vectorizer-service 重建超时** — `docker compose up -d --build` 因 torch 755MB 依赖下载超时，但容器仍健康运行。重建时建议单独处理或使用已有镜像。

> 首页报错、布局居中、header sticky、dropdown 蓝框已全部修复。

### 未跟踪文件

> 无。所有文件已纳入版本控制。

---

## 3. 关键规则速查（P0 不可违反）

| 优先级 | 规则 | 说明 |
|--------|------|------|
| P0 | 交付质量我负责 | 任何改动必须端到端测试后才能声明完成 |
| P0 | 闭环开发 | 写代码前想完整流程，写完测成功路径+边界 |
| P0 | 默认中文输出 | 用户消息是中文 -> 回复中文 |
| P0 | RTK 前缀命令 | 所有 Bash 命令前缀 `rtk` |
| P1 | 动手验证优先 | 思考超 3 分钟无进展 -> curl/log/console |
| P1 | Docker 不改不 rebuild | 改代码只重启容器，改 Dockerfile/依赖才 rebuild |
| P1 | 小步快跑提交 | 完成一个独立修复点就 commit |
| P1 | 检查活跃错题 | 动手前读 mistake-log.md，相似场景警觉 |
| P2 | bool + omitempty | Go struct 中 bool 带 omitempty 会导致 false 被跳过 |

---

## 4. 活跃错题（需警觉）

| 时间 | 场景 | 错误 | 修正措施 |
|------|------|------|----------|
| 05-03 | Phase 11 CSS | 全局 `* { transition: 300ms }` 覆盖所有元素 | 禁止全局 `*` 选择器设置 transition |
| 05-03 | shadcn 版本 | shadcn v4 组件 + Tailwind v3 不兼容 | v3 项目用 shadcn v3 CLI |
| 05-03 | CSS 变量格式 | OKLCH 变量被 hsl() 包装导致暗黑模式失效 | OKLCH 变量用 `var(--x)` 不用 `hsl()` |
| 05-03 | 组件默认尺寸 | Logo 默认 size=200 在 48px header 中溢出 | 约束容器中显式设置 size |
| 05-03 | UI 交互差异 | shadcn v4 DropdownMenuItem 用 focus: 而非 hover: | 第三方库需测试 hover/focus 行为 |
| 05-03 | 浏览器缓存陷阱 | Next.js dev CSS 修改后未 Disable cache 验证 | 前端修改必须配合 Disable cache / Ctrl+Shift+R |
| 05-03 | Tailwind 透明度工具类 | `ring-foreground/10` 在 OKLCH 下回退到蓝色 | 带透明度的工具类在 OKLCH 变量下无效，改用 border |
| 05-03 | localStorage 默认值 | `rightPanelVisible ?? true` 导致内容偏左 | localStorage 默认值必须与产品默认值一致 |
| 05-03 | Go time.Duration | `PresignedGetObject(ctx, bucket, obj, 300, nil)` 传 300 被解释为 300 纳秒 | `time.Duration` 必须带单位：`300 * time.Second` |
| 05-03 | Redis Stream | 失败后不 ack → 消息永久 pending → 死循环积压 | 消费者处理失败必须 ack（哪怕失败也要 ack），配合 maxlen trim |
| 05-03 | LLM 协议传播 | 旧数据无 `llm_protocol` 字段 → processor `Unknown LLM protocol` | 上游（memory-service）兜底推断，下游严格校验，快速暴露 |
| 05-03 | 跨服务配置传播 | file_consumer 派生任务漏传 `include_note_in_analysis` | 派生任务需显式白名单传播所有相关配置字段 |

---

## 5. Docker 运维速查

**容器名对照**:
| 服务 | 容器名 |
|------|--------|
| Gateway | `echoes-gateway` |
| User Service | `echoes-user-service` |
| Memory Service | `echoes-memory-service` |
| Processor | `echoes-processor` |
| Vectorizer | `echoes-vectorizer` |
| Web (Next.js) | `echoes-web` |
| PostgreSQL | `echoes-postgres` |
| Redis | `echoes-redis` |

**常用运维命令**:
```bash
./scripts/docker-ops.sh status          # 容器状态
./scripts/docker-ops.sh check           # 深度健康检查
./scripts/docker-ops.sh fix-all         # 一键修复
./scripts/dev-reload.sh gateway         # 重载 Gateway（不改不 rebuild）
./scripts/dev-reload.sh all             # 批量重载
```

**重要**: 开发环境修改代码只需 restart 容器，不需要 rebuild。只有改 Dockerfile/docker-compose.yml/依赖时才 rebuild。

**时区配置**: 所有服务容器已统一注入 `TZ=Asia/Shanghai`，日志时间均为北京时间。如需修改时区，编辑 `docker-compose.yml` 中各服务的 `environment` 段落。

---

## 5.1 核心数据流速查

### LLM 配置优先全链路

```
前端设置面板
    ↓ POST /api/v1/users/settings
user-service（AES-256-GCM 加密 api_key）
    ↓ 存入 PostgreSQL users.settings (JSONB)
memory-service（读取时解密或透传加密态）
    ↓ 发布 Redis Stream 任务时注入 llm_* 字段
processor-service（_create_llm() 中解密 api_key）
    ↓ LLMFactory.create(protocol, model, api_key...)
OpenAIProvider / AnthropicProvider
```

**优先级**: `fields["llm_protocol"]` > `fields["llm_provider"]` > `settings.llm_protocol` > `settings.llm_provider` > 环境变量。用户配置始终优先。

**API key 加密链**: user-service `crypto.Encrypt()` → DB 存储 → memory-service 传播（加密态）→ processor-service 使用时 `decrypt()`。

### 文件记忆处理链路

```
前端上传文件
    ↓ POST /api/v1/memories (content_type=file)
memory-service
    → UploadFile() → MinIO bucket
    → GetPresignedGetURL(300*time.Second) → presigned URL
    → PublishFileTasks() → Redis Stream "tasks:file" (XADD)
processor-service file_consumer
    → MinIO 客户端直接下载（带认证，避免 presigned 过期）
    → 提取文本（txt/md/docx）
    → 更新 memory.content
    → 派生任务：text:vectorize + tag:generate + suggestion:generate
        （含完整 LLM 配置传播）
vectorizer-service / processor tag_consumer / suggestion_consumer
    → 各自处理，完成后 memory 状态更新
```

**关键坑**: `PresignedGetObject` 第三个参数是 `time.Duration`（纳秒），必须传 `300*time.Second`，不能裸传 `300`。

### Redis Stream 消费者安全模式

- 消费者组创建：`id="$"`（只消费新消息，避免重启后重播历史）
- 消息处理失败：**必须 ack**，否则消息永久 pending 死循环
- Stream 自动 trim：`maxlen=5000`，防止无限增长
- 发布任务时也要带 `maxlen=5000`

---

## 6. 调试优先级

| 优先级 | 方法 | 适用场景 |
|--------|------|----------|
| 1 | curl 直接测 API | 后端数据不保存/不返回 |
| 2 | docker logs | 服务崩溃/500 错误 |
| 3 | 运维脚本 | 容器健康检查 |
| 4 | 浏览器 devtools | 前端状态/渲染问题 |
| 5 | 代码走读 | 逻辑漏洞/边界条件 |

**前端样式问题专属排查流程：**
1. DevTools -> Network -> **Disable cache** -> 刷新
2. Console -> `getComputedStyle(el).propertyName` 验证实际值
3. Elements -> Computed 面板看规则来源和覆盖链
4. 清 `.next` 目录 + 重启容器
5. 最后用 Playwright 做回归截图

---

## 7. 记忆文件索引

所有记忆存储于 `C:\Users\Yongbin\.claude\projects\D--xProjects-Vibe-Echoes\memory\`：

| 文件 | 内容 |
|------|------|
| `MEMORY.md` | 规则索引 + 项目状态 |
| `mistake-log.md` | 活跃/历史错题 + 模式洞察 |
| `feedback_quality_ownership.md` | 交付质量我负责 |
| `feedback_closed_loop_development.md` | 闭环开发 |
| `feedback_chinese_output.md` | 默认中文输出 |
| `feedback_rtk_prefix.md` | RTK 命令前缀 |
| `feedback_testing_expectation.md` | 主动端到端测试 |
| `feedback_docker_nextjs_build.md` | host build 与容器 dev 冲突 |
| `feedback_docker_devops.md` | Docker 运维脚本化 |
| `feedback_debug_workflow.md` | 调试经验教训（含浏览器缓存、Playwright 局限） |
| `feedback_frontend_shadcn_tailwind.md` | 前端 shadcn/Tailwind/CSS 兼容性原则 |
| `project_phase11_status.md` | Phase 11 当前状态 + 已修复问题 |
