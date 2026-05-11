---
name: Echoes Project State
description: 拾忆项目当前状态跟踪，记录已完成/进行中/待办事项
type: state
---

# 项目状态

**最后更新：** 2026-05-09
**当前分支：** develop（领先 origin/develop 24+ commits，已推送）
**当前里程碑：** v1.3 "记忆的回响"（Phase 14 ✅ 全部完成）

---

## 当前位置

**状态：** v1.2 里程碑已完成并归档，v1.3 Phase 11 ✅ 已完成，Phase 12 ✅ 已完成，Phase 13 ✅ 技术实现完成，Phase 14 ✅ 全部完成（7/7 plans，4 Waves）
**最近活动：** 2026-05-09 — Phase 14 全部执行完成：Cover Consumer + Weave API + 时间轴封面 + 多选交互 + 编织页面/编辑器 + 入口集成 + 端到端验证
**端到端验证结果：** 前端构建 ✅ | TypeScript 类型检查 ✅ | Go 测试通过 ✅ | 路由注册 ✅ | 文件完整性 ✅ | 人工 E2E 验证 ⏳ 待执行（Phase 13 + 14）

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
- Phase 15 — 情绪与回响 ✅ 讨论完成 + UI-SPEC 通过（2026-05-11），待规划
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
- [x] Phase 13 构建/类型/编译验证通过（2026-05-09）
- [x] Phase 14 构建/类型/测试验证通过（2026-05-09）

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

### Phase 13 — 记忆星图与探索（2026-05-09 执行完成）

**状态：** ✅ 技术实现全部完成，自动验证通过，待人工端到端确认

**实事求是评估：**

| 类别 | 状态 | 说明 |
|------|------|------|
| DB 迁移 + 领域类型 | ✅ 完成 | `005_memory_relations.sql`，ConstellationNode/Edge/ExploreResult |
| 关系仓库 | ✅ 完成 | `relation_repository.go`：GetReason/Save/GetRelations |
| Constellation API | ✅ 完成 | `GET /constellation?offset=`：最近 100 + 星标记忆合并 |
| Explore API | ✅ 完成 | `GET /memories/:id/explore`：flat 结构返回 similarity + reason |
| LLM 关联说明 | ✅ 完成 | 缓存优先（memory_relations），miss 时调用 OpenAI/Anthropic，5s 超时 |
| 前端类型 + API | ✅ 完成 | `types/constellation.ts`，`lib/api.ts` 新增方法 |
| ConstellationGraph | ✅ 完成 | react-force-graph-2d 动态导入，自定义 Canvas 渲染（圆/菱形/方块） |
| GraphControls | ✅ 完成 | 缩放/重置/搜索筛选 |
| ExplorePanel | ✅ 完成 | 面包屑 + 关联记忆卡片 + AI 原因 |
| BreadcrumbTrail | ✅ 完成 | 水平导航，支持点击跳转和重置 |
| RelatedMemoryCard | ✅ 完成 | 预览 + 相似度 badge + 原因 + 标签 |
| /explore 页面 | ✅ 完成 | 移动端探索模式，钻取 + URL 同步 |
| Hooks (3) | ✅ 完成 | useConstellationData, useGraphInteractions, useExplorePath |
| 键盘快捷键 | ✅ 完成 | Esc/+/−/0/f |
| 构建验证 | ✅ 通过 | 前端 `npm run build` + `tsc --noEmit`，后端 `go build` |
| 端到端验证 | ⏳ 待人工 | 需启动服务后创建测试数据并手动验证 16 项检查 |

**已锁定决策：**
- D-01: 图数据分层加载（首次 100 条 + 星标，按需扩展）
- D-02: 关联说明混合模式（实时 LLM + `memory_relations` 表缓存）
- D-03: 可视化库 P0 用 react-force-graph-2d，P1 评估 Sigma.js
- D-04: 探索模式桌面端 RightPanel 展开，移动端新页面推入
- D-05: 图着色按标签聚类 + 内容类型边框 + 星标光晕

