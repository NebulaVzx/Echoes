# Phase 15: 情绪与回响 (Mood & Echo) - Research

**Researched:** 2026-05-11
**Domain:** AI sentiment analysis, calendar heatmap visualization, Redis Stream async processing, Go API extensions
**Confidence:** HIGH

## Summary

Phase 15 adds emotional dimension to memories through AI-powered sentiment analysis and a GitHub-style mood calendar visualization. The technical architecture follows established patterns: a new Redis Stream consumer (`mood:generate`) in the processor-service performs LLM-based sentiment analysis, results are stored in a dedicated `memory_emotions` table, and the frontend renders an interactive heatmap calendar at `/mood`. The DailyReview feature is extended with AI-generated "echo" messages using a mixed selection strategy (60% "this day in history" + 40% random).

**Primary recommendation:** Build a custom heatmap component (not a library) to match the diverging color scale (-10 to +10) and UI-SPEC requirements exactly. Use `react-activity-calendar` only as a reference for layout math. Extend existing consumer/LLM patterns rather than introducing new abstractions.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Sentiment analysis (AI) | Processor Service (Python) | — | LLM calls belong in processor-service, consistent with tag/suggestion/cover consumers |
| Sentiment data storage | Database (PostgreSQL) | — | Dedicated `memory_emotions` table, GORM-managed |
| Calendar data aggregation | Memory Service (Go) | — | SQL aggregation (weighted avg per day), API endpoint |
| Mood calendar visualization | Browser / Client (Next.js) | — | React component with Framer Motion animations |
| Echo message generation | Processor Service (Python) | — | LLM call per DailyReview request, real-time |
| Echo style preference | Browser / Client (localStorage) | — | User preference stored client-side per UI-SPEC |
| Batch backfill orchestration | Memory Service (Go) | — | Paginated query + Redis Stream publish |

---

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 保存记忆时实时分析（新记忆）+ 已有记忆全量批量回溯
- **D-02:** 回溯范围：全量（当前数据量小，未来可扩展）
- **D-03:** 分析全部 content_type：text / link / file / weave
- **D-04:** 复用 Redis Stream 模式：新增 `mood:generate` 队列 + `mood_consumer.py`
- **D-05:** 独立 `memory_emotions` 表：`memory_id` + `sentiment` + `score` + `analyzed_at` + `model_version`
- **D-06:** 情绪粒度：三分类 + 强度（positive/neutral/negative + 1-10）
- **D-07:** 日历聚合策略：某天有多条记忆时，使用加权平均值（positive=+1, neutral=0, negative=-1）
- **D-08:** 支持重新分析：保留 `model_version` 历史
- **D-09:** 扩展 DailyReview：复用现有 `/memories/daily-review` 端点，添加回响语字段
- **D-10:** 记忆来源：混合策略（那年今日 60% + 随机 40%）
- **D-11:** 回响语实时生成：用户打开 DailyReview 时调用 LLM
- **D-12:** 不存储回响历史：不持久化回响语
- **D-13:** 不需要主动推送：纯被动展示
- **D-14:** DailyReview 卡片默认折叠，localStorage 记住偏好
- **D-15:** 回响风格多种可选：温暖/幽默/简洁/洞察
- **D-16:** 情绪日历独立页面 `/mood`

### Claude's Discretion
- 情绪分析 LLM prompt 模板设计
- 情绪日历热力图组件选型（评估 react-calendar-heatmap 等库）
- 批量回溯任务的分片和进度跟踪实现细节
- DailyReview 卡片扩展的 UI 细节

