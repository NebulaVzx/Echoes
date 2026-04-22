---
name: Echoes Roadmap
description: 拾忆产品开发路线图
---

# 路线图

## 里程碑

- ✅ **v1.0 MVP** — Phases 0-5 (shipped 2026-04-22)
- 🚧 **v1.1 Echo Assistant** — Phases 6-7 (in progress)

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

## 进行中

### 🚧 v1.1 Echo Assistant

**目标：** 对话式 AI 助手，基于 RAG 回答用户记忆相关问题 + 修复 v1.0 已知问题

#### Phase 6: Echo Assistant

**目标：** 实现对话式 AI 助手，支持 RAG 检索 + LLM 生成回答 + 对话历史

**需求映射：** CHAT-01 ~ CHAT-15

**成功标准：**
1. 用户可在首页打开 Chat 侧边栏与 AI 对话
2. AI 能基于用户记忆回答"我上周存的关于 Go 的文章有哪些？"
3. 回答中显示引用的记忆来源
4. 对话历史可持久化、查看、删除
5. Playwright E2E 测试覆盖核心 Chat 流程

**计划（预估）：**
- 06-01: 数据库模型 + API（conversations/messages 表，Chat API）
- 06-02: RAG 检索逻辑（复用语义搜索 + Prompt 组装）
- 06-03: LLM 回答生成（复用现有 Provider + 流式/非流式）
- 06-04: 前端 Chat UI 侧边栏（消息列表、输入框、历史对话）
- 06-05: 对话历史管理（创建、切换、删除）

#### Phase 7: Bug Fixes & Quality

**目标：** 修复 v1.0 已知问题，补充 Go 单元测试

**需求映射：** BUG-01 ~ BUG-11

**成功标准：**
1. OAuth state 条目 10 分钟后自动清理
2. Gateway /health 返回下游服务健康状态
3. 时间轴支持分页（页码组件）
4. User/Memory/Gateway 核心逻辑有单元测试覆盖
5. 所有修复通过 Playwright E2E 回归测试

**计划（预估）：**
- 07-01: OAuth state TTL + 定期清理
- 07-02: Gateway 下游健康检查 + 超时重试
- 07-03: 前端分页 UI
- 07-04: Go 单元测试（User/Memory/Gateway）

## 进度

| Phase | 里程碑 | 计划完成 | 状态 | 完成日期 |
|-------|--------|----------|------|----------|
| 1. Foundation | v1.0 | — | Complete | 2026-04-19 |
| 2. Authentication | v1.0 | — | Complete | 2026-04-19 |
| 3. Memory Capture | v1.0 | — | Complete | 2026-04-19 |
| 4. AI Processing | v1.0 | 4/4 | Complete | 2026-04-19 |
| 5. Search | v1.0 | 4/4 | Complete | 2026-04-21 |
| 6. Observability + Polish | v1.0 | 7/7 | Complete | 2026-04-22 |
| 6. Echo Assistant | v1.1 | 0/5 | Not started | — |
| 7. Bug Fixes | v1.1 | 0/4 | Not started | — |

---

*Roadmap updated: 2026-04-22 for v1.1 milestone*
