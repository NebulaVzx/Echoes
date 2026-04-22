---
name: Echoes Project State
description: 拾忆项目当前状态跟踪，记录已完成/进行中/待办事项
type: state
---

# 项目状态

**最后更新：** 2026-04-22
**当前分支：** develop
**当前阶段：** Sprint 5 已完成

---

## 完成状态

### Sprint 0：基础设施（已完成）
- [x] Docker Compose 配置
- [x] 数据库迁移（users / memories + pgvector）
- [x] 各服务 Dockerfile
- [x] 服务骨架（/health）
- [x] Next.js 初始化
- [x] Makefile / 启动脚本

### Sprint 1：认证体系（已完成）
- [x] User Service：注册/登录/OAuth/刷新
- [x] Gateway：JWT 中间件 + 反向代理
- [x] 前端：登录/注册页 + 路由保护 + AuthProvider
- [x] GitHub OAuth 流程修复（hash redirect）

### Sprint 2：记忆捕获（已完成）
- [x] Memory Service：CRUD + 分页 + Redis Stream
- [x] Gateway：记忆路由转发
- [x] 前端：时间轴 + 创建表单 + 卡片 + 详情页
- [x] PostgreSQL 数组类型修复（pq.StringArray）
- [x] GORM 向量字段跳过 auto-migrate

### Sprint 3：AI 处理层（已完成）
- [x] 计划 03-01：BGE-M3 向量维度迁移 + 子任务状态追踪 + 内部 API（已完成 2026-04-19）
- [x] 计划 03-02：LLM Provider 抽象层 + Processor Service（已完成 2026-04-19）
- [x] 计划 03-03：Vectorizer Service：BGE-M3 模型 + 向量生成（已完成 2026-04-19）
- [x] 计划 03-04：Integration - Docker Compose 集成 + Gateway 安全检查 + 冒烟测试 + e2e 验证脚本（已完成 2026-04-19）

### Sprint 4：搜索与发现（已完成）
- [x] 计划 04-01：Vectorizer Service POST /encode 端点 + CORS（已完成 2026-04-21）
- [x] 计划 04-02：Memory Service 语义搜索 + 相似推荐 API（已完成 2026-04-21）
- [x] 计划 04-03：前端搜索页面 + 导航搜索框 + 相似推荐组件（已完成 2026-04-21）
- [x] 计划 04-04：E2E 验证脚本 + VERIFICATION.md（已完成 2026-04-21）

---

## 待办事项（下一步）

### Sprint 5：可观测性 + 打磨（已完成）
- [x] 计划 05-01：Go Zap 日志 + Prometheus Metrics（3 个 Go 服务）（已完成 2026-04-21）
- [x] 计划 05-02：前端打磨 — Framer Motion、骨架屏、空状态、Toast（已完成 2026-04-21）
- [x] 计划 05-03：Go OpenTelemetry 链路追踪（已完成 2026-04-21）
- [x] 计划 05-04：Python 服务可观测性（Prometheus + OTel）（已完成 2026-04-21）
- [x] 计划 05-05：后端打磨 — 输入验证、统一错误响应、限流、CORS（已完成 2026-04-21）
- [x] 计划 05-06：Docker Compose 扩展 — Prometheus + Jaeger + Grafana（已完成 2026-04-21）
- [x] 计划 05-07：Grafana 仪表盘 + Playwright E2E 测试（已完成 2026-04-21）

### Sprint 6：Echo Assistant（规划中）

## 发布状态

- **Phase 5 PR:** [#2](https://github.com/NebulaVzx/Echoes/pull/2) — develop → main
- **提交日期:** 2026-04-22
- **验证状态:** 17/17 automated + 10/10 UAT passed

- **Phase 4 PR:** [#1](https://github.com/NebulaVzx/Echoes/pull/1) — develop → main
- **提交日期:** 2026-04-21
- **验证状态:** 12/12 automated + 5/5 UAT passed

---

## 技术债务（已修复）
- [x] 移除硬编码 JWT Secret（C1）
- [x] .env 安全模板（C2）
- [x] 修复 CORS 白名单（C3）
- [x] 添加限流中间件（C4）
- [x] 输入内容 XSS 过滤（C5）
- [x] isPublicRoute HasPrefix 绕过（M7）

## 已知问题

1. ~~Vectorizer 是空壳~~：已修复（03-03 完成）
2. ~~无测试文件~~：Playwright E2E 测试已添加（05-07 完成），Go 单元测试仍待补充
3. **OAuth state 内存泄漏**：未清理过期 state 条目
4. **Gateway 无后端健康检查**：服务宕机时返回 502/503
5. **前端无分页 UI**：API 支持但 UI 硬编码 page=1

---

## 质量门禁

- [x] Sprint 0 里程碑验证通过
- [x] Sprint 1 里程碑验证通过
- [x] Sprint 2 里程碑验证通过
- [x] Sprint 3 里程碑验证通过（2026-04-19）
- [x] Sprint 4 里程碑验证通过（2026-04-21）
- [x] Sprint 5 里程碑验证通过（2026-04-21）

---

*State tracking for Echoes project. Updated: 2026-04-21*
