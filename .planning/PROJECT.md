---
name: Echoes (拾忆)
description: 个人语义搜索引擎，支持文本/链接保存、自动标签、语义检索和相似推荐
type: product
---

# 项目上下文

## 概述

**Echoes (拾忆)** 是一款个人语义搜索引擎。用户可以随手保存文字片段和链接，系统自动进行向量化和标签生成，支持通过自然语言进行语义检索和相似内容推荐。

- **中文名：** 拾忆 — 捡拾遗落的记忆
- **英文名：** Echoes — 回声、回响
- **Slogan：** "拾起遗落的记忆"
- **设计美学：** Notion-like 极简主义，充足留白，暗黑模式，细腻动效（200-300ms ease-out）

## 核心价值

1. **捕获摩擦极低**：看到就存，无需整理
2. **找回能力极强**：语义搜索，不用记得关键词
3. **发现意外关联**："原来我之前还存过类似的"

## 目标用户

- 信息囤积者：收藏100篇文章，需要时找不到
- 知识工作者：需要建立个人知识库
- 终身学习者：囤积课程/论文/教程

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 14 (App Router), Tailwind CSS, shadcn/ui, Framer Motion |
| API 网关 | Go + Gin |
| 后端服务 | Go + GORM |
| 向量/ML | Python + FastAPI, BGE-M3 模型 |
| 数据库 | PostgreSQL 15 + pgvector |
| 缓存/队列 | Redis 7 (Stream) |
| 对象存储 | MinIO |
| 可观测性 | Prometheus + OpenTelemetry + Zap + Jaeger + Grafana |

## 架构模式

微服务架构，API Gateway 模式：
- Gateway：统一入口，JWT 认证，反向代理，聚合健康检查
- User Service：注册/登录/OAuth，JWT 管理，用户设置（LLM/搜索/分页偏好）
- Memory Service：记忆 CRUD，搜索，异步任务发布
- Processor Service：链接抓取，自动标签（Python）
- Vectorizer Service：BGE-M3 向量化（Python）

## 关键约束

- LLM 提供商：OpenAI / Anthropic 可切换（工厂模式）
- 向量模型：BGE-M3（1024维，中文优化）
- 相似度阈值：0.75
- 所有 LLM 调用必须异步，失败时降级为本地关键词提取
- Windows 兼容（WSL2 / Docker Desktop）

## 当前状态

**已发布版本：** v1.1 Echo Assistant（2026-04-25）

**v1.1 已交付功能：**
- Chat UI 侧边栏（Notion-like 风格）
- RAG 检索逻辑（语义搜索 + LLM 生成回答）
- 引用来源展示（显示答案来自哪些记忆）
- 对话历史管理（多轮对话上下文，持久化到数据库）
- OAuth state 内存泄漏修复（TTL + 定期清理 goroutine）
- Gateway 聚合健康检查（/health 探测下游服务）
- 前端双模式分页（加载更多 / 页码组件，支持移动端）
- Go 单元测试补充（User/Memory/Gateway 共 55+ 测试）
- Phase 6 代码审查修复（路径遍历、系统提示重复、JSON 错误处理）

## 已验证需求

### v1.0 (2026-04-22)
- 认证：邮箱注册/登录 + GitHub OAuth + JWT 双 Token
- 记忆捕获：文字/链接保存，时间轴浏览，详情编辑删除
- 搜索：语义搜索 + 相似推荐（BGE-M3 + pgvector）
- AI：LLM 自动标签，Redis Stream 异步队列
- 可观测性：Prometheus / Jaeger / Grafana / Zap
- 前端：暗黑模式，Framer Motion 动效，骨架屏，Playwright E2E

### v1.1 (2026-04-25)
- Echo Assistant：Chat 侧边栏 + RAG 检索 + 多轮对话 + 引用标注
- 质量：OAuth 清理 + 健康检查 + 双模式分页 + Go 单元测试

## 下一个里程碑目标 (v1.2)

待规划。候选方向：
- Chat 消息流式输出（SSE）
- 对话导出（Markdown / PDF）
- AI 主动建议（基于新保存的记忆提示）
- 多人协作共享记忆

## 相关文档

- `PRD.md` — 完整产品需求、API 定义、数据库 Schema
- `CLAUDE.md` — 项目开发指南和命令速查
- `.planning/MILESTONES.md` — 里程碑记录
- `.planning/milestones/` — 归档的路线图和需求
- `README.md` — 快速开始指南

---

*Project context updated: 2026-04-25 after v1.1 milestone*
