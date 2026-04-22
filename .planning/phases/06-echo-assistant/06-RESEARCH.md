# Phase 6: Echo Assistant - Research

**Researched:** 2026-04-22
**Domain:** Conversational AI (RAG + Multi-turn Chat), Full-stack (Next.js + Go + Python)
**Confidence:** HIGH

## Summary

Echo Assistant is a conversational AI sidebar that answers user questions based on their saved memories using RAG (Retrieval-Augmented Generation). The phase spans three tiers: a Notion AI-style right sidebar in Next.js, a new Chat Service in Go for conversation persistence and RAG orchestration, and reuse of the existing Python LLM Provider for answer generation.

**Primary recommendation:** Build a dedicated Go Chat Service (within Gateway or as a separate service) that orchestrates RAG by calling Memory Service's `/search` API, assembles prompts using a structured Chinese system template, and manages multi-turn context with a sliding window (last 10 messages + RAG context per turn). Use Perplexity-style inline citations `[1]` with a collapsible source footer. Frontend: custom sidebar component with `react-markdown` for message rendering, integrated into the existing header.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Chat UI sidebar | Browser / Client | — | Pure React component, no SSR needed for chat state |
| Message rendering (Markdown) | Browser / Client | — | Client-side `react-markdown` with syntax highlighting |
| Conversation persistence | API / Backend (Go Chat Service) | — | Go + GORM + PostgreSQL, follows existing service pattern |
| RAG retrieval orchestration | API / Backend (Go Chat Service) | — | Calls Memory Service `/search`, assembles prompt |
| LLM answer generation | API / Backend (Python Processor) | — | Reuse existing LLM Provider abstraction layer |
| Multi-turn context management | API / Backend (Go Chat Service) | — | Token budgeting + sliding window truncation in Go |
| Citation parsing/rendering | Browser / Client | API / Backend | API returns citation metadata; client renders inline markers |

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01: Notion AI 风格右侧侧边栏** — 宽度约 400px（桌面），移动端全屏覆盖；触发方式：Header 中的 AI 图标按钮；动画 300ms ease-out，与现有 Framer Motion 风格一致
- **D-02: RAG Prompt 组装策略** — 复用现有 `/search` API，不新增向量检索逻辑；Top N 默认候选 5 或 10；系统 Prompt 需适配中文个人知识库场景
- **D-03: 多轮对话上下文管理** — 使用现有 LLM Provider 抽象层（OpenAI / Anthropic）；历史保留轮数、token 截断策略、是否摘要压缩待调研确定
- **D-04: 引用来源展示** — 展示形式、引用内容、是否可点击跳转待调研确定；与现有 Notion-like 极简美学一致

### Claude's Discretion
- 侧边栏内的具体组件布局（消息气泡样式、输入框设计）—— 保持与现有 UI 一致
- 对话历史的展示形式（列表项样式、时间分组）—— 由实现者决定
- 加载状态的具体表现（typing indicator 样式）—— 由实现者决定
- 暗黑模式下的侧边栏样式 —— 复用现有主题系统

