---
name: Echoes Roadmap
description: 拾忆产品开发路线图
---

# 路线图

## 里程碑

- ✅ **v1.0 MVP** — Phases 0-5 (shipped 2026-04-22)
- ✅ **v1.1 Echo Assistant** — Phases 6-7 (shipped 2026-04-25)
- 🚧 **v1.2 "记忆的温度"** — Phases 8-10 (规划中)

## 已发布

<details>
<summary>✅ v1.0 MVP (Sprint 0-5) — SHIPPED 2026-04-22</summary>

| Phase | 名称 | 计划数 | 完成日期 |
|-------|------|--------|----------|
| 0 | 基础设施 | — | 2026-04-19 |
| 1 | 认证体系 | — | 2026-04-19 |
| 2 | 记忆捕获 | — | 2026-04-19 |
| 3 | AI 处理层 | 4 | 2026-04-19 |
| 4 | 搜索能力 | 4 | 2026-04-21 |
| 5 | 可观测性 + 打磨 | 7 | 2026-04-22 |

完整归档见 `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v1.1 Echo Assistant (Phases 6-7) — SHIPPED 2026-04-25</summary>

| Phase | 名称 | 计划数 | 完成日期 |
|-------|------|--------|----------|
| 6 | Echo Assistant | 5 | 2026-04-22 |
| 7 | Bug Fixes & Quality | 4 | 2026-04-25 |

完整归档见 `.planning/milestones/v1.1-ROADMAP.md`

</details>

## 进行中

### 🚧 v1.2 "记忆的温度" (规划中)

**Slogan:** "不只是存储，更是陪伴"

| Phase | 名称 | 计划数 | 状态 |
|-------|------|--------|------|
| 8 | AI 陪伴建议 | 5 | 🚧 规划中 |
| 9 | 标签重生 | — | 🚧 规划中 |
| 10 | 记忆的温度 | — | 🚧 规划中 |

**核心方向：**
1. **AI 陪伴建议** — 保存记忆后生成温情的、有建设性的 AI 反馈，持久化保存
2. **标签重生** — 标签从静态附属品变为可过滤、可管理、可发现的知识节点
3. **记忆的温度** — Streaks、那年今日、时间胶囊，让记忆有情感价值

## Phase 8: AI 陪伴建议 — 计划列表

**目标：** 保存记忆后异步生成温情/建设性的 AI 反馈建议，持久化保存并与记忆关联。用户可选择开启/关闭此功能（默认关闭）。

| 计划 | 文件 | 目标 | 波次 |
|------|------|------|------|
| 08-01 | `08-01-PLAN.md` | 数据库 Schema (ai_suggestions 表) + Go/TS 类型定义 | Wave 1 |
| 08-02 | `08-02-PLAN.md` | Memory Service 建议层 (Repository + Service + Handler + Redis Stream) | Wave 2 |
| 08-03 | `08-03-PLAN.md` | Processor Service 建议消费者 (Consumer + Prompts + LLM 扩展) | Wave 2 |
| 08-04 | `08-04-PLAN.md` | 前端创建表单 + 设置页 (AI 开关、建议卡片、风格配置) | Wave 3 |
| 08-05 | `08-05-PLAN.md` | 前端记忆卡片 + 详情页 (✨ 标记、建议展示、反馈) | Wave 3 |

## 进度

| Phase | 里程碑 | 计划完成 | 状态 | 完成日期 |
|-------|--------|----------|------|----------|
| 0. Foundation | v1.0 | — | Complete | 2026-04-19 |
| 1. Authentication | v1.0 | — | Complete | 2026-04-19 |
| 2. Memory Capture | v1.0 | — | Complete | 2026-04-19 |
| 3. AI Processing | v1.0 | 4/4 | Complete | 2026-04-19 |
| 4. Search | v1.0 | 4/4 | Complete | 2026-04-21 |
| 5. Observability + Polish | v1.0 | 7/7 | Complete | 2026-04-22 |
| 6. Echo Assistant | v1.1 | 5/5 | Complete | 2026-04-22 |
| 7. Bug Fixes & Quality | v1.1 | 4/4 | Complete | 2026-04-25 |
| 8. AI 陪伴建议 | v1.2 | 0/5 | Planning | — |
| 9. 标签重生 | v1.2 | — | Planning | — |
| 10. 记忆的温度 | v1.2 | — | Planning | — |

---

*Roadmap updated: 2026-04-25 for Phase 8 planning*
