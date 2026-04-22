# Phase 5: 可观测性 + 打磨上线 - Research

**Researched:** 2026-04-21
**Domain:** Observability (Prometheus/OpenTelemetry/Zap), Frontend Polish (Framer Motion), E2E Testing (Playwright), Backend Polish (Validation/Rate Limit/CORS)
**Confidence:** HIGH

## Summary

Phase 5 是 Echoes 项目的最后一个 Sprint，目标是将产品从"功能可用"提升到"生产就绪"。核心工作分为三大块：(1) 可观测性三件套（Metrics/Tracing/Logging）接入全部 5 个服务；(2) 前后端体验打磨（动效、加载状态、错误处理、输入验证）；(3) 端到端测试覆盖核心用户流程。

本研究基于已锁定的 CONTEXT.md 决策，深入调研了各技术栈的最新版本、集成模式和已知陷阱。Go 侧使用 Zap v1.27.1 + Prometheus client_golang v1.23.2 + OpenTelemetry Go v1.43.0；Python 侧使用 prometheus-client + opentelemetry-python v1.35.0；基础设施使用 Prometheus + Jaeger all-in-one + Grafana 通过 Docker Compose 编排；前端使用已有的 Framer Motion v11 实现页面过渡和列表动画；E2E 使用 Playwright v1.59.1（WSL 中已有 v1.58.2）。

所有版本均通过 Go Module Proxy / npm registry / PyPI 验证，非训练数据假设。

**Primary recommendation:** 按 CONTEXT.md 建议的顺序实施（Zap -> Metrics -> Tracing -> Infra -> Grafana -> Frontend -> Backend -> E2E），每个 Go 服务独立初始化可观测性 SDK，Gateway 作为 trace 根节点通过 HTTP Header 向下透传，Python 服务通过 OTLP 直接上报 Jaeger。

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Metrics 收集 | 各服务自身 | Prometheus Server | 每个服务通过 `/metrics` 端点自暴露，Prometheus 拉取聚合 |
| Trace 生成 | Gateway (根节点) | 所有下游服务 | Gateway 生成 trace_id，HTTP / Redis 透传全链路 |
| 结构化日志 | 各服务自身 | — | Zap/标准库直接输出，携带 trace_id |
| 日志/Trace 查看 | Grafana + Jaeger UI | — | Grafana 看指标，Jaeger UI 看链路 |
| 限流 | Gateway | — | 统一入口限流，避免各服务重复实现 |
| CORS | Gateway | — | 统一处理跨域，下游服务无需关心 |
| 输入验证 | 各服务 Handler | — | Go validator / Pydantic 在边界处校验 |
| 页面动效 | Browser (Client) | — | Framer Motion 纯客户端动画 |
| E2E 测试 | CI/本地测试环境 | — | Playwright 模拟真实用户操作 |

---

## User Constraints (from CONTEXT.md)

### Locked Decisions
1. **Python 服务可观测性范围：** Processor 和 Vectorizer 统一接入 Prometheus + OpenTelemetry，与 Go 服务共用 Grafana Dashboard
2. **Trace 上下文传播：** 使用 OTel W3C Trace Context propagator 自动处理，Go 侧 `otelgin` + `otelhttp`，Python 侧 `opentelemetry-instrumentation-fastapi` + Redis Stream 手动携带 `traceparent`
3. **E2E 测试工具：** Playwright，测试范围：注册->登录->创建记忆->搜索->查看详情、暗黑模式、设置页面
4. **Zap 日志：** 完全替换 Gin 内置 logger，JSON 格式，字段含 `timestamp, level, msg, trace_id, span_id, service, path, method, status, duration_ms`
5. **Framer Motion 动效：** 页面切换(淡入+上滑)、卡片入场(stagger 50ms)、骨架屏、空状态、按钮缩放反馈；不做复杂动画
6. **Prometheus 指标维度：** Counter `http_requests_total`, `llm_requests_total`, `memory_processing_total`；Histogram `http_request_duration_seconds`, `llm_request_duration_seconds`；不加 user_id 维度避免高基数
7. **Grafana 仪表盘：** JSON 文件 + Provisioning 自动导入，展示 QPS/延迟 P99/错误率/内存处理状态

### Claude's Discretion
- 具体动画参数微调（duration、ease 曲线）
- Playwright 测试用例的具体组织方式
- Grafana Dashboard 面板的具体布局和查询语句

