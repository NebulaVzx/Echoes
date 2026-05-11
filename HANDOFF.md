# HANDOFF — Echoes 项目交接文档

> 生成时间：2026-05-11
> 生成上下文：Phase 13 技术完成 + Phase 14 全部完成 + 关键线上 Bug 修复

---

## 1. 项目概况

| 项目 | 说明 |
|------|------|
| **名称** | Echoes（拾忆）— 个人语义搜索引擎 |
| **当前版本** | v1.2.0 "记忆的温度" → v1.3 Phase 14 ✅ 全部完成（2026-05-09） |
| **当前分支** | `develop`（已推送 origin/develop） |
| **主分支** | `main` |
| **技术栈** | Next.js 14 + Go/Gin + Python/FastAPI + PostgreSQL/pgvector + Redis Stream |
| **部署方式** | Docker Compose（开发），Kubernetes（生产） |

---

## 2. 当前工作状态

### ✅ Phase 11 — UI 架构重设计（12/12 plans，2026-05-03 完成）

三栏自适应工作台、Command Palette、AI 时代交互特征。详见 `.planning/phases/11-ui-redesign/`。

### ✅ Phase 12 — 记忆捕获扩展（2026-05-08 完成）

文件上传（txt/md/docx）、记忆匣命名、快速模板、星标、来源标注、批量导入、智能粘贴识别。

### ✅ Phase 13 — 记忆星图与探索（2026-05-09 技术完成，待人工 E2E）

向量关联可视化（react-force-graph-2d）、无限钻取探索模式、AI 关联说明、键盘快捷键。

- 构建/类型/编译验证全部通过
- 人工端到端验证（16 项检查点）待执行

### ✅ Phase 14 — 记忆封面与编织（2026-05-09 全部完成）

AI 生成封面图（DALL-E 3 → Pollinations → 纯色降级）、多条记忆编织成文章（4 种模式）、时间轴封面展示、多选交互。

| Plan | 目标 | 状态 |
|------|------|------|
| 14-01 | Cover Consumer（DALL-E 3 + Pollinations 降级，Pillow 裁剪，MinIO 上传） | ✅ 已完成 |
| 14-02 | Weave API + Domain 更新（content_type="weave"，编织端点，LLM prompt） | ✅ 已完成 |
| 14-03 | 时间轴封面展示（MemoryCard 缩略图，响应式尺寸，标签 hash 降级） | ✅ 已完成 |
| 14-04 | 多选状态（Ctrl/Shift 点击，长按，浮动操作栏） | ✅ 已完成 |
| 14-05 | 编织页面与编辑器（/weave，模式选择，编辑，Markdown 导出） | ✅ 已完成 |
| 14-06 | Command Palette + ExplorePanel 集成（/weave 命令，编织按钮） | ✅ 已完成 |
| 14-07 | 端到端集成（cover 队列发布，构建验证，E2E 测试） | ✅ 已完成 |

---

## 3. 关键 Bug 修复记录（2026-05-09 ~ 05-11）

### 3.1 Weave 返回 "LLM API returned 401"

**现象**: 用户界面 LLM 配置测试连接成功，但 weave 生成报 401。

**根因链**:
1. **JWT Token 过期** → Gateway 直接返回 401（50µs，auth middleware 拦截），未到达 memory-service
2. **用户数据库 settings = {}** → memory-service 回退到环境变量 `OPENAI_API_KEY`，该 key 已失效
3. **memory-service 未解密 api_key** → `getUserLLMConfig` 直接从 DB 读取加密态的 api_key 传给 LLM，LLM 校验失败

**修复**:
- `memory-service/internal/service/memory_service.go:getUserLLMConfig` — 添加 `crypto.Decrypt()` 解密 api_key
- 若解密失败则 fallback 使用原值（兼容明文/旧数据）

```go
if settings.APIKey != "" {
    decrypted, err := crypto.Decrypt(settings.APIKey)
    if err == nil && decrypted != "" {
        config["api_key"] = decrypted
    } else {
        config["api_key"] = settings.APIKey
    }
}
```

### 3.2 AI 功能完全失效（tag/suggestion/file extraction/cover）

**现象**: 保存记忆后标签、建议、封面图全部不生成。

**根因**: `processor-service` 启动时崩溃 `ModuleNotFoundError: No module named 'PIL'`，因为 `openai_provider.py` 导入了 Pillow 但 `requirements.txt` 未包含。

**修复**:
- `services/processor-service/requirements.txt` — 添加 `Pillow>=10.0.0`
- 重启 processor-service 容器

### 3.3 Processor-Service 双解密 API Key

**现象**: 修复 Pillow 后，processor 消费者仍报 LLM 401。

**根因**: memory-service 在发布 Redis Stream 任务时已将 api_key 解密，但 processor-service 的 `_create_llm()` 仍尝试 `decrypt(encrypted_key)`，导致解密乱码。

**修复**: 所有 processor consumer（tag_consumer.py / suggestion_consumer.py / link_consumer.py）添加 try/except fallback：

