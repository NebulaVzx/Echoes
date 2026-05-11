# Phase 15: 情绪与回响 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-11
**Phase:** 15-mood-echo
**Areas discussed:** 情绪分析时机与范围, 情绪数据存储模型, 每日回响与已有功能的关系, 推送触发机制

---

## 情绪分析时机与范围

| Option | Description | Selected |
|--------|-------------|----------|
| 保存记忆时实时分析 | 保存时异步入队（复用 Redis Stream 模式），新记忆立即有情绪数据 | ✓ |
| 后台批量分析全部记忆 | 一次性任务批量分析所有已有记忆，新记忆仍需实时触发 | ✓ |
| 用户打开情绪日历按需分析 | 懒加载模式，节省 API 调用成本但首次打开有延迟 | |

**User's choice:** 组合策略：保存时实时分析（新记忆）+ 已有记忆全量批量回溯
**Notes:** 当前数据量小，全量回溯即可。未来新用户可采用最近 N 条策略。

---

## 情绪数据存储模型

| Option | Description | Selected |
|--------|-------------|----------|
| memories 表新增字段 | 最简单，但未来调整分析模型需更新所有记录 | |
| 独立 memory_emotions 表 | 支持模型演进和审计，但 JOIN 查询增加复杂度 | ✓ |
| memories.metadata JSONB | 无需迁移，但 JSONB 查询性能和类型安全较差 | |

**User's choice:** 独立 `memory_emotions` 表

| Option | Description | Selected |
|--------|-------------|----------|
| 三分类 + 强度 | positive/neutral/negative + 1-10，简单直观 | ✓ |
| 细粒度情感 | 6-8 种情绪，更丰富但展示复杂 | |
| 三分类 + 细粒度标签 | 兼顾简洁和丰富，但存储和展示更复杂 | |

**User's choice:** 三分类 + 强度

| Option | Description | Selected |
|--------|-------------|----------|
| 主导情绪（数量取胜） | positive 记忆数量 > negative 数量 → 显示 positive | |
| 加权平均值 | 计算所有记忆的情绪强度平均值 | ✓ |
| 取最新记忆 | 以当天最新保存的记忆情绪为准 | |
| 显示情绪分布（hover 展开） | 格子颜色用平均值，hover 展示详细分布 | |

**User's choice:** 加权平均值

| Option | Description | Selected |
|--------|-------------|----------|
| 支持重新分析 | 保留 model_version 历史，最新版本覆盖展示 | ✓ |
| 不支持，一次性 | 与现有 tag/suggestion 一样，生成后不再改变 | |
| 支持用户手动修正 | 用户在记忆详情页可手动修改情绪标签 | |

**User's choice:** 支持重新分析

---

## 每日回响与已有功能的关系

| Option | Description | Selected |
|--------|-------------|----------|
| 扩展 DailyReview | 复用现有 API 和 UI，用户无认知负担 | ✓ |
| 独立 Daily Echo 端点 | 新建端点和页面，与 DailyReview 并存 | |
| 合并为统一「今日」页面 | 改动大但体验统一 | |

**User's choice:** 扩展 DailyReview

| Option | Description | Selected |
|--------|-------------|----------|
| 优先那年今日，fallback 随机 | 情感价值最高，依赖历史数据 | |
| 智能排序（未读优先 + 高质量 + 关联度） | 避免重复推送，但算法复杂 | |
| 情绪匹配 | 根据今天情绪选择同情绪记忆 | |
| 混合策略：那年今日 60% + 随机 40% | 兼顾情感价值和多样性 | ✓ |

**User's choice:** 混合策略：那年今日 60% + 随机 40%

| Option | Description | Selected |
|--------|-------------|----------|
| 预生成（每天一次） | 性能好，但用户多次刷新内容不变 | |
| 实时生成（打开时生成） | 每次打开可能看到不同回响语，有新鲜感 | ✓ |
| 预生成 + 手动刷新 | 兼顾性能和灵活性 | |

**User's choice:** 实时生成（打开时生成）

| Option | Description | Selected |
|--------|-------------|----------|
| 存储全部历史 | 提供「回响历史」页面回顾 | |
| 不存储，每次新鲜 | 简单，但用户无法回顾 | ✓ |
| 只存用户收藏 | 平衡存储成本和用户需求 | |

**User's choice:** 不存储，每次新鲜

---

## 推送触发机制

| Option | Description | Selected |
|--------|-------------|----------|
| 不需要主动推送 | 纯被动展示，用户打开页面时才看到 | ✓ |
| Web Push 推送 | 需要 Service Worker + Web Push API + VAPID 密钥 | |
| 邮件推送 | 需要邮件服务集成 | |

**User's choice:** 不需要主动推送

| Option | Description | Selected |
|--------|-------------|----------|
| 默认展开（含回响语） | 最直观，但占用更多首屏空间 | |
| 默认折叠，点击展开 | 给用户控制权，localStorage 记住状态 | ✓ |
| 首页不展示，独立页面查看 | 减少首页干扰，但降低使用率 | |

**User's choice:** 默认折叠，点击展开

| Option | Description | Selected |
|--------|-------------|----------|
| 温暖安慰型 | 温柔、鼓励、治愈 | |
| 幽默调侃型 | 轻松、俏皮、有梗 | |
| 简洁洞察型 | 简短、有力、引发思考 | |
| 多种风格可选 | 用户在设置中选择喜欢的风格 | ✓ |

**User's choice:** 多种风格可选

| Option | Description | Selected |
|--------|-------------|----------|
| 独立页面 /mood | 完整展示全年热力图 + 月视图 + 主题视图 | ✓ |
| 集成到首页时间轴上方 | 迷你版热力图横条 | |
| 集成到用户 Profile 页 | 作为个人数据的一部分 | |

**User's choice:** 独立页面 /mood

---

## Claude's Discretion

- 情绪分析 LLM prompt 模板设计（由 planner/researcher 具体设计）
- 情绪日历热力图组件选型（由 planner 评估 react-calendar-heatmap 等库）
- 批量回溯任务的分片和进度跟踪实现细节
- DailyReview 卡片扩展的 UI 细节

---

## Deferred Ideas

- Web Push 主动推送 — 需要 Service Worker + Web Push API，v1.4+ 评估
- 邮件推送 — 需要邮件服务集成，v1.4+ 评估
- 情绪历史页面 — 用户反馈需要时再实现
- 系统级日历集成 — iCal/Outlook 同步情绪事件，v1.5+ 考虑
- 移动端 widget — iOS/Android 桌面小组件，需要原生开发（Expo 阶段）