### Deferred Ideas (OUT OF SCOPE)
- 流式输出（SSE）— v1.2 之后考虑
- AI 主动建议 — 基于新保存记忆推送
- 对话导出（Markdown/PDF）— v1.2 之后考虑
- 语音输入/输出 — 超出当前范围

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHAT-01 | Chat 侧边栏 UI（打开/关闭） | Notion AI 风格右侧滑出，400px 桌面 / 全屏移动端 |
| CHAT-02 | 对话历史列表（按时间倒序）+ 新建对话 | 新增 `conversations` 表，按 `updated_at` 倒序 |
| CHAT-03 | 消息 Markdown 渲染 | `react-markdown` + `remark-gfm` + `rehype-highlight` |
| CHAT-04 | 发送后加载状态（typing indicator） | Skeleton 或自定义脉冲动画，复用现有设计系统 |
| CHAT-05 | 暗黑模式支持 | 复用现有 `dark:` Tailwind 类 |
| CHAT-06 | RAG 语义检索（复用 `/search` API） | 调用 Memory Service `GET /search?q={query}&limit=5` |
| CHAT-07 | Top N 排序（默认 5 条） | 按 `similarity` 降序，阈值 0.75（复用现有逻辑） |
| CHAT-08 | 无相关记忆时明确告知 | 系统 Prompt 中嵌入指令："若上下文无相关信息，明确说明" |
| CHAT-09 | 复用现有 LLM Provider 生成回答 | 需扩展 `generate()` 支持 `messages` 数组（多轮对话） |
| CHAT-10 | Prompt 包含检索到的记忆上下文 | 结构化上下文模板：分隔线 + 编号 + 元数据 |
| CHAT-11 | 回答中引用来源 | Perplexity 风格：内联 `[1]` + 底部来源卡片 |
| CHAT-12 | 多轮对话（保留最近 N 轮） | 滑动窗口：最近 10 轮消息 + 每轮独立 RAG |
| CHAT-13 | 对话持久化（conversations + messages 表） | PostgreSQL 新增两表，GORM 模型 |
| CHAT-14 | 查看历史对话列表并切换 | REST API: `GET /chat/conversations` |
| CHAT-15 | 删除单条对话 | REST API: `DELETE /chat/conversations/:id` |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-markdown | ^9.0 | Markdown rendering in chat messages | De facto standard for React markdown [VERIFIED: npm registry] |
| remark-gfm | ^4.0 | GitHub Flavored Markdown support (tables, strikethrough) | Standard companion to react-markdown [VERIFIED: npm registry] |
| rehype-highlight | ^7.0 | Syntax highlighting for code blocks | Most popular rehype plugin for highlight.js [VERIFIED: npm registry] |
| lucide-react | ^0.344.0 (existing) | Icons (Sparkles, Send, X, etc.) | Already in project, consistent icon set [VERIFIED: package.json] |
| framer-motion | ^11.0.8 (existing) | Sidebar slide-in animation | Already in project, matches existing animation style [VERIFIED: package.json] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| highlight.js | ^11.9 | Code block syntax highlighting (peer of rehype-highlight) | Required by rehype-highlight for language detection |
| uuid | ^9.0 | Client-side conversation ID generation | For optimistic UI before server response |

### Version Verification
```bash
# Verified versions (as of 2026-04-22)
npm view react-markdown version    # 9.1.0
npm view remark-gfm version        # 4.0.1
npm view rehype-highlight version  # 7.0.2
npm view highlight.js version      # 11.11.1
```

**Installation:**
```bash
cd web && npm install react-markdown remark-gfm rehype-highlight highlight.js
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-markdown | @uiw/react-markdown-preview | Heavier, more features than needed; react-markdown is lighter and sufficient |
| rehype-highlight | prism-react-renderer | prism-react-renderer requires more custom component wiring; rehype-highlight integrates directly with react-markdown |
| highlight.js | PrismJS | Both work; highlight.js has broader language support and is more commonly paired with rehype-highlight |

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              BROWSER / CLIENT                           │
│  ┌─────────────────────┐    ┌──────────────────────────────────────┐   │
│  │   Main Content      │    │     Chat Sidebar (~400px)            │   │
│  │   (Timeline)        │◄──►│  ┌─────────┐  ┌─────────────────┐   │   │
│  │                     │    │  │ History │  │ Message Stream  │   │   │
│  │                     │    │  │  List   │  │ (Markdown render)│   │   │
│  │                     │    │  └─────────┘  └─────────────────┘   │   │
│  │                     │    │  ┌─────────────────────────────────┐ │   │
│  │                     │    │  │        Input Area               │ │   │
│  │                     │    │  └─────────────────────────────────┘ │   │
│  └─────────────────────┘    └──────────────────────────────────────┘   │
│                              Click AI icon to toggle                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ POST /api/v1/chat/messages
┌─────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY (Go + Gin)                        │
│                    JWT auth, route to Chat Service                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
┌──────────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│   Chat Service (Go)  │  │ Memory Service   │  │  User Service (Go)   │
│  ─────────────────   │  │ (Go)             │  │  (existing)          │
│  • Conversation CRUD │  │  ──────────────  │  │                      │
│  • RAG Orchestration │◄─┤  • /search API   │  │                      │
│  • Prompt Assembly   │  │  • Vector search │  │                      │
│  • Context Management│  │  • pgvector      │  │                      │
│  • Call LLM Provider │──┼──────────────────┘  └──────────────────────┘
└──────────────────────┘  │                         ▲
           │              │                         │
           │              └─────────────────────────┘
           │                 (User settings: LLM config)
           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      PROCESSOR SERVICE (Python + FastAPI)               │
│  ─────────────────────────────────────────────────────────────────────  │
│  • LLM Provider (OpenAI / Anthropic)                                    │
│  • Receives: assembled prompt (system + context + history + query)      │
│  • Returns: generated answer text                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         POSTGRESQL 15 + pgvector                        │
│  ─────────────────────────────────────────────────────────────────────  │
│  • conversations  table (new)                                           │
│  • messages       table (new)                                           │
│  • memories       table (existing)                                      │
│  • users          table (existing)                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow: Single Chat Turn

```
1. User types question → clicks Send
2. Frontend POST /api/v1/chat/messages
   Body: { conversation_id, content }
