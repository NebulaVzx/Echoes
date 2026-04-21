# Phase 4: 搜索能力 - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

实现语义搜索和相似内容推荐，使 Echoes 从"存储工具"升级为"可检索的知识库"。

本阶段交付：
- **语义搜索 API**：`GET /api/v1/search?q=&limit=`，基于 BGE-M3 向量余弦相似度
- **相似推荐 API**：`GET /api/v1/memories/:id/related`，基于已有向量查询最相似记忆
- **搜索前端页面**：顶部搜索入口 + 搜索结果页
- **响应式适配**：单列流式布局在所有屏幕尺寸保持一致体验

**暗黑模式已在 Sprint 3 完成**（ThemeProvider + dark: Tailwind 类全覆盖），本阶段仅验证搜索页兼容，无需新增工作。

</domain>

<decisions>
## Implementation Decisions

### 搜索查询向量化 (Claude's Discretion)
- **D-01:** **Memory Service 调用 Vectorizer Service HTTP API** 生成查询向量
  - 理由：职责分离，Vectorizer 是专门向量服务；Go 服务不应内嵌 Python 模型依赖
  - 查询向量可缓存（Redis key: `search_vector:{query_hash}`，TTL 1 小时）
  - 失败时返回 503 并提示"搜索服务暂不可用"

### 搜索排序策略 (Claude's Discretion)
- **D-02:** **Phase 1 采用纯向量余弦相似度排序**
  - 理由：BGE-M3 语义模型已能处理"Go"与"Golang"等语义关联；混合排序（向量+关键词加权）是优化项，后续迭代
  - 阈值 0.75（来自 REQUIREMENTS.md R4.4），低于阈值的结果过滤
  - 结果包含 `similarity` 分数用于 UI 展示

### 搜索界面设计 (Claude's Discretion)
- **D-03:** **顶部导航栏常驻搜索框 + Enter 跳转搜索结果页**
  - 导航栏搜索框作为全局入口，placeholder 为"搜索你的记忆..."
  - 输入后按 Enter 跳转到 `/search?q=...` 独立结果页
  - 结果页展示记忆卡片列表（复用首页 MemoryCard 组件），按相似度排序
  - 空结果展示友好提示（"没有找到相关记忆，试试其他关键词？"）

### 相似推荐规则 (Claude's Discretion)
- **D-04:** **详情页底部展示"你可能还感兴趣"，最多 3 条**
  - 基于当前记忆的 `vector` 字段查询最相似记忆（排除自身）
  - 相似度阈值 **0.7**（低于搜索的 0.75，保证有足够结果展示）
  - 只展示 `processing_status = completed` 的记忆
  - 复用 MemoryCard 组件，横向排列或单列展示

### 响应式适配 (Claude's Discretion)
- **D-05:** **保持单列流式布局，所有屏幕尺寸一致**
  - 理由：时间轴风格是 Echoes 核心视觉识别；Notion-like 极简美学更适合单列阅读流
  - 搜索框在移动端全宽，桌面端限制最大宽度
  - 卡片间距和字体大小随屏幕微调，但不改变单列结构

### Claude's Discretion
- 搜索 API 的分页策略（limit/offset vs cursor-based）
- 搜索框的 debounce 延迟（建议 300ms）
- 相似推荐的缓存策略
- 搜索结果高亮关键词的实现方式

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 产品需求
- `PRD.md` §4 — 搜索能力需求（语义搜索、相似推荐、阈值、维度）
- `REQUIREMENTS.md` §4 — R4.1-R4.7 搜索能力验收标准

### 代码库分析
- `.planning/codebase/ARCHITECTURE.md` §微服务通信 — Gateway → Service 代理模式
- `.planning/codebase/STACK.md` — pgvector 版本、BGE-M3 配置

### 现有代码
- `services/memory-service/internal/transport/memory_handler.go` — 现有路由注册模式，需新增 search/related 路由
- `services/memory-service/internal/repository/memory_repository.go` — 需新增向量查询方法
- `services/memory-service/internal/domain/memory.go` — Memory 模型（vector 字段为 1024 维）
- `services/vectorizer-service/app/services/embedder.py` — BGE-M3 编码服务（1024 维输出）
- `services/vectorizer-service/app/main.py` — FastAPI 入口，已有 `/encode` 端点
- `services/gateway/internal/router/router.go` — `/search` 路由已配置到 Memory Service
- `web/app/providers/theme-provider.tsx` — 暗黑模式已完整实现
- `web/components/memory/memory-card.tsx` — 可复用的记忆卡片组件
- `shared/migrations/001_init.sql` — 数据库 schema（vector(1024) + ivfflat 索引）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `MemoryCard` 组件 — 搜索/推荐结果可直接复用
- `api.ts` 中的 `ApiClient` — 新增 `searchMemories()` 和 `getRelatedMemories()` 方法
- `ThemeProvider` — 搜索页自动继承暗黑模式
- `memory_handler.go` 的 `getUserID` 辅助函数 — 搜索/推荐路由复用

### Established Patterns
- Gateway 反向代理模式 — `/search` 已配置，Memory Service 只需实现 handler
- Memory Service 分层架构 — domain/service/repository/transport，新增 search 功能遵循相同模式
- 数据库查询 — GORM + 原生 SQL（pgvector 函数需原生 SQL）

### Integration Points
- **Memory Service → Vectorizer Service**：新增 HTTP 调用生成查询向量
- **Memory Service → PostgreSQL**：新增向量相似度查询（`<=>` 余弦距离运算符）
- **Frontend → Gateway**：新增 `/api/v1/search?q=` 和 `/api/v1/memories/:id/related` 调用
- **Memory Detail Page**：底部注入 RelatedMemories 组件

</code_context>

<specifics>
## Specific Ideas

- 搜索框 placeholder: "搜索你的记忆..." / "Search your memories..."
- 搜索结果页展示相似度分数（如 "相关度 92%"）
- 相似推荐区域标题: "你可能还感兴趣"
- 空搜索结果提示文案: "没有找到相关记忆，换个关键词试试？"
- 搜索页支持 URL 参数共享（`/search?q=Go协程` 可直接分享）

</specifics>

<deferred>
## Deferred Ideas

- **混合排序（向量 + 关键词加权）** — Phase 2 优化项，当前纯向量已足够
- **搜索历史/热门搜索** — 用户行为分析功能，属于后续增强
- **高级搜索过滤器（按标签、日期、类型筛选）** — 超出 Phase 4 范围
- **搜索建议/自动补全** — 需要构建 query 索引，后续迭代
- **搜索结果高亮关键词** — 语义搜索无明确关键词匹配，高亮逻辑复杂，后续考虑

</deferred>

---

*Phase: 04-search-capability*
*Context gathered: 2026-04-21*
