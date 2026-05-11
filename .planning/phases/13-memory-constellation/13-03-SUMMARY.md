# 13-03 SUMMARY — 前端星图组件

## 状态
✅ 已完成

## 变更文件
- `web/package.json` — 添加 `react-force-graph-2d`, `graphology`
- `web/types/constellation.ts` — GraphNode, GraphEdge, GraphData, ExploreState, ConstellationResponse, ExploreResponse
- `web/lib/api.ts` — `getConstellation(offset)`, `exploreMemory(id)`
- `web/components/constellation/ConstellationGraph.tsx` — ForceGraph2D + 自定义 Canvas 渲染
- `web/components/constellation/GraphControls.tsx` — 缩放/重置/搜索控件
- `web/components/constellation/GraphSkeleton.tsx` — 加载占位
- `web/app/(main)/constellation/page.tsx` — Server Component，metadata
- `web/app/(main)/constellation/page-client.tsx` — Client Component，数据获取 + 筛选 + 分页

## 实现要点
- react-force-graph-2d 动态导入（`ssr: false`），避免 SSR 报错
- `forwardRef` + `useImperativeHandle` 暴露 zoom/zoomToFit/centerAt 给父组件
- 自定义 `nodeCanvasObject`：圆（text）、菱形（link，rotate PI/4）、方块（file）
- 星标记忆金色光晕 `rgba(250, 204, 21, 0.3/0.25)`，节点尺寸 +3
- 标签仅在 `globalScale > 1.2` 时显示，避免视觉拥挤
- 颜色由 page-client 集中计算（`getTagColor`），graph 只读取 `node.color`
- 筛选逻辑：维护 `allGraphData` 原始数据不变，`filteredNodes` 为派生视图，`displayData` 用 `useMemo`
- 双击检测（300ms 间隔）实现节点缩放聚焦，避免使用不存在的 `onNodeDoubleClick` prop
- 悬停高亮：连通节点和边 opacity 保持，其余 dim 到 0.3/0.1（通过 rgba 和 ctx.globalAlpha 实现）
- 性能参数：`warmupTicks={50}`, `cooldownTicks={30}`, `cooldownTime={8000}`, `d3VelocityDecay={0.4}`

## 构建验证
✅ `npm run build` 通过，/constellation 页面 10.3 kB

## 已知问题 / 待后续处理
- `onNodeDoubleClick` 不是 react-force-graph-2d 的标准属性，已改为单击计时器检测双击（见实现要点）
- `linkOpacity` / `nodeOpacity` 不是标准属性，已通过 rgba 颜色和 `ctx.globalAlpha` 内嵌实现
- 星图节点点击目前只打印 console.log，探索面板在 Wave 3（13-04/13-05）中实现

## 提交
`feat(13-03): 前端星图组件 — ForceGraph2D + 自定义渲染 + 搜索筛选` (71d0d5a)
