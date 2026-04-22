---
name: Phase 5 Context
phase: 5
description: 可观测性 + 打磨上线的实现决策
---

# Phase 5: 可观测性 + 打磨上线 — 决策记录

> 创建日期：2026-04-21
> 状态：讨论完成，准备进入规划阶段

---

## 范围边界（已锁定）

**不添加新功能，只增强现有功能的可见性和体验。**
- 可观测性：Metrics / Tracing / Logging 三件套
- 前端打磨：动效、加载状态、错误处理、空状态
- 后端打磨：输入验证、统一错误格式、限流、CORS
- E2E 测试：端到端流程验证
- 不碰：业务功能（认证/记忆/搜索）、数据库结构

---

## 灰色地带决策

### 1. Python 服务可观测性范围 — 决策：统一接入

**决策：** Processor Service 和 Vectorizer Service 也接入 Prometheus + OpenTelemetry，与 Go 服务共用同一套 Grafana Dashboard。

**实现方式：**
- Python 侧使用 `prometheus-client` + `opentelemetry-python`
- FastAPI 用 `opentelemetry-instrumentation-fastapi` 自动产生 HTTP span
- Redis Stream 消费需要手动创建 span（上下文从消息 headers 中提取）

**为什么：** 用户链路跨越 Go → Python（如创建记忆 → Processor 标签生成），如果 Python 侧没有 trace，链路是断的。统一 dashboard 也方便运维。

---

### 2. Trace 上下文传播机制 — 决策：OTel 自动注入/提取

**决策：** 使用 OpenTelemetry 的 W3C Trace Context  propagator 自动处理 trace 透传。

**Go 侧：**
- Gateway `otelgin` 中间件自动生成 trace，注入到 HTTP Header
- HTTP Client（Gateway → User/Memory）使用 `otelhttp` 自动携带 header

**Python 侧：**
- FastAPI 使用 `opentelemetry-instrumentation-fastapi` 自动提取 header
- Redis Stream 消息中手动携带 `traceparent`，消费端手动提取

**为什么：** 手动透传容易遗漏边界场景（如异步任务），OTel 自动处理更可靠。

---

### 3. E2E 测试工具 — 决策：Playwright

**决策：** 使用 Playwright 进行端到端测试，替代 bash/curl 脚本。

**测试范围（Phase 5）：**
- 注册 → 登录 → 创建文字记忆 → 搜索记忆 → 查看详情
- 暗黑模式切换
- 设置页面：LLM 配置、搜索阈值

**为什么：** Playwright 能测前端交互（如 toast 提示、动效、路由跳转），bash 脚本只能测 API。Playwright 默认无头模式，适合 CI。

**注意：** 本项目已有 `dev-start.ps1` / `make dev-start` 启动脚本，Playwright 测试前需要先确保服务 running。

---

### 4. Zap 日志与 Gin Logger — 决策：完全替换

**决策：** 所有 Go 服务完全使用 Zap 结构化日志，移除 Gin 内置 logger 中间件。

**格式：** JSON，字段包括 `timestamp`, `level`, `msg`, `trace_id`, `span_id`, `service`, `path`, `method`, `status`, `duration_ms`

**配置：**
- Development: Console 输出（可读）
- Production: JSON 输出（可收集）
- 通过 `LOG_LEVEL` 环境变量控制（默认 INFO）

**为什么：** 统一格式便于日志收集和分析，Gin logger 的默认格式无法携带 trace_id。

---

### 5. Framer Motion 动效范围 — 决策：最佳实践

**决策：** 以下动效全部实现：

| 场景 | 动效 | 参数 |
|------|------|------|
| 页面切换（路由跳转）| 淡入 + 轻微上滑 | `opacity: 0→1, y: 10→0`, 200ms, ease-out |
| 记忆卡片入场 | 逐张淡入 + 上滑 | stagger 50ms, 同上参数 |
| 加载状态 | 骨架屏（Skeleton） | shadcn/ui Skeleton 组件 |
| 空状态 | 图标 + 文案淡入 | 300ms |
| 按钮/交互 | 缩放反馈 | `scale: 0.97`, 100ms |

