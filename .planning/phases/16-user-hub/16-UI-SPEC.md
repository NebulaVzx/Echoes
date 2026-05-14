---
phase: 16
slug: user-hub
status: draft
shadcn_initialized: true
preset: none
created: 2026-05-12
---

# Phase 16 — UI Design Contract

> Visual and interaction contract for Phase 16: 用户管理中心

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn/ui (已初始化) |
| Preset | Notion-like minimalism |
| Component library | Radix UI |
| Icon library | Lucide React |
| Font | System font stack |
| Animation | Framer Motion, 200-300ms ease-out |

---

## Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, inline padding |
| sm | 8px | Compact element spacing |
| md | 16px | Default element spacing, card internal padding |
| lg | 24px | Section padding, card groups |
| xl | 32px | Layout gaps |
| 2xl | 48px | Major section breaks |
| 3xl | 64px | Page-level spacing |

Exceptions:
- DNA 可视化卡片内边距 20px（图表呼吸感）
- 人格选择卡片 gap 12px（紧凑网格）

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px | 400 | 1.5 |
| Label | 12px | 500 | 1.4 |
| Heading | 18px | 600 | 1.3 |
| Display | 24px | 700 | 1.2 |
| Stat Number | 32px | 700 | 1.1 |

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | #ffffff / #0a0a0a (dark) | Page background, surfaces |
| Secondary (30%) | #f5f5f5 / #171717 (dark) | Cards, sidebar, nav |
| Accent (10%) | #f59e0b (amber-500) | AI-related elements, primary actions |
| Destructive | #ef4444 (red-500) | Delete account, destructive actions only |
| Success | #22c55e (green-500) | Export success, healthy status |
| Info | #3b82f6 (blue-500) | Info banners, tips |

Accent reserved for:
- AI 人格选中状态
- DNA 洞察高亮卡片
- 导出按钮
- 数据仪表盘关键指标

**人格主题色（展示用，非交互）：**
- 温柔学姐: #f472b6 (pink-400)
- 极简主义者: #6b7280 (gray-500)
- 好奇探索者: #8b5cf6 (violet-500)
- 老朋友: #f59e0b (amber-500)

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | 保存更改 / 生成画像 / 立即导出 |
| Empty state heading | 还没有足够的记忆 |
| Empty state body | 保存 10 条记忆后，AI 会为你生成第一份知识画像。去记录些什么吧。 |
| Error state | 生成失败，请稍后重试 + 重新生成 按钮 |
| Destructive confirmation | 注销账户: 输入确认注销以继续，此操作不可撤销 |
| DNA 刷新按钮 | 刷新画像 |
| 导出按钮 | 导出数据 |
| 人格切换提示 | AI 助手已切换为 [人格名]，下次交互时生效 |

---

## Page: /profile (我的画像)

### Layout
- 单列布局，max-width 720px，居中
- 顶部：用户信息卡片（头像 + 用户名 + 邮箱 + 编辑按钮）
- 下方：tab 切换（记忆 DNA / AI 人格 / 学习路径 / 数据仪表盘）

### Section: 用户信息卡片
- 头像 80x80px，圆形，点击触发上传
- 用户名大字体，邮箱小字灰色
- 编辑按钮：小型次要按钮，点击展开 inline 编辑表单

### Section: 记忆 DNA (默认 tab)
- 顶部：生成时间 + 刷新画像 按钮（小型）
- 主区域：雷达图展示知识领域分布（recharts RadarChart）
- 下方：2x2 网格小卡片
  - 阅读偏好（长文/短文比例，横向进度条）
  - 记录节奏（活跃时段热力 mini 图）
  - 标签演化（折线图，近 4 周）
  - 记忆影响力（Top 3 被引用记忆列表）
- 底部：AI 洞察语（引用卡片样式，左侧 amber 竖线）