3. Gateway → Chat Service
4. Chat Service:
   a. Save user message to DB
   b. Call Memory Service: GET /search?q={content}&limit=5
   c. Receive search results (memories with similarity scores)
   d. Assemble prompt: system + retrieved context + history + current query
   e. Call Processor Service LLM Provider /generate
   f. Receive AI answer
   g. Parse citations from answer (if LLM follows format)
   h. Save assistant message to DB
   i. Return: { message, citations[] }
5. Frontend renders message with Markdown + inline citation markers
```

### Recommended Project Structure

```
web/
├── app/
│   ├── (main)/
│   │   ├── page.tsx              # Add ChatSidebar + AI button to header
│   │   └── layout.tsx
│   └── providers/
│       └── chat-provider.tsx     # Chat state management (React Context)
├── components/
│   ├── chat/
│   │   ├── chat-sidebar.tsx      # Main sidebar container (slide-in)
│   │   ├── chat-header.tsx       # New chat button, close button
│   │   ├── chat-message-list.tsx # Scrollable message area
│   │   ├── chat-message.tsx      # Single message bubble (user/assistant)
│   │   ├── chat-input.tsx        # Input + send button
│   │   ├── chat-history-list.tsx # Conversation list sidebar
│   │   ├── chat-history-item.tsx # Single conversation item
│   │   ├── typing-indicator.tsx  # Loading animation
│   │   └── citation-footer.tsx   # Source cards below assistant message
│   └── ui/                       # Existing shadcn/ui components
├── lib/
│   ├── api.ts                    # Add chat API methods
│   └── markdown.tsx              # Markdown renderer component
└── types/
    └── chat.ts                   # Chat-related TypeScript types

services/
├── gateway/
│   └── cmd/main.go               # Add /api/v1/chat/* routes
└── chat-service/                 # NEW (or integrate into Gateway)
    ├── cmd/main.go
    ├── internal/
    │   ├── domain/
    │   │   ├── conversation.go   # Conversation + Message models
    │   │   └── chat_request.go   # DTOs
    │   ├── repository/
    │   │   └── conversation_repository.go  # GORM DB operations
    │   ├── service/
    │   │   └── chat_service.go   # Business logic: RAG orchestration
    │   └── transport/
    │       └── chat_handler.go   # HTTP handlers
    └── go.mod

shared/migrations/
└── 002_chat_tables.sql           # conversations + messages tables
```

### Pattern 1: RAG Prompt Assembly
**What:** Structured prompt with system instructions, retrieved context, conversation history, and current query.
**When to use:** Every chat turn that requires memory retrieval.
**Example:**
```go
// Source: Research synthesis from cnblogs RAG guide + Agentset templates
const systemPromptTemplate = `你是用户的个人知识库助手"拾忆"。你基于用户保存的记忆片段回答问题。

## 任务
根据下面提供的记忆片段，回答用户的问题。你的回答必须严格基于提供的记忆内容，不得添加外部知识或猜测。

## 记忆片段
{{range $i, $m := .Memories}}
---
[{{add $i 1}}] 标题: {{$m.Title}}
类型: {{$m.ContentType}}
标签: {{join $m.Tags ", "}}
保存时间: {{$m.CreatedAt}}
内容:
{{$m.Content}}
{{if $m.Note}}备注: {{$m.Note}}{{end}}
---
{{end}}

## 约束
1. 【严格基于记忆】只使用提供的记忆片段中的信息回答问题
2. 【引用标注】每个事实性陈述必须标注来源，格式为 [1]、[2] 等
3. 【信息不足】如果记忆片段不足以回答问题，明确说明"根据您的记忆，我找不到相关信息"
4. 【语言一致】使用与用户问题相同的语言回答
5. 【禁止推测】不要推断、假设或添加记忆片段中未明确提及的信息
6. 【直接回答】不要以"根据您的记忆"开头，直接提供带引用的答案`
```

### Pattern 2: Multi-turn Context Management (Sliding Window)
**What:** Keep last N messages in history, truncate when approaching token limit.
**When to use:** For conversations longer than a few turns.
**Example:**
```go
// Source: Research synthesis from MT-OSC + OpenAI community best practices
const (
    MaxHistoryMessages = 10  // Keep last 10 messages (5 turns)
    MaxContextTokens   = 6000 // Reserve room for system + RAG + output
)

