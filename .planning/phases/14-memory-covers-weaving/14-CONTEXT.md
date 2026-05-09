---
phase: 14
name: memory-covers-weaving
title: 记忆封面与AI编织
description: 为每条记忆自动生成视觉封面图，并支持将多条记忆AI编织成连贯文章
milestone: v1.3 "记忆的回响"
depends_on: [13-memory-constellation]
---

# Phase 14 Context

**Gathered:** 2026-05-09
**Status:** Ready for planning

## Phase Boundary

让时间轴从"文本列表"升级为"视觉杂志墙"，并提供知识整理工具（记忆编织）。

**In scope:**
- 记忆封面生成（文本/链接/文件三种类型）
- 封面存储（MinIO）和展示（时间轴卡片左侧缩略图）
- 多选记忆交互（桌面端 Ctrl+点击，移动端长按选择模式）
- AI 记忆编织（article/story/summary/todo 四种模式）
- 编织结果保存为新的 memory（content_type="weave"）
- 编织文章可编辑、可导出 Markdown

**Out of scope:**
- 桌面端直接导出到 Obsidian/Notion 本地库（v1.4+）
- 移动端离线编织（依赖 Service Worker，和 PWA 一起实现）
- 封面手动上传/替换

---

## Implementation Decisions

### 封面生成服务（D-01）
- **D-01-01:** DALL-E 3 作为封面生成主服务，通过现有 OpenAI Provider 调用
- **D-01-02:** Pollinations.AI 作为开发环境降级选项（避免消耗 API 额度）
- **D-01-03:** 图片尺寸 1024x1024（DALL-E 3 最小尺寸），后端裁剪为 4:3（400x300）后上传 MinIO

### 封面生成时机与流程（D-02）
- **D-02-01:** 保存记忆时异步入队，Redis Stream 队列名为 `cover:generate`
- **D-02-02:** processor-service 新增 `cover_consumer.py`，与现有 file/link/tag/suggestion consumers 并列
- **D-02-03:** 文本类型：提取标题+前 200 字摘要 → 生成英文 prompt → 调用 DALL-E 3
- **D-02-04:** 链接类型：先抓取 og:image，失败则降级为文本生成
- **D-02-05:** 文件类型：提取首段文字 → 同文本类型生成
- **D-02-06:** 生成完成后通过 API 回写 `memories.cover_url`
- **D-02-07:** 任何失败都优雅降级：前端显示"纯色背景 + 首字母图标"（无需等待后端）

### 时间轴布局变化（D-03）
- **D-03-01:** 保持单列列表布局，卡片左侧添加缩略图
- **D-03-02:** 桌面端缩略图 120x90，平板端 100x75，移动端 80x60
- **D-03-03:** 无封面时显示渐变背景色 + 首字母图标（颜色根据标签 hash 计算，与星图节点颜色一致）
- **D-03-04:** 移动端提供"显示封面/隐藏封面"设置项（默认显示）

### 多选交互与编织入口（D-04）
- **D-04-01:** 桌面端：Ctrl/Cmd + 点击卡片切换选中，Shift + 点击连续选择
- **D-04-02:** 移动端：长按卡片 500ms 进入选择模式，底部出现操作栏
- **D-04-03:** 选中后顶部出现浮动操作栏（"编织文章" | "取消"）
- **D-04-04:** 编织入口：时间轴多选操作栏 + Command Palette（`/weave`）
- **D-04-05:** 星图页面 ExplorePanel 中可选中节点后添加"编织选中记忆"按钮
- **D-04-06:** 编织完成后跳转到 `/weave/{id}` 编辑页面

### 编织内容持久化（D-05）
- **D-05-01:** 编织结果保存为新的 memory，content_type="weave"
- **D-05-02:** 编织 memory 的 metadata 中包含 `weave_source_ids: string[]`（来源记忆 ID 列表）
- **D-05-03:** 编织文章使用 `[^1]`、`[^2]` 格式标注来源，底部自动附加来源列表
- **D-05-04:** 编织文章可编辑（复用现有 memory 编辑页面或新建 `/weave/{id}/edit`）
- **D-05-05:** 导出格式：Markdown（`.md` 文件下载）

