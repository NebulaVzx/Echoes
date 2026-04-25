---
name: Phase 8 Context
description: AI 陪伴建议 - Context for research and planning
type: context
---

# Phase 8: AI 陪伴建议 - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

保存记忆后，系统异步调用 LLM 生成温情/建设性的 AI 反馈建议，持久化保存并与记忆关联。
用户可选择开启/关闭此功能（默认关闭）。建议根据内容类型（text/link）采用不同策略。

### 在范围内
- 创建表单中的 AI 建议开关（默认关闭，状态持久化）
- 保存记忆后异步生成 AI 建议
- 建议持久化到数据库
- 建议在创建表单、记忆详情页、记忆卡片三处展示
- 文字/链接的不同建议策略
- 用户对建议的反馈（采纳/忽略）
- 失败静默降级

### 不在范围内
- 实时输入建议（打字时的即时建议）
- 标签/摘要生成（已有 Processor 负责）
- 多轮建议对话
- 建议的社交分享

</domain>

<decisions>
## Implementation Decisions

### 1. 数据存储方式 — 新增独立表 `ai_suggestions`

**D-01: 独立表设计**
- 表名：`ai_suggestions`
- 与 `memories` 一对一关系（`memory_id` 外键 + ON DELETE CASCADE）
- 字段：id, memory_id, content, suggestion_type, created_at, user_feedback, metadata(JSONB)
- 理由：2025 年 AI Companion 最佳实践推荐分层存储结构；独立表可记录用户反馈和生成元数据，不影响 memories 表查询性能，未来可扩展为每条记忆多条建议

```sql
CREATE TABLE ai_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    suggestion_type VARCHAR(20),      -- emotion_support, knowledge_expand, action_suggest, connection
    created_at TIMESTAMP DEFAULT NOW(),
    user_feedback VARCHAR(20),        -- liked, disliked, ignored, null
    metadata JSONB                    -- model, temperature, tokens, latency
);
CREATE INDEX idx_ai_suggestions_memory_id ON ai_suggestions(memory_id);
```

### 2. 生成时机与通知机制 — 异步生成 + 前端轮询

**D-02: 复用现有 Redis Stream + Processor 架构**
- 保存流程：
  1. `POST /api/v1/memories` → Memory Service 保存记忆
  2. 如果用户开启 AI 建议，Memory Service 发布 `suggestion:generate` 到 Redis Stream
  3. Processor Service 消费任务，调用 LLM 生成建议
  4. Processor 将建议写入 `ai_suggestions` 表（通过 Memory Service 内部 API）
- 前端轮询：`GET /api/v1/memories/:id/suggestion` 每 2 秒，最多 15 秒
- 超时后放弃，用户手动刷新或下次访问时可见

**D-03: 保存 API 响应格式**
```json
{
  "success": true,
  "data": {
    "memory": { ... },
    "suggestion_status": "pending"   // pending | completed | skipped
  }
}
```

### 3. 建议展示位置 — 三层展示策略

**D-04: 创建表单即时展示（核心触点）**
- 保存成功后，在表单下方展示建议卡片（Framer Motion fade-in，300ms）
- 这是情感连接最强的时刻，用户刚完成创作，对新反馈最开放
- 卡片样式：柔和背景（gray-50），带 ✨ 图标，建议文本，快捷操作（💾 收藏 / 👎 不用了）

**D-05: 记忆详情页完整展示**
- 详情页底部展示完整建议，带快捷操作和生成时间
- 用户可点击「收藏这条建议」或「告诉 AI 这条建议没用」

**D-06: 记忆卡片标记**
- 时间轴卡片右上角显示 subtle 的 ✨ 图标（仅当建议存在时）
- hover 时 tooltip 显示建议前 30 字预览
- 不占用卡片主要内容空间

### 4. Prompt 工程策略 — 双 Prompt + 用户偏好风格

**D-07: 模块化 Prompt 架构（基于 CHI 2025 研究）**
- 分为两个 Prompt 模板：`text_suggestion` 和 `link_suggestion`
- 每个 Prompt 包含：Persona + Task Instruction + Content Context + Output Template

