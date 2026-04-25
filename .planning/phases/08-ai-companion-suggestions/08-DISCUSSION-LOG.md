# Phase 8: AI 陪伴建议 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 08-ai-companion-suggestions
**Areas discussed:** Data Storage, Generation Timing, Display Locations, Prompt Strategy, Failure Handling

---

## 1. 数据存储方式

| Option | Description | Selected |
|--------|-------------|----------|
| 新增独立表 `ai_suggestions` | 一对一外键关联，可记录反馈和元数据，不影响 memories 表 | ✓ |
| `memories` 表新增 JSONB 字段 | 简单但扩展性差，查询不便 | |
| Redis 缓存 | 仅适合短期，不符合持久化需求 | |

**User's choice:** 用户授权采用最佳实践，选择独立表方案
**Notes:** 基于 2025 年 AI Companion 分层存储最佳实践（PostgreSQL 存储结构化建议记录）

---

## 2. 生成时机与通知机制

| Option | Description | Selected |
|--------|-------------|----------|
| 异步生成 + Redis Stream + 前端轮询 | 复用现有架构，不阻塞保存，用户体验好 | ✓ |
| 同步生成 | 用户立即看到建议，但增加保存延迟 1-3 秒 | |
| WebSocket / SSE | 实时推送，但对于简单建议生成过于复杂 | |

**User's choice:** 用户授权采用最佳实践，选择异步 + 轮询方案
**Notes:** 复用现有 Redis Stream + Processor 架构最一致；轮询间隔 2 秒，超时 15 秒

---

## 3. 建议展示的位置与时机

| Option | Description | Selected |
|--------|-------------|----------|
| 三层展示（创建表单 + 详情页 + 卡片标记） | 即时反馈 + 深度浏览 + 发现标记 | ✓ |
| 仅详情页展示 | 不干扰创建流程，但建议易被埋没 | |
| 仅创建表单展示 | 即时反馈强，但长期无法回顾 | |

**User's choice:** 用户授权采用最佳实践，选择三层展示
**Notes:** 创建表单是情感连接最强的时刻；卡片标记帮助用户发现哪些记忆有建议

---

## 4. Prompt 工程策略

| Option | Description | Selected |
|--------|-------------|----------|
| 双 Prompt（text/link）+ 用户偏好风格 | 针对性强，用户可个性化 | ✓ |
| 单一通用 Prompt | 简单但建议质量可能不高 | |
| 多 Prompt + 动态选择 | 过于复杂，当前版本不需要 | |

**User's choice:** 用户授权采用最佳实践，选择双 Prompt + 用户偏好
**Notes:** 基于 CHI 2025 模块化 Prompt 架构研究；用户可在设置选择温柔型/实用型/启发型

---

## 5. 失败与降级

| Option | Description | Selected |
|--------|-------------|----------|
| 静默忽略 + 内部监控 | 不打扰用户，内部记录日志 | ✓ |
| 展示失败状态，可重试 | 透明但增加 UI 复杂度 | |
| 降级为本地规则生成 | 需要额外开发，收益不大 | |

**User's choice:** 用户授权采用最佳实践，选择静默降级
**Notes:** 内容 < 15 字跳过生成；超时 > 15 秒自动放弃；符合"不打扰"设计原则

---

## Claude's Discretion

- 建议卡片的具体视觉设计（圆角、阴影、动画细节）— 由实现者决定，保持与现有 UI 一致
- 具体 Prompt 文本内容 — 需要测试调优
- 轮询间隔和超时阈值 — 可在范围内微调

## Deferred Ideas

- 多轮建议对话 — v1.3+
- 基于反馈的个性化优化 — v1.3+
- 建议的情感分析时间线 — v1.3+
- 实时输入建议 — 明确不做（Phase 8 范围外）
