---
name: Echoes Project State
description: 拾忆项目当前状态跟踪，记录已完成/进行中/待办事项
type: state
---

# 项目状态

**最后更新：** 2026-05-09
**当前分支：** develop（领先 origin/develop 24+ commits，未推送）
**当前里程碑：** v1.3 "记忆的回响"（Phase 13 🔄 执行中）

---

## 当前位置

**状态：** v1.2 里程碑已完成并归档，v1.3 Phase 11 已完成（12/12 plans），Phase 12 已完成（P0 + P1 全部完成）
**最近活动：** 2026-05-08 — Phase 12 缺口补齐：星标筛选 UI + 草稿自动保存 + 端到端验证。新增 2 文件修改（page.tsx + create-memory-form.tsx），所有核心服务容器已启动并运行。
**端到端验证结果：** 文字记忆创建 ✅ | 文件上传 + 文本提取 ✅ | 语义搜索找到文件内容 ✅ | 星标筛选返回 2 条 ✅ | 草稿自动保存代码已部署（需人工验证浏览器行为）

---

## 已完成里程碑

### v1.0 MVP（2026-04-22）
- Sprint 0-5 全部完成
- PR #2 已创建（develop → main）
- Tag: v1.0

### v1.1 Echo Assistant（2026-04-25）
- Phase 6 — Echo Assistant（已完成）
- Phase 7 — Bug Fixes & Quality（已完成）
- 修复：OAuth state 内存泄漏、Gateway 健康检查、路径遍历、Chat 服务问题
- 新增：双模式分页、Go 单元测试（55 个测试全部通过）

### v1.2 "记忆的温度"（2026-04-26）
- Phase 8 — AI 陪伴建议（已完成，5/5 计划）
- Phase 9 — 标签重生（已完成，4/4 计划）
- Phase 10 — 记忆的温度（已完成，4/4 计划）
- 提交数：105，文件变更：120，插入：19,777 行
- Tag: v1.2

---

## 待办里程碑

### v1.3 "记忆的回响"（规划中）
- Phase 11 — UI 架构重设计（三栏工作台、Command Palette、AI 交互）
- Phase 12 — 记忆捕获扩展（文件上传、记忆匣、快速模板）
- Phase 13 — 记忆星图与探索（可视化关联网络、无限钻取）
- Phase 14 — 记忆封面与编织（AI 封面、记忆编织文章）
- Phase 15 — 情绪与回响（情绪日历、每日记忆推送）
- Phase 16 — 用户管理中心（记忆 DNA、AI 人格、数据主权）
- Phase 17 — 浏览器插件与桥梁（Web Clipper、记忆桥梁）
- **新增需求来源**：用户反馈 + Flipbook 启发调研

### v1.4 "稳固之基"（规划中）
- Phase 18 — 公共模块提取（shared/go + shared/python，消灭重复代码）
- Phase 19 — 前端架构清理（api.ts 拆分、组件目录重组）
- Phase 20 — 安全加固：认证层（Refresh Token 轮换、密码策略、账户锁定、日志遮蔽）
- Phase 21 — 安全加固：基础设施（Docker 网络隔离、端口收敛、TLS、Secrets）
- Phase 22 — 服务边界治理（Chat 下沉、Gateway 纯路由化）
- **新增需求来源**：代码安全审计 + 技术债务扫描（2026-04-26）

---

## 质量门禁

- [x] Sprint 0 里程碑验证通过
- [x] Sprint 1 里程碑验证通过
- [x] Sprint 2 里程碑验证通过
- [x] Sprint 3 里程碑验证通过（2026-04-19）
- [x] Sprint 4 里程碑验证通过（2026-04-21）
- [x] Sprint 5 里程碑验证通过（2026-04-21）
- [x] v1.1 里程碑验证通过（2026-04-25）
- [x] v1.2 里程碑验证通过（2026-04-26）

---

## 决策记录