**D-08: 文字内容 Prompt 设计原则**
- 语气：温暖、理解、不矫情，多用问句和邀请式语言
- 长度限制：50-150 字（简短有力，不喧宾夺主）
- 策略：
  - 情绪支持：检测到负面词汇 → 安慰 +  gentle 引导
  - 思考引导：检测到问题/困惑 → 提供思考角度
  - 知识拓展：检测到学习笔记 → 关联已有记忆
  - 灵感催化：检测到创意 → 建议时间胶囊或后续行动

**D-09: 链接内容 Prompt 设计原则**
- 语气：知识型、洞察型
- 策略：
  - 技术文章 → 关联已有笔记，建议专题
  - 新闻资讯 → 背景关联，发现趋势
  - 教程课程 → 预估时间，优先级建议
  - 设计灵感 → 趋势发现，风格对比

**D-10: 用户偏好风格设置**
- 在 Settings 页面新增「AI 建议风格」选项：
  - 🫂 温柔型（情绪支持为主）
  - 🧠 实用型（知识拓展、行动建议为主）
  - 💡 启发型（灵感催化、连接发现为主）
- 默认：启发型（平衡）
- 存储在 `users.settings` JSONB 中

### 5. 失败与降级 — 静默处理 + 内部监控

**D-11: 生成保证原则 — 只要开关开启，每条记忆必须有建议**
- **不跳过任何内容**：无论内容长短（哪怕只有 1 个字），都生成建议
- **超时后自动重试**：首次超时（默认 30 秒）→ 自动重试，最多 3 次，指数退避（1s / 2s / 4s）
- **重试全部失败后**：标记为 `suggestion_status: "failed"`，但用户侧仍显示「AI 暂时没想好，稍后再来看看吧~」而非空白
- **永不静默忽略**：前端始终有展示区域，只是内容可能是占位文案或实际建议

**D-12: 用户可配置阈值（Settings 页面）**
- `ai_suggestion_timeout`: 单次生成超时时间（10-60 秒，默认 30 秒）
- `ai_suggestion_max_retries`: 最大重试次数（1-5 次，默认 3 次）
- 存储在 `users.settings` JSONB 中
- 高级选项默认折叠，普通用户不感知

**D-13: 内部监控**
- 失败时记录结构化日志（Zap）：memory_id, error, model, latency, retry_count
- 定期查看失败率，用于优化 Prompt 或模型配置

### 6. 用户反馈机制

**D-13: 快捷反馈**
- 每条建议展示两个快捷操作：👍 有用 / 👎 没用
- 点击后更新 `ai_suggestions.user_feedback` 字段
- 未来可用于个性化优化（v1.3+）

**D-14: 反馈不立即影响当前建议**
- 当前版本仅记录反馈，不实时调整建议生成
- 避免过度复杂的反馈循环，保持功能简洁

### Claude's Discretion
- 建议卡片的具体视觉设计（圆角、阴影、动画细节）
- 轮询间隔和超时阈值（可在 1-3 秒 / 10-30 秒范围内微调）
- 具体 Prompt 文本内容（需要测试调优）
- 建议类型（suggestion_type）的具体分类方式

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 产品需求
- `.planning/REQUIREMENTS.md` — v1.2 需求规格（FEAT-01 ~ FEAT-08）
- `.planning/ROADMAP.md` — Phase 8 目标与成功标准
- `.planning/PROJECT.md` — 项目上下文与技术栈

### 现有代码（复用资产）
- `services/processor-service/app/services/llm/` — LLM Provider 抽象层（OpenAI/Anthropic/DeepSeek/Kimi/通义千问/智谱/豆包）
- `services/memory-service/internal/service/redis_queue.go` — Redis Stream 发布实现
- `services/memory-service/internal/domain/memory.go` — Memory 领域模型
- `services/processor-service/app/consumers/` — 现有消费者模式（tag_consumer, link_consumer）
- `web/components/memory/create-memory-form.tsx` — 创建表单（需添加 AI 建议开关和展示区域）
- `web/components/memory/memory-card.tsx` — 记忆卡片（需添加 ✨ 标记）
- `web/lib/api.ts` — 前端 API 客户端（需新增 suggestion 相关接口）

