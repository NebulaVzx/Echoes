# Phase 7: Bug Fixes & Quality - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-23
**Phase:** 07-bug-fixes-quality
**Areas discussed:** OAuth State Cleanup, Gateway Health Check, Frontend Pagination, Go Unit Testing

---

## OAuth State 清理机制

| Option | Description | Selected |
|--------|-------------|----------|
| 后台 goroutine + time.Ticker | 每 5 分钟扫描 map 清理过期 state，改动最小 | ✓ |
| sync.Map + TTL 封装 | 替换为 sync.Map 并封装 TTL 逻辑，改动较大 | |
| Redis TTL | 引入 Redis 依赖存储 state，适合多实例但过度设计 | |

**User's choice:** 用户指示"采用最佳实践"，选择 goroutine 定期清理方案
**Rationale:** 当前单机部署，map+goroutine 足够简单有效；Redis 引入额外依赖无必要；sync.Map 改动量大于收益

---

## Gateway 健康检查深度

| Option | Description | Selected |
|--------|-------------|----------|
| 聚合式下游检查 | 检查 User/Memory Service 可达性，返回聚合状态 + 503 | ✓ |
| 仅 gateway 自身 | 保持现状，仅返回 gateway 状态 | |
| 深度检查（含 DB） | 检查下游服务的数据库连接，过重且可能引发雪崩 | |

**User's choice:** 用户指示"采用最佳实践"，选择聚合式下游检查
**Rationale:** 微服务网关标准做法；轻量级 HTTP 探测足够；DB 级检查可能加重故障

---

## 前端分页交互模式

| Option | Description | Selected |
|--------|-------------|----------|
| 双模式（默认加载更多 + Settings 可切页码） | 默认加载更多按钮，用户可在 Settings 切换为页码组件 | ✓ |
| "加载更多" 按钮 | Notion-like，保留滚动位置，极简风格 | （默认子模式） |
| 传统页码组件 | 适合管理后台，记忆量大时跳转方便 | （可选子模式） |
| 无限滚动 | 无法保留滚动位置，与 BUG-08 冲突 | |

**User's choice:** 用户明确要求"默认加载更多，但可以在 Settings 切换成页码组件"
**Rationale:** 加载更多符合 Notion-like 默认体验；页码组件作为偏好设置满足重度用户快速跳转需求；偏好存储在 users.settings 复用现有设置系统

---

## Go 单元测试范围与策略

| Option | Description | Selected |
|--------|-------------|----------|
| Service 层 + Mock Repository | 测试核心领域逻辑，mock 数据层，标准 Go 实践 | ✓ |
| 全量测试（Handler+Service+Repo） | 覆盖广但 Handler 层性价比低 | |
| testcontainers 集成测试 | 需要真实 DB，过重，不适合本阶段 | |

**User's choice:** 用户指示"采用最佳实践"，选择 Service 层 + Mock Repository
**Rationale:** Service 层包含核心业务逻辑；Repository 已有接口便于 mock；符合 Go 社区测试最佳实践

---

## Claude's Discretion

无 — 用户明确要求"全部按照最佳实践"

## Deferred Ideas

- Redis TTL for OAuth state（多实例时考虑）
- testcontainers 集成测试（后续阶段）
- 熔断器模式（后续 milestone）