### Deferred Ideas (OUT OF SCOPE)
- Web Push / 邮件主动推送
- 情绪历史页面
- 系统级日历集成（iCal/Outlook）
- 移动端 widget

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MOOD-01 | 新增 `memory_emotions` 表迁移 | Standard PostgreSQL migration pattern (005_memory_relations.sql reference) |
| MOOD-02 | 新增 `mood:generate` Redis Stream + MoodConsumer | BaseConsumer pattern verified (base.py), TagConsumer/SuggestionConsumer as reference |
| MOOD-03 | LLM sentiment analysis prompt + provider method | OpenAIProvider/AnthropicProvider `generate()` method exists; add `analyze_sentiment()` |
| MOOD-04 | 情绪分析结果回写 memory_emotions 表 | MemoryServiceClient.update_task_status pattern + new emotion repository |
| MOOD-05 | 批量回溯已有记忆的情绪分析 | Paginated memory query + Redis Stream publish per batch |
| MOOD-06 | 新增 `GET /mood/calendar` API | MemoryService aggregation query (weighted avg per day) |
| MOOD-07 | 新增 `GET /mood/insight` API (月度洞察) | LLM call with monthly emotion summary |
| MOOD-08 | 扩展 `GET /memories/daily-review` (添加回响语) | Existing endpoint at memory_handler.go:885-908 |
| MOOD-09 | 回响语 LLM prompt (4种风格) | Suggestion prompt pattern (suggestion_prompts.py) as reference |
| MOOD-10 | 情绪日历页面 `/mood` | Custom heatmap component (see Standard Stack decision) |
| MOOD-11 | EchoCard 扩展 (DailyReview + 回响) | DailyReviewCard.tsx exists; extend with echo section |
| MOOD-12 | 回响风格选择器 + localStorage | EchoStyleSelector component per UI-SPEC |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-activity-calendar | 3.2.0 [VERIFIED: npm registry] | Reference for heatmap layout math | Built-in dark mode, `theme` prop, `renderBlock` for custom tooltip, SSR support |
| framer-motion | 11.0.8 [VERIFIED: package.json] | Cell stagger animations, page transitions | Already in project, UI-SPEC requires it |
| lucide-react | 0.344.0 [VERIFIED: package.json] | Icons (Heart, Laugh, Lightbulb, Feather) | Already in project |
| shadcn/ui v3 | latest [VERIFIED: UI-SPEC] | Tooltip, Badge, Button, Switch, Separator | Already installed |

### Decision: Custom Heatmap vs. Library

**Recommendation: Build custom heatmap component.** [VERIFIED: UI-SPEC analysis]

The UI-SPEC requires a **diverging color scale** (green for positive, gray for neutral, red for negative) mapped to scores -10 to +10. Neither `react-calendar-heatmap` nor `react-activity-calendar` supports diverging scales natively:

- `react-calendar-heatmap` (1.10.0): Single-hue scale only via `classForValue`. No built-in tooltip, requires `react-tooltip` integration. Last updated 2023. [VERIFIED: npm registry + WebSearch]
- `react-activity-calendar` (3.2.0): Supports `theme` prop but only for single activity level (0-4). `renderBlock` allows custom rendering but the base color logic assumes a single dimension. [VERIFIED: npm registry + WebSearch]

**Custom component approach:**
- Use CSS Grid for 53 weeks x 7 days layout (year view)
- Each cell is a `<button>` with inline `backgroundColor` from mood color utility
- Framer Motion for stagger animation (`delay = (weekIndex * 7 + dayIndex) * 8ms`)
- shadcn Tooltip primitive for hover detail
- Total component size estimate: ~200 lines

**Reference only:** Study `react-activity-calendar`'s source for week-column layout algorithm (how to arrange 365 days into 53 columns starting from the first Sunday).

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-tooltip | — | Alternative tooltip if shadcn Tooltip insufficient | Only if shadcn Tooltip has performance issues with 365 cells |

### Backend Stack (no new dependencies)

| Component | Status | Notes |
|-----------|--------|-------|
| Redis Stream | Already used | Add `mood:generate` stream, reuse `RedisTaskQueue.PublishTask()` |
| GORM | Already used | Add `EmotionRepository` interface + `GormEmotionRepository` |
| LLM Factory | Already used | Add `analyze_sentiment()` abstract method to `LLMProvider` |
| OpenAIProvider | Already used | Implement `analyze_sentiment()` with structured output prompt |
| AnthropicProvider | Already used | Implement `analyze_sentiment()` with same prompt |

---

## Architecture Patterns

### System Architecture Diagram