func (s *ChatService) buildMessages(ctx context.Context, conv *Conversation, query string, memories []Memory) ([]LLMMessage, error) {
    messages := []LLMMessage{}

    // 1. System message with RAG context
    systemContent := s.assembleSystemPrompt(memories)
    messages = append(messages, LLMMessage{Role: "system", Content: systemContent})

    // 2. Recent history (last MaxHistoryMessages)
    recentMessages := s.getRecentMessages(conv, MaxHistoryMessages)
    messages = append(messages, recentMessages...)

    // 3. Current user query
    messages = append(messages, LLMMessage{Role: "user", Content: query})

    return messages, nil
}

// RAG is performed on CURRENT query only, not on full history
// This avoids drift: each turn independently retrieves relevant memories
```

### Pattern 3: Citation Parsing and Rendering
**What:** LLM outputs inline citations like `[1]`; backend parses them into structured data; frontend renders clickable links.
**When to use:** Every assistant message that references memories.
**Example:**
```typescript
// Frontend: Parse citation markers from LLM text
interface Citation {
  index: number
  memoryId: string
  title: string
  similarity: number
}

function renderMessageWithCitations(
  text: string,
  citations: Citation[]
): React.ReactNode {
  // Split text by citation markers [1], [2], etc.
  const parts = text.split(/(\[\d+\])/g)
  return parts.map((part, i) => {
    const match = part.match(/\[(\d+)\]/)
    if (match) {
      const idx = parseInt(match[1])
      const citation = citations.find(c => c.index === idx)
      if (citation) {
        return (
          <a
            key={i}
            href={`/memory/${citation.memoryId}`}
            className="inline-flex items-center px-1 py-0.5 text-xs font-medium bg-blue-50 text-blue-600 rounded hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400"
          >
            [{idx}]
          </a>
        )
      }
    }
    return <span key={i}>{part}</span>
  })
}
```

### Anti-Patterns to Avoid
- **Anti-pattern: Putting RAG context in user message instead of system message.** System message is the correct place for retrieved context because it sets the behavioral context for the model. User message should only contain the actual query. [CITED: OpenAI Developer Community best practices]
- **Anti-pattern: Using conversation history for RAG retrieval.** Do NOT concatenate full chat history into the search query. Only use the current user query for semantic search. History-based retrieval causes drift and retrieves irrelevant memories from earlier turns. [ASSUMED: based on RAG best practices]
- **Anti-pattern: Storing full conversation context in frontend state.** Conversations must be persisted to DB immediately; frontend state should only cache for UI responsiveness, with server as source of truth.
- **Anti-pattern: Letting LLM decide when to cite without explicit instructions.** Without explicit "MUST cite every factual statement" in system prompt, LLMs often omit citations. Be prescriptive in the prompt.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown rendering in chat | Custom markdown parser | `react-markdown` + `remark-gfm` | 10+ years of edge cases handled (nested lists, tables, HTML escaping) [VERIFIED: npm registry] |
| Syntax highlighting | Custom highlighter | `rehype-highlight` + `highlight.js` | 190+ languages, theme ecosystem, accessibility [VERIFIED: npm registry] |
| Token counting for context limits | Custom tokenizer | Approximate with character count / 4 | For v1.1, simple heuristic suffices; full tokenization requires `tiktoken` (Python) or `gpt-tokenizer` (JS) which add complexity. Upgrade when needed. [ASSUMED] |
| Sidebar slide animation | Custom CSS transitions | `framer-motion` (already in project) | AnimatePresence + motion.div handles mount/unmount animations cleanly [VERIFIED: package.json] |
| Conversation state management | Redux / Zustand | React Context (existing pattern) | Project already uses Context for Auth; Chat state follows same pattern. No new dependency needed. [VERIFIED: auth-provider.tsx] |
| LLM Provider abstraction | LangChain / LlamaIndex | Existing custom LLM Provider (200 lines) | Project explicitly chose lightweight abstraction; LangChain is overkill for this use case [VERIFIED: CLAUDE.md] |

**Key insight:** The project already has a lightweight LLM abstraction that works. The main extension needed is supporting a `messages` array (multi-turn) instead of a single `prompt` string. This is a small, focused change — not a reason to introduce a framework.

## Common Pitfalls

### Pitfall 1: Context Window Overflow
**What goes wrong:** As conversations grow, the combined system prompt + RAG context + history exceeds the LLM's context window (e.g., GPT-4o: 128K tokens, but practical limit for quality is much lower). The model truncates from the middle or throws an error.
**Why it happens:** Naively appending all messages without token budgeting. Each turn adds ~500-2000 tokens.
**How to avoid:** Implement a sliding window (last 10 messages max) + monitor total context size. For v1.1, use message count as a proxy for token count. Reserve ~4000 tokens for system+RAG, ~4000 for history, ~2000 for output.
**Warning signs:** API returns "context length exceeded" errors; responses degrade in quality after ~10 turns.

### Pitfall 2: RAG Context Drift in Multi-turn
**What goes wrong:** User asks "Tell me about Go articles", then "What about the second one?". The second query alone retrieves nothing relevant because it lacks "Go articles" context.
**Why it happens:** RAG only uses the current query for retrieval, but the current query may be ambiguous without history context.
**How to avoid:** For follow-up queries, use query rewriting: prepend conversation topic to the search query. Example: "What about the second one?" → rewrite to "What about the second Go article?" using the last assistant message as context. For v1.1, a simpler fallback: if retrieval returns < 3 results, also search with the previous user query concatenated.
**Warning signs:** Follow-up questions consistently return "no relevant memories" despite clear relevance.

### Pitfall 3: Citation Hallucination
**What goes wrong:** LLM generates citations like `[3]` but only 2 memories were retrieved, or cites a memory that doesn't support the claim.
**Why it happens:** LLMs are not inherently good at matching claims to sources without explicit structure.
**How to avoid:** (1) In system prompt, explicitly number memories and instruct "ONLY use numbers [1] through [N]". (2) Post-process: validate that all citation indices are within range. (3) Strip invalid citations from the response and log for debugging.
**Warning signs:** Citation numbers exceed retrieved count; citations don't match the claim content.

### Pitfall 4: Sidebar Z-Index and Layout Issues
**What goes wrong:** Chat sidebar overlays content but click-outside-to-close doesn't work, or sidebar appears behind modal dialogs.
**Why it happens:** Incorrect z-index stacking, or the sidebar is not properly portaled to document body.
**How to avoid:** Use `position: fixed` with `z-50` for the sidebar container. Use a backdrop overlay with `z-40` that captures click-outside events. Ensure the sidebar is rendered at the root layout level, not nested inside relative containers.
**Warning signs:** Clicks on sidebar content propagate to main content; sidebar clipped by parent containers.

### Pitfall 5: Mobile Sidebar Experience
**What goes wrong:** 400px sidebar overflows on mobile screens, or the close button is inaccessible.
**Why it happens:** Sidebar width is hardcoded without responsive breakpoints.
**How to avoid:** On screens < 640px (sm breakpoint), render sidebar as full-width overlay (100vw). Add a swipe-to-close gesture or prominent close button. Use Tailwind's responsive prefixes: `w-full sm:w-[400px]`.
**Warning signs:** Horizontal scroll on mobile; sidebar content cut off.

## Code Examples

### LLM Provider Extension for Multi-turn (Python)
```python
# Source: Existing codebase + OpenAI/Anthropic API docs
# File: services/processor-service/app/services/llm/base.py