### 数据库
- `shared/migrations/001_init.sql` — 现有 Schema（参考添加新表）

### 架构文档
- `CLAUDE.md` — 开发指南与命令速查
- `PRD.md` — 完整产品需求与 API 定义

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **LLM Provider 抽象层** (`services/processor-service/app/services/llm/`):
  - 已支持 7 个提供商，工厂模式创建实例
  - `base.py` 定义 `generate()` 接口，可直接复用于建议生成
  - 需传入用户选择的 provider/model/temperature（从 users.settings 读取）
- **Redis Stream 发布** (`services/memory-service/internal/service/redis_queue.go`):
  - 已有 `PublishLinkFetch` / `PublishTextVectorize` / `PublishTagGenerate`
  - 可新增 `PublishSuggestionGenerate` 方法
- **Processor 消费者** (`services/processor-service/app/consumers/`):
  - `tag_consumer.py` 和 `link_consumer.py` 提供了消费者模式参考
  - 可新增 `suggestion_consumer.py`
- **创建表单** (`web/components/memory/create-memory-form.tsx`):
  - 已有标签输入、备注输入、提交按钮
  - 可在备注输入框和提交按钮之间添加 AI 建议 toggle 开关
- **用户设置系统** (`services/user-service/internal/domain/auth.go`):
  - 已有 `users.settings` JSONB 字段存储用户偏好
  - 可新增 `ai_suggestion_enabled` 和 `ai_suggestion_style` 字段

### Established Patterns
- **异步任务流**: Memory Service 发布 → Redis Stream → Processor 消费 → 更新数据库
- **状态管理**: 前端 React Context（AuthProvider），API 请求通过 ApiClient
- **加载状态**: Skeleton 组件 + `isLoading` 状态
- **动画**: Framer Motion（fade-in, slide），建议卡片可用同样风格
- **错误处理**: 后端统一 ErrorResponse 格式，前端 Toast 提示（但建议生成失败静默处理，不 Toast）

### Integration Points
- **Gateway 路由**: 新增 `/api/v1/memories/:id/suggestion` 路由
- **Memory Service**: 新增 suggestion 相关 handler + service + repository
- **Processor Service**: 新增 `suggestion_consumer.py` + suggestion 生成逻辑
- **前端**: 创建表单、记忆卡片、记忆详情页三处接入

</code_context>

<specifics>
## Specific Ideas

### 建议卡片即时展示动画
保存成功后，建议卡片从表单下方以 fade-in + slight translate-y 动画出现：
```
[保存记忆按钮]
↓ 500ms 后
┌─────────────────────────────────┐
│ ✨ AI 说                          │
│                                 │
│  这段文字有点沉重呢，要不要        │
│  顺便记一件今天值得感恩的小事？   │
│                                 │
│  [💾 收藏]  [👎 不用了]          │
└─────────────────────────────────┘
```

### 链接建议示例
用户保存了一篇 React 文章：
> "这篇讲 React Server Components，你之前也存过 3 篇 React 相关的笔记，要不要建一个 React 学习专题？"

### 文字建议示例
用户写了一段加班很累的话：
> "今天很辛苦呢。要不要顺便记一件今天让你微笑的小事？哪怕是咖啡很好喝也可以 ✨"

</specifics>

<deferred>
## Deferred Ideas

- **多轮建议对话** — 用户与建议互动后，AI 可继续追问/拓展（v1.3+）
- **建议的情感分析时间线** — 分析用户所有建议的情绪倾向，生成情绪趋势图（v1.3+）
- **基于反馈的个性化优化** — 根据用户点赞/点踩调整 Prompt（v1.3+）
- **建议的社交分享** — 把有趣的建议分享出去（v1.4+）
- **实时输入建议** — 打字时实时生成建议（Phase 8 明确不做）

## Reviewed Todos (not folded)
- 无
</deferred>

---

*Phase: 08-ai-companion-suggestions*
*Context gathered: 2026-04-25*