```
New Memory Created / Batch Backfill Triggered
       |
       v
[Memory Service] --publish--> Redis Stream `mood:generate`
       |                           (memory_id, content, content_type, llm_config)
       |                                    |
       |                                    v
       |                           [Processor Service]
       |                           MoodConsumer (extends BaseConsumer)
       |                           |
       |                           v
       |                    LLMFactory.create()
       |                    analyze_sentiment(content)
       |                    Returns: {sentiment, score, reason}
       |                           |
       |                           v
       |                    PATCH /internal/memories/:id/tasks
       |                    (task_type="mood:generate", result={sentiment, score, reason})
       |                                    |
       v                                    v
[Memory Service] <--internal API--- MemoryService.UpdateTaskStatus()
       |
       v
INSERT INTO memory_emotions (memory_id, sentiment, score, model_version)
       |
       v
User opens /mood page
       |
       v
GET /api/v1/mood/calendar?year=2026
       |
       v
[Memory Service] SQL aggregation:
SELECT DATE(created_at), weighted_avg(score) FROM memory_emotions
WHERE user_id = ? AND YEAR = ? GROUP BY day
       |
       v
Frontend renders heatmap with diverging color scale

---

DailyReview Echo Flow:
User opens homepage / clicks "生成回响"
       |
       v
GET /api/v1/memories/daily-review?style=warm
       |
       v
[Memory Service]
  1. Select memory (60% 那年今日 + 40% random)
  2. Call Processor Service /generate/chat or internal LLM
  3. Generate echo message with style-specific prompt
       |
       v
Return: {today_count, top_tags, worth_reviewing, echo_message}
```

### Recommended Project Structure

```
# Backend additions
services/memory-service/
  internal/
    domain/
      emotion.go              # Emotion, MoodDayData, MoodInsight structs
    repository/
      emotion_repository.go   # EmotionRepository interface + Gorm impl
    service/
      emotion_service.go      # Mood calendar aggregation, insight generation
    transport/
      mood_handler.go         # GET /mood/calendar, GET /mood/insight

services/processor-service/
  app/
    consumers/
      mood_consumer.py        # MoodConsumer extends RedisStreamConsumer
    services/
      llm/
        base.py               # Add analyze_sentiment() abstract method
        openai_provider.py    # Implement analyze_sentiment()
        anthropic_provider.py # Implement analyze_sentiment()
        prompts/
          sentiment_prompts.py # Sentiment analysis prompt templates
          echo_prompts.py      # Echo generation prompt templates (4 styles)

shared/migrations/
  006_memory_emotions.sql     # New table + indexes

# Frontend additions
web/
  app/
    (main)/
      mood/
        page.tsx              # Mood calendar page
  components/
    mood/
      mood-calendar.tsx       # Custom heatmap grid
      mood-calendar-legend.tsx
      mood-day-tooltip.tsx    # shadcn Tooltip wrapper
      mood-insight-card.tsx
      day-detail-panel.tsx
    echo/
      echo-card.tsx           # Extended DailyReviewCard
      echo-style-selector.tsx
      echo-message.tsx
  lib/
    mood-colors.ts            # Color scale utilities (-10 to +10)
    api.ts                    # Add getMoodCalendar, getMoodInsight
  hooks/
    use-mood-calendar.ts
```

### Pattern 1: Redis Stream Consumer (MoodConsumer)

**What:** Inherit `RedisStreamConsumer` base class, implement `process_message()` for sentiment analysis.

**When to use:** All async AI processing tasks in the processor-service.

**Example:**
```python
# Source: services/processor-service/app/consumers/base.py (verified)
# Pattern identical to TagConsumer, SuggestionConsumer, CoverConsumer

class MoodConsumer(RedisStreamConsumer):
    def __init__(self, redis_client, memory_client):
        super().__init__(
            redis_client=redis_client,
            stream="mood:generate",
            group="processor-group",
            consumer="processor-mood-1",
            memory_client=memory_client,
            max_retries=3,
        )

    async def process_message(self, msg_id: str, fields: dict):
        memory_id = fields.get("memory_id", "")
        content = fields.get("content", "")
        content_type = fields.get("content_type", "")

        llm = _create_llm(fields)
        result = await llm.analyze_sentiment(content)
        # result = {"sentiment": "positive", "score": 7, "reason": "..."}

        await self.memory_client.update_task_status(
            memory_id, "mood:generate", "completed",
            result={"sentiment": result["sentiment"], "score": result["score"], "reason": result["reason"]}
        )
```

### Pattern 2: LLM Provider Extension

**What:** Add `analyze_sentiment()` method to `LLMProvider` base class, implement in both OpenAI and Anthropic providers.

