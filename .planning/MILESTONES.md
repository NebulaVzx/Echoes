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
