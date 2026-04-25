---
phase: 08-ai-companion-suggestions
verified: 2026-04-25T12:00:00Z
status: gaps_found
score: 10/12 must-haves verified
overrides_applied: 0
overrides: []
gaps:
  - truth: "RetryTask handler supports suggestion:generate task type for manual retry of failed suggestion generation"
    status: failed
    reason: "RetryTask validTypes map in both memory_handler.go and memory_service.go is missing 'suggestion:generate'. Attempting to retry a failed suggestion generation via the internal API will return 'Invalid task_type' error."
    artifacts:
      - path: "services/memory-service/internal/transport/memory_handler.go"
        issue: "validTypes map at line 305 only includes link:fetch, text:vectorize, tag:generate — missing suggestion:generate"
      - path: "services/memory-service/internal/service/memory_service.go"
        issue: "validTypes map at line 521 only includes link:fetch, text:vectorize, tag:generate — missing suggestion:generate"
    missing:
      - "Add 'suggestion:generate': true to validTypes map in memory_handler.go RetryTask handler"
      - "Add 'suggestion:generate': true to validTypes map in memory_service.go RetryTask method"
      - "Add case 'suggestion:generate' in memory_service.go RetryTask switch to build publish data (memory_id, content_type, content, style, note, link_title, link_summary, llmConfig)"
  - truth: "User-configurable timeout and max_retries settings are consumed by the Processor Service suggestion consumer"
    status: failed
    reason: "The SuggestionConsumer hardcodes max_retries=3 in its constructor and does not read ai_suggestion_timeout or ai_suggestion_max_retries from user settings. The settings are stored in users.settings JSONB but never passed through the Redis Stream message or read by the consumer."
    artifacts:
      - path: "services/processor-service/app/consumers/suggestion_consumer.py"
        issue: "max_retries=3 hardcoded in __init__; no reading of timeout or max_retries from message fields or user settings"
      - path: "services/memory-service/internal/service/redis_queue.go"
        issue: "PublishSuggestionGenerate does not include timeout or max_retries in published message fields"
    missing:
      - "Pass ai_suggestion_timeout and ai_suggestion_max_retries from user settings into the Redis Stream message in PublishSuggestionGenerate"
      - "Read timeout and max_retries from message fields in SuggestionConsumer and use them instead of hardcoded values"
      - "Pass timeout to llm.generate_suggestion() call and use max_retries for the consumer's retry logic"
---

# Phase 8: AI 陪伴建议 Verification Report

**Phase Goal:** 保存记忆后异步生成温情/建设性的 AI 反馈建议，持久化保存并与记忆关联。用户可选择开启/关闭此功能（默认关闭）。建议根据内容类型（text/link）采用不同策略。

**Verified:** 2026-04-25

**Status:** gaps_found

