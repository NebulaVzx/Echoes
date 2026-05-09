---
status: testing
phase: 13-memory-constellation
source:
  - 13-03-SUMMARY.md
  - 13-04-SUMMARY.md
  - 13-05-SUMMARY.md
started: 2026-05-09T20:00:00+08:00
updated: 2026-05-09T20:00:00+08:00
---

## Current Test

number: 1
name: Cold Start Smoke Test
expected: |
  启动所有服务（docker-compose up -d + make migrate），访问 http://localhost:3000/constellation
  页面加载无白屏/报错，显示加载骨架或星图内容
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: |
  启动所有服务（docker-compose up -d + make migrate），访问 http://localhost:3000/constellation
  页面加载无白屏/报错，显示加载骨架或星图内容
result: pending

### 2. 星图页面渲染与节点显示
expected: |
  创建 ≥3 条不同标签的记忆并等待向量化处理完成后，访问 /constellation
  页面显示力导向图，节点在画布上分布，有连线连接相关记忆
result: pending

### 3. 标签颜色聚类
expected: |
  星图中不同标签的记忆显示不同颜色（如 "技术"=蓝色，"生活"=绿色）
  同标签的记忆节点颜色一致
result: pending

### 4. 内容类型形状区分
expected: |
  text 类型记忆 = 圆形节点
  link 类型记忆 = 菱形节点（旋转 45°）
  file 类型记忆 = 方形节点
result: pending

### 5. 星标记忆金色光晕
expected: |
  将至少 1 条记忆标记为星标后刷新星图
  星标记忆节点有金色/黄色外发光，尺寸比普通节点大
result: pending

### 6. 悬停高亮连通节点
expected: |
  鼠标悬停在任意节点上
  该节点和与之相连的记忆节点保持高亮，其他节点变暗（opacity 降低）
  相连的边也变亮，无关边变暗
result: pending

### 7. 双击缩放聚焦节点
expected: |
  快速双击（300ms 内两次点击）任意节点
  画布平滑缩放并聚焦到该节点位置
result: pending

### 8. 搜索筛选功能
expected: |
  在左上角搜索框输入记忆标题关键词或标签名
  星图只显示匹配的记忆节点和它们之间的边
  清除搜索后恢复完整星图
result: pending

### 9. "探索更远"分页加载
expected: |
  当记忆数量 > 100 时，星图底部中央显示"探索更远"按钮
  点击后加载下一批记忆节点并追加到星图中
  按钮在无可加载内容时隐藏
result: pending

### 10. 桌面端节点点击打开探索面板
expected: |
  在桌面浏览器（宽度 ≥768px）中点击任意星图节点
  右侧滑出 ExplorePanel，显示该记忆的关联记忆列表
  面板中有面包屑导航显示当前探索路径
result: pending

### 11. 探索面板关联记忆展示
expected: |
  ExplorePanel 中显示 5-8 条关联记忆
  每条记忆显示：标题/内容预览、相似度百分比（如 "85%"）、AI 生成的关联原因、标签
  关联原因以斜体小字展示
result: pending

### 12. 面包屑钻取导航
expected: |
  在 ExplorePanel 中点击一条关联记忆
  面包屑增加一层，显示新的中心记忆
  面板内容更新为新记忆的关联记忆列表
  点击面包屑中的任意层级可跳转回该记忆
result: pending

### 13. 移动端节点点击跳转探索页面
expected: |
  在移动端浏览器或桌面模拟移动端（宽度 <768px）中点击星图节点
  页面导航到 /explore?id={memoryId}
  新页面显示该记忆的关联记忆列表，支持继续钻取
result: pending

### 14. 键盘快捷键
expected: |
  在星图页面按下以下按键：
  - +/-：画布放大/缩小
  - 0：重置视图
  - f：自适应画布（zoomToFit）
  - Esc：关闭 ExplorePanel（如果打开）
result: pending

### 15. 空状态展示
expected: |
  当用户没有任何记忆时访问 /constellation
  页面显示"星图还是一片空白"提示，有引导按钮去创建第一条记忆
result: pending

### 16. 错误状态与重试
expected: |
  模拟网络错误（如断开 API 服务）后刷新星图
  页面显示错误提示和"重试"按钮
  点击重试后重新加载数据
result: pending

## Summary

total: 16
passed: 0
issues: 0
pending: 16
skipped: 0

## Gaps

[none yet]
