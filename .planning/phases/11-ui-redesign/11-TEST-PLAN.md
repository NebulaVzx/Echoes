---
phase: 11
name: UI 架构重设计 — 测试计划
created: 2026-05-03
tool: Playwright 1.59.1
---

# Phase 11 — UI 测试计划

## 测试范围

Phase 11 改造了全局布局、导航、主题系统和跨平台基础。测试覆盖：

| 类别 | 测试项 | 方式 |
|------|--------|------|
| 布局 | 三栏 Grid、Sidebar、RightPanel、Header | Headless |
| 导航 | Sidebar 4组9项、Mobile Dock 5 tab、路由 | Headless |
| 交互 | Command Palette、UserMenu、面板折叠/拖拽 | Headless |
| 主题 | Dark/Light 切换、Accent 色切换、Density | Headless |
| 存量 | 所有已有页面在新布局下正常渲染 | Headless |
| API | Gateway 健康、Memory Service 可用 | curl |

## 测试用例

### T1 — 三栏布局 (Desktop ≥1280px)

**前置**: Viewport 1440x900
**步骤**:
1. 访问 /login 页 → 应无 .app-shell 元素
2. 登录后访问 / → 应有 .app-shell (grid 容器)
3. 检查 .app-shell 的 grid-template-columns
4. 检查 .app-shell-header 存在
5. 检查 .app-shell-sidebar 存在 (初始宽 ~200px)
6. 检查 .app-shell-main 存在
7. 检查 .app-shell-panel 存在

**预期**: 三栏 Grid 布局，Header 全宽跨列

### T2 — Header 简化

**前置**: 已登录，Desktop viewport
**步骤**:
1. Header 仅含：Logo(链接到/) + SearchInput + UserMenu(Avatar)
2. Header 内无 ThemeToggle 按钮（已移到 UserMenu）
3. Header 内无 Capsules/Settings 链接（已移到 Sidebar）
4. Logo 点击跳转到 /

**预期**: Header 干净三区（Logo | 搜索 | 头像）

### T3 — Sidebar 导航

**前置**: 已登录，Desktop viewport
**步骤**:
1. Sidebar 包含 4 个分组：拾忆、发现、创作、我的
2. 拾忆组：时间轴(/)、记忆星图(/constellation)、探索模式(/explore)
3. 发现组：标签云(/tags)、情绪日历(/mood)、每日回响(/daily-echo)
4. 创作组：记忆编织(/weave)、时间胶囊(/capsules)
5. 我的组：个人画像(/profile)
6. 记忆星图/探索/情绪/编织/画像 有 ✨ 标记
7. 点击侧边栏底部折叠按钮，Sidebar 宽度变为 ~48px
8. 折叠后 hover 导航项显示 Tooltip

**预期**: 完整导航结构，折叠/展开正常

### T4 — UserMenu 下拉

**前置**: 已登录
**步骤**:
1. 点击 Header 右侧头像
2. 下拉菜单出现 4 个选项：我的画像、设置、切换主题、退出登录
3. 点击"我的画像"跳转到 /profile
4. 点击"设置"跳转到 /settings
5. 点击"切换主题"触发 dark/light 切换
6. 点击"退出登录"弹出确认 Dialog
7. Dialog 含"取消"和"确定退出"按钮

**预期**: 菜单功能完整，导航正确

### T5 — Command Palette

**前置**: 已登录
**步骤**:
1. 按 Cmd+K (Mac) / Ctrl+K (Win)
2. Command Palette 弹出
3. 输入 "时间轴" → 过滤结果显示该条目
4. 输入 "/" → 页面组过滤
5. 输入 ">" → 命令组过滤
6. 选择条目后导航到对应页面
7. 按 Escape 关闭

**预期**: Cmd+K 触发、模糊搜索、前缀过滤、导航

### T6 — Right Panel

**前置**: 已登录，Desktop viewport
**步骤**:
1. 默认 Panel 宽度 ~280px
2. Panel 可通过 LayoutProvider.toggleRightPanel 切换
3. Panel 隐藏时 content 不可见
4. Panel 左侧边缘可拖拽调整宽度 (200-400px)
5. 不同页面显示不同空状态文案

**预期**: Panel 可折叠/展开/调整宽度

### T7 — Mobile Dock (<768px)

**前置**: Viewport 375x812 (iPhone)
**步骤**:
1. Sidebar 不可见 (display:none)
2. 底部出现 .mobile-dock
3. Dock 包含 5 个 tab：拾(/)、星(/constellation)、胶(/capsules)、标(/tags)、我(/profile)
4. 当前路由对应的 tab 高亮
5. Click tab → 导航到对应页面

**预期**: 移动端底部导航取代 Sidebar

### T8 — 主题切换

**前置**: 已登录
**步骤**:
1. 初始为亮色模式（或跟随系统）
2. 通过 UserMenu 切换 → html 添加 .dark class
3. 再次切换 → html 移除 .dark class
4. 过渡动画为 300ms ease-out

**预期**: Dark/Light 切换，300ms 过渡

### T9 — 存量页面完整性

**前置**: 已登录
**步骤**:
1. 访问 / → 时间轴页面正常渲染（无内联 header）
2. 访问 /search?q=test → 搜索结果页正常
3. 访问 /tags → 标签管理页正常
4. 访问 /capsules → 时间胶囊页正常
5. 访问 /settings → 设置页正常
6. 访问 /memory/{id} → 记忆详情页正常
7. 所有页面无 <header> 元素（由 AppShell 提供）

**预期**: 所有存量页面在新布局下功能完整

### T10 — 新占位页面

**前置**: 已登录
**步骤**:
1. /constellation — 显示"即将在 Phase 13 上线"
2. /explore — 显示"即将在 Phase 13 上线"
3. /mood — 显示"即将在 Phase 15 上线"
4. /daily-echo — 显示"即将在 Phase 15 上线"
5. /weave — 显示"即将在 Phase 14 上线"
6. /profile — 显示"即将在 Phase 16 上线"

**预期**: 6 个占位页面正常渲染

## 自动化验证命令

```bash
# 布局 shell
grep -c "app-shell" web/app/globals.css

# Provider tree
grep -c "LayoutProvider" web/app/layout.tsx

# 无残留 header
grep -r "<header" web/app/\(main\)/ | wc -l

# 设计 Token
ls shared/design-tokens/colors.json
```