**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                 | Status     | Evidence |
| --- | --------------------------------------------------------------------- | ---------- | -------- |
| 1   | 数据库存在 ai_suggestions 表，包含所有必要字段和索引                    | VERIFIED   | `shared/migrations/002_ai_suggestions.sql` 存在，6 列 + ON DELETE CASCADE + 索引 |
| 2   | Memory Service 领域模型包含 AISuggestion 结构体和验证标签               | VERIFIED   | `services/memory-service/internal/domain/memory.go` 有 AISuggestion、CreateSuggestionRequest、UpdateSuggestionFeedbackRequest、SuggestionResponse |
| 3   | TaskStatusUpdate 包含 suggestion:generate 有效任务类型                  | VERIFIED   | `domain/memory.go:150` binding 包含 suggestion:generate |
| 4   | User Settings 包含 4 个 AI 配置字段（启用、风格、超时、重试）            | VERIFIED   | `services/user-service/internal/domain/auth.go` 有 AISuggestionEnabled/Style/Timeout/MaxRetries |
| 5   | 前端 API 类型完整（AISuggestion、AISettings、CreateMemoryResponse）     | VERIFIED   | `web/lib/api.ts` 有所有类型定义 |
| 6   | Memory Service 建议仓库实现 CRUD 操作                                   | VERIFIED   | `suggestion_repository.go` 有 Create/GetByMemoryID/UpdateFeedback/DeleteByMemoryID |
| 7   | Redis Stream 发布 suggestion:generate 任务                             | VERIFIED   | `redis_queue.go:85` PublishSuggestionGenerate 方法存在 |
| 8   | Memory Service Create 返回 suggestion_status                           | VERIFIED   | `memory_service.go` Create 返回 (*Memory, string, error)，handler 返回 {memory, suggestion_status} |
| 9   | Processor Service 消费者生成建议并持久化                                | VERIFIED   | `suggestion_consumer.py` 有完整 process_message 流程：构建提示、调用 LLM、分类、持久化 |
| 10  | 前端创建表单有 AI 开关，保存后显示建议卡片                               | VERIFIED   | `create-memory-form.tsx` 有 enableAISuggestion 开关和 AISuggestionCard 渲染 |
| 11  | 记忆卡片显示 Sparkles 图标，hover 显示建议预览                           | VERIFIED   | `memory-card.tsx` 有 hasSuggestion 状态、Sparkles 图标、CSS group-hover tooltip |
| 12  | 记忆详情页显示完整建议，支持反馈操作                                     | VERIFIED   | `suggestion-detail-section.tsx` 有完整 UI，feedback 按钮调用 updateSuggestionFeedback |
| 13  | 设置页有 AI 建议配置（风格、超时、重试）                                 | VERIFIED   | `settings/page.tsx` 有 4 个 AI 字段、风格选择、高级选项折叠 |
| 14  | Gateway 路由覆盖建议端点                                                 | VERIFIED   | `router.go` 使用 `/memories/*path` 通配代理，自动覆盖所有建议端点 |
| 15  | RetryTask 支持 suggestion:generate 任务类型重试                          | FAILED     | `memory_handler.go:305` 和 `memory_service.go:521` validTypes 缺少 suggestion:generate |
| 16  | Processor Service 使用用户配置的超时和重试次数                            | FAILED     | `suggestion_consumer.py` 硬编码 max_retries=3，不读取 timeout 或 max_retries |

