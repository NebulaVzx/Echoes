---
phase: 13
name: memory-constellation
title: 记忆星图与探索模式
description: 基于向量相似度构建记忆关联网络可视化，支持从任意记忆出发无限钻取探索，受 Flipbook 生成式视觉交互启发
milestone: v1.3 "记忆的回响"
depends_on: [12-memory-capture-expansion]
---

# Phase 13 Context

## 目标

解决"保存了 1000 条记忆却依然感觉知识碎片化"的问题。通过可视化关联网络和探索式交互，让用户**发现记忆之间的隐藏连接**。

## Flipbook 启发

Flipbook（Zain Shah, 2026-04）展示了"生成式视觉互联网"——界面由 AI 实时生成，用户通过点击任意位置无限钻取。

Echoes 不照搬像素流（成本过高且不适用于生产力工具），但吸收其核心洞见：
- **视觉优先**：信息用图传达，而非纯文本列表
- **无限钻取**：从任意节点出发，无边界的探索
- **状态化**：界面随用户意图动态生成

## 范围

### P0 — 记忆星图（Memory Constellation）
- 力导向图可视化（react-force-graph-2d）
- 节点 = 记忆，边 = 向量相似度 > 0.75
- 按标签聚类着色
- 悬停/点击/双击交互

### P0 — 探索模式（Exploration Mode）
- 从任意记忆出发，展示 5-8 条关联记忆
- AI 生成"为什么相关"的关联说明
- 支持无限钻取（点击关联记忆成为新中心）
- 面包屑路径记录

### P1 — 星图优化
- 大数据量降级（Sigma.js）
- 筛选/搜索节点
- 3D 模式（预留）

## 技术约束
- 个人用户记忆量通常 < 10,000，react-force-graph 可处理 5,000 节点
- 相似度计算复用现有 pgvector
- 关联说明调用 LLM（复用现有 Provider）
- 批量相似度查询需优化（预计算或分页）

## 关键文件
- `web/components/constellation/` — 新组件目录
- `services/memory-service/internal/repository/memory_repository.go` — 向量查询
- `services/memory-service/internal/transport/memory_handler.go` — 新增 /graph /explore 接口

## 验收标准
- 星图页面可流畅展示 500+ 节点
- 探索模式钻取深度 >= 3 层
- 关联说明有洞察性（用户反馈"原来还有这个联系"）

---

## 跨平台兼容性考虑

### 可视化渲染性能

| 平台 | 渲染策略 | 性能目标 |
|------|---------|---------|
| **桌面端** | Canvas 2D / WebGL，500+ 节点流畅 | 60fps，支持力导向动画 |
| **平板端** | Canvas 2D，节点数限制 200 | 30fps 可接受，关闭复杂动画 |
| **移动端** | 简化 SVG / Canvas，节点数限制 50 | 优先展示最近 30 天的记忆关联 |

### 手势交互差异

- **桌面端**：鼠标滚轮缩放、拖拽平移、hover 显示节点详情、右键菜单
- **移动端**：pinch 缩放、单指平移、长按显示节点详情、双击聚焦
- **平板端**：支持 Apple Pencil / 触控笔悬停预览（未来扩展）

### 探索模式的导航差异

桌面端"无限钻取"采用**横向展开**（点击节点 → 右侧滑出新面板），移动端更适合**纵向堆叠**（点击节点 → 新页面推入导航栈），体验类似 Instagram 的深层浏览。

## 实现决策（2026-05-09 更新）

基于代码库侦察（Phase 11/12 已完成）和最佳实践：

### D-01: 图数据加载策略

**分层加载 + 按需扩展**
- 首次加载：最近 100 条记忆 + 所有星标记忆（通常 < 200 节点）
- 视口内节点自动扩展关联（悬停/点击时加载其相似节点）
- "探索更远"按钮加载下一批 100 条
- 理由：避免 10,000 节点一次性渲染导致初始加载 >3s；星标记忆是高价值节点，应始终可见

### D-02: 关联说明生成时机

**混合模式：实时生成 + 关系表缓存**
- 首次展示两记忆关联时：实时调用 LLM 生成 "为什么相关" 说明
- 缓存写入 `memory_relations` 表：`source_id`, `target_id`, `similarity`, `reason`, `created_at`
- 后续直接读取缓存，< 50ms
- 缓存预热：星标记忆的关联在后台预计算
- 理由：平衡洞察质量与性能，避免重复 LLM 调用成本

