# Phase 13 Discussion Log

**Date:** 2026-05-09
**Status:** Context updated with implementation decisions

---

## Areas Discussed

### 1. 图数据加载策略
- **Options presented:** 全量加载 vs 分层加载 vs 纯按需
- **Decision (D-01):** 分层加载 — 首次 100 条 + 星标，视口扩展 + "探索更远"
- **Reasoning:** 避免 10,000 节点初始卡顿；星标记忆始终可见保证高价值内容可达

### 2. 关联说明生成时机
- **Options presented:** 实时 LLM vs 预计算 vs 混合
- **Decision (D-02):** 混合模式 — 首次实时生成，缓存到 `memory_relations` 表
- **Reasoning:** 平衡洞察质量与性能；缓存可预热星标记忆关联

### 3. 可视化库选型
- **Options presented:** react-force-graph-2d vs D3-force vs Sigma.js
- **Decision (D-03):** P0 用 react-force-graph-2d，P1 评估 Sigma.js 大数据降级
- **Reasoning:** React 友好、快速落地、与原有规划一致

### 4. 探索模式交互范式
- **Options presented:** 右侧面板 vs 全屏覆盖 vs 新页面
- **Decision (D-04):** 桌面端复用 RightPanel 横向展开；移动端新页面推入
- **Reasoning:** 最大化复用 Phase 11 布局基础设施

### 5. 图着色策略
- **Decision (D-05):** 按标签聚类着色 + 内容类型边框区分 + 星标金色光晕
- **Reasoning:** 多维度视觉编码，信息密度高但不杂乱

---

## Deferred Ideas

- 3D 星图 (v1.4+)
- AR/VR 空间探索 (远期)
- 多人共享星图 (需要社交功能)
- 预计算全图边集 (夜间批量任务)

---

## Codebase Insights Applied

- Phase 11 已完成三栏布局，`/constellation` 和 `/explore` 占位页 + Sidebar 导航已注册
- Phase 12 扩展了记忆模型（vector 1024 维 BGE-M3）
- 已有 `SearchByVector` / `FindRelated` 可复用
- 无图可视化库，需新增 `react-force-graph-2d`
- 需新增 `memory_relations` 表和对应 API 端点
