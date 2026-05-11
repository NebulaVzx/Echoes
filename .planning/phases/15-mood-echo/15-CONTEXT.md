---
phase: 15
name: mood-echo
title: 情绪日历与每日回响
description: AI分析记忆情绪倾向生成可视化日历，并每日推送一条旧记忆让用户与过去重逢
milestone: v1.3 "记忆的回响"
depends_on: [14-memory-covers-weaving]
---

# Phase 15: 情绪与回响 - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning

## Phase Boundary

为记忆增加情感维度，让用户看见自己的情绪波动，每天收到一条温暖的旧记忆推送。

**In scope:**
- 记忆情绪分析（AI 分析每条记忆的情绪倾向）
- 情绪数据存储（独立表，支持模型演进）
- 情绪日历页面（`/mood`，GitHub contribution graph 风格热力图）
- 年视图 / 月视图 / 主题视图
- AI 月度情绪洞察总结
- 每日记忆回响（扩展 DailyReview，混合策略选择记忆，AI 生成回响语）
- 回响风格偏好设置（温暖/幽默/简洁/洞察）

**Out of scope:**
- Web Push / 邮件主动推送（纯被动展示，v1.4+ 再评估）
- 情绪历史页面（不存储回响历史，每次新鲜体验）
- 系统级日历集成（iCal/Outlook，v1.5+）
- 移动端 widget（需要原生开发）

---

## Implementation Decisions

### 情绪分析时机与范围（D-01 ~ D-04）

- **D-01:** 保存记忆时实时分析（新记忆）+ 已有记忆全量批量回溯
- **D-02:** 回溯范围：全量（当前数据量小，未来需考虑可扩展性——新增用户可采用最近 N 条策略）
- **D-03:** 分析全部 content_type：text / link / file / weave（链接用 og:title+摘要，文件用提取文本，编织用 text_content）
- **D-04:** 复用 Redis Stream 模式：新增 `mood:generate` 队列 + `mood_consumer.py`，与现有 tag/link/suggestion/cover consumers 并列

### 情绪数据存储模型（D-05 ~ D-08）

- **D-05:** 独立 `memory_emotions` 表：`memory_id` + `sentiment` (varchar: positive/neutral/negative) + `score` (int 1-10) + `analyzed_at` + `model_version`
- **D-06:** 情绪粒度：三分类 + 强度（positive/neutral/negative + 1-10）
- **D-07:** 日历聚合策略：某天有多条记忆时，使用加权平均值（positive=+1, neutral=0, negative=-1）
- **D-08:** 支持重新分析：保留 `model_version` 历史，新模型可生成新记录覆盖展示

### 每日回响与已有功能的关系（D-09 ~ D-12）

- **D-09:** 扩展 DailyReview：复用现有 `/memories/daily-review` 端点，在返回中添加回响语字段
- **D-10:** 记忆来源：混合策略（那年今日 60% + 随机 40%）
- **D-11:** 回响语实时生成：用户打开 DailyReview 时调用 LLM，每次新鲜体验
- **D-12:** 不存储回响历史：不持久化回响语，每次打开重新生成

### 推送触发机制（D-13 ~ D-16）

- **D-13:** 不需要主动推送：纯被动展示，用户打开页面时才看到
- **D-14:** DailyReview 卡片默认折叠，点击展开；localStorage 记住用户展开/折叠偏好
- **D-15:** 回响风格多种可选：温暖安慰型 / 幽默调侃型 / 简洁洞察型 / 等，用户在设置中选择
- **D-16:** 情绪日历独立页面 `/mood`，不在首页展示

### Claude's Discretion

- 情绪分析 LLM prompt 模板设计（由 planner/researcher 具体设计）
- 情绪日历热力图组件选型（由 planner 评估 react-calendar-heatmap 等库）
- 批量回溯任务的分片和进度跟踪实现细节
- DailyReview 卡片扩展的 UI 细节

---

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求与边界
- `.planning/ROADMAP.md` §Phase 15 — Phase goal and scope
- `CLAUDE.md` §Technology Stack — 技术栈和架构模式
- `CLAUDE.md` §Async Task Flow — Redis Stream 消费者模式