**不做：** 过于复杂的动画（如卡片拖拽、3D 翻转），保持 Notion-like 克制风格。

---

### 6. Prometheus 指标维度 — 决策：最佳实践

**决策：** 以下指标 + 标签维度：

**Counter：**
- `http_requests_total` — labels: `service`, `method`, `path`, `status_code`
- `llm_requests_total` — labels: `service`, `provider`, `model`, `status`
- `memory_processing_total` — labels: `status` (pending/processing/completed/failed)

**Histogram：**
- `http_request_duration_seconds` — labels: `service`, `method`, `path`
- `llm_request_duration_seconds` — labels: `provider`, `model`

**不加 user_id 维度：** 避免高基数问题（user_id 是无限增长的）。

---

### 7. Grafana 仪表盘交付 — 决策：JSON + Provisioning

**决策：**
- Dashboard JSON 文件存放在 `.planning/grafana/` 或 `shared/grafana/`
- Docker Compose 通过 Grafana provisioning 自动导入
- 提供：QPS、延迟 P99、错误率、内存处理状态分布

---

## 已锁定的前置决策（来自 Roadmap / 先前阶段）

| 决策 | 来源 | 内容 |
|------|------|------|
| 可观测性栈 | Roadmap | Prometheus + OpenTelemetry + Zap + Jaeger + Grafana |
| 必须接入的服务 | Roadmap | 所有 Go 服务（Gateway / User / Memory）+ Python（本阶段新增） |
| 日志格式 | Roadmap | JSON，含 trace_id / span_id |
| Trace 传播 | Roadmap | Gateway 生成 trace_id，HTTP / Redis 透传 |
| Docker Compose 扩展 | Roadmap | 新增 prometheus / jaeger / grafana 容器 |

---

## 可复用的代码库资产

| 资产 | 位置 | 复用方式 |
|------|------|----------|
| 限流中间件 | `services/gateway/internal/middleware/rate_limit.go` | 扩展到所有服务或保留 Gateway 统一限流 |
| Toast 通知组件 | `web/components/ui/toast.tsx` | 复用，增加错误场景调用 |
| CSS 过渡动画 | `web/app/globals.css` | 已有基础 transition，扩展 Framer Motion |
| /health 端点 | 各服务 `cmd/main.go` | 复用，增加 readiness 检查 |
| API 错误格式 | `web/lib/api.ts` | 已有统一格式，后端需对齐 |
| 骨架屏基础 | shadcn/ui `Skeleton` | 直接复用 |

---

## 依赖与顺序

**实现顺序建议：**
1. Zap 日志替换（影响所有 Go 服务，先做）
2. Prometheus Metrics 接入（Go + Python）
3. OpenTelemetry Tracing 接入（Go + Python）
4. Docker Compose 扩展（Prometheus + Jaeger + Grafana）
5. Grafana Dashboard 配置
6. 前端打磨（Framer Motion + 骨架屏 + 空状态）
7. 后端打磨（输入验证 + 统一错误 + CORS）
8. Playwright E2E 测试

**关键依赖：**
- Tracing 依赖 Zap（trace_id 需要写入日志）
- E2E 测试依赖所有服务 + 前端同时 running
- Grafana Dashboard 依赖 Metrics 已暴露

---

## 明确不做（Scope 边界）

- ❌ K8s 部署配置（Sprint 5 只更新 Docker Compose）
- ❌ AlertManager 告警规则（只收集 metrics，不配置告警）
- ❌ 性能压测（只验证可观测性，不做负载测试）
- ❌ 移动端适配（保持现有响应式，不做专门优化）
- ❌ 第三方 Agent 市场（Phase 3 预留，不实现）

---

## 下一步

进入 `/gsd-plan-phase 5` — 基于本 CONTEXT.md 创建可执行计划。