### Deferred Ideas (OUT OF SCOPE)
- K8s 部署配置（只更新 Docker Compose）
- AlertManager 告警规则
- 性能压测
- 移动端适配专项优化
- 第三方 Agent 市场

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R7.1 | `/metrics` 端点暴露 Prometheus 指标 | Go: `promhttp.Handler()` + Python: `make_asgi_app()` |
| R7.2 | HTTP 请求总量、延迟分桶 | Go: `prometheus.NewCounterVec` + `NewHistogramVec`；Python: `prometheus-client` Counter/Histogram |
| R7.3 | Gateway 生成 trace_id 透传全链路 | Go: `otelgin.Middleware()` + `otelhttp.NewTransport()`；Python: `FastAPIInstrumentor` + `propagate.extract/inject` |
| R7.4 | OpenTelemetry 跨服务调用 Span | Go: `trace.NewTracerProvider` + OTLP exporter；Python: `TracerProvider` + `OTLPSpanExporter` |
| R7.5 | Zap 结构化日志（JSON 格式） | `zap.NewProductionConfig()` + 自定义 `EncoderConfig` |
| R7.6 | 日志含 trace_id / span_id | `trace.SpanFromContext()` 提取 span context，注入 zap fields |
| R6.5 | 页面切换动画（Framer Motion） | `AnimatePresence` + `motion.div` in `app/template.tsx` |
| R6.6 | 卡片入场动画 | `staggerChildren` + `motion.div` variants |
| R6.7 | 加载状态 / 骨架屏 | shadcn/ui `Skeleton` 组件（需确认是否已安装） |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **Go: Zap** | v1.27.1 [VERIFIED: Go Proxy] | 结构化日志 | Uber 出品，性能最高，Go 生态事实标准 |
| **Go: gin-contrib/zap** | v1.1.7 [VERIFIED: Go Proxy] | Gin + Zap 集成 | 官方 contrib，替代 Gin 默认 logger |
| **Go: Prometheus client_golang** | v1.23.2 [VERIFIED: Go Proxy] | Metrics 暴露 | Prometheus 官方 Go 客户端 |
| **Go: OpenTelemetry Go** | v1.43.0 [VERIFIED: Go Proxy] | Trace SDK | CNCF 标准，2026-04 最新稳定版 |
| **Go: otelgin** | v0.68.0 [VERIFIED: Go Proxy] | Gin 自动 instrument | OTel Go Contrib 官方中间件 |
| **Go: otelhttp** | v0.68.0 [VERIFIED: Go Proxy] | HTTP 客户端 instrument | OTel Go Contrib 官方 transport wrapper |
| **Go: go-playground/validator/v10** | v10.30.2 [VERIFIED: Go Proxy] | 输入验证 | Gin 内置绑定使用的就是它 |
| **Go: golang.org/x/time/rate** | latest [VERIFIED: Go Proxy] | Token Bucket 限流 | Go 官方扩展包，生产就绪 |
| **Python: prometheus-client** | latest [CITED: pypi.org] | Metrics 暴露 | Prometheus 官方 Python 客户端 |
| **Python: opentelemetry-api** | 1.35.0 [CITED: pypi.org] | Trace API | 2026-04 最新稳定版 |
| **Python: opentelemetry-sdk** | 1.35.0 [CITED: pypi.org] | Trace SDK | 与 API 配套 |
| **Python: opentelemetry-instrumentation-fastapi** | 0.56b0 [CITED: pypi.org] | FastAPI 自动 instrument | 官方 contrib，自动产生 HTTP span |
| **Python: opentelemetry-exporter-otlp** | 1.35.0 [CITED: pypi.org] | OTLP 导出器 | 上报到 Jaeger/Collector |
| **Frontend: Framer Motion** | v11.0.8 [VERIFIED: package.json] | 动画库 | 已安装，React/Next.js 生态标准 |
| **Frontend: shadcn/ui Skeleton** | — | 骨架屏 | 项目已使用 shadcn/ui 组件体系 |
| **E2E: Playwright** | v1.59.1 [VERIFIED: npm registry] | 端到端测试 | 微软出品，Next.js 生态首选 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **Go: otel/exporters/otlp/otlptrace/otlptracehttp** | v1.43.0 | OTLP HTTP 导出 trace | 直接上报 Jaeger，无需 Collector |
| **Python: opentelemetry-instrumentation-redis** | 0.56b0 | Redis 自动 instrument | 如需自动追踪 Redis 调用 |
| **Grafana** | latest | 可视化仪表盘 | Docker Compose 运行 |
| **Jaeger all-in-one** | 1.76+ | Trace 收集与展示 | Docker Compose 运行，支持 OTLP |
| **Prometheus** | v3.x | Metrics 收集 | Docker Compose 运行 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zap | slog (Go 1.21+) | slog 是标准库但功能较简单，Zap 性能更好、生态更成熟；CONTEXT.md 已锁定 Zap |
| OTel Jaeger exporter (deprecated) | OTLP exporter | Jaeger exporter 已弃用，OTLP 是标准协议 |
| Custom token bucket | `github.com/gin-contrib/ratelimit` | 官方包更简单但灵活性差；已有自定义实现，建议保留并优化 |
| Playwright | Cypress | Playwright 支持多浏览器、无头模式更好、CI 集成更成熟；CONTEXT.md 已锁定 |

### Go 服务依赖安装

```bash
# Gateway / User Service / Memory Service
cd services/gateway  # 或 user-service, memory-service
go get go.uber.org/zap@v1.27.1
go get github.com/gin-contrib/zap@v1.1.7
go get github.com/prometheus/client_golang@v1.23.2
go get github.com/prometheus/client_golang/prometheus/promhttp
go get go.opentelemetry.io/otel@v1.43.0
go get go.opentelemetry.io/otel/sdk@v1.43.0
go get go.opentelemetry.io/otel/trace@v1.43.0
go get go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp@v1.43.0
go get go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin@v0.68.0
go get go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp@v0.68.0
go get github.com/go-playground/validator/v10@v10.30.2
go get golang.org/x/time/rate@latest
```

### Python 服务依赖安装

```bash
# Processor Service / Vectorizer Service
cd services/processor-service  # 或 vectorizer-service
pip install prometheus-client opentelemetry-api==1.35.0 opentelemetry-sdk==1.35.0 opentelemetry-instrumentation-fastapi==0.56b0 opentelemetry-exporter-otlp==1.35.0
```

### 前端依赖

```bash
cd web
# Framer Motion 已安装 (v11.0.8)
# Playwright 安装
npm install -D @playwright/test@1.59.1
npx playwright install
```

---

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Echoes Observability Stack                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    HTTP (trace header)    ┌─────────────┐                 │
│  │   Web App   │◄─────────────────────────►│   Gateway   │◄──┐             │
│  │  (Next.js)  │                           │   (Go/Gin)  │   │             │
│  └─────────────┘                           └──────┬──────┘   │             │
│                                                   │          │             │
│                              ┌────────────────────┘          │             │
│                              │ HTTP + trace header           │             │
│                              ▼                               │             │
│                    ┌─────────────────┐                       │             │
│                    │  User Service   │                       │             │
│                    │    (Go/Gin)     │                       │             │
│                    └─────────────────┘                       │             │
│                              ▲                               │             │
│                              │ HTTP + trace header           │             │
│                    ┌─────────────────┐                       │             │
│                    │ Memory Service  │◄──────────────────────┘             │
│                    │    (Go/Gin)     │                                     │
│                    └────────┬────────┘                                     │
│                             │ Redis Stream (traceparent in msg)            │
│                             ▼                                              │
│              ┌──────────────────────────────┐                             │
│              │                              │                             │
│    ┌─────────▼──────────┐    ┌──────────────▼──────────┐                 │
│    │ Processor Service  │    │  Vectorizer Service     │                 │
│    │  (Python/FastAPI)  │    │   (Python/FastAPI)      │                 │
│    └────────────────────┘    └─────────────────────────┘                 │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Data Flow                                    │   │
│  │                                                                      │   │
│  │  Metrics ───────► Prometheus ◄──scrape──┬── /metrics (all services)  │   │
│  │                                           │                          │   │
│  │  Traces ────────► Jaeger OTLP ◄──export─┘── OTLP HTTP/gRPC          │   │
│  │                                           │                          │   │
│  │  Logs ──────────► stdout/JSON ◄──log───┬── Zap / Python logging      │   │
│  │                                         │   (trace_id in fields)      │   │
│  │                                         ▼                             │   │
│  │  Visualize ◄── Grafana ──► Prometheus datasource + Jaeger datasource  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (新增/修改)