**When to use:** Any new LLM-powered feature.

**Example:**
```python
# Source: services/processor-service/app/services/llm/base.py (verified)
class LLMProvider(ABC):
    # ... existing methods ...

    @abstractmethod
    async def analyze_sentiment(self, content: str) -> dict:
        """Analyze sentiment of content.
        Returns: {"sentiment": "positive|neutral|negative", "score": 1-10, "reason": str}
        """
        pass
```

### Pattern 3: Weighted Daily Aggregation (SQL)

**What:** Aggregate multiple emotions per day into a single score using weighted average.

**When to use:** Mood calendar data API.

**Example:**
```sql
-- Source: Derived from D-07 (CONTEXT.md)
SELECT
    DATE(m.created_at) as day,
    AVG(CASE
        WHEN e.sentiment = 'positive' THEN e.score
        WHEN e.sentiment = 'negative' THEN -e.score
        ELSE 0
    END) as weighted_score,
    COUNT(*) as memory_count,
    MODE() WITHIN GROUP (ORDER BY e.sentiment) as dominant_sentiment
FROM memories m
JOIN memory_emotions e ON m.id = e.memory_id
WHERE m.user_id = ?
  AND EXTRACT(YEAR FROM m.created_at) = ?
GROUP BY DATE(m.created_at)
ORDER BY day;
```

### Pattern 4: API Response Extension (DailyReview)

**What:** Extend existing API response without breaking backward compatibility.

**When to use:** Adding fields to existing endpoints.

**Example:**
```go
// Source: services/memory-service/internal/transport/memory_handler.go:885-908 (verified)
// Existing GetDailyReview handler - add optional echo_message field

func (h *MemoryHandler) GetDailyReview(c *gin.Context) {
    // ... existing code ...
    style := c.Query("style") // optional echo style parameter
    review, echoMessage, err := h.memoryService.GetDailyReview(ctx, userID, style)
    // ...
    data := gin.H{
        "today_count": review.TodayCount,
        "top_tags":    review.TopTags,
    }
    if review.WorthReviewing != nil {
        data["worth_reviewing"] = review.WorthReviewing.SafeResponse()
    }
    if echoMessage != "" {
        data["echo_message"] = echoMessage
    }
    c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
}
```

### Anti-Patterns to Avoid

- **Storing echo messages:** UI-SPEC D-12 explicitly says "不存储回响历史". Do not add an `echo_messages` table.
- **Synchronous LLM calls in API handlers:** Echo generation must call the processor-service LLM endpoint asynchronously or the API will timeout. Use the existing `/api/v1/generate/chat` endpoint in processor-service.
- **Embedding sentiment in memories table:** D-05 requires independent `memory_emotions` table for model versioning support.
- **Client-side sentiment analysis:** Never do LLM calls from the browser. All AI processing stays in processor-service.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Calendar heatmap layout | Custom SVG math from scratch | CSS Grid with 53 columns | Grid handles responsive layout; only need to compute day-to-cell mapping |
| LLM API client | Raw HTTP requests | Existing LLMFactory + provider classes | Retry logic, rate limiting, timeout handling already implemented |
| Redis Stream consumer | Thread-based polling | Existing BaseConsumer + async | Pending recovery, ack handling, trace propagation all built-in |
| Date math (week start, year boundaries) | Manual calculation | `date-fns` or native `Date` | Error-prone, especially with timezones |
| Color interpolation | Manual RGB math | OKLCH CSS variables or predefined scale | UI-SPEC provides exact hex values for each range |

**Key insight:** The only truly custom component is the heatmap grid layout. Everything else (LLM, Redis, API patterns) has established reusable assets in the codebase.

---

## Runtime State Inventory

This phase does NOT involve rename/refactor/migration of existing identifiers. It adds new capabilities. However, batch backfill has runtime considerations:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing memories without emotion data | Batch backfill via paginated query + Redis Stream |
| Live service config | Processor-service env: `enable_mood_consumer` flag needed | Add to `app/config.py` and docker-compose |
| OS-registered state | None | None — verified |
| Secrets/env vars | None new; reuses existing LLM API keys | None |
| Build artifacts | None | None |

**Nothing found in category:** OS-registered state, secrets/env vars (new), build artifacts.

---

## Common Pitfalls

