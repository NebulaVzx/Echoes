# Phase 14: memory-covers-weaving - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-09
**Phase:** 14-memory-covers-weaving
**Areas discussed:** 封面生成服务, 封面生成时机与流程, 时间轴布局变化, 多选交互与编织入口, 编织内容持久化

---

## 封面生成服务

| Option | Description | Selected |
|--------|-------------|----------|
| DALL-E 3 | 复用现有 OpenAI Provider，质量稳定，中文理解好 | ✓ |
| Pollinations.AI | 免费但限速 1req/5s，国内访问不稳定 | (开发环境降级) |
| 本地 Stable Diffusion | 完全免费但需要 GPU 服务器 | |

**User's choice:** "全部认可，按此执行" — 确认 DALL-E 3 为主，Pollinations.AI 为开发环境降级
**Notes:** 复用现有 LLM Provider 工厂模式，新增 image generation prompt

---

## 封面生成时机与流程

| Option | Description | Selected |
|--------|-------------|----------|
| 保存时异步入队（Redis Stream） | 与现有模式一致，打开时间轴时封面已就绪 | ✓ |
| 前端按需懒加载 | 不增加后端负担，但首次滚动时等待 | |

**User's choice:** "全部认可，按此执行" — 确认保存时异步入队
**Notes:** 新增 `cover:generate` Redis Stream 队列和 `cover_consumer.py`

---

## 时间轴布局变化

| Option | Description | Selected |
|--------|-------------|----------|
| 单列列表 + 左侧缩略图 | 保持现有布局熟悉感，移动端友好 | ✓ |
| 网格/杂志墙布局 | 视觉冲击力更强，但与现有风格差异大 | |

**User's choice:** "全部认可，按此执行" — 确认单列列表 + 左侧缩略图
**Notes:** 桌面端 120x90，平板端 100x75，移动端 80x60。无封面时显示渐变背景 + 首字母图标

---

## 多选交互与编织入口

| Option | Description | Selected |
|--------|-------------|----------|
| 桌面端 Ctrl+点击，移动端长按 | 标准多选模式，顶部/底部操作栏 | ✓ |
| 仅 Command Palette 入口 | 不够直观， discoverability 差 | |

**User's choice:** "全部认可，按此执行" — 确认多选交互方案
**Notes:** 编织入口包括：时间轴多选操作栏、Command Palette (`/weave`)、星图 ExplorePanel 可选扩展

---

## 编织内容持久化

| Option | Description | Selected |
|--------|-------------|----------|
| 保存为新的 memory（content_type="weave"） | 复用现有记忆系统，支持编辑和导出 | ✓ |
| 单独的 weaves 表 | 需要额外维护，与现有系统割裂 | |

**User's choice:** "全部认可，按此执行" — 确认保存为新的 memory
**Notes:** metadata 中包含 `weave_source_ids`，使用 `[^1]` 格式标注来源

---

## Claude's Discretion

- 封面生成 prompt 模板设计
- 编织四种模式的具体 prompt 设计
- 多选状态管理的具体实现方式
- 编织编辑页面的具体 UI 设计

---

## Deferred Ideas

None — discussion stayed within phase scope