```
Echoes/
├── docker-compose.yml                    # 新增 prometheus/jaeger/grafana 服务
├── docker-compose.observability.yml      # 可选：独立可观测性配置
├── Makefile                              # 新增 make 命令
├── web/
│   ├── app/
│   │   ├── template.tsx                  # 新增：Framer Motion 页面过渡
│   │   ├── loading.tsx                   # 新增：全局加载状态
│   │   └── (main)/
│   │       ├── page.tsx                  # 修改：卡片 stagger 动画
│   │       └── memory/
│   │           └── [id]/
│   │               └── page.tsx          # 修改：页面过渡
│   ├── components/
│   │   ├── ui/
│   │   │   ├── skeleton.tsx              # 新增/确认：shadcn Skeleton
│   │   │   └── toast.tsx                 # 已存在，扩展错误场景
│   │   ├── memory/
│   │   │   ├── memory-card.tsx           # 修改：添加 motion wrapper
│   │   │   └── memory-list.tsx           # 新增：stagger 容器
│   │   └── empty-state.tsx               # 新增：空状态组件
│   ├── e2e/
│   │   ├── auth.setup.ts                 # 新增：认证 setup
│   │   ├── fixtures/
│   │   │   └── user.json                 # 新增：测试用户数据
│   │   └── specs/
│   │       ├── auth.spec.ts              # 新增：注册/登录
│   │       ├── memory.spec.ts            # 新增：记忆 CRUD
│   │       ├── search.spec.ts            # 新增：搜索
│   │       └── settings.spec.ts          # 新增：设置/暗黑模式
│   └── playwright.config.ts              # 新增
├── services/
│   ├── gateway/
│   │   ├── cmd/main.go                   # 修改：初始化 OTel + Zap
│   │   ├── internal/
│   │   │   ├── middleware/
│   │   │   │   ├── zap_logger.go         # 新增：Zap 中间件
│   │   │   │   ├── metrics.go            # 新增：Prometheus 中间件
│   │   │   │   ├── ratelimit.go          # 已存在，优化
│   │   │   │   ├── auth.go               # 已存在
│   │   │   │   └── cors.go               # 新增：独立 CORS 中间件
│   │   │   ├── observability/
│   │   │   │   ├── zap.go                # 新增：Zap 初始化
│   │   │   │   ├── trace.go              # 新增：TracerProvider 初始化
│   │   │   │   └── metrics.go            # 新增：Prometheus registry
│   │   │   └── router/
│   │   │       └── router.go             # 修改：接入中间件
│   │   └── go.mod                        # 修改：添加依赖
│   ├── user-service/
│   │   ├── cmd/main.go                   # 修改：初始化 OTel + Zap
│   │   ├── internal/
│   │   │   ├── observability/            # 新增（同 gateway 结构）
│   │   │   └── transport/
│   │   │       └── handler.go            # 修改：输入验证
│   │   └── go.mod
│   ├── memory-service/
│   │   ├── cmd/main.go                   # 修改：初始化 OTel + Zap
│   │   ├── internal/
│   │   │   ├── observability/            # 新增
│   │   │   └── transport/
│   │   │       └── handler.go            # 修改：输入验证
│   │   └── go.mod
│   ├── processor-service/
│   │   ├── app/
│   │   │   ├── main.py                   # 修改：OTel + Prometheus 初始化
│   │   │   ├── observability.py          # 新增：统一可观测性初始化
│   │   │   ├── config.py                 # 修改：添加可观测性配置
│   │   │   └── consumers/
│   │   │       └── base.py               # 修改：提取 traceparent
│   │   ├── requirements.txt              # 修改：添加依赖
│   │   └── Dockerfile                    # 无需修改
│   └── vectorizer-service/
│       ├── app/
│       │   ├── main.py                   # 修改：OTel + Prometheus 初始化
│       │   ├── observability.py          # 新增
│       │   ├── config.py                 # 修改
│       │   └── consumers/
│       │       └── base.py               # 修改
│       ├── requirements.txt              # 修改
│       └── Dockerfile
├── shared/
│   └── grafana/                          # 新增
│       ├── provisioning/
│       │   ├── dashboards/
│       │   │   └── dashboards.yaml       # 新增：dashboard provider 配置
│       │   └── datasources/
│       │       └── datasources.yaml      # 新增：Prometheus + Jaeger 数据源
│       └── dashboards/
│           └── echoes-overview.json      # 新增：Echoes 仪表盘 JSON
└── prometheus.yml                        # 新增：Prometheus scrape 配置
```

### Pattern 1: Go 服务可观测性初始化

**What:** 每个 Go 服务在 `main()` 中初始化 Zap + OTel TracerProvider + Prometheus Registry，通过 `observability` 包封装。

**When to use:** 所有 Go 服务（Gateway、User Service、Memory Service）

**Example:**

```go
// services/gateway/internal/observability/zap.go
// Source: https://pkg.go.dev/go.uber.org/zap + CONTEXT.md 决策
package observability

import (
	"os"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

func NewLogger(service string) (*zap.Logger, error) {
	env := os.Getenv("ENV")
	level := os.Getenv("LOG_LEVEL")
	if level == "" {
		level = "info"
	}

	var cfg zap.Config
	if env == "production" {
		cfg = zap.NewProductionConfig()
	} else {
		cfg = zap.NewDevelopmentConfig()
	}

	// 统一字段名
	cfg.EncoderConfig.TimeKey = "timestamp"
	cfg.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
	cfg.EncoderConfig.MessageKey = "msg"
	cfg.EncoderConfig.CallerKey = "caller"

	logLevel, err := zapcore.ParseLevel(level)
	if err != nil {
		logLevel = zapcore.InfoLevel
	}
	cfg.Level = zap.NewAtomicLevelAt(logLevel)

	logger, err := cfg.Build(
		zap.Fields(zap.String("service", service)),
	)
	if err != nil {
		return nil, err
	}
	return logger, nil
}
```

```go
// services/gateway/internal/observability/trace.go
// Source: https://opentelemetry.io/docs/languages/go/getting-started/
package observability

import (
	"context"
	"os"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
)

func InitTracer(serviceName string) (func(context.Context) error, error) {
	ctx := context.Background()

	// OTLP HTTP exporter -> Jaeger
	exporter, err := otlptracehttp.New(ctx,
		otlptracehttp.WithEndpoint("jaeger:4318"), // HTTP endpoint
		otlptracehttp.WithInsecure(),
	)
	if err != nil {
		return nil, err
	}

	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceName(serviceName),
			semconv.ServiceVersion(os.Getenv("SERVICE_VERSION")),
		),
	)
	if err != nil {
		return nil, err
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
	)

	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	return tp.Shutdown, nil
}
```

```go
// services/gateway/cmd/main.go - 修改后
package main

import (
	"context"
	"os"

	"github.com/NebulaVzx/Echoes/services/gateway/internal/observability"
	"github.com/NebulaVzx/Echoes/services/gateway/internal/router"
	"go.uber.org/zap"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// 初始化 Zap
	logger, err := observability.NewLogger("gateway")
	if err != nil {
		panic(err)
	}
	defer logger.Sync()

	// 初始化 Tracer
	shutdown, err := observability.InitTracer("gateway")
	if err != nil {
		logger.Fatal("failed to init tracer", zap.Error(err))
	}
	defer shutdown(context.Background())

	// 设置全局 logger（供其他包使用）
	zap.ReplaceGlobals(logger)

	r := router.Setup(logger)

	logger.Info("gateway starting", zap.String("port", port))
	if err := r.Run(":" + port); err != nil {
		logger.Fatal("failed to start gateway", zap.Error(err))
	}
}
```