### Pitfall 1: LLM Prompt Engineering for Structured Output
**What goes wrong:** LLM returns free-form text instead of parseable sentiment/score/reason.
**Why it happens:** Insufficient prompt constraints; model hallucinates format.
**How to avoid:** Use explicit JSON schema in prompt with examples. Add regex/JSON fallback parsing. Test with both OpenAI and Anthropic models.
**Warning signs:** Consumer repeatedly fails with "invalid sentiment format" in logs.

### Pitfall 2: Batch Backfill Blocking the Queue
**What goes wrong:** Publishing thousands of backfill messages at once overwhelms Redis Stream or creates a long processing backlog.
**Why it happens:** No pagination or rate limiting on backfill.
**How to avoid:** Process in batches of 50 memories. Add delay between batches. Consider a dedicated backfill endpoint that returns a job ID rather than blocking.
**Warning signs:** Redis memory usage spikes; processor-service CPU pegged; new memory mood analysis delayed.

### Pitfall 3: Timezone Mismatch in Calendar Aggregation
**What goes wrong:** Memories created late at night in user's timezone appear on the wrong day in the calendar.
**Why it happens:** PostgreSQL `DATE(created_at)` uses UTC; user's local timezone may be +8.
**How to avoid:** Store `created_at` in UTC (already done), but aggregate using the user's timezone. Either pass timezone from frontend or default to Asia/Shanghai per project locale. Use `created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai'`.
**Warning signs:** User reports "yesterday's memories show on today".

### Pitfall 4: Echo Generation API Timeout
**What goes wrong:** `GET /memories/daily-review` with echo generation takes >5s and triggers Gateway timeout.
**Why it happens:** LLM call is synchronous within the API handler.
**How to avoid:** Call processor-service LLM endpoint with 10s timeout. If timeout, return DailyReview without echo_message (frontend shows "生成中，请稍后重试"). Or make echo generation a separate API call (`POST /memories/daily-review/echo`).
**Warning signs:** Frontend shows loading spinner indefinitely; Gateway 504 errors in logs.

### Pitfall 5: Diverging Color Scale Accessibility
**What goes wrong:** Red-green color scale is unreadable for colorblind users; also fails WCAG contrast in dark mode.
**Why it happens:** Green-red is the most common colorblindness deficiency.
**How to avoid:** Per UI-SPEC, use the exact hex values provided (tested for contrast). Add pattern/texture variation or ensure cells have `aria-label` with sentiment text. Do not rely solely on color.
**Warning signs:** Lighthouse accessibility score < 90.

---

## Code Examples

### Sentiment Analysis Prompt Template

```python
# Source: Derived from suggestion_prompts.py pattern + CONTEXT.md D-06

SENTIMENT_SYSTEM_PROMPT = """你是一位情绪分析专家。请分析以下用户保存的记忆内容的情绪倾向。

要求：
1. 情绪分类（sentiment）：positive（积极）/ neutral（中性）/ negative（消极）
2. 情绪强度（score）：1-10 的整数
   - positive: 1=轻微积极, 10=非常积极
   - negative: 1=轻微消极, 10=非常消极
   - neutral: 一律为 5
3. 简短理由（reason）：20-50字，说明为什么这样判断

输出格式（严格JSON，不要其他内容）：
{"sentiment": "positive", "score": 7, "reason": "用户记录了一个愉快的周末活动，语气轻松"}

内容类型说明：
- text: 用户直接输入的文本
- link: 链接的标题和摘要
- file: 文件提取的文本内容
- weave: AI编织的文章内容
"""

def build_sentiment_prompt(content: str, content_type: str) -> str:
    return f"""{SENTIMENT_SYSTEM_PROMPT}

内容类型：{content_type}
内容：
{content[:3000]}

请分析以上内容的情绪倾向，输出JSON格式结果："""
```

### Echo Generation Prompt Template (4 Styles)

```python
# Source: Derived from suggestion_prompts.py pattern + UI-SPEC

ECHO_STYLE_PERSONAS = {
    "warm": "你是一位温柔体贴的老朋友，语气温暖、充满关怀，善于发现记忆中的美好。",
    "humorous": "你是一位幽默风趣的伙伴，善于用轻松调侃的方式让回忆变得有趣。",
    "concise": "你是一位洞察深刻的智者，用简洁有力的语言点出记忆的核心意义。",
    "poetic": "你是一位诗意文艺的观察者，用优美抒情的语言唤醒记忆的温度。",
}

