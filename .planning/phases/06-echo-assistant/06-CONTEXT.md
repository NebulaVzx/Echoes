---
name: Phase 6 Context
description: Echo Assistant - Context for research and planning
type: context
---

# Phase 6: Echo Assistant - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

实现对话式 AI 助手（Echo Assistant），用户可通过自然语言与"拾忆"对话。
AI 基于用户已有的记忆进行 RAG 检索并生成回答，支持多轮对话和历史管理。

### 在范围内
- Chat UI 侧边栏（Notion AI 风格，右侧）
- RAG 检索逻辑（复用现有语义搜索 API）
- LLM 回答生成（复用现有 Provider 抽象层）
- 多轮对话上下文管理
- 对话历史持久化（数据库表 + CRUD）
- 引用来源展示

### 不在范围内
- 流式输出（SSE）（v1.2 之后）
- 语音输入/输出
- 图片/视频理解
- AI 主动建议（基于新保存记忆推送）
- 对话导出（Markdown/PDF）

</domain>

<decisions>
## Implementation Decisions

### Chat UI 布局
- **D-01: Notion AI 风格右侧侧边栏**
  - 用户已决定采用 Notion AI 风格的右侧侧边栏
  - 触发方式：Header 中的 AI 图标按钮，点击后右侧滑出侧边栏
  - 侧边栏宽度：约 400px（桌面），移动端全屏覆盖
  - 侧边栏内包含：对话历史列表（顶部）、消息区域（中间）、输入框（底部）
  - 关闭方式：点击外部区域或关闭按钮，侧边栏滑回
  - 动画：300ms ease-out，与现有 Framer Motion 动画风格一致

### RAG Prompt 组装策略
- **D-02: 交由研究员调研最佳实践**
  - 用户要求调研 RAG Prompt 组装的最佳实践
  - 关键待调研点：
    - Top N 条记忆（N 的取值，默认候选 5 或 10）
    - 每条记忆包含的字段（标题、内容、标签、备注、相似度分数）
    - 系统 Prompt 模板设计（中文语境，个人知识库问答场景）
    - 检索不到相关记忆时的处理策略（明确告知"未找到相关记忆"）
  - 约束：复用现有 `/search` API（语义搜索），不新增向量检索逻辑

### 多轮对话上下文管理
- **D-03: 交由研究员调研最佳实践**
  - 用户要求调研多轮对话上下文管理的最佳实践
  - 关键待调研点：
    - 历史保留轮数（候选：最近 5 轮、10 轮，或按 token 数截断）
    - 上下文窗口管理（LLM 的 max_tokens 限制）
    - 是否将历史对话也作为 RAG 上下文的一部分（还是仅当前 query 做 RAG）
    - 对话摘要机制（长对话是否需要摘要来压缩上下文）
  - 约束：使用现有 LLM Provider 抽象层（OpenAI / Anthropic）

### 引用来源展示
- **D-04: 交由研究员调研最佳实践**
  - 用户要求调研引用来源展示的最佳实践
  - 关键待调研点：
    - 展示形式：内联标注 `[1]` + 底部引用列表 vs 直接嵌入文本
    - 引用内容：记忆标题、标签、保存日期、相似度分数
    - 点击引用是否可跳转至记忆详情页
    - 无引用时的处理（纯知识问答，不引用记忆）
  - 约束：与现有 Notion-like 极简美学一致

### Claude's Discretion
- 侧边栏内的具体组件布局（消息气泡样式、输入框设计）—— 由实现者决定，保持与现有 UI 一致
- 对话历史的展示形式（列表项样式、时间分组）—— 由实现者决定
- 加载状态的具体表现（typing indicator 样式）—— 由实现者决定
- 暗黑模式下的侧边栏样式 —— 复用现有主题系统

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 产品需求
- `.planning/REQUIREMENTS.md` — v1.1 需求规格（CHAT-01 ~ CHAT-15）
- `.planning/ROADMAP.md` — Phase 6 目标与成功标准
- `.planning/PROJECT.md` — 项目上下文与技术栈