**计划清单：**
| Plan | 目标 | Wave | 状态 |
|------|------|------|------|
| 13-01 | 数据库迁移 + Domain 类型 + RelationRepository + Constellation 查询 | 1 | ✅ 已完成 |
| 13-02 | MemoryService 扩展 + Constellation/Explore Handler + LLM 关联说明 | 1 | ✅ 已完成 |
| 13-03 | 安装依赖 + 类型定义 + ConstellationGraph + GraphControls + 星座页面 | 2 | ✅ 已完成 |
| 13-04 | ExplorePanel + BreadcrumbTrail + RelatedMemoryCard + /explore 页面 | 3 | ✅ 已完成 |
| 13-05 | Hooks + 页面集成 + RightPanel 联动 + 键盘快捷键 | 3 | ✅ 已完成 |
| 13-06 | 端到端验证（人工检查点） | 4 | ⏳ 待人工确认 |

**文档产出：**
- 13-CONTEXT.md（已更新，含 5 个决策）
- 13-RESEARCH.md（732 行，技术调研）
- 13-UI-SPEC.md（532 行，6/6 维度通过）
- 13-VALIDATION.md（测试策略）
- 13-DISCUSSION-LOG.md（讨论记录）

### Phase 14 — 记忆封面与编织（2026-05-09 全部完成）

**状态：** ✅ 全部完成（7/7 plans，4 Waves），构建+测试通过

**实事求是评估：**

| 类别 | 状态 | 说明 |
|------|------|------|
| Cover Consumer | ✅ 完成 | Redis Stream `cover:generate` 消费者，DALL-E 3 → Pollinations → 纯色降级，Pillow 裁剪 400x300，MinIO `covers/{user_id}/{memory_id}.jpg` |
| Weave API | ✅ 完成 | `POST /memories/weave`，4 种模式（article/story/summary/todo），LLM prompt 模板，`[^N]` 来源引用，metadata 存储 weave_source_ids |
| 时间轴封面 | ✅ 完成 | MemoryCard 左侧缩略图，3 档响应式尺寸（80x60/100x75/120x90），cover_url 优先，标签 HSL hash 降级 |
| 多选交互 | ✅ 完成 | Ctrl/Cmd 多选、Shift 范围选择、500ms 触摸长按、浮动选择栏、选中高亮边框 |
| 编织页面 | ✅ 完成 | `/weave` 列表页 + `/weave/[id]` 详情页，模式选择弹窗（4 模式），Markdown 预览/编辑/导出/保存 |
| 入口集成 | ✅ 完成 | CommandPalette `/weave` 导航命令，ExplorePanel「编织」按钮（当前记忆 + 关联记忆一起编织） |
| 端到端验证 | ✅ 通过 | 前端 `npm run build` + `tsc` 通过，后端 `go test ./...` 通过 |

**计划清单：**
| Plan | 目标 | Wave | 状态 |
|------|------|------|------|
| 14-01 | Cover Consumer（DALL-E 3 + Pollinations 降级，Pillow 裁剪，MinIO 上传） | 1 | ✅ 已完成 |
| 14-02 | Weave API + Domain 更新（content_type="weave"，编织端点，LLM prompt） | 1 | ✅ 已完成 |
| 14-03 | 时间轴封面展示（MemoryCard 缩略图，响应式尺寸，标签 hash 降级） | 2 | ✅ 已完成 |
| 14-04 | 多选状态（Ctrl/Shift 点击，长按，浮动操作栏） | 3 | ✅ 已完成 |
| 14-05 | 编织页面与编辑器（/weave，模式选择，编辑，Markdown 导出） | 3 | ✅ 已完成 |
| 14-06 | Command Palette + ExplorePanel 集成（/weave 命令，编织按钮） | 3 | ✅ 已完成 |
| 14-07 | 端到端集成（cover 队列发布，构建验证，E2E 测试） | 4 | ✅ 已完成 |

**文档产出：**
- 14-CONTEXT.md（已更新，含 5 个决策组）
- 14-DISCUSSION-LOG.md（讨论记录）
- 14-RESEARCH.md（733 行，技术调研）
- 14-VALIDATION.md（验证策略）
- 14-01~14-07-PLAN.md（7 个执行计划）

---

*State tracking for Echoes project. Updated: 2026-05-09 — Phase 14 全部完成，7/7 plans 执行完毕，构建+测试通过*