def build_echo_prompt(memory_content: str, style: str, years_ago: int) -> str:
    persona = ECHO_STYLE_PERSONAS.get(style, ECHO_STYLE_PERSONAS["warm"])
    return f"""{persona}

你的任务：根据用户 {years_ago} 年前保存的这条记忆，生成一段温暖的回响语，让用户与过去的自己重逢。

要求：
- 长度：80-150个汉字
- 语气：根据选择的风格调整
- 内容：呼应记忆的主题，可以提出问题、分享感悟、或简单陪伴
- 不要总结记忆内容，而是以一种"对话"的方式与过去的用户交流

记忆内容：
{memory_content[:500]}

请直接输出回响语，不要加引号、标题或格式标记。"""
```

### Mood Calendar Color Utility

```typescript
// Source: Derived from UI-SPEC Color section

export const MOOD_COLORS = {
  light: {
    stronglyPositive: '#216e39',  // +8 to +10
    positive: '#30a14e',          // +5 to +7
    mildlyPositive: '#56d364',    // +2 to +4
    neutral: '#ebedf0',           // -1 to +1
    mildlyNegative: '#f85149',    // -4 to -2
    negative: '#cf222e',          // -7 to -5
    stronglyNegative: '#82071e',  // -10 to -8
    noData: '#ebedf0',
  },
  dark: {
    stronglyPositive: '#39d353',
    positive: '#2ea043',
    mildlyPositive: '#56d364',
    neutral: '#161b22',
    mildlyNegative: '#f85149',
    negative: '#da3633',
    stronglyNegative: '#ff7b72',
    noData: '#21262d',
  },
} as const;

export function scoreToColor(score: number | null, isDark: boolean): string {
  if (score === null) return isDark ? MOOD_COLORS.dark.noData : MOOD_COLORS.light.noData;
  const palette = isDark ? MOOD_COLORS.dark : MOOD_COLORS.light;
  if (score >= 8) return palette.stronglyPositive;
  if (score >= 5) return palette.positive;
  if (score >= 2) return palette.mildlyPositive;
  if (score >= -1) return palette.neutral;
  if (score >= -4) return palette.mildlyNegative;
  if (score >= -7) return palette.negative;
  return palette.stronglyNegative;
}
```

### Database Migration

```sql
-- Source: Pattern from 005_memory_relations.sql + CONTEXT.md D-05

CREATE TABLE IF NOT EXISTS memory_emotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    sentiment VARCHAR(20) NOT NULL CHECK (sentiment IN ('positive', 'neutral', 'negative')),
    score INT NOT NULL CHECK (score >= 1 AND score <= 10),
    reason TEXT,
    model_version VARCHAR(50) DEFAULT 'v1',
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(memory_id, model_version)
);

CREATE INDEX IF NOT EXISTS idx_memory_emotions_memory ON memory_emotions(memory_id);
CREATE INDEX IF NOT EXISTS idx_memory_emotions_sentiment ON memory_emotions(sentiment);
CREATE INDEX IF NOT EXISTS idx_memory_emotions_analyzed ON memory_emotions(analyzed_at);

-- For calendar aggregation queries
CREATE INDEX IF NOT EXISTS idx_memory_emotions_user_date
ON memory_emotions(memory_id, analyzed_at);

CREATE TRIGGER update_memory_emotions_updated_at
    BEFORE UPDATE ON memory_emotions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE memory_emotions IS '记忆情绪分析结果，支持模型版本演进';
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `react-calendar-heatmap` (single-hue, no tooltip) | Custom component with diverging scale + shadcn Tooltip | Phase 15 | Full control over color scale and accessibility |
| Storing AI suggestions in `ai_suggestions` table | Storing emotions in `memory_emotions` table | Phase 15 | Separates emotion data from suggestion data for independent evolution |
| TagConsumer pattern (simple result) | MoodConsumer with structured JSON result | Phase 15 | Requires robust prompt engineering for consistent output format |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `react-activity-calendar` does not support diverging color scales natively | Standard Stack | If wrong, could use library instead of custom component; low risk |
| A2 | Processor-service has sufficient compute to handle mood analysis backlog | Architecture | If wrong, need to add consumer scaling or backfill throttling |
| A3 | LLM models (gpt-4o-mini, claude-sonnet) reliably output structured JSON for sentiment | Code Examples | If wrong, need to add more robust parsing/retry logic |
| A4 | User timezone can be defaulted to Asia/Shanghai for aggregation | Common Pitfalls | If wrong, need to add timezone preference to user settings |