### Pattern 2: Gin 中间件链（Zap + Metrics + Trace）

**What:** 替换 `gin.Logger()` 为自定义中间件链，按顺序执行：Trace -> Metrics -> Zap Logging -> Auth -> Rate Limit

**When to use:** Gateway 路由设置，其他 Go 服务可简化（无 Auth/Rate Limit）

**Example:**

```go
// services/gateway/internal/router/router.go - 修改后
func Setup(logger *zap.Logger) *gin.Engine {
	router := gin.New()
	router.Use(gin.Recovery())

	// 1. OpenTelemetry trace（生成/提取 trace）
	router.Use(otelgin.Middleware("gateway"))

	// 2. Prometheus metrics（记录请求数/延迟）
	router.Use(middleware.PrometheusMetrics("gateway"))

	// 3. Zap logger（结构化日志，含 trace_id）
	router.Use(middleware.ZapLogger(logger))

	// 4. CORS
	router.Use(corsMiddleware())

	// ... 其余路由配置
}
```

```go
// services/gateway/internal/middleware/zap_logger.go
package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/zap"
)

func ZapLogger(logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		method := c.Request.Method

		// 提取 trace_id
		span := trace.SpanFromContext(c.Request.Context())
		spanContext := span.SpanContext()
		traceID := ""
		spanID := ""
		if spanContext.IsValid() {
			traceID = spanContext.TraceID().String()
			spanID = spanContext.SpanID().String()
		}

		c.Next()

		// 构建日志字段
		fields := []zap.Field{
			zap.String("path", path),
			zap.String("method", method),
			zap.Int("status", c.Writer.Status()),
			zap.Duration("duration_ms", time.Since(start)),
			zap.String("client_ip", c.ClientIP()),
		}
		if traceID != "" {
			fields = append(fields, zap.String("trace_id", traceID))
			fields = append(fields, zap.String("span_id", spanID))
		}

		if len(c.Errors) > 0 {
			logger.Error("request failed", append(fields, zap.Errors("errors", c.Errors))...)
		} else {
			logger.Info("request completed", fields...)
		}
	}
}
```

### Pattern 3: Prometheus Metrics 中间件

**What:** 使用 `prometheus.NewCounterVec` 和 `NewHistogramVec` 记录 HTTP 请求指标，通过 `/metrics` 端点暴露。

**When to use:** 所有服务

**Example:**

```go
// services/gateway/internal/middleware/metrics.go
package middleware

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	httpRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total HTTP requests",
		},
		[]string{"service", "method", "path", "status_code"},
	)

	httpRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "HTTP request duration in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"service", "method", "path"},
	)
)

func init() {
	prometheus.MustRegister(httpRequestsTotal, httpRequestDuration)
}

func PrometheusMetrics(service string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 跳过 /metrics 端点自身
		if c.Request.URL.Path == "/metrics" {
			c.Next()
			return
		}

		start := time.Now()
		c.Next()

		duration := time.Since(start).Seconds()
		status := strconv.Itoa(c.Writer.Status())
		path := c.Request.URL.Path // 注意：可能需要规范化动态路径
		method := c.Request.Method

		httpRequestsTotal.WithLabelValues(service, method, path, status).Inc()
		httpRequestDuration.WithLabelValues(service, method, path).Observe(duration)
	}
}

// RegisterMetricsEndpoint 注册 /metrics 端点
func RegisterMetricsEndpoint(r *gin.Engine) {
	r.GET("/metrics", gin.WrapH(promhttp.Handler()))
}
```

### Pattern 4: Python FastAPI 可观测性初始化

**What:** 在 FastAPI `lifespan` 中初始化 Prometheus 和 OpenTelemetry，使用 `FastAPIInstrumentor` 自动 instrument。

**When to use:** Processor Service、Vectorizer Service

**Example:**

```python
# services/processor-service/app/observability.py
# Source: https://emdneto.github.io/opentelemetry-by-example/python/fastapi/
from contextlib import asynccontextmanager
from fastapi import FastAPI
from prometheus_client import make_asgi_app
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
import os


def setup_observability(app: FastAPI, service_name: str):
    """Setup Prometheus metrics and OpenTelemetry tracing."""

    # 1. Prometheus /metrics 端点
    metrics_app = make_asgi_app()
    app.mount("/metrics", metrics_app)

    # 2. OpenTelemetry TracerProvider
    resource = Resource.create({
        "service.name": service_name,
        "service.version": os.getenv("SERVICE_VERSION", "0.2.0"),
    })
    provider = TracerProvider(resource=resource)

    # OTLP HTTP exporter -> Jaeger
    otlp_endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://jaeger:4318/v1/traces")
    exporter = OTLPSpanExporter(endpoint=otlp_endpoint)
    provider.add_span_processor(BatchSpanProcessor(exporter))

    trace.set_tracer_provider(provider)

    # 3. 自动 instrument FastAPI
    FastAPIInstrumentor.instrument_app(app)

    return provider
```

```python
# services/processor-service/app/main.py - 修改后
from fastapi import FastAPI
from app.observability import setup_observability

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ... 原有初始化代码 ...

    yield

    # Shutdown: 关闭 tracer provider
    provider = trace.get_tracer_provider()
    if hasattr(provider, 'shutdown'):
        provider.shutdown()

app = FastAPI(lifespan=lifespan)
setup_observability(app, "processor-service")
```

### Pattern 5: Redis Stream Trace 上下文传播

**What:** Memory Service 发布任务时，将当前 trace 的 `traceparent` 写入 Redis Stream message fields；Python Consumer 读取时提取并创建 child span。

**When to use:** 跨语言异步任务链路（Go -> Python via Redis Stream）

**Example:**

```go
// Go 侧：发布时注入 traceparent
import "go.opentelemetry.io/otel/propagation"

func (q *RedisTaskQueue) PublishTask(ctx context.Context, stream string, data map[string]interface{}) error {
	// 提取当前 trace 上下文并序列化
	carrier := propagation.MapCarrier{}
	propagator := propagation.TraceContext{}
	propagator.Inject(ctx, carrier)

	// 将 traceparent 加入 message fields
	fields := map[string]interface{}{
		"traceparent": carrier["traceparent"],
	}
	for k, v := range data {
		fields[k] = v
	}

	return q.redis.XAdd(ctx, &redis.XAddArgs{
		Stream: stream,
		Values: fields,
	}).Err()
}
```