**Score:** 14/16 truths verified (87.5%)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `shared/migrations/002_ai_suggestions.sql` | ai_suggestions 表定义 | VERIFIED | 6 列、索引、CASCADE、注释完整 |
| `services/memory-service/internal/domain/memory.go` | 领域模型扩展 | VERIFIED | AISuggestion + 请求/响应结构体 + TaskType 扩展 |
| `services/user-service/internal/domain/auth.go` | 用户设置扩展 | VERIFIED | 4 个 AI 字段 + AISettings 结构体 |
| `services/memory-service/internal/repository/suggestion_repository.go` | 建议仓库 | VERIFIED | 接口 + GORM 实现，4 个方法 |
| `services/memory-service/internal/service/redis_queue.go` | Redis 发布 | VERIFIED | PublishSuggestionGenerate 方法 |
| `services/memory-service/internal/service/memory_service.go` | 服务逻辑 | VERIFIED | 创建/获取/更新建议 + getUserSuggestionStyle |
| `services/memory-service/internal/transport/memory_handler.go` | HTTP 处理器 | VERIFIED | 3 个新端点 + Create 返回 suggestion_status |
| `services/memory-service/cmd/main.go` | 依赖注入 | VERIFIED | suggestionRepo 注入 NewMemoryService |
| `services/processor-service/app/services/llm/prompts/suggestion_prompts.py` | 提示模板 | VERIFIED | 3 个风格 + 文本/链接提示 + 分类函数 |
| `services/processor-service/app/services/llm/base.py` | LLM 基类扩展 | VERIFIED | generate_suggestion 抽象方法 |
| `services/processor-service/app/services/llm/openai_provider.py` | OpenAI 实现 | VERIFIED | generate_suggestion 委托 generate，temp=0.8 |
| `services/processor-service/app/services/llm/anthropic_provider.py` | Anthropic 实现 | VERIFIED | generate_suggestion 委托 generate，temp=0.8 |
| `services/processor-service/app/clients/memory_client.py` | 内存客户端扩展 | VERIFIED | create_suggestion 方法 POST 内部 API |
| `services/processor-service/app/consumers/suggestion_consumer.py` | 建议消费者 | VERIFIED | 完整流程，继承重试机制 |
| `services/processor-service/app/config.py` | 配置扩展 | VERIFIED | enable_suggestion_consumer 设置 |
| `services/processor-service/app/main.py` | 消费者启动 | VERIFIED | SuggestionConsumer 导入和启动 |
| `web/lib/api.ts` | API 客户端扩展 | VERIFIED | getSuggestion、updateSuggestionFeedback、CreateMemoryResponse |
| `web/components/memory/ai-suggestion-card.tsx` | 建议卡片 | VERIFIED | 轮询、反馈、动画、可关闭 |
| `web/components/memory/create-memory-form.tsx` | 创建表单增强 | VERIFIED | AI 开关、enable_ai_suggestion 载荷、建议卡片渲染 |
| `web/app/(main)/settings/page.tsx` | 设置页 AI 部分 | VERIFIED | 4 字段、风格选择、高级选项折叠 |
| `web/components/memory/memory-card.tsx` | 记忆卡片增强 | VERIFIED | Sparkles 图标、tooltip、挂载时获取 |
| `web/components/memory/suggestion-detail-section.tsx` | 详情页建议区 | VERIFIED | 骨架屏、内容、类型标签、反馈按钮 |
| `web/app/(main)/memory/[id]/page.tsx` | 详情页集成 | VERIFIED | SuggestionDetailSection 导入和渲染 |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| Create Form | Memory Service POST /memories | api.createMemory | WIRED | enable_ai_suggestion 包含在载荷中 |
| Memory Service Create | Redis Stream | PublishSuggestionGenerate | WIRED | 条件：req.EnableAISuggestion == true |
| Processor Consumer | LLM | llm.generate_suggestion() | WIRED | 温度 0.8，max_tokens=200 |
| Processor Consumer | Memory Service 内部 API | memory_client.create_suggestion() | WIRED | POST /internal/memories/:id/suggestion |
| Memory Card | Memory Service | api.getSuggestion(memory.id) | WIRED | 挂载时获取，控制 Sparkles 显示 |
| Detail Page | Memory Service | api.getSuggestion(memoryId) | WIRED | SuggestionDetailSection 内调用 |
| Feedback Buttons | Memory Service | api.updateSuggestionFeedback() | WIRED | PATCH /memories/:id/suggestion/feedback |
| Settings Page | User Service | api.updateSettings({ ai: {...} }) | WIRED | 4 个 AI 字段保存到 users.settings |
| Gateway | Memory Service | 反向代理 /memories/*path | WIRED | 通配代理自动覆盖建议端点 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| memory-card.tsx | hasSuggestion, suggestionPreview | api.getSuggestion(memory.id) | API 查询 ai_suggestions 表 | FLOWING |
| ai-suggestion-card.tsx | suggestion, isLoading | api.getSuggestion(memoryId) 轮询 | API 查询 ai_suggestions 表 | FLOWING |
| suggestion-detail-section.tsx | suggestion, feedback | api.getSuggestion(memoryId) | API 查询 ai_suggestions 表 | FLOWING |
| create-memory-form.tsx | lastCreatedMemory | api.createMemory() | 返回 {memory, suggestion_status} | FLOWING |
| suggestion_consumer.py | suggestion_text | llm.generate_suggestion(prompt) | 调用 OpenAI/Anthropic API | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Memory Service 编译 | `go build ./services/memory-service/...` | 无错误 | PASS |
| Processor Service 编译 | `python -m py_compile suggestion_consumer.py` | OK | PASS |
| Next.js 构建 | `npm run build` (web/) | 成功，6 条路由 | PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
| ----------- | -------------- | ----------- | ------ | -------- |
| FEAT-01 | 08-02, 08-03 | 保存记忆后异步调用 LLM 生成 AI 建议 | SATISFIED | Redis Stream + SuggestionConsumer + LLM generate_suggestion |
| FEAT-02 | 08-03 | 建议根据内容类型采用不同策略 | SATISFIED | build_text_suggestion_prompt / build_link_suggestion_prompt |
| FEAT-03 | 08-01, 08-02 | 建议持久化到数据库，与记忆关联 | SATISFIED | ai_suggestions 表 + suggestion_repository.go + ON DELETE CASCADE |
| FEAT-04 | 08-02, 08-04 | 创建表单可选择开启/关闭 AI 建议（默认关闭） | SATISFIED | create-memory-form.tsx enableAISuggestion 开关，默认 false |
| FEAT-05 | 08-02, 08-03 | 生成失败不阻塞保存，自动重试（最多 3 次，指数退避） | PARTIAL | 消费者继承基类重试（1s, 2s, 4s），但 RetryTask 不支持 suggestion:generate 重试 |
| FEAT-06 | 08-02, 08-04, 08-05 | 记忆卡片显示 AI 建议图标，hover 展开 | SATISFIED | memory-card.tsx Sparkles + group-hover tooltip |
| FEAT-07 | 08-02, 08-05 | 记忆详情页底部展示完整建议，带快捷操作 | SATISFIED | suggestion-detail-section.tsx 完整 UI + 反馈按钮 |
| FEAT-08 | 08-02, 08-05 | 用户点击「不用了」记录偏好，减少同类建议 | SATISFIED | updateSuggestionFeedback API + 前端反馈状态显示 |
| FEAT-32 | 08-01, 08-04 | AI 建议风格选择（温柔/实用/启发，默认启发） | SATISFIED | settings/page.tsx 风格选择 + getUserSuggestionStyle 默认 inspiring |
| FEAT-33 | 08-01, 08-04 | 单次生成超时时间 10-60 秒可调（默认 30） | PARTIAL | 设置页有 UI 和存储，但 Processor 不消费该值 |
| FEAT-34 | 08-01, 08-04 | 最大重试次数 1-5 次可调（默认 3） | PARTIAL | 设置页有 UI 和存储，但 Processor 硬编码 max_retries=3 |
| FEAT-35 | 08-01, 08-04 | 配置项作为高级选项默认折叠，存储在 users.settings | SATISFIED | settings/page.tsx details/summary 折叠 + updateSettings 保存 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| suggestion_consumer.py | 40 | max_retries=3 硬编码 | Warning | 用户设置的重试次数不生效 |
| suggestion_consumer.py | 61 | 链接建议传递空字符串作为 title/summary | Info | 链接建议缺少标题/摘要上下文（计划偏差 D-08-03-02 已记录） |

### Human Verification Required

1. **AI 建议生成端到端流程**
   - **测试:** 创建一条文字记忆，开启 AI 建议，观察 10-30 秒后是否出现建议卡片
   - **预期:** 卡片显示 AI 生成的中文建议，内容温暖有建设性，50-150 字
   - **原因:** 需要运行完整服务栈（Gateway + Memory Service + Redis + Processor + LLM API key）

2. **反馈按钮交互**
   - **测试:** 在建议卡片或详情页点击「有用」和「不用了」
   - **预期:** 按钮状态变化，显示确认文字，刷新页面后状态保持
   - **原因:** 需要数据库写入和读取验证

3. **链接类型建议质量**
   - **测试:** 保存一个链接记忆（如技术文章），开启 AI 建议
   - **预期:** 建议内容偏向知识关联和行动建议，而非情绪支持
   - **原因:** 需要实际 LLM 输出来验证提示模板效果

4. **不同风格建议差异**
   - **测试:** 在设置页切换温柔型/实用型/启发型，分别创建记忆
   - **预期:** 三种风格生成的建议语气和内容策略有明显差异
   - **原因:** 需要实际 LLM 输出来验证 STYLE_PERSONAS 效果

### Gaps Summary

Phase 8 实现了完整的 AI 陪伴建议功能链：数据库 Schema、Memory Service 建议层、Processor Service 消费者、前端创建表单/设置页/记忆卡片/详情页。所有主要功能组件都已存在、有实质内容、已正确连接。构建全部通过。

发现 **2 个 gaps**，均不影响核心功能但影响完整性和可配置性：

**Gap 1: RetryTask 不支持 suggestion:generate 重试**
- `memory_handler.go:305` 和 `memory_service.go:521` 的 validTypes 映射缺少 `suggestion:generate`
- 影响：如果建议生成失败，无法通过内部 API 手动触发重试
- 根因：TaskStatusUpdate 的 binding 标签已更新，但 RetryTask 的验证逻辑未同步更新

**Gap 2: 用户配置的 timeout/max_retries 未被 Processor Service 消费**
- 设置页允许用户配置超时（10-60s）和最大重试（1-5），数据存储在 users.settings JSONB
- 但 `PublishSuggestionGenerate` 未将这些值传入 Redis Stream 消息
- `SuggestionConsumer` 硬编码 `max_retries=3`，不读取消息中的 timeout 或 max_retries
- 影响：用户调整设置后，Processor 的行为不会改变

两个 gaps 的修复工作量小（各约 5-10 行代码），建议在 Phase 8 收尾时修复。

---

_Verified: 2026-04-25_
_Verifier: Claude (gsd-verifier)_