from abc import ABC, abstractmethod
from typing import List, Dict

class LLMMessage(TypedDict):
    role: str  # "system" | "user" | "assistant"
    content: str

class LLMProvider(ABC):
    # ... existing __init__ ...

    @abstractmethod
    async def generate(self, prompt: str, temperature: float = None, max_tokens: int = 500) -> str:
        pass

    # NEW: Multi-turn chat completion
    @abstractmethod
    async def chat(self, messages: List[LLMMessage], temperature: float = None, max_tokens: int = 500) -> str:
        """Generate a response given a conversation history."""
        pass

# OpenAI implementation
async def chat(self, messages: List[LLMMessage], temperature: float = None, max_tokens: int = 500) -> str:
    temp = temperature if temperature is not None else self.temperature
    for attempt in range(3):
        try:
            resp = await asyncio.wait_for(
                self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,  # Pass full message array
                    temperature=temp,
                    max_tokens=max_tokens,
                ),
                timeout=30.0,
            )
            return resp.choices[0].message.content
        except RateLimitError:
            wait = 2 ** attempt
            await asyncio.sleep(wait)
        except asyncio.TimeoutError:
            if attempt == 2:
                raise
            await asyncio.sleep(1)
    raise RuntimeError("OpenAI chat failed after 3 attempts")

