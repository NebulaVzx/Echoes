---
name: Milestones
---

# Milestones

## v1.0 MVP — 2026-04-22

**拾忆 (Echoes) 初始版本**，覆盖 6 个 Sprint（Week 1-6），包含完整的前后端微服务架构。

### Stats

- **Phases:** 6 (Sprint 0-5)
- **Plans:** 15+ (3-5 有完整 GSD 规划归档)
- **Commits:** 110
- **Files changed:** 193
- **Lines:** ~27,500 insertions, ~286 deletions
- **Timeline:** 2026-04-19 → 2026-04-22 (4 天)

### Key Accomplishments

1. **微服务架构落地** — Gateway + User Service + Memory Service + Processor + Vectorizer，Go/Python 混合栈，Docker Compose 一键启动
2. **完整的认证链路** — 邮箱注册/登录 + GitHub OAuth，JWT Access/Refresh 双 Token，前端路由保护
3. **记忆捕获与浏览** — 文字/链接保存，时间轴倒序展示，记忆卡片，详情页编辑删除
4. **语义搜索 + 相似推荐** — BGE-M3 向量模型，pgvector 余弦相似度，自然语言查询，详情页"你可能还感兴趣"
5. **AI 异步处理** — LLM 自动标签（OpenAI/Anthropic 可切换），Redis Stream 任务队列，状态流转 pending→processing→completed/failed
6. **可观测性栈** — Prometheus 指标（5 服务）、Jaeger 分布式链路追踪、Grafana 仪表盘、Zap 结构化日志、Playwright E2E 测试套件（13 tests）

### Phase Breakdown

| Phase | Name | Plans | Status |
|-------|------|-------|--------|
| 0 | 基础设施 | — | ✅ |
| 1 | 认证体系 | — | ✅ |
| 2 | 记忆捕获 | — | ✅ |
| 3 | AI 处理层 | 4 | ✅ |
| 4 | 搜索能力 | 4 | ✅ |
| 5 | 可观测性 + 打磨 | 7 | ✅ |

### Known Issues at Close

- OAuth state 内存泄漏（未清理过期 state 条目）
- Gateway 无后端健康检查（服务宕机时返回 502/503）
- 前端无分页 UI（API 支持但 UI 硬编码 page=1）

---

## v1.1 Echo Assistant — 2026-04-25

**对话式 AI 助手 + 质量修复**，引入基于 RAG 的 Echo Assistant，同时修复 v1.0 已知问题并补充 Go 单元测试。

### Stats

- **Phases:** 2 (6-7)
- **Plans:** 9 (5 + 4)
- **Commits:** 26
- **Files changed:** 37
- **Lines:** ~5,500 insertions, ~100 deletions
- **Timeline:** 2026-04-22 → 2026-04-25 (4 天)

### Key Accomplishments

1. **Echo Assistant 对话式 AI** — Chat 侧边栏（Notion-like），RAG 语义检索 + LLM 生成回答，引用标注 [1][2]，多轮对话上下文保留
2. **对话历史管理** — conversations/messages 数据表，持久化到 PostgreSQL，支持查看、切换、删除对话
3. **OAuth State 修复** — 10min TTL + 每 5min 清理 goroutine，5 个单元测试覆盖，解决内存泄漏
4. **Gateway 健康检查** — 聚合 /health 端点探测 User/Memory Service，返回 503 + 降级状态，反向代理超时配置
5. **前端双模式分页** — 默认"加载更多"，Settings 可切换"页码组件"，移动端简化显示，偏好持久化
6. **Go 单元测试基线** — 55+ 测试覆盖 User Service (11)、Memory Service (10)、Gateway 中间件 (JWT/CORS/限流/路由 17)
7. **Phase 6 代码审查修复** — 路径遍历修复 (CR-02)、Chat 系统提示去重 (WR-01)、JSON 错误显式处理 (WR-02)、移除未使用变量 (IN-01)
8. **Windows 兼容性修复** — filepath.Clean → stdpath.Clean，解决 Windows 下公开路由匹配失败

### Phase Breakdown

| Phase | Name | Plans | Status |
|-------|------|-------|--------|
| 6 | Echo Assistant | 5 | ✅ |
| 7 | Bug Fixes & Quality | 4 | ✅ |

### Known Issues at Close

- Playwright E2E 需要完整 Docker 栈运行（建议在 CI 中配置）
- Gateway volume mount 已补充，但镜像构建需要网络可用时执行

---