### D-03: 可视化库选型

**P0: react-force-graph-2d**
- 安装 `react-force-graph-2d`（基于 D3-force，React 友好）
- 支持力导向、悬停、点击、缩放、拖拽
- 个人用户 < 10,000 节点，该库可流畅处理 5,000 节点
- P1 评估 Sigma.js 作为大数据降级（> 5,000 节点时自动切换）

### D-04: 探索模式交互范式

**桌面端：右侧面板横向展开**
- 复用 Phase 11 已有的 RightPanel 组件
- 点击节点 → 右侧滑出关联记忆面板（5-8 条）
- 面包屑路径记录在最顶部

**移动端：新页面推入导航栈**
- 点击节点 → 新页面推入（类似 Instagram 深层浏览）
- 返回按钮回到上一级
- 与桌面端体验差异由响应式断点自然处理

### D-05: 图着色策略

**按标签聚类着色 + 内容类型区分**
- 主色：记忆的主要标签（取第一个标签的 hash 映射到色板）
- 辅助：内容类型区分边框（text=圆点、link=菱形、file=方形）
- 星标记忆：金色光晕或更大节点尺寸
- 选中节点：高对比度边框 + 关联边高亮

## <canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求与边界
- `.planning/ROADMAP.md` §Phase 13 — 阶段边界和目标
- `13-CONTEXT.md` §范围 — P0/P1 划分

### 技术架构
- `CLAUDE.md` — 技术栈、目录结构、API 约定、命名规范
- `PRD.md` — 完整 API 定义、数据库 Schema

### 现有代码（复用资产）
- `web/components/layout/AppShell.tsx` — 三栏布局壳（Phase 11）
- `web/components/layout/Sidebar.tsx` — 已有 /constellation 和 /explore 导航
- `web/app/(main)/constellation/page.tsx` — 占位页（需替换）
- `web/app/(main)/explore/page.tsx` — 占位页（需替换）
- `services/memory-service/internal/repository/memory_repository.go` — `SearchByVector` / `FindRelated`
- `services/memory-service/internal/transport/memory_handler.go` — handler 模式
- `web/lib/api.ts` — API 客户端模式

### 数据库
- `shared/migrations/001_init.sql` — 现有 Schema
- 需新增：`memory_relations` 表（D-02 关联缓存）

## <code_context>

## Existing Code Insights

### Reusable Assets
- `AppShell` + `Sidebar` + `RightPanel` — Phase 11 已完成，/constellation 和 /explore 路由已注册
- `SearchByVector` / `FindRelated` — 已有 pgvector 相似度查询，可直接复用
- `api.searchMemories` / `api.getRelatedMemories` — 前端 API 模式
- `MemoryCard` — 节点详情展示可复用
- `CommandPalette` — 可添加 "打开星图" / "随机探索" 命令

### Established Patterns
- Go service 分层：domain → repository → service → transport
- 前端数据获取：React `useEffect` + `useCallback`（或 TanStack Query）
- 暗黑模式：`dark:` Tailwind 前缀
- 动效：Framer Motion `motion.div`
- 响应式：`lg:` / `md:` Tailwind 断点（Phase 11 已定义：Mobile <768, Tablet 768-1279, Desktop ≥1280）

### Integration Points
- Memory Service：新增 `GetConstellation` / `Explore` handler，复用 `SearchByVector`
- Gateway：无需修改（`/*` 已转发）
- 前端：替换占位页，新增 `web/components/constellation/` 目录
- 数据库：新增 `memory_relations` 表迁移

## <deferred>

## Deferred Ideas

- **3D 星图** — `react-force-graph-3d` 或 Three.js，v1.4+ 评估
- **AR/VR 空间探索** — 远期概念
- **多人共享星图** — 需要社交功能，v1.4+
- **预计算全图边集** — 夜间任务批量计算所有记忆对的相似度，当前按需计算足够

### 不在本 Phase 做的事

- ❌ 移动端原生性能优化（Metal/Vulkan 渲染）—— 当前 Web 技术栈已足够
- ❌ AR/VR 空间探索 —— 远期概念