```python
api_key = None
encrypted_key = fields.get("api_key")
if encrypted_key:
    try:
        api_key = decrypt(encrypted_key)
    except Exception:
        # Memory-service now decrypts before publishing; use as-is
        api_key = encrypted_key
```

### 3.4 Weave 时间轴不显示内容预览

**根因**: `memory-card.tsx` 的 `getPreviewContent()` 没有处理 `content_type === 'weave'`。

**修复**:
```typescript
if (memory.content_type === 'weave') {
  return memory.text_content || ''
}
```

### 3.5 导航栏 "记忆编织" 仍显示 "new" 星标

**修复**: `web/components/layout/Sidebar.tsx` — `isNew: true` → `isNew: false`

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
| 05-03 | LLM 协议传播 | 旧数据无 `llm_protocol` 字段 → processor `Unknown LLM protocol` | 上游兜底推断，下游严格校验，快速暴露 |
| 05-03 | 跨服务配置传播 | file_consumer 派生任务漏传 `include_note_in_analysis` | 派生任务需显式白名单传播所有相关配置字段 |
| **05-09** | **Python 依赖缺失** | **processor-service 缺 Pillow，所有 async 消费者无法启动** | **Python 服务新增依赖必须同步 requirements.txt + Dockerfile，启动后立即验证容器日志** |
| **05-09** | **API Key 解密链** | **user-service 加密 → memory-service 解密后传播 → processor 又解密一次** | **修改加密/解密逻辑时必须审计全链路：谁加密、谁解密、传播态是密文还是明文** |
| **05-09** | **JWT Token 过期** | ** weave 401 被误判为 LLM 401，因为 gateway 返回 401 太快（50µs）** | **区分 "Gateway 401"（认证层，<1ms）和 "LLM 401"（业务层，>100ms）— 看响应时间** |
| **05-09** | **Weave 预览遗漏** | **新增 content_type 时未同步更新 preview 逻辑** | **新增 content_type 必须检查：时间轴预览、搜索预览、分享预览、卡片渲染** |

---

## 5. 关键规则速查（P0 不可违反）

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

## 6. Docker 运维速查

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
| MinIO | `echoes-minio` |

**常用运维命令**:
```bash
./scripts/docker-ops.sh status          # 容器状态
./scripts/docker-ops.sh check           # 深度健康检查
./scripts/docker-ops.sh fix-all         # 一键修复
./scripts/dev-reload.sh gateway         # 重载 Gateway（不改不 rebuild）
./scripts/dev-reload.sh all             # 批量重载
```

**重要**: 开发环境修改代码只需 restart 容器，不需要 rebuild。只有改 Dockerfile/docker-compose.yml/依赖时才 rebuild。

**时区配置**: 所有服务容器已统一注入 `TZ=Asia/Shanghai`，日志时间均为北京时间。

---

## 7. 核心数据流速查

### LLM 配置优先全链路（已修复，2026-05-09）

```
前端设置面板
    ↓ POST /api/v1/users/settings
user-service（AES-256-GCM 加密 api_key）
    ↓ 存入 PostgreSQL users.settings (JSONB)
memory-service（读取时解密 api_key）
    ↓ 发布 Redis Stream 任务时注入 llm_* 字段（api_key 为明文）
processor-service（_create_llm() 中：先尝试解密，失败则用明文）
    ↓ LLMFactory.create(protocol, model, api_key...)
OpenAIProvider / AnthropicProvider
```

**优先级**: `fields["llm_protocol"]` > `fields["llm_provider"]` > `settings.llm_protocol` > `settings.llm_provider` > 环境变量。用户配置始终优先。

**注意**: memory-service 现在负责解密 api_key，processor-service 做双解密兼容（try decrypt → fallback plaintext）。未来应统一为：memory-service 解密传播，processor-service 直接使用。

### Redis Stream 消费者安全模式

- 消费者组创建：`id="$"`（只消费新消息，避免重启后重播历史）
- 消息处理失败：**必须 ack**，否则消息永久 pending 死循环
- Stream 自动 trim：`maxlen=5000`，防止无限增长
- 发布任务时也要带 `maxlen=5000`

---

## 8. 调试优先级

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

**LLM 401 分层诊断法：**
1. **响应时间 < 1ms** → Gateway JWT 认证失败（token 过期）→ 重新登录
2. **响应时间 10-100ms** → memory-service 层（api_key 未解密或 settings 为空）→ 检查 user settings + 解密逻辑
3. **响应时间 > 1s** → 实际 LLM API 返回 401（key 无效）→ 检查 api_key 有效性

---

## 9. 记忆文件索引

所有记忆存储于 `C:\Users\Yongbin\.claude\projects\d--xProjects-Vibe-Echoes\memory\`：

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
| `feedback_debug_workflow.md` | 调试经验教训 |
| `feedback_frontend_shadcn_tailwind.md` | 前端 shadcn/Tailwind/CSS 兼容性原则 |
| `feedback_llm_propagation.md` | LLM 配置传播链审计（新增） |
| `project_phase11_status.md` | Phase 11 当前状态 + 已修复问题 |