### Claude's Discretion
- 封面生成 prompt 模板设计（由 planner/researcher 具体设计）
- 编织四种模式的具体 prompt 设计（由 planner/researcher 具体设计）
- 多选状态管理的具体实现方式（React Context vs useState lifting）
- 编织编辑页面的具体 UI 设计（复用现有编辑器 vs 新建）

---

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & Existing Patterns
- `.planning/ROADMAP.md` §Phase 14 — Phase goal and scope
- `CLAUDE.md` §Technology Stack — 技术栈和架构模式
- `CLAUDE.md` §Async Task Flow — Redis Stream 消费者模式

### Backend Integration Points
- `services/memory-service/internal/domain/memory.go` — Memory 模型（已含 CoverURL 字段）
- `services/memory-service/internal/service/memory_service.go` — MinIOClient 和 TaskQueue 注入
- `services/processor-service/app/consumers/` — 现有消费者模式（file/link/suggestion/tag）
- `services/processor-service/app/services/llm/` — LLM Provider 工厂模式
- `shared/migrations/004_file_upload.sql` — cover_url 字段已添加

### Frontend Integration Points
- `web/components/memory/memory-card.tsx` — 记忆卡片组件（需添加封面图展示）
- `web/app/(main)/page.tsx` — 时间轴页面（需添加多选状态和操作栏）
- `web/components/layout/CommandPalette.tsx` — Command Palette（需添加编织入口）
- `web/components/constellation/ExplorePanel.tsx` — 探索面板（可选编织入口）

### Storage
- `docker-compose.yml` §MinIO — 对象存储配置

---

## Existing Code Insights

### Reusable Assets
- **LLM Provider 工厂** (`processor-service/app/services/llm/`): 新增 image generation prompt，复用 `openai_provider.py` 的 `images.generate` 接口
- **Redis Stream Consumer 基类** (`processor-service/app/consumers/base.py`): 新增 `CoverConsumer` 继承基类
- **MinIO Client** (`memory-service/internal/service/memory_service.go`): 复用现有 client 上传封面图
- **MemoryCard 组件** (`web/components/memory/memory-card.tsx`): 在 Header 区域左侧添加封面缩略图
- **Tag Hash 颜色** (`web/components/constellation/` 中的 `getTagColor`): 复用于封面降级时的背景色

### Established Patterns
- **异步任务流**: 保存 → 发布 Redis Stream → Consumer 处理 → 回写数据库。封面生成完全遵循此模式。
- **消费者模式**: processor-service 中每个 consumer 独立文件，继承 BaseConsumer，处理特定 queue。
- **API 响应封装**: 后端使用 `ApiResponse<T>` 封装，前端使用 `api.ts` 中的 `SafeResponse()`。

### Integration Points
- **新增 Redis Stream queue**: `cover:generate`
- **新增 processor-service consumer**: `cover_consumer.py`
- **新增 memory-service handler endpoint**: `POST /api/v1/memories/:id/cover`（可选，用于手动触发）
- **新增前端组件**: `MemoryCard` 添加封面展示，`Timeline` 添加多选状态
- **新增路由**: `/weave/:id`（编织结果查看/编辑）

---

## Specific Ideas

- 封面降级时的首字母图标颜色应与星图节点颜色一致（标签 hash），形成视觉统一
- 编织文章编辑器可采用"双栏模式"：左侧编辑区，右侧来源记忆预览
- 编织模式中的 "todo" 模式可生成可勾选的任务清单（复用现有 todo 模板）

---

## Deferred Ideas

None — discussion stayed within phase scope

---

*Phase: 14-memory-covers-weaving*
*Context gathered: 2026-05-09*
