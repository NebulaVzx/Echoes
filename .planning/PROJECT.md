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

**已发布版本：** v1.2 "记忆的温度"（2026-04-26）

**v1.2 已交付功能：**
- AI 陪伴建议：保存记忆后异步生成温情建议，支持文字/链接不同策略
- AI 建议 UI：Sparkles 标记、详情页展示、反馈按钮（有用/不用了）
- 标签过滤器：首页横向标签栏，多选 AND 过滤
- 标签管理页：/tags 云图/卡片/列表视图，颜色选择器，标签合并
- 相关标签：记忆详情页基于共现统计的关联发现
- 记忆 Streaks：连续记录天数统计，创建表单状态显示
- 那年今日：首页展示一年前的记忆，与过去的自己重逢
- 时间胶囊：7/30/100 天封印，到期解锁仪式卡片
- 每日回顾：可折叠卡片展示今日记忆摘要

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

### v1.2 (2026-04-26)
- AI 陪伴建议：三种风格（温柔/实用/启发），文字/链接不同策略
- 标签重生：过滤器、管理页、颜色、合并、关联发现
- 记忆的温度：Streaks、那年今日、时间胶囊、每日回顾

## 下一个里程碑目标

*待规划。使用 `/gsd-new-milestone` 开始下一个里程碑。*

---

*Project context updated: 2026-04-26 — v1.2 milestone shipped*
