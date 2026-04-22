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
- Gateway：统一入口，JWT 认证，反向代理
- User Service：注册/登录/OAuth，JWT 管理
- Memory Service：记忆 CRUD，搜索，异步任务发布
- Processor Service：链接抓取，自动标签（Python）
- Vectorizer Service：BGE-M3 向量化（Python）

## 关键约束

- LLM 提供商：OpenAI / Anthropic 可切换（工厂模式）
- 向量模型：BGE-M3（1024维，中文优化）
- 相似度阈值：0.75
- 所有 LLM 调用必须异步，失败时降级为本地关键词提取
- Windows 兼容（WSL2 / Docker Desktop）

## 当前里程碑：v1.1 Echo Assistant

**目标：** 对话式 AI 助手，基于 RAG 回答用户记忆相关问题 + 修复 v1.0 已知问题

**目标功能：**
- Chat UI 侧边栏（Notion-like 风格）
- RAG 检索逻辑（语义搜索 + LLM 生成回答）
- 引用来源展示（显示答案来自哪些记忆）
- 对话历史管理（多轮对话上下文）
- 修复 OAuth state 内存泄漏
- Gateway 后端健康检查
- 前端分页 UI
- Go 单元测试补充

## 已验证需求（v1.0）

- 认证：邮箱注册/登录 + GitHub OAuth + JWT 双 Token
- 记忆捕获：文字/链接保存，时间轴浏览，详情编辑删除
- 搜索：语义搜索 + 相似推荐（BGE-M3 + pgvector）
- AI：LLM 自动标签，Redis Stream 异步队列
- 可观测性：Prometheus / Jaeger / Grafana / Zap
- 前端：暗黑模式，Framer Motion 动效，骨架屏，Playwright E2E

## 相关文档

- `PRD.md` — 完整产品需求、API 定义、数据库 Schema
- `CLAUDE.md` — 项目开发指南和命令速查
- `.planning/MILESTONES.md` — 里程碑记录
- `.planning/milestones/` — 归档的路线图和需求
- `README.md` — 快速开始指南

---

*Project context updated: 2026-04-22 after v1.0 milestone*