```python
# Python 侧：消费时提取 traceparent
from opentelemetry.propagate import extract, set_span_in_context
from opentelemetry.trace import get_tracer

tracer = get_tracer(__name__)

async def process_message(self, msg_id, fields):
    traceparent = fields.get("traceparent", "")
    if traceparent:
        # 从 traceparent 提取上下文
        carrier = {"traceparent": traceparent}
        parent_context = extract(carrier)
    else:
        parent_context = None

    with tracer.start_as_current_span(
        "process_redis_task",
        context=parent_context,
        attributes={"stream": self.stream, "message_id": msg_id}
    ) as span:
        # ... 实际处理逻辑 ...
        pass
```

### Pattern 6: Framer Motion 页面过渡（Next.js App Router）

**What:** 使用 `app/template.tsx` 创建 `AnimatePresence` 包装器，实现页面切换动画。`template.tsx` 在导航时会重新挂载，支持 exit 动画。

**When to use:** Next.js App Router 页面过渡

**Example:**

```tsx
// web/app/template.tsx
// Source: https://motion.dev/motion/animate-presence/ + Next.js docs
'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { usePathname } from 'next/navigation'

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
```

### Pattern 7: Framer Motion 列表 Stagger 动画

**What:** 使用 variants 定义容器和子项动画，通过 `staggerChildren` 实现逐张入场效果。

**When to use:** 记忆卡片列表、搜索结果列表

**Example:**

```tsx
// web/components/memory/memory-list.tsx
'use client'

import { motion } from 'framer-motion'
import { MemoryCard } from './memory-card'
import type { Memory } from '@/lib/api'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05, // 50ms 间隔
      delayChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: "easeOut" },
  },
}

export function MemoryList({ memories }: { memories: Memory[] }) {
  return (
    <motion.div
      className="flex flex-col gap-5"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {memories.map((memory) => (
        <motion.div key={memory.id} variants={itemVariants}>
          <MemoryCard memory={memory} />
        </motion.div>
      ))}
    </motion.div>
  )
}
```

### Pattern 8: Playwright 认证 Setup

**What:** 使用 Playwright 的 project dependencies 功能，在 setup 项目中执行登录并保存 storage state，后续测试复用。

**When to use:** 需要认证状态的 E2E 测试

**Example:**

```typescript
// web/e2e/auth.setup.ts
import { test as setup, expect } from '@playwright/test'

const authFile = 'playwright/.auth/user.json'

setup('authenticate', async ({ page }) => {
  // 1. 注册测试账号（或直接用 API 创建）
  await page.goto('/register')
  await page.getByLabel('邮箱').fill('test@example.com')
  await page.getByLabel('密码').fill('testpassword123')
  await page.getByLabel('用户名').fill('testuser')
  await page.getByRole('button', { name: '注册' }).click()

  // 2. 等待登录完成（URL 跳转或 localStorage token）
  await page.waitForURL('/')
  await page.waitForFunction(() => {
    return localStorage.getItem('echoes_token') !== null
  })

  // 3. 保存认证状态
  await page.context().storageState({ path: authFile })
})
```

```typescript
// web/playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:3000',
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'cd .. && make dev-start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
```

### Pattern 9: Gin 输入验证 + 统一错误响应

**What:** 使用 `go-playground/validator/v10`（Gin 内置）进行请求校验，统一错误响应格式与前端 `ApiResponse` 对齐。

**When to use:** 所有 Go 服务的 Handler

**Example:**

```go
// 请求结构体定义
type CreateMemoryRequest struct {
	ContentType string   `json:"content_type" binding:"required,oneof=text link"`
	TextContent string   `json:"text_content" binding:"omitempty,max=10000"`
	LinkURL     string   `json:"link_url" binding:"omitempty,url,max=2048"`
	Tags        []string `json:"tags" binding:"omitempty,dive,max=50"`
	Note        string   `json:"note" binding:"omitempty,max=1000"`
}

// 统一错误响应
type ErrorResponse struct {
	Success bool `json:"success"`
	Error   struct {
		Code    string `json:"code"`
		Message string `json:"message"`
		Details []ValidationError `json:"details,omitempty"`
	} `json:"error"`
}

type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

func respondWithValidationError(c *gin.Context, err error) {
	var ve validator.ValidationErrors
	if errors.As(err, &ve) {
		details := make([]ValidationError, 0, len(ve))
		for _, e := range ve {
			details = append(details, ValidationError{
				Field:   e.Field(),
				Message: fmt.Sprintf("validation failed on '%s'", e.Tag()),
			})
		}
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Success: false,
			Error: struct {
				Code    string            `json:"code"`
				Message string            `json:"message"`
				Details []ValidationError `json:"details,omitempty"`
			}{
				Code:    "VALIDATION_ERROR",
				Message: "Request validation failed",
				Details: details,
			},
		})
		return
	}
	c.JSON(http.StatusBadRequest, ErrorResponse{
		Success: false,
		Error: struct {
			Code    string            `json:"code"`
			Message string            `json:"message"`
			Details []ValidationError `json:"details,omitempty"`
		}{
			Code:    "BAD_REQUEST",
			Message: err.Error(),
		},
	})
}
```

### Anti-Patterns to Avoid

- **在 Prometheus labels 中使用 user_id 或 request_id：** 会导致高基数问题，内存爆炸 [CITED: CONTEXT.md 决策]
- **手动透传 trace_id：** 使用 OTel 的 propagator 自动处理，避免遗漏边界场景 [CITED: CONTEXT.md 决策]
- **保留 Gin 默认 logger 同时使用 Zap：** 日志格式不一致，且 Gin logger 无法携带 trace_id [CITED: CONTEXT.md 决策]
- **在 App Router 的 layout.tsx 中使用 AnimatePresence：** layout.tsx 在导航时不会重新挂载，exit 动画不会触发；必须使用 template.tsx [VERIFIED: Next.js docs + Framer Motion docs]
- **Playwright 测试直接操作 localStorage 而不使用 storageState：** 无法正确恢复 cookie 和 sessionStorage，认证状态可能不完整 [CITED: Playwright docs]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token Bucket 限流 | 从零实现（已有基础版） | `golang.org/x/time/rate` | 官方包，经过充分测试，支持 Wait/AllowN 等高级功能 |
| Prometheus HTTP 指标 | 手动统计请求数/延迟 | `prometheus/client_golang` + `promhttp` | 官方客户端，自动处理 histogram 分桶、标签逃逸 |
| Gin Trace 中间件 | 手动读取/写入 trace header | `otelgin.Middleware()` | 官方 contrib，自动处理 W3C Trace Context |
| HTTP Client Trace 透传 | 手动设置 header | `otelhttp.NewTransport()` | 自动注入 trace header，支持 metrics |
| FastAPI Trace | 手动创建 span | `FastAPIInstrumentor.instrument_app()` | 自动追踪所有路由、异常、数据库调用 |
| 页面过渡动画 | CSS transition | `AnimatePresence` + `motion.div` | 支持 exit 动画、stagger、手势，性能更好 |
| E2E 认证状态管理 | 每个测试都登录 | Playwright `storageState` + setup project | 登录一次复用多次，测试速度提升 10x+ |