---

## Open Questions

1. **Batch backfill trigger mechanism**
   - What we know: Need to analyze all existing memories. D-02 says "全量回溯".
   - What's unclear: Should backfill be triggered automatically on deploy (migration script)? Or via a manual admin API?
   - Recommendation: Add a one-time backfill script in `scripts/` that queries paginated memories and publishes to `mood:generate`. Run manually after deployment.

2. **Echo generation latency budget**
   - What we know: UI-SPEC says echo is generated when user opens DailyReview.
   - What's unclear: Is 3-second LLM latency acceptable? Should we cache echo for the same day?
   - Recommendation: Even though D-12 says "不存储回响历史", consider caching "today's echo" in memory-service for 1 hour to avoid repeated LLM calls. This is not "history" — it's a performance optimization.

3. **Monthly insight generation frequency**
   - What we know: UI-SPEC shows "本月情绪洞察" card.
   - What's unclear: Generate on-demand when user views the month? Pre-generate and cache?
   - Recommendation: Generate on-demand, cache in memory-service Redis for 24 hours keyed by `user_id:year:month`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.14 | Processor-service | Yes | 3.14.3 | — |
| Go 1.25 | Memory-service, Gateway | Yes | 1.25.0 | — |
| Node.js 20+ | Next.js frontend | Yes | (implied by Next.js 14) | — |
| Redis 7 | Redis Stream | Yes | 7.x (docker-compose) | — |
| PostgreSQL 15 | Data storage | Yes | 15.x (docker-compose) | — |
| OpenAI API | Sentiment analysis | Yes (env key) | gpt-4o-mini | Anthropic fallback |
| Anthropic API | Sentiment analysis | Yes (env key) | claude-sonnet | OpenAI fallback |

