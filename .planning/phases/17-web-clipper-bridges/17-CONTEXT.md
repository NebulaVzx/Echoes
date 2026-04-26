---
phase: 17
name: web-clipper-bridges
title: 浏览器插件与记忆桥梁
description: Chrome/Edge浏览器插件实现一键网页保存，以及AI发现两条无关记忆间的隐藏联系
milestone: v1.3 "记忆的回响"
depends_on: [16-user-hub]
---

# Phase 17 Context

## 目标

扩展记忆捕获渠道（浏览器插件），并探索 AI 驱动的跨领域联想（记忆桥梁）。

## 范围

### P2 — Echoes Web Clipper
- Chrome/Edge 插件（Manifest V3）
- 整页保存（提取标题/URL/摘要）
- 选中文本保存（右键菜单 + 快捷键 Ctrl+Shift+S）
- 高亮批注保存（选中 + 添加笔记）
- 离线队列（网络不佳时暂存）

### P2 — 记忆桥梁（Memory Bridge）
- 后台任务：发现"远距离相似对"（相似度 0.60-0.75，不同标签，时间跨度 > 30 天）
- LLM 验证并生成"桥梁说明"
- "今日发现"模块展示 1-2 条
- 用户反馈（有用/不相关）优化质量

## 技术约束
- Web Clipper 使用 WXT 框架（TypeScript，跨浏览器）
- 复用现有 Echoes API
- 记忆桥梁计算成本高，作为"彩蛋功能"或预留

## 验收标准
- 插件可从 Chrome Web Store 安装
- 一键保存延迟 < 2s
- 桥梁发现让用户产生"Aha!"时刻

---

## 跨平台兼容性考虑

### Web Clipper 的分发渠道

Web Clipper 本质上是**浏览器扩展**，不是 App 的一部分，各平台需要独立分发：

| 平台 | 分发渠道 | 技术栈 |
|------|---------|--------|
| **Chrome/Edge 桌面端** | Chrome Web Store | WXT + Manifest V3 |
| **Safari 桌面端** | Mac App Store | 需额外开发 Safari App Extension |
| **Firefox** | Firefox Add-ons | WXT 支持多浏览器构建 |
| **移动端** | ❌ 浏览器扩展不支持 | 用系统级分享替代（见下文） |

### 移动端"剪藏"替代方案

移动端浏览器无法安装扩展，用**系统分享菜单**实现：
- **iOS**：Share Extension（需要独立 App 容器，Expo 阶段实现）
- **Android**：Intent Filter 接收 `ACTION_SEND`，PWA 可注册为分享目标（Web Share Target API，Chrome 89+）
- **回退**：用户在浏览器中复制链接/文本 → 打开 Echoes App → 自动识别剪贴板内容

### 桌面端 App 的剪藏集成

Tauri 桌面端可通过以下方式实现类似扩展的功能：
- **全局快捷键**：`Cmd+Shift+S` 唤起快速保存浮窗（即使 App 在后台）
- **系统分享菜单**：macOS Share Sheet / Windows Share 集成
- **协议处理**：注册 `echoes://clip?url=...` 协议，浏览器书签按钮点击跳转

### 记忆桥梁的展示统一

记忆桥梁是后台计算 + 前端展示，三端共享：
- "今日发现"卡片在首页展示，三端 UI 一致
- 用户反馈（有用/不相关）同步到云端，影响后续推荐质量

### 不在本 Phase 做的事

- ❌ Safari 扩展 —— 需要 macOS 开发者账号和原生开发，放到 v1.5+
- ❌ iOS Share Extension —— 需要独立 App 包， Expo 阶段再考虑
- ❌ 桌面端全局快捷键剪藏 —— 依赖 Tauri 全局快捷键 API，放到 v1.4+ 或作为桌面端增强功能
