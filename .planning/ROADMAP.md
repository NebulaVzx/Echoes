---
name: Echoes Roadmap
description: 拾忆产品 6 周 Sprint 开发路线图，映射到 GSD 阶段
type: roadmap
---

# 路线图

## 概览

| 阶段 | 对应 Sprint | 主题 | 周期 | 状态 |
|------|------------|------|------|------|
| 阶段 0 | Sprint 0 | 基础设施 | Week 1 | 已完成 |
| 阶段 1 | Sprint 1 | 认证体系 | Week 2 | 已完成 |
| 阶段 2 | Sprint 2 | 记忆捕获 | Week 3 | 已完成 |
| 阶段 3 | Sprint 3 | AI 处理层 | Week 4 | 待开发 |
| 阶段 4 | Sprint 4 | 搜索能力 | Week 5 | 待开发 |
| 阶段 5 | Sprint 5 | 可观测性 + 打磨 | Week 6 | 待开发 |
| 阶段 6 | Phase 2 | Echo Assistant | +1-2 周 | 规划中 |

---

## 阶段 0：基础设施（Sprint 0）

**目标：** 一键启动完整的开发环境

**交付物：**
- Docker Compose 配置（所有服务 + 基础设施）
- 数据库迁移（users / memories + pgvector 扩展）
- 各服务 Dockerfile（多阶段构建）
- 服务骨架（/health 端点）
- Next.js 项目初始化
- Makefile / 启动脚本

**验证标准：** `docker-compose up -d` 后所有服务 running，Gateway `/health` 返回 200

---

## 阶段 1：认证体系（Sprint 1）

**目标：** 用户可注册、登录，JWT 认证链路贯穿 Gateway → User Service

**交付物：**
- User Service：注册/登录/OAuth/刷新 Token
- Gateway：JWT 中间件 + 反向代理
- 前端：登录页/注册页/路由保护/AuthProvider

**验证标准：**
- 用户可通过邮箱注册、登录
- GitHub OAuth 可完成授权
- Gateway 中间件拒绝无 Token 请求

---

## 阶段 2：记忆捕获（Sprint 2）

**目标：** 用户可保存文字/链接，时间轴浏览记忆

**交付物：**
- Memory Service：记忆 CRUD + 分页 + Redis Stream 发布
- Gateway：记忆路由转发
- 前端：时间轴首页 + 创建表单 + 记忆卡片 + 详情页

**验证标准：**
- 登录用户可创建文字记忆和链接记忆
- 时间轴展示记忆列表（按时间倒序）
- 可点击查看详情、编辑标签、删除
- 创建后 Redis Stream 有任务

---

## 阶段 3：AI 处理层（Sprint 3）

**目标：** 自动标签 + 文本向量化，异步队列消费者工作

**关键交付物：**
- LLM Provider 抽象层（OpenAI / Anthropic）
- Processor Service：Redis Stream 消费者 + 链接抓取 + 自动标签
- Vectorizer Service：BGE-M3 模型加载 + 向量生成
- 状态流转管理：pending → processing → completed/failed

**验证标准：**
- 创建记忆后，Processor 自动抓取链接标题摘要
- 自动标签生成（中文，3-5 个）
- 向量写入 memories.vector 字段
- LLM 失败时降级为本地关键词提取

---

## 阶段 4：搜索能力（Sprint 4）

**目标：** 语义搜索可用，相似推荐可用，暗黑模式完成

**关键交付物：**
- 语义搜索 API：`GET /api/v1/search?q=&limit=`
- 相似推荐：`GET /api/v1/memories/:id/related`
- 搜索页面（前端）
- 暗黑模式切换
- 响应式适配

**验证标准：**
- 搜索"Go 协程"可找到相关记忆
- 相似推荐展示"你可能还感兴趣"
- 暗黑模式完整可用

---

## 阶段 5：可观测性 + 打磨（Sprint 5）

**目标：** 必须接入可观测性三件套，产品达到可用状态

**关键交付物：**
- Prometheus Metrics（/metrics 端点）
- OpenTelemetry Tracing（跨服务链路）
- Zap 结构化日志
- Framer Motion 动效
- 错误处理（Toast 通知）
- 端到端测试

**验证标准：**
- Prometheus 可抓取所有 Go 服务指标
- Jaeger 可查看跨服务调用链路
- Grafana 仪表盘展示 QPS / 延迟 / 错误率
- 端到端流程无阻塞通过

---

## 阶段 6：Echo Assistant（Phase 2）

**目标：** 对话式 AI 助手，基于 RAG 回答用户记忆相关问题

**关键交付物：**
- Chat UI 侧边栏
- RAG 检索逻辑（语义搜索 + LLM 生成）
- 引用来源展示
- 对话历史管理

**验证标准：** "我上周存的关于 Go 的文章有哪些？" → 列出相关记忆 + 总结回答

---

## 当前阶段

**阶段 2 已完成（2026-04-19）**，下一阶段：**阶段 3（AI 处理层）**

见 `.planning/STATE.md` 获取最新状态。

---

*Roadmap derived from PRD.md Sprint plan. Created: 2026-04-19*