**Missing dependencies with no fallback:** None.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (Go) | Go testing + testify (existing) |
| Framework (Python) | pytest (existing) |
| Framework (Frontend) | Jest + React Testing Library (existing) |
| E2E | Playwright (existing) |
| Config file | `jest.config.js` (implied), `playwright.config.ts` |
| Quick run command (Go) | `go test ./... -run TestMood` |
| Quick run command (Python) | `pytest tests/test_mood_consumer.py -x` |
| Full suite command | `make test` or `go test ./...` + `pytest` + `npm test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MOOD-01 | Migration creates memory_emotions table | integration | `go test ./...` (migration test) | ❌ Wave 0 |
| MOOD-02 | MoodConsumer processes mood:generate messages | unit | `pytest tests/test_mood_consumer.py -x` | ❌ Wave 0 |
| MOOD-03 | LLM analyze_sentiment returns valid JSON | unit | `pytest tests/test_llm_providers.py -x` | ❌ Wave 0 |
| MOOD-04 | Emotion result written to DB | integration | `go test ./...` | ❌ Wave 0 |
| MOOD-05 | Batch backfill publishes correct number of tasks | unit | `pytest tests/test_backfill.py -x` | ❌ Wave 0 |
| MOOD-06 | Calendar API returns correct aggregation | unit | `go test ./... -run TestMoodCalendar` | ❌ Wave 0 |
| MOOD-07 | Insight API calls LLM with monthly summary | unit | `go test ./...` | ❌ Wave 0 |
| MOOD-08 | DailyReview includes echo_message when requested | unit | `go test ./... -run TestDailyReview` | ❌ Wave 0 |
| MOOD-09 | Echo prompt generates 4 distinct styles | unit | `pytest tests/test_echo_prompts.py -x` | ❌ Wave 0 |
| MOOD-10 | MoodCalendar renders 365 cells | component | `npm test -- MoodCalendar` | ❌ Wave 0 |
| MOOD-11 | EchoCard expands/collapses with animation | component | `npm test -- EchoCard` | ❌ Wave 0 |
| MOOD-12 | Style selector persists to localStorage | component | `npm test -- EchoStyleSelector` | ❌ Wave 0 |

### Wave 0 Gaps

- [ ] `services/processor-service/tests/test_mood_consumer.py` — covers MOOD-02, MOOD-03
- [ ] `services/processor-service/app/services/llm/prompts/sentiment_prompts.py` — covers MOOD-03
- [ ] `services/processor-service/app/services/llm/prompts/echo_prompts.py` — covers MOOD-09
- [ ] `services/memory-service/internal/repository/emotion_repository.go` — covers MOOD-04
- [ ] `services/memory-service/internal/transport/mood_handler.go` — covers MOOD-06, MOOD-07
- [ ] `web/components/mood/mood-calendar.tsx` — covers MOOD-10
- [ ] `web/components/echo/echo-card.tsx` — covers MOOD-11
- [ ] `shared/migrations/006_memory_emotions.sql` — covers MOOD-01

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | — (no new auth flows) |
| V3 Session Management | No | — (no new session mechanisms) |
| V4 Access Control | Yes | Existing JWT middleware; new endpoints require `getUserID()` |
| V5 Input Validation | Yes | `validator/v10` for query params; `binding:"oneof=..."` for enums |
| V6 Cryptography | No | — (no new crypto) |
| V7 Error Handling | Yes | Zap logger for errors; no sensitive data in responses |
| V8 Data Protection | Yes | `SafeResponse()` pattern; emotion data user-scoped |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthorized mood data access | Information Disclosure | All mood queries include `user_id = ?` filter |
| LLM prompt injection via memory content | Tampering | Content is user-generated by definition; no mitigation needed (user analyzing own content) |
| Batch backfill DoS | Denial of Service | Paginate (50/batch), add rate limit on backfill endpoint |
| Echo generation abuse | Denial of Service | Rate limit `/memories/daily-review` endpoint; cache echo for 1 hour |

---

## Sources

### Primary (HIGH confidence)
- `services/processor-service/app/consumers/base.py` — Redis Stream Consumer base class pattern
- `services/processor-service/app/consumers/tag_consumer.py` — Consumer implementation pattern
- `services/processor-service/app/consumers/suggestion_consumer.py` — LLM call + result persistence pattern
- `services/processor-service/app/consumers/cover_consumer.py` — Multi-strategy consumer pattern
- `services/processor-service/app/services/llm/base.py` — LLMProvider abstract class
- `services/processor-service/app/services/llm/openai_provider.py` — OpenAI implementation
- `services/processor-service/app/services/llm/anthropic_provider.py` — Anthropic implementation
- `services/memory-service/internal/transport/memory_handler.go` — Handler patterns, DailyReview endpoint
- `services/memory-service/internal/service/memory_service.go` — Service layer patterns
- `services/memory-service/internal/repository/memory_repository.go` — Repository patterns
- `services/memory-service/internal/domain/memory.go` — Domain types
- `shared/migrations/005_memory_relations.sql` — Migration pattern reference
- `web/lib/api.ts` — Frontend API client pattern
- `web/components/warmth/daily-review-card.tsx` — Existing DailyReview component
- `web/package.json` — Frontend dependencies
- `15-CONTEXT.md` — Phase decisions and constraints
- `15-UI-SPEC.md` — Visual and interaction contract

### Secondary (MEDIUM confidence)
- [react-calendar-heatmap npm](https://www.npmjs.com/package/react-calendar-heatmap) — v1.10.0, API verified via WebSearch
- [react-activity-calendar npm](https://www.npmjs.com/package/react-activity-calendar) — v3.2.0, theme/dark mode verified via WebSearch
- [React Activity Calendar Storybook](https://grubersjoe.github.io/react-activity-calendar/) — Color themes and renderBlock prop

### Tertiary (LOW confidence)
- Context7 CLI fallback produced library IDs but docs fetch failed due to Windows path issues; library metadata was usable

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All libraries verified via npm registry or existing in codebase
- Architecture: HIGH — Patterns directly reusable from existing consumers and handlers
- Pitfalls: MEDIUM-HIGH — Based on prior phase experience (Phase 8 suggestion, Phase 14 cover) and standard async/LLM best practices

**Research date:** 2026-05-11
**Valid until:** 2026-06-11 (30 days for stable stack)