### Section: AI 人格
- 4 个人格卡片，2x2 网格（桌面）/ 单列（移动端）
- 每个卡片：人格图标（emoji）+ 名称 + 一句话描述 + 选中圆点
- 选中状态：amber 边框 + 浅色 amber 背景
- 底部：预览效果 按钮，点击弹出模拟对话气泡

### Section: 学习路径
- 知识地图：复用 ConstellationGraph 组件，节点 = 知识领域
- 下方：推荐路径列表，每个路径 = 标题 + 描述 + 标记为学习中 按钮

### Section: 数据仪表盘
- 3 列统计卡片：总记忆数 / 总字数 / 覆盖主题数
- 存储占用：进度条（MinIO 使用量 / 限额）
- AI 调用统计：本月 tokens 用量（条形图）

---

## Page: /settings (调整)

### 移除
- Section 0 记忆统计 整个移除（迁移到 /profile）

### 新增 Section: 隐私与数据
- 位置：放在 AI 建议 之后
- 内容：
  - 隐私开关组（Toggle）：
    - 允许记忆参与 AI 训练分析
    - 开启情绪分析
    - 自动删除 N 天前的记忆（带数字输入）
  - 数据导出：
    - 格式选择：Markdown / JSON（单选卡片）
    - 导出数据 按钮（主按钮）
    - 导出进度提示（如有）

### 新增 Section: 账户安全
- 位置：最后
- 内容：
  - 头像上传（与 /profile 共用组件）
  - 用户名修改（inline input + 保存）
  - 密码修改（旧密码 + 新密码 + 确认）
  - 邮箱变更（当前邮箱 + 新邮箱 + 验证）
  - TOTP 双因素认证（开关 + 扫码区域）
  - 活跃会话列表（设备 + 时间 + 退出 按钮）
  - 注销账户（红色区域，折叠面板，需二次确认）

---

## Components

### DNA Radar Chart
- 库: recharts RadarChart
- 6 个维度：技术 / 生活 / 艺术 / 商业 / 科学 / 其他
- 颜色: amber-500 fill, amber-200 stroke
- 大小: 320x240px（桌面），全宽（移动端）

### Persona Card
- 尺寸: 自适应，最小 140px 宽
- 内边距: 16px
- 圆角: 12px (rounded-xl)
- 默认状态: 灰色边框 border-gray-200
- 选中状态: amber 边框 border-amber-400, bg-amber-50
- 内容: emoji(24px) + 名称(14px bold) + 描述(12px gray)

### Stat Card
- 尺寸: 1/3 宽度（桌面），全宽（移动端）
- 内边距: 20px
- 圆角: 12px
- 背景: secondary color
- 内容: 数字(32px bold) + 标签(12px gray)

### Export Button Group
- 格式选择: 两个水平卡片（Markdown / JSON）
- 单选样式: border + 选中时 amber 边框 + 勾选图标
- 导出按钮: 主按钮，加载状态显示生成中...

---

## Animations

| Trigger | Animation | Duration |
|---------|-----------|----------|
| Tab 切换 | 内容淡入 + 轻微上滑 | 200ms ease-out |
| DNA 图表加载 | 雷达图从中心缩放展开 | 400ms ease-out |
| 人格卡片选中 | 边框颜色过渡 + 轻微放大(1.02) | 200ms ease-out |
| 统计数据更新 | 数字滚动动画（react-countup）| 600ms |
| 导出完成 | Toast 从顶部滑入 | 300ms ease-out |
| 页面进入 | 内容 stagger 淡入（各 section 间隔 50ms）| 200ms each |

---

## Responsive

| Breakpoint | Layout Changes |
|------------|----------------|
| >= 768px (md) | 2x2 人格网格，3 列统计，雷达图 320px |
| < 768px (sm) | 单列人格，统计卡片堆叠，雷达图全宽 |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | Card, Button, Input, Switch, Tabs, Dialog, Toast, Avatar, Label, Progress, Separator, Collapsible | not required |
| third-party | recharts (RadarChart, LineChart, BarChart), react-cropper, react-countup | npm install + verify types |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-05-12