**Key insight:** 可观测性领域有成熟的标准库和官方集成包，自定义实现容易遗漏边界情况（如 context 传播、并发安全、metrics 标签规范化）。

---

## Runtime State Inventory

> 本阶段涉及 rename/refactor/migration 的内容较少，主要是新增可观测性基础设施和打磨现有功能。以下是对可能受影响的运行时状态的审计。

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Redis Stream 消息格式：新增 `traceparent` field | 代码编辑（发布端注入 + 消费端提取） |
| Live service config | 无（所有配置通过 env var 或代码管理） | 无 |
| OS-registered state | 无 | 无 |
| Secrets/env vars | 新增：`OTEL_EXPORTER_OTLP_ENDPOINT`, `LOG_LEVEL`, `SERVICE_VERSION` | 更新 `.env` 模板和 docker-compose.yml |
| Build artifacts | Go 服务新增依赖后需重新 `go mod download` | 重新构建 Docker 镜像 |

**Nothing found in category:**
- Live service config: None — 无外部 UI 配置（如 n8n/Datadog）
- OS-registered state: None — 无 Task Scheduler/systemd 等注册

---

## Common Pitfalls

### Pitfall 1: Go OTel Jaeger Exporter 已弃用
**What goes wrong:** 使用 `go.opentelemetry.io/otel/exporters/jaeger` 导出 trace，编译报错或运行异常。
**Why it happens:** Jaeger exporter 在 OTel Go v1.18+ 已弃用，官方推荐使用 OTLP exporter [VERIFIED: Go Proxy 显示 jaeger exporter 最后版本 v1.17.0 于 2023-08]。
**How to avoid:** 使用 `go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp` 直接上报到 Jaeger 的 OTLP 端点（`jaeger:4318`）。
**Warning signs:** `go get` 时 jaeger exporter 没有新版本；文档中标注 deprecated。

### Pitfall 2: Prometheus 高基数标签
**What goes wrong:** 在 Counter/Histogram 的 labels 中加入 user_id、request_id 等无限增长维度，导致 Prometheus 内存占用持续增长。
**Why it happens:** 每个唯一的 label 组合都会创建一个时间序列，无限增长的维度会导致时间序列爆炸 [CITED: CONTEXT.md 决策 + Prometheus 最佳实践]。
**How to avoid:** labels 只使用有限枚举值（service, method, path, status_code, provider, model）。path 需要规范化（如将 `/memories/123` 替换为 `/memories/{id}`）。
**Warning signs:** Prometheus 内存使用随用户增长而线性增长；`/metrics` 端点返回的指标行数异常庞大。

### Pitfall 3: Zap Logger 未 Flush 导致日志丢失
**What goes wrong:** 程序崩溃或快速退出时，部分日志未写入输出。
**Why it happens:** Zap 使用缓冲 IO，需要调用 `Sync()` 刷新缓冲区 [CITED: Zap 官方文档]。
**How to avoid:** 在 `main()` 中使用 `defer logger.Sync()`，并在 graceful shutdown 时确保调用。
**Warning signs:** 程序 panic 后看不到 panic 前的最后几条日志。

### Pitfall 4: Next.js App Router AnimatePresence Exit 动画不生效
**What goes wrong:** 页面切换时只有 enter 动画，没有 exit 动画。
**Why it happens:** App Router 的 `layout.tsx` 在导航时不会重新挂载，而 `AnimatePresence` 依赖组件卸载触发 exit 动画 [CITED: Next.js docs + Framer Motion docs]。
**How to avoid:** 使用 `app/template.tsx`（而非 `layout.tsx`）包装 `AnimatePresence`，`template.tsx` 会在导航时重新挂载。
**Warning signs:** exit 动画从不触发；只有刷新页面时能看到 initial 动画。

### Pitfall 5: Playwright 测试在 CI 中 flaky
**What goes wrong:** 测试在本地通过但在 CI 中随机失败。
**Why it happens:** 服务启动时间不一致、网络延迟、动画导致元素状态变化 [CITED: Playwright docs]。
**How to avoid:** 使用 `webServer` 配置等待服务就绪；使用 `expect().toBeVisible()` 而非固定等待；在 CI 中禁用动画（`prefers-reduced-motion`）。
**Warning signs:** 同一测试多次运行结果不一致；失败集中在页面加载/导航步骤。

### Pitfall 6: Python OTel 与 FastAPI 生命周期冲突
**What goes wrong:** FastAPI `lifespan` 中初始化 OTel，但 `FastAPIInstrumentor` 在 `lifespan` 之前执行，导致某些 span 缺失。
**Why it happens:** `FastAPIInstrumentor.instrument_app()` 需要在 app 实例创建后立即调用，而不是在 lifespan 中 [CITED: OpenTelemetry Python docs]。
**How to avoid:** 在 `main.py` 模块级别调用 `setup_observability(app)`，不要在 `lifespan` 内部调用。
**Warning signs:** 启动阶段的 span（如 Redis 连接）缺失；某些路由没有产生 trace。

### Pitfall 7: CORS 配置遗漏 Gateway 反向代理场景
**What goes wrong:** 前端直接请求 Gateway 时 CORS 正常，但通过负载均衡/反向代理后 CORS 失败。
**Why it happens:** `Origin` header 在代理层可能被修改，或者 `Access-Control-Allow-Origin` 的精确匹配策略过于严格 [CITED: 现有 router.go 使用精确匹配]。
**How to avoid:** 使用 `gin-contrib/cors` 库的通配符/正则匹配，或支持从 env 读取多个 origin；确保 `Vary: Origin` 头被设置。
**Warning signs:** 生产环境 CORS 报错，开发环境正常；特定域名无法访问。

---

## Code Examples

### Go: 从 Context 提取 trace_id 写入 Zap

```go
// Source: https://pkg.go.dev/go.uber.org/zap + https://opentelemetry.io/docs/languages/go/
import (
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/zap"
)

func LoggerWithTrace(ctx context.Context, logger *zap.Logger) *zap.Logger {
	span := trace.SpanFromContext(ctx)
	if !span.SpanContext().IsValid() {
		return logger
	}
	return logger.With(
		zap.String("trace_id", span.SpanContext().TraceID().String()),
		zap.String("span_id", span.SpanContext().SpanID().String()),
	)
}
```

### Go: Gateway HTTP Client 自动透传 Trace

