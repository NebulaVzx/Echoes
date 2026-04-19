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
| 可观测性 | Prometheus + OpenTelemetry + Zap (Sprint 5) |

## 架构模式

微服务架构，API Gateway 模式：
- Gateway：统一入口，JWT 认证，反向代理
- User Service：注册/登录/OAuth，JWT 管理
- Memory Service：记忆 CRUD，搜索，异步任务发布
- Processor Service：链接抓取，自动标签（Python）
- Vectorizer Service：BGE-M3 向量化（Python）

## 关键约束

- LLM 提供商：OpenAI / Anthropic 可切换（工厂模式）
- 向量模型：BGE-M3（768维，中文优化）
- 相似度阈值：0.75
- 所有 LLM 调用必须异步，失败时降级为本地关键词提取
- Windows 兼容（WSL2 / Docker Desktop）

## 项目状态

当前处于 Sprint 2 完成阶段（2026-04-19），见 `STATE.md`。

## 相关文档

- `PRD.md` — 完整产品需求、API 定义、数据库 Schema
- `CLAUDE.md` — 项目开发指南和命令速查
- `.planning/codebase/` — 代码库分析文档
- `README.md` — 快速开始指南

---

*Project context created: 2026-04-19*
