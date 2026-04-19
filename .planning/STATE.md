---
name: Echoes Project State
description: 拾忆项目当前状态跟踪，记录已完成/进行中/待办事项
type: state
---

# 项目状态

**最后更新：** 2026-04-19
**当前分支：** develop
**当前阶段：** Sprint 2 完成，准备 Sprint 3

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

---

## 待办事项（下一步）

### Sprint 3：AI 处理层（即将开始）
- [ ] LLM Provider 抽象层（OpenAI / Anthropic）
- [ ] Processor Service：Redis 消费者 + 链接抓取 + 标签生成
- [ ] Vectorizer Service：BGE-M3 模型 + 向量生成
- [ ] 状态流转管理 + 重试机制

### 技术债务（Sprint 3 前需处理）
- [ ] 移除硬编码 JWT Secret（安全）
- [ ] 从 Git 移除 .env（安全）
- [ ] 修复 CORS 白名单（安全）
- [ ] 添加限流中间件（安全）
- [ ] 输入内容 XSS 过滤（安全）

---

## 已知问题

1. **Processor/Vectorizer 是空壳**：只有 health check，不消费 Redis Stream
2. **无测试文件**：整个代码库零测试
3. **OAuth state 内存泄漏**：未清理过期 state 条目
4. **Gateway 无后端健康检查**：服务宕机时返回 502/503
5. **前端无分页 UI**：API 支持但 UI 硬编码 page=1

---

## 质量门禁

- [x] Sprint 0 里程碑验证通过
- [x] Sprint 1 里程碑验证通过
- [x] Sprint 2 里程碑验证通过
- [ ] Sprint 3 前需修复 Critical 安全问题

---

*State tracking for Echoes project. Updated: 2026-04-19*