```go
// Source: https://opentelemetry.io/docs/languages/go/getting-started/
import "go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"

// 替换默认 Transport
transport := otelhttp.NewTransport(&http.Transport{
	MaxIdleConns:        100,
	MaxIdleConnsPerHost: 10,
	IdleConnTimeout:     90 * time.Second,
})

client := &http.Client{Transport: transport}
// 使用 client 发送的请求会自动携带 trace header
```

### Python: 手动创建 Span 并注入 traceparent 到 Redis

```python
# Source: https://signoz.io/blog/opentelemetry-fastapi/
from opentelemetry import trace
from opentelemetry.propagate import inject

tracer = trace.get_tracer(__name__)

async def publish_task(redis_client, stream, data):
    with tracer.start_as_current_span("publish_task") as span:
        carrier = {}
        inject(carrier)  # 将当前 trace 上下文序列化到 carrier
        traceparent = carrier.get("traceparent", "")

        fields = {"traceparent": traceparent, **data}
        await redis_client.xadd(stream, fields)
```

### Prometheus Scrape Config

```yaml
# prometheus.yml
# Source: https://prometheus.io/docs/prometheus/latest/configuration/configuration/
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'gateway'
    static_configs:
      - targets: ['gateway:8080']
        labels:
          service: 'gateway'

  - job_name: 'user-service'
    static_configs:
      - targets: ['user-service:8001']
        labels:
          service: 'user-service'

  - job_name: 'memory-service'
    static_configs:
      - targets: ['memory-service:8002']
        labels:
          service: 'memory-service'

  - job_name: 'processor-service'
    static_configs:
      - targets: ['processor-service:8003']
        labels:
          service: 'processor-service'

  - job_name: 'vectorizer-service'
    static_configs:
      - targets: ['vectorizer-service:8004']
        labels:
          service: 'vectorizer-service'
```

### Docker Compose: Observability Stack

```yaml
# docker-compose.yml 新增服务
  prometheus:
    image: prom/prometheus:latest
    container_name: echoes-prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"
    networks:
      - echoes-network

  jaeger:
    image: jaegertracing/all-in-one:1.76
    container_name: echoes-jaeger
    environment:
      - COLLECTOR_OTLP_ENABLED=true
    ports:
      - "16686:16686"  # Jaeger UI
      - "4317:4317"    # OTLP gRPC
      - "4318:4318"    # OTLP HTTP
    networks:
      - echoes-network

  grafana:
    image: grafana/grafana:latest
    container_name: echoes-grafana
    ports:
      - "3001:3000"    # 避免与 web 的 3000 冲突
    volumes:
      - ./shared/grafana/provisioning:/etc/grafana/provisioning
      - ./shared/grafana/dashboards:/var/lib/grafana/dashboards
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_AUTH_ANONYMOUS_ENABLED=true
    networks:
      - echoes-network
```

### Grafana Dashboard Provisioning

```yaml
# shared/grafana/provisioning/dashboards/dashboards.yaml
# Source: https://grafana.com/docs/grafana/latest/administration/provisioning/
apiVersion: 1

providers:
  - name: 'echoes-dashboards'
    orgId: 1
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: false
    options:
      path: /var/lib/grafana/dashboards
      foldersFromFilesStructure: true
```

