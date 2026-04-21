# Phase 3: AI 处理层 - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

实现 Processor Service 和 Vectorizer Service 的完整业务逻辑，使其从 Redis Stream 消费任务并处理记忆：

- **LLM Provider 抽象层**：OpenAI / Anthropic 可切换，工厂模式
- **Processor Service**：Redis Stream 消费者 + 链接抓取 + 自动标签生成
- **Vectorizer Service**：BGE-M3 模型加载 + 向量生成 + Redis Stream 消费者
- **状态流转管理**：`pending → processing → completed/failed`，支持子任务级状态追踪
- **错误处理**：失败时准确报告错误，不降级；支持用户单独重试失败子任务

## 技术债务（Sprint 3 前必须处理）

根据 CONCERNS.md，以下安全问题需在 Sprint 3 开发前修复：
- 移除硬编码 JWT Secret（C1）
- 从 Git 移除 .env（C2）
- 修复 CORS 白名单（C3）
- 添加限流中间件（C4）
- 输入内容 XSS 过滤（C5）

</domain>

<decisions>
## Implementation Decisions

### LLM 策略
- **D-01:** **不做降级**。LLM 调用失败时返回准确错误信息，不 fallback 到本地关键词提取
- **D-02:** **核心依赖 AI 能力**。标签生成必须调用 LLM，TF-IDF / jieba 等本地方案不采用
- **D-03:** **LLM 可配置**。Provider、模型、参数均通过环境变量 / 配置界面设置，非写死
- **D-04:** **LLM 状态监控**。需要提供配置界面和状态监控（如调用成功率、延迟）
- **D-05:** **Prompt 工程**：生成 3-5 个中文标签，Prompt 需可配置

### 链接抓取策略
- **D-06:** **抓正文做摘要**。不仅提取 `<title>` 和 `<meta description>`，还抓取正文内容
- **D-07:** **正文摘要使用 LLM**。抓取的正文通过 LLM 生成摘要，而非简单截断
- **D-08:** **反爬虫处理**：httpx 需配置合理 User-Agent、超时、重试；遇到 403/429 时记录错误但不阻塞其他任务

### Redis Stream 消费模式
- **D-09:** **Consumer Group**。使用 Redis Stream Consumer Group 实现可靠消费，支持 ACK 和故障转移
- **D-10:** **每个服务独立 Consumer Group**：Processor 和 Vectorizer 各自使用不同 Consumer Group
- **D-11:** **消息 ACK 机制**：任务处理成功后 ACK，失败时不 ACK（让消息保留在 Pending 列表供重试）

### 状态流转机制
- **D-12:** **Memory Service 是数据 Owner**。Processor/Vectorizer **不直连 DB**，通过内部 API 调用 Memory Service 更新状态
- **D-13:** **子任务级状态追踪**。`metadata` JSONB 中记录各子任务独立状态：
  ```json
  {
    "tasks": {
      "link:fetch": {"status": "completed", "updated_at": "..."},
      "text:vectorize": {"status": "failed", "error": "...", "updated_at": "..."},
      "tag:generate": {"status": "completed", "updated_at": "..."}
    }
  }
  ```
- **D-14:** **聚合状态计算**：
  - 全部成功 → `completed`
  - 有失败有成功 → `partial_failed`
  - 全部失败 → `failed`
  - 任一任务进行中 → `processing`
- **D-15:** **用户可单独重试**。前端展示各子任务状态，用户可点击重试某一失败任务
- **D-16:** **重试机制**：失败任务最多自动重试 3 次（指数退避），之后标记为 `failed` 等待用户手动重试

### Claude's Discretion
- BGE-M3 模型加载策略（启动时预加载 vs 懒加载）
- LLM Provider 抽象层的具体接口设计
- Processor 内部任务调度细节
- 内部 API 的具体路径和认证方式

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 产品需求
- `PRD.md` §7 — 异步任务处理、任务类型、状态流转
- `PRD.md` §3.1 Phase 1 — AI 能力需求（LLM、向量模型）
- `PRD.md` §3.2 — LLM 提供商配置、降级策略（注：降级策略已被否决，但配置部分仍适用）

### 代码库分析
- `.planning/codebase/CONCERNS.md` — C1-C5 安全债务必须 Sprint 3 前处理
- `.planning/codebase/ARCHITECTURE.md` §异步任务流 — Redis Streams 架构
- `.planning/codebase/STACK.md` — 技术栈版本和依赖

### 现有代码
- `services/memory-service/internal/service/memory_service.go` — TaskQueue 接口、publishTasks、状态管理
- `services/memory-service/internal/service/redis_queue.go` — Redis Stream 发布实现
- `services/processor-service/app/main.py` — 当前空壳，需实现消费者
- `services/vectorizer-service/app/main.py` — 当前空壳，需实现消费者
- `services/memory-service/internal/domain/memory.go` — Memory 领域模型、metadata 字段
- `shared/migrations/001_init.sql` — 数据库 Schema

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TaskQueue` 接口（`memory_service.go`）— 已有发布端，需实现消费端
- `RedisTaskQueue`（`redis_queue.go`）— 发布实现可作为消费端参考
- `Memory` domain 模型 — 已有 `metadata` JSONB 字段，可用于存储子任务状态
- `processing_status` 字段 — 已有 `pending/processing/completed/failed` 约束

### Established Patterns
- FastAPI lifespan manager — Processor/Vectorizer 已有，可在 startup 中启动 Redis Consumer
- Go 服务分层架构 — Memory Service 已有 domain/service/repository/transport，新增内部 API 端点遵循相同模式
- Redis Stream 消息格式 — 已标准化：`{memory_id, content/link_url}`

### Integration Points
- **Memory Service → Redis**：publishTasks 已发布到 `link:fetch`、`text:vectorize`、`tag:generate`
- **Processor → Memory Service**：新增内部 API 调用更新状态（`PATCH /api/v1/internal/memories/:id/tasks`）
- **Vectorizer → Memory Service**：同上
- **Processor → LLM Provider**：新模块，Processor 调用生成标签
- **Frontend → Memory Service**：新增子任务状态展示和重试按钮

</code_context>

<specifics>
## Specific Ideas

- LLM 配置界面：用户可设置 Provider（OpenAI/Anthropic）、API Key、模型名称、Temperature 等
- LLM 状态监控：显示调用次数、成功率、平均延迟、最近错误
- 链接抓取使用 httpx + BeautifulSoup，正文提取后使用 LLM 做摘要
- BGE-M3 模型在 Vectorizer 启动时预加载，避免请求时加载延迟
- 子任务重试按钮在记忆详情页展示，类似"重新生成标签"、"重新向量化"

</specifics>

<deferred>
## Deferred Ideas

- LLM 配置界面的完整 UI 设计 — Sprint 4 或 Sprint 5 前端打磨阶段
- 链接抓取的更高级功能（如 PDF 解析、视频字幕提取）— Phase 2
- 多模态内容处理（图片 OCR）— 明确不做（PRD §3.4）
- 高级重试策略（如死信队列）— 如 Sprint 3 时间充裕可考虑

</deferred>

---

*Phase: 03-ai-processing*
*Context gathered: 2026-04-19*