# Anthropic implementation
async def chat(self, messages: List[LLMMessage], temperature: float = None, max_tokens: int = 500) -> str:
    temp = temperature if temperature is not None else self.temperature
    # Anthropic uses "system" as a top-level param, not in messages array
    system_msg = None
    chat_messages = []
    for m in messages:
        if m["role"] == "system":
            system_msg = m["content"]
        else:
            chat_messages.append({"role": m["role"], "content": m["content"]})

    for attempt in range(3):
        try:
            kwargs = {
                "model": self.model,
                "max_tokens": max_tokens,
                "temperature": temp,
                "messages": chat_messages,
            }
            if system_msg:
                kwargs["system"] = system_msg

            resp = await asyncio.wait_for(
                self.client.messages.create(**kwargs),
                timeout=30.0,
            )
            return resp.content[0].text
        except AnthropicRateLimitError:
            wait = 2 ** attempt
            await asyncio.sleep(wait)
        except asyncio.TimeoutError:
            if attempt == 2:
                raise
            await asyncio.sleep(1)
    raise RuntimeError("Anthropic chat failed after 3 attempts")
```

### Database Schema (PostgreSQL)
```sql
-- Source: REQUIREMENTS.md CHAT-13 + project conventions
-- File: shared/migrations/002_chat_tables.sql

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL DEFAULT '新对话',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    citations JSONB DEFAULT '[]',  -- Array of {index, memory_id, title, similarity}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at ASC);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE conversations IS 'Chat conversation sessions';
COMMENT ON TABLE messages IS 'Individual chat messages within a conversation';
```

### Frontend: Chat Sidebar Component
```tsx
// Source: Research synthesis (shadcn/ui sidebar + Framer Motion)
// File: web/components/chat/chat-sidebar.tsx

'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles } from 'lucide-react'
import ChatHeader from './chat-header'
import ChatMessageList from './chat-message-list'
import ChatInput from './chat-input'
import ChatHistoryList from './chat-history-list'

interface ChatSidebarProps {
  isOpen: boolean
  onClose: () => void
}