```yaml
# shared/grafana/provisioning/datasources/datasources.yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true

  - name: Jaeger
    type: jaeger
    access: proxy
    url: http://jaeger:16686
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Jaeger exporter (deprecated) | OTLP exporter | OTel Go v1.18 (2023) | 统一协议，减少 exporter 维护成本 |
| Gin 默认 logger | Zap 结构化日志 | Phase 5 (本阶段) | JSON 格式、trace_id 关联、性能提升 |
| 无 trace 透传 | W3C Trace Context 自动传播 | Phase 5 (本阶段) | 全链路可追踪，跨语言/跨服务 |
| 手工 curl 验证 | Playwright E2E | Phase 5 (本阶段) | 覆盖前端交互，CI 友好 |
| 无输入验证 | go-playground/validator | Phase 5 (本阶段) | 边界安全，统一错误格式 |

**Deprecated/outdated:**
- `go.opentelemetry.io/otel/exporters/jaeger`: 已弃用，使用 OTLP exporter 替代 [VERIFIED: Go Proxy 显示最后版本 2023-08]
- `github.com/uber/jaeger-client-go`: 已归档，不再维护

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Jaeger all-in-one 1.76+ 支持 OTLP 且 `COLLECTOR_OTLP_ENABLED=true` 即可启用 | Infrastructure | 如果版本不支持，需要降级或改用 Collector 模式 |
| A2 | shadcn/ui Skeleton 组件可通过 `npx shadcn add skeleton` 安装 | Frontend Polish | 如果项目使用自定义 shadcn 配置，可能需要手动创建 |
| A3 | WSL 中 `npx playwright install` 可以正常下载浏览器二进制 | E2E Testing | 如果 WSL 环境缺少依赖，可能需要手动安装系统包 |
| A4 | Go 服务使用 `go mod tidy` 后所有依赖可正常解析 | Standard Stack | 如果某些包有版本冲突，可能需要显式指定兼容版本 |
| A5 | Python 服务使用 `pip install` 安装 opentelemetry 包时与现有依赖（fastapi 0.110.0, pydantic 2.6.4）无冲突 | Standard Stack | 如有冲突，可能需要升级 fastapi/pydantic 版本 |

---

## Open Questions

1. **Grafana Dashboard JSON 的具体面板设计**
   - What we know: 需要展示 QPS、延迟 P99、错误率、内存处理状态分布
   - What's unclear: 具体的 PromQL 查询语句、面板布局、变量配置
   - Recommendation: 先搭建基础面板，后续根据实际 metrics 数据调整

2. **Playwright 测试是否需要独立的测试数据库**
   - What we know: E2E 测试会创建真实数据
   - What's unclear: 测试后数据清理策略（每次清理 vs. 独立 DB）
   - Recommendation: 使用现有 docker-compose 环境，测试后通过 API 清理数据，或标记测试数据便于识别

3. **现有 rate limiter 是否需要替换为 `golang.org/x/time/rate`**
   - What we know: 已有自定义 token bucket 实现，功能正常
   - What's unclear: 是否有已知 bug 或性能瓶颈
   - Recommendation: 保留现有实现，添加 per-user（基于 userID）的限流策略扩展

4. **Go 服务是否需要在 Docker 镜像中安装 ca-certificates 以支持 OTLP HTTPS**
   - What we know: 当前使用 `WithInsecure()` 连接 Jaeger
   - What's unclear: 生产环境是否需要 TLS
   - Recommendation: 开发环境保持 insecure，生产环境通过 env 配置 TLS

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Go | Go 服务编译 | ✓ (Windows) | 1.22.8 | WSL 中无 Go，Windows 原生可用 |
| Python | Python 服务 | ✓ (WSL) | 3.12.3 | — |
| Node.js | Web / Playwright | ✓ (WSL) | (via npm 11.6.0) | — |
| npm | Web 依赖安装 | ✓ (WSL) | 11.6.0 | — |
| Docker | 容器编排 | ✓ | v5.1.2 (Compose) | — |
| WSL | 开发环境 | ✓ | — | Docker Desktop 直接运行 |
| Playwright | E2E 测试 | ✓ (WSL) | 1.58.2 | 可通过 npm 升级到 1.59.1 |
| Prometheus | Metrics 收集 | ✗ | — | Docker Compose 启动 |
| Jaeger | Trace 收集 | ✗ | — | Docker Compose 启动 |
| Grafana | 可视化 | ✗ | — | Docker Compose 启动 |

**Missing dependencies with no fallback:**
- 无 — 所有缺失项均可通过 Docker Compose 启动

**Missing dependencies with fallback:**
- 无

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (@playwright/test v1.59.1) |
| Config file | `web/playwright.config.ts` |
| Quick run command | `cd web && npx playwright test --grep "auth"` |
| Full suite command | `cd web && npx playwright test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R7.1 | `/metrics` 端点返回 Prometheus 格式 | smoke | `curl http://localhost:8088/metrics` | ❌ Wave 0 |
| R7.3 | Gateway 生成 trace_id 并透传 | integration | Playwright trace + Jaeger UI 验证 | ❌ Wave 0 |
| R7.5 | Zap JSON 日志含 trace_id | smoke | `docker logs echoes-gateway | grep trace_id` | ❌ Wave 0 |
| R6.5 | 页面切换有淡入动画 | e2e | `npx playwright test specs/navigation.spec.ts` | ❌ Wave 0 |
| R6.7 | 加载状态显示骨架屏 | e2e | `npx playwright test specs/memory.spec.ts` | ❌ Wave 0 |
| E2E-01 | 注册->登录->创建记忆->搜索->查看详情 | e2e | `npx playwright test specs/full-flow.spec.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** 手动验证受影响的服务 `/health` 和 `/metrics`
- **Per wave merge:** `make test`（Go 单元测试 + Playwright E2E）
- **Phase gate:** 全链路验证：Prometheus 抓取正常、Jaeger 展示完整 trace、E2E 全部通过

### Wave 0 Gaps
- [ ] `web/playwright.config.ts` — Playwright 配置文件
- [ ] `web/e2e/auth.setup.ts` — 认证 setup
- [ ] `web/e2e/specs/*.spec.ts` — E2E 测试用例
- [ ] Go 服务测试：目前无单元测试，Phase 5 至少添加 observability 包的测试
- [ ] Python 服务测试：已有 `tests/test_imports.py`，需扩展可观测性测试

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | JWT 中间件（已有） |
| V3 Session Management | Yes | Token 刷新机制（已有） |
| V4 Access Control | Yes | Gateway JWT 验证 + `X-User-ID` 注入（已有） |
| V5 Input Validation | Yes | `go-playground/validator/v10` + Pydantic（本阶段增强） |
| V6 Cryptography | No | 使用 bcrypt（已有），本阶段不改动 |
| V7 Error Handling | Yes | 统一错误响应格式，不暴露内部细节（本阶段） |
| V8 Data Protection | No | 本阶段不处理敏感数据变更 |
| V9 Communication | Yes | CORS 白名单配置（本阶段优化） |
| V10 Malicious Code | No | 不涉及代码注入防御变更 |
| V11 Business Logic | Yes | 限流防止暴力破解/滥用（本阶段优化） |

### Known Threat Patterns for Echoes Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| JWT 绕过（HasPrefix 漏洞） | Spoofing | 已修复：精确匹配 + 前缀带斜杠 [CITED: STATE.md 技术债务] |
| 无限制 API 调用 | Denial of Service | Token Bucket 限流（本阶段优化 per-user） |
| CORS 配置过宽 | Spoofing | 白名单精确匹配，支持 env 扩展（本阶段） |
| 输入注入（XSS/SQLi） | Tampering | Validator 校验 + GORM 参数化查询（本阶段增强验证） |
| 敏感信息泄露 | Information Disclosure | 统一错误格式，不返回堆栈（本阶段） |

---

## Sources

### Primary (HIGH confidence)
- Go Proxy (`proxy.golang.org`) — Zap v1.27.1, client_golang v1.23.2, OTel Go v1.43.0, otelgin v0.68.0, otelhttp v0.68.0, validator v10.30.2, gin-contrib/zap v1.1.7
- npm registry — prom-client v15.1.3, framer-motion v12.38.0, @playwright/test v1.59.1
- PyPI — opentelemetry-api 1.35.0, opentelemetry-sdk 1.35.0, opentelemetry-instrumentation-fastapi 0.56b0 (2026-04-09)
- [OpenTelemetry Go Getting Started](https://opentelemetry.io/docs/languages/go/getting-started/) — SDK 初始化模式
- [Zap Config Source](https://github.com/uber-go/zap/blob/master/config.go) — NewProductionConfig/NewDevelopmentConfig 默认值
- [Framer Motion AnimatePresence](https://motion.dev/motion/animate-presence/) — API 文档
- [Playwright Auth Docs](https://playwright.dev/docs/auth) — storageState + setup project

### Secondary (MEDIUM confidence)
- [OpenTelemetry Python 2026 Guide](https://byteiota.com/opentelemetry-production-ready-2026-complete-tutorial/) — Python OTel v1.35.0 特性
- [FastAPI + Prometheus Official](https://prometheus.github.io/client_python/exporting/http/fastapi-gunicorn/) — `make_asgi_app()` 用法
- [Grafana Provisioning Docs](https://grafana.com/docs/grafana/latest/administration/provisioning/) — Dashboard provider YAML 格式
- [Gin Rate Limiting 2026](https://oneuptime.com/blog/post/2026-01-07-go-rate-limiting/) — Token bucket 模式
- [Gin Validation 2026](https://oneuptime.com/blog/post/2026-02-03-gin-binding-validation/) — Validator v10 用法

### Tertiary (LOW confidence)
- WebSearch 结果中关于 Next.js App Router + Framer Motion 的社区实践（未找到官方文档明确说明 template.tsx 与 AnimatePresence 的兼容性，但社区广泛采用）
- Jaeger all-in-one 1.76 的 OTLP 支持（基于 Jaeger 官方文档的通用知识，未直接验证 1.76 的 release notes）

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 所有版本通过官方 registry 验证
- Architecture: HIGH — 基于官方文档和已验证的代码模式
- Pitfalls: HIGH — 多个来源交叉验证（OTel Jaeger exporter 弃用、Prometheus 高基数、AnimatePresence layout 问题）

**Research date:** 2026-04-21
**Valid until:** 2026-05-21（Go/Python 依赖每月更新，建议实施前再次验证最新版本）