### 后端集成点
- `services/memory-service/internal/transport/memory_handler.go` — DailyReview 端点（`GET /memories/daily-review`，需扩展）
- `services/memory-service/internal/service/memory_service.go` — `GetDailyReview` 实现
- `services/memory-service/internal/repository/memory_repository.go` — 记忆查询方法
- `services/processor-service/app/consumers/` — 现有消费者模式（file/link/suggestion/tag/cover）
- `services/processor-service/app/services/llm/` — LLM Provider 工厂模式
- `services/processor-service/app/consumers/base.py` — Redis Stream Consumer 基类
- `shared/migrations/` — 数据库迁移目录

### 前端集成点
- `web/app/(main)/page.tsx` — 首页（DailyReview 卡片位置）
- `web/lib/api.ts` — API 客户端模式
- `web/components/memory/` — 记忆相关组件

### 已有 Phase 上下文
- `.planning/phases/13-memory-constellation/13-CONTEXT.md` — `memory_relations` 缓存表模式可参考
- `.planning/phases/14-memory-covers-weaving/14-CONTEXT.md` — 异步消费者模式（cover_consumer）

---

## Existing Code Insights

### Reusable Assets
- **LLM Provider 工厂** (`processor-service/app/services/llm/`): 新增情绪分析 prompt，复用现有 Provider
- **Redis Stream Consumer 基类** (`processor-service/app/consumers/base.py`): 新增 `MoodConsumer` 继承基类
- **DailyReview API** (`services/memory-service/internal/transport/memory_handler.go`): `GET /memories/daily-review` 已存在，扩展添加回响语字段
- **Memory Repository** (`services/memory-service/internal/repository/memory_repository.go`): 复用查询方法获取那年今日记忆
- **Tag Hash 颜色** (`web/components/constellation/`): 情绪日历热力图着色可参考

### Established Patterns
- **异步任务流**: 保存 → 发布 Redis Stream → Consumer 处理 → 回写数据库。情绪分析完全遵循此模式。
- **消费者模式**: processor-service 中每个 consumer 独立文件，继承 BaseConsumer，处理特定 queue。
- **API 响应封装**: 后端使用 `ApiResponse<T>` 封装，前端使用 `api.ts` 中的 `SafeResponse()`。
- **数据库迁移**: 新表通过 `shared/migrations/` 添加，命名格式 `00X_description.sql`。

### Integration Points
- **新增 Redis Stream queue**: `mood:generate`
- **新增 processor-service consumer**: `mood_consumer.py`
- **新增 memory-service API**: `GET /mood/calendar`（情绪日历数据）
- **扩展 memory-service API**: `GET /memories/daily-review`（添加回响语字段）
- **新增前端页面**: `/mood`（情绪日历）
- **新增数据库表**: `memory_emotions`（参考 Phase 13 的 `memory_relations` 表模式）

---

## Specific Ideas

- 情绪日历的热力图颜色参考 GitHub contribution graph：浅绿→深绿（positive），灰色（neutral），浅红→深红（negative）
- 批量回溯任务可考虑分页处理（每批 50 条），通过 Redis Stream 的 consumer group 实现并行
- 回响语 prompt 中可注入用户选择的风格偏好和当天选中的记忆内容
- 情绪分析 prompt 应要求 LLM 同时输出分类和强度，并给出简短理由（便于 debug）

---

## Deferred Ideas

- **Web Push 主动推送** — 需要 Service Worker + Web Push API + VAPID 密钥，v1.4+ 评估
- **邮件推送** — 需要邮件服务集成（Resend/SendGrid），v1.4+ 评估
- **情绪历史页面** — 用户反馈需要时再实现（当前不存储历史回响）
- **系统级日历集成** — iCal/Outlook 同步情绪事件，v1.5+ 考虑
- **移动端 widget** — iOS/Android 桌面小组件，需要原生开发（Expo 阶段）

---

*Phase: 15-mood-echo*
*Context gathered: 2026-05-11*