### 现有代码（复用资产）
- `services/processor-service/app/services/llm/` — LLM Provider 抽象层（OpenAI/Anthropic）
- `services/memory-service/internal/service/memory_service.go` — 语义搜索逻辑
- `services/memory-service/internal/transport/memory_handler.go` — Search API 接口
- `web/lib/api.ts` — 前端 API 客户端
- `web/app/providers/auth-provider.tsx` — 认证状态管理
- `web/components/ui/` — shadcn/ui 组件库
- `web/app/(main)/page.tsx` — 首页布局（Chat 入口位置）

### 架构文档
- `CLAUDE.md` — 开发指南与命令速查
- `PRD.md` — 完整产品需求与 API 定义

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **LLM Provider 抽象层** (`services/processor-service/app/services/llm/`): 
  - 已支持 OpenAI 和 Anthropic，工厂模式创建实例
  - `base.py` 定义 `generate()` 接口，可直接复用于 Chat 回答生成
  - 需扩展支持多轮对话（传入 messages 数组而非单条 prompt）
- **语义搜索 API** (`services/memory-service/internal/transport/memory_handler.go`):
  - `SearchMemories` Handler 已存在，支持自然语言查询
  - 可复用该接口进行 RAG 检索，无需新增向量检索逻辑
- **API 客户端** (`web/lib/api.ts`):
  - `ApiClient` 已封装 `request()` 方法，支持 JWT 自动注入
  - 新增 Chat 相关 API 方法即可
- **AuthProvider** (`web/app/providers/auth-provider.tsx`):
  - 已管理用户登录状态，Chat 入口按钮可根据 `user` 状态显示/隐藏
- **UI 组件库** (`web/components/ui/`):
  - shadcn/ui 组件可用（Button, Input, ScrollArea, Skeleton 等）
  - `empty-state.tsx` 可复用于"无历史对话"状态

### Established Patterns
- **状态管理**: 前端使用 React Context（AuthProvider、ThemeProvider），Chat 状态可用同样模式
- **数据获取**: 前端使用 ApiClient 直接调用 REST API，Chat API 遵循同样模式
- **错误处理**: 后端统一 ErrorResponse 格式，前端 Toast 提示
- **加载状态**: Skeleton 组件 + `isLoading` 状态，Chat 消息区域可用 Skeleton 或 TypingIndicator
- **动画**: Framer Motion（page transitions, stagger），Chat 侧边栏滑入动画复用同样风格

### Integration Points
- **Gateway 路由**: 新增 `/api/v1/chat/*` 路由，转发到 User Service 或新 Chat Service
- **前端入口**: 首页 Header 添加 AI 图标按钮，点击触发侧边栏
- **数据库**: 新增 `conversations` 和 `messages` 表（见 REQUIREMENTS.md CHAT-13）
- **LLM 调用**: Processor Service 或 Gateway 调用现有 LLM Provider，传入 RAG 组装后的 Prompt
</code_context>

<specifics>
## Specific Ideas

### Notion AI 参考
- 右侧侧边栏，宽度约 400px
- 顶部有"New chat"按钮和历史对话列表
- 中间是消息流，用户消息右对齐，AI 消息左对齐
- 底部是输入框，带发送按钮
- 侧边栏滑入/滑出动画

### RAG 场景示例
- 用户问："我上周存的关于 Go 的文章有哪些？"
- 系统先调用 `/search?q=Go 文章&limit=5` 检索相关记忆
- 将检索结果组装成 Prompt 上下文
- LLM 生成回答并标注来源

### 引用展示参考
- Perplexity AI 风格：回答中内联 `[1]`，底部列出引用来源
- 或 ChatGPT 风格：不显示引用，直接给出答案
- 用户要求调研最佳实践，尚未锁定具体形式
</specifics>

<deferred>
## Deferred Ideas

- **流式输出（SSE）** — v1.2 之后考虑，当前用非流式实现
- **AI 主动建议** — 基于新保存的记忆提示"你可能想问..."，属于新能力
- **对话导出（Markdown/PDF）** — v1.2 之后考虑
- **语音输入/输出** — 超出当前范围

## Reviewed Todos (not folded)
- 无
</deferred>

---

*Phase: 06-echo-assistant*
*Context gathered: 2026-04-22*