export default function ChatSidebar({ isOpen, onClose }: ChatSidebarProps) {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/20 z-40 sm:hidden"
            onClick={onClose}
          />

          {/* Sidebar */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
            className="fixed top-0 right-0 h-full w-full sm:w-[400px] bg-white dark:bg-gray-800 border-l border-gray-100 dark:border-gray-700 z-50 flex flex-col shadow-xl"
          >
            <ChatHeader
              onClose={onClose}
              onToggleHistory={() => setShowHistory(!showHistory)}
              onNewChat={() => setActiveConversationId(null)}
            />

            {showHistory ? (
              <ChatHistoryList
                onSelect={setActiveConversationId}
                onCloseHistory={() => setShowHistory(false)}
              />
            ) : (
              <>
                <ChatMessageList conversationId={activeConversationId} />
                <ChatInput conversationId={activeConversationId} />
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
```

### Frontend: Markdown Message Renderer
```tsx
// Source: react-markdown official docs pattern
// File: web/lib/markdown.tsx

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github.css'  // Or github-dark.css for dark mode

interface MarkdownRendererProps {
  content: string
  citations?: Citation[]
}

export function MarkdownRenderer({ content, citations }: MarkdownRendererProps) {
  // If citations provided, parse inline [1] markers and render as links
  if (citations && citations.length > 0) {
    return <MarkdownWithCitations content={content} citations={citations} />
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      className="prose prose-sm dark:prose-invert max-w-none"
      components={{
        // Custom rendering for specific elements if needed
        a: ({ node, ...props }) => (
          <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline" />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-turn prompt (string) | Multi-turn messages array | 2023 (ChatGPT API) | Better context retention, standard for all major providers |
| RAG context in user message | RAG context in system message | 2024 (best practices consensus) | Clearer separation of instructions vs. query |
| Full history for RAG retrieval | Current query only for RAG | 2024-2025 | Prevents retrieval drift; query rewriting for disambiguation |
| Token-based truncation | Hierarchical memory + summarization | 2025 (MT-OSC, Mem0) | 72% token reduction, better long-conversation quality |
| End-of-response source list | Inline citations + source cards | 2024-2025 (Perplexity, Claude) | Claim-level attribution, better UX |

**Deprecated/outdated:**
- LangChain for simple RAG: Overkill for this project's scope (confirmed by CLAUDE.md decision)
- Storing chat history in localStorage only: Must persist to DB for multi-device access
- Custom markdown parsers: react-markdown is the ecosystem standard

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | RAG retrieval should use ONLY the current query, not full history | Multi-turn Context Management | If wrong, follow-up queries will fail to retrieve relevant memories. Mitigation: implement query rewriting fallback |
| A2 | Message count (10 messages) is a sufficient proxy for token count in v1.1 | Common Pitfalls | If wrong, context may exceed LLM limits for long messages. Mitigation: add character-count-based truncation as secondary guard |
| A3 | `react-markdown` + `rehype-highlight` is sufficient for chat message rendering | Standard Stack | If wrong, complex Markdown (tables, nested lists) may render poorly. Mitigation: these libraries handle all GFM features |
| A4 | Anthropic API accepts `system` as top-level param (not in messages array) | Code Examples | If wrong, system prompt won't be passed correctly. Verified against anthropic SDK docs pattern [CITED: anthropic Python SDK behavior] |
| A5 | Perplexity-style inline citations `[1]` are the best UX for this product | Citation Best Practices | If wrong, users may prefer embedded text references. Mitigation: design is flexible, can switch to footnote style |

## Open Questions

1. **Chat Service placement: standalone microservice or integrated into Gateway?**
   - What we know: Gateway already handles routing; adding chat logic increases its responsibility
   - What's unclear: Whether chat volume justifies a separate service
   - Recommendation: Start as a package within Gateway (`internal/chat/`) to minimize deployment complexity. Extract to standalone service if chat traffic grows.

2. **Should conversation titles be auto-generated by LLM?**
   - What we know: Notion AI auto-generates chat titles from first message
   - What's unclear: Whether this adds unnecessary LLM cost/complexity for v1.1
   - Recommendation: For v1.1, use truncated first user message as title (e.g., "我上周存的关于 Go 的文章..."). Add LLM-generated titles in v1.2 if needed.

3. **How to handle LLM failures gracefully?**
   - What we know: Existing LLM Provider has 3-retry with exponential backoff
   - What's unclear: Whether to show a generic error or a partial response
   - Recommendation: After retries exhausted, return user-friendly error:"AI 服务暂时不可用，请稍后重试" and allow user to retry the message.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm | Frontend build | Unknown | — | Required for Next.js dev server |
| Go | Backend services | Yes | 1.22.8 | — |
| Python | Processor Service | Unknown | — | Required for LLM Provider |
| PostgreSQL | Conversation persistence | Yes (via Docker Compose) | 15 | — |
| Redis | — (not needed for chat v1.1) | Yes | 7 | — |
| OpenAI API key | LLM generation | Configured in env | — | Fallback to Anthropic |
| Anthropic API key | LLM generation | Configured in env | — | Fallback to OpenAI |

**Missing dependencies with no fallback:**
- Node.js/npm must be available for frontend development (standard for Next.js project)

**Missing dependencies with fallback:**
- None identified

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (frontend) + Go testing (backend) |
| Config file | `web/jest.config.js` (if exists) / Go default |
| Quick run command | `cd web && npm test -- --testPathPattern=chat` / `cd services/gateway && go test ./internal/chat/...` |
| Full suite command | `cd web && npm test` / `cd services/gateway && go test ./...` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHAT-01 | Sidebar opens/closes | component | Jest + React Testing Library | New file needed |
| CHAT-02 | Conversation list renders | component | Jest | New file needed |
| CHAT-03 | Markdown renders correctly | component | Jest | New file needed |
| CHAT-06 | RAG calls /search API | integration | Go test with mocked Memory Service | New file needed |
| CHAT-09 | LLM Provider chat() works | unit | Python pytest | New file needed |
| CHAT-13 | DB conversations CRUD | unit | Go test with test DB | New file needed |

### Sampling Rate
- **Per task commit:** `cd web && npm test -- --testPathPattern=chat -x` / `go test ./internal/chat/... -v`
- **Per wave merge:** Full frontend + backend test suite
- **Phase gate:** All new chat tests green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `web/components/chat/__tests__/chat-sidebar.test.tsx` — covers CHAT-01
- [ ] `web/lib/__tests__/markdown.test.tsx` — covers CHAT-03
- [ ] `services/gateway/internal/chat/service_test.go` — covers CHAT-06, CHAT-13
- [ ] `services/processor-service/app/services/llm/test_chat.py` — covers CHAT-09
- [ ] Frontend test utilities for mocking API client

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | JWT via Gateway, same as existing endpoints |
| V3 Session Management | Yes | Conversation data scoped to user_id; no cross-user access |
| V4 Access Control | Yes | All chat endpoints verify X-User-ID header; repository queries filtered by user_id |
| V5 Input Validation | Yes | Zod (frontend) + Go validator (backend) for request DTOs |
| V6 Cryptography | No | No new crypto; reuse existing JWT |
| V7 Error Handling | Yes | Unified ErrorResponse format; no stack traces in production |

### Known Threat Patterns for Chat/RAG Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via user message | Tampering | System prompt is trusted; user content is clearly delimited. No tool calling exposed to LLM. |
| Cross-user conversation access | Elevation of Privilege | All DB queries filter by user_id; verify X-User-ID matches conversation owner |
| LLM API key exposure | Information Disclosure | Keys stored in environment variables only; never sent to frontend |
| Excessive token consumption | Denial of Service | max_tokens limit per request; rate limiting at Gateway |
| Conversation data leakage in logs | Information Disclosure | Do not log message content; log only conversation_id and metadata |

## Sources

### Primary (HIGH confidence)
- [OpenAI Chat Completions API Docs](https://platform.openai.com/docs/guides/chat-completions) — Messages array structure, role definitions
- [Anthropic Messages API Docs](https://docs.anthropic.com/en/api/messages) — System param as top-level, message format differences
- [react-markdown npm](https://www.npmjs.com/package/react-markdown) — v9.1.0, API and plugin ecosystem
- [rehype-highlight npm](https://www.npmjs.com/package/rehype-highlight) — v7.0.2, highlight.js integration
- [Existing codebase](services/processor-service/app/services/llm/) — LLM Provider abstraction layer
- [Existing codebase](services/memory-service/internal/transport/memory_handler.go) — Search API interface
- [Existing codebase](web/lib/api.ts) — API client pattern
- [Existing codebase](web/app/providers/auth-provider.tsx) — React Context pattern

### Secondary (MEDIUM confidence)
- [RAG Prompt Design Guide (Chinese)](https://www.cnblogs.com/aigent/p/19493333) — 7-part template structure, citation requirements
- [RAG Prompt Templates (Agentset)](https://agentset.ai/rag-prompts) — Strict grounding template, citation format
- [MT-OSC Paper (arXiv 2604.08782)](https://arxiv.org/html/2604.08782v1) — Multi-turn context condensation techniques
- [OpenAI Community: Managing Context with Fixed Token Limits](https://community.openai.com/t/managing-context-in-a-conversation-bot-with-fixed-token-limits/1093181) — Practical token budgeting
- [Perplexity AI Citation Analysis](https://ziptie.dev/blog/how-perplexity-ai-answers-work/) — Inline citation UI pattern
- [shadcn/ui Sidebar Docs](https://ui.shadcn.com/docs/components/radix/sidebar) — Sidebar component structure
- [Notion AI Sidebar Pattern](https://dev.to/mrsupercraft/notion-ai-didnt-work-for-me-so-i-built-my-own-25jo) — Notion AI clone architecture

### Tertiary (LOW confidence)
- [Mem0 Chat History Summarization](https://mem0.ai/blog/llm-chat-history-summarization-guide-2025) — Advanced summarization techniques (overkill for v1.1)
- [State-Update Prompting Strategy (arXiv 2509.17766)](https://arxiv.org/html/2509.17766v2) — 59% token reduction technique (reference for future optimization)
- [RAG Optimization 2026 (LinkedIn)](https://www.linkedin.com/posts/ujjyainimitra_ai-retrieval-is-evolving-fast-rag-systems-activity-7437796544638115840-TKRu) — High-level trends, not specific implementations

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All libraries verified via npm registry or existing in project
- Architecture: HIGH — Clear separation of concerns; follows existing microservice patterns
- Pitfalls: MEDIUM-HIGH — Based on documented community patterns and research papers; some assumptions about token management
- RAG prompt design: MEDIUM-HIGH — Based on multiple Chinese and English sources; specific template needs testing with actual BGE-M3 retrieval quality
- Citation UX: MEDIUM — Perplexity pattern is well-documented, but optimal format for this specific product needs user validation

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (30 days for stable stack; RAG prompt template should be validated with real data within 1 week of implementation)
