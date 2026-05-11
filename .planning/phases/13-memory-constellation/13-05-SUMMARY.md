# 13-05 SUMMARY — 星图与探索集成

## 状态
✅ 已完成

## 变更文件
- `web/components/constellation/hooks/useConstellationData.ts` — 数据获取 hook（含分页）
- `web/components/constellation/hooks/useGraphInteractions.ts` — 节点选择 hook
- `web/components/constellation/hooks/useExplorePath.ts` — 探索路径 hook
- `web/app/(main)/constellation/page-client.tsx` — 集成所有功能的星图页面

## 实现要点
- **useConstellationData**: 封装 `api.getConstellation(offset)`，支持 loadMore/refresh；注意颜色由 caller 计算，hook 不处理
- **useGraphInteractions**: 管理 selectedNode 状态，提供 handleNodeClick / deselect
- **useExplorePath**: push/pop/navigateTo/clear，管理面包屑路径栈
- **page-client 集成**:
  - 节点点击 → 桌面端打开右侧 ExplorePanel（`explorePath.push`）→ 移动端跳转 `/explore?id=`
  - 键盘快捷键：Esc 关闭面板、+/- 缩放、0 重置、f 自适应
  - 移动检测：`window.innerWidth < 768`，移动端限制节点数 50
  - 保留现有功能：筛选、分页加载、空/错状态、zoom 控制

## 构建验证
✅ `npm run build` 通过，/constellation 页面 6.84 kB

## 提交
`feat(13-04/13-05): 探索模式 UI + 组件集成 + 键盘快捷键` (22cc7eb)