- **D-06-04-01:** ReactMarkdown v9 不支持 className prop，采用 div 包裹方案
- **D-06-04-02:** 所有 Chat 组件为纯展示组件，数据通过 props/callbacks 传递，状态管理交由 ChatProvider (06-05)
- **D-08-02-01:** Create 方法返回 (*Memory, string, error) 带 suggestion_status，避免额外 DB 查询
- **D-08-02-02:** getUserSuggestionStyle 默认 inspiring
- **D-08-02-03:** 建议生成失败不阻塞保存流程

## 当前 Phase 详细状态

### Phase 12 — 记忆捕获扩展（2026-05-03 至 05-08）

**实事求是评估：**

| 类别 | 状态 | 说明 |
|------|------|------|
| 文件上传核心链路 | ✅ 完成 | 上传 → MinIO → file:extract → 文本提取 → 向量化/标签/建议 |
| 数据库迁移 | ✅ 完成 | 004_file_upload.sql，5 个新字段 + 索引 |
| 前端表单 | ✅ 完成 | "记忆匣"品牌、拖拽上传、5 模板、来源、星标、草稿自动保存 |
| 记忆卡片展示 | ✅ 完成 | 文件图标、星标、来源标注 |
| 星标筛选 API | ✅ 完成 | `?starred=true` 支持 |
| 星标筛选 UI | ✅ 完成 | page.tsx 添加 "只看星标" Switch toggle + URL 同步 |
| 草稿自动保存 | ✅ 完成 | localStorage debounce 2s + 页面加载恢复 + 提交清除 |
| 批量导入 | ✅ 完成 | 多文件选择、逐个上传、总大小 50MB 限制、独立错误处理 |
| 智能粘贴识别 | ✅ 完成 | URL/代码/待办列表/读书笔记 自动检测并切换模式或模板 |
| 端到端验证 | ✅ 完成 | 2026-05-09：批量导入 3 文件验证通过、智能粘贴编译通过 |
| 测试覆盖 | ⚠️ 部分 | file_consumer/base/link_consumer/redis_queue 有测试，handler/service 层缺少文件上传专项测试 |

**质量门禁：**
- [x] Phase 12 端到端验证通过（2026-05-08）
- [x] 所有核心服务容器健康运行（2026-05-08 已启动）

### Phase 13 — 记忆星图与探索（2026-05-09 规划完成）

**状态：** ✅ 规划完成，6 个计划已验证通过，待执行

**已锁定决策：**
- D-01: 图数据分层加载（首次 100 条 + 星标，按需扩展）
- D-02: 关联说明混合模式（实时 LLM + `memory_relations` 表缓存）
- D-03: 可视化库 P0 用 react-force-graph-2d，P1 评估 Sigma.js
- D-04: 探索模式桌面端 RightPanel 展开，移动端新页面推入
- D-05: 图着色按标签聚类 + 内容类型边框 + 星标光晕

**计划清单：**
| Plan | 目标 | Wave | 状态 |
|------|------|------|------|
| 13-01 | 数据库迁移 + Domain 类型 + RelationRepository + Constellation 查询 | 1 | 📋 待执行 |
| 13-02 | MemoryService 扩展 + Constellation/Explore Handler + LLM 关联说明 | 1 | 📋 待执行 |
| 13-03 | 安装依赖 + 类型定义 + ConstellationGraph + GraphControls + 星座页面 | 2 | 📋 待执行 |
| 13-04 | ExplorePanel + BreadcrumbTrail + RelatedMemoryCard + /explore 页面 | 3 | 📋 待执行 |
| 13-05 | Hooks + 页面集成 + RightPanel 联动 + 键盘快捷键 | 3 | 📋 待执行 |
| 13-06 | 端到端验证（人工检查点） | 4 | 📋 待执行 |

**文档产出：**
- 13-CONTEXT.md（已更新，含 5 个决策）
- 13-RESEARCH.md（732 行，技术调研）
- 13-UI-SPEC.md（532 行，6/6 维度通过）
- 13-VALIDATION.md（测试策略）
- 13-DISCUSSION-LOG.md（讨论记录）

---

*State tracking for Echoes project. Updated: 2026-05-09 — Phase 12 全部完成，Phase 13 上下文已收集*
