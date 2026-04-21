---
name: Echoes Project State
description: 拾忆项目当前状态跟踪，记录已完成/进行中/待办事项
type: state
---

# 项目状态

**最后更新：** 2026-04-19
**当前分支：** develop
**当前阶段：** Sprint 3 已完成

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

---

## 待办事项（下一步）

### Sprint 4：搜索与发现（上下文已收集）
- [ ] 语义搜索 API（向量相似度查询）
- [ ] 相似内容推荐
- [x] 暗黑模式支持（已在 Sprint 3 完成）
- [ ] 前端搜索界面

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
2. **无测试文件**：Processor 和 Vectorizer 已有冒烟测试（03-04），Go 服务仍无测试
3. **OAuth state 内存泄漏**：未清理过期 state 条目
4. **Gateway 无后端健康检查**：服务宕机时返回 502/503
5. **前端无分页 UI**：API 支持但 UI 硬编码 page=1

---

## 质量门禁

- [x] Sprint 0 里程碑验证通过
- [x] Sprint 1 里程碑验证通过
- [x] Sprint 2 里程碑验证通过
- [x] Sprint 3 里程碑验证通过（2026-04-19）

---

*State tracking for Echoes project. Updated: 2026-04-19*
