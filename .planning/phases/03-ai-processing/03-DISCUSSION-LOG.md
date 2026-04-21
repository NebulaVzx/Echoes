# Phase 3: AI 处理层 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 3-AI 处理层
**Areas discussed:** LLM 策略、链接抓取、Redis 消费模式、状态流转

---

## LLM 降级策略

| Option | Description | Selected |
|--------|-------------|----------|
| 本地降级 (jieba/TF-IDF) | LLM 失败时 fallback 到本地关键词提取 | |
| 报错不降级 | LLM 失败时返回准确错误，不降级，核心依赖 AI | ✓ |

**User's choice:** 不做降级，报错即可。核心依赖 AI 能力。
**Notes:** 用户还提出 LLM 应可配置（非写死），需要配置和状态监控界面。

---

## 链接抓取深度

| Option | Description | Selected |
|--------|-------------|----------|
| 仅标题+描述 | 只抓 `<title>` 和 `<meta description>` | |
| 正文+LLM 摘要 | 抓正文，用 LLM 生成摘要 | ✓ |

**User's choice:** 抓正文做摘要，可尝试 LLM 的网络搜索能力。
**Notes:** 反爬虫网站需处理（403/429 记录错误但不阻塞）。

---

## Redis Stream 消费模式

| Option | Description | Selected |
|--------|-------------|----------|
| 简单轮询 | 简单 XREAD，无 ACK | |
| Consumer Group | XREADGROUP + ACK，支持故障转移 | ✓ |

**User's choice:** Consumer Group，确保可靠实现。
**Notes:** Processor 和 Vectorizer 各自使用不同 Consumer Group。

---

## 状态流转与子任务重试

| Option | Description | Selected |
|--------|-------------|----------|
| 单一状态字段 | 只有 `processing_status`，成功/失败二值 | |
| 子任务级状态 | metadata JSONB 记录各子任务独立状态，支持部分成功 | ✓ |

**User's choice:** 部分成功时用户可单独重试失败部分。
**Notes:** 需要子任务级状态追踪（link:fetch、text:vectorize、tag:generate 各自独立）。

---

## 状态更新方式

| Option | Description | Selected |
|--------|-------------|----------|
| 直连 DB | Processor/Vectorizer 直接连接 PostgreSQL | |
| 内部 API | 通过 API 调用 Memory Service 更新 | ✓ (Claude's discretion) |

**User's choice:** "你按照最佳实践来，只要效果是可靠的就行"
**Claude decision:** 通过内部 API 调用 Memory Service，保持微服务数据边界。

---

## Claude's Discretion

- BGE-M3 模型加载策略
- LLM Provider 抽象层接口设计
- Processor 内部任务调度细节
- 内部 API 具体路径和认证方式

## Deferred Ideas

- LLM 配置界面完整 UI — Sprint 4/5
- 高级链接抓取（PDF、视频）— Phase 2
- 多模态处理 — 明确不做
- 死信队列 — Sprint 3 时间充裕时考虑
