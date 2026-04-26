---
phase: 14
name: memory-covers-weaving
title: 记忆封面与AI编织
description: 为每条记忆自动生成视觉封面图，并支持将多条记忆AI编织成连贯文章
milestone: v1.3 "记忆的回响"
depends_on: [13-memory-constellation]
---

# Phase 14 Context

## 目标

让时间轴从"文本列表"升级为"视觉杂志墙"，并提供知识整理工具（记忆编织）。

## 范围

### P0 — 记忆封面（Memory Cover）
- 链接类型：抓取 og:image 或 favicon
- 文本类型：Pollinations AI 生成封面图（基于标题+摘要）
- 文件类型：提取首段文字生成封面
- 存储：MinIO（`covers/{user_id}/{memory_id}.png`）
- 降级：纯色背景 + 首字母图标

### P0 — AI 记忆编织（Memory Weaving）
- 多选记忆 → 一键编织成文章/故事/总结/待办
- 模式：article / story / summary / todo
- 保留来源标注（[^1] 引用格式）
- 可编辑、可导出 Markdown

## 技术约束
- Pollinations.AI 免费 tier：1 req/5s（注册 Seed 账户去水印）
- 封面尺寸：400x300，异步生成
- 编织复用现有 LLM Provider
- 封面 URL 写入 `memories.cover_url`（新增字段）

## 验收标准
- >80% 的记忆有封面图
- 编织文章逻辑连贯、来源可追溯
- 封面生成不阻塞保存流程

---

## 跨平台兼容性考虑

### 记忆编织的多选交互

| 平台 | 多选方式 | 说明 |
|------|---------|------|
| **桌面端** | Ctrl/Cmd + 点击卡片 | 标准多选，支持 Shift 连续选择 |
| **移动端** | 长按进入"选择模式" → 点击多选 | 底部出现操作栏（编织/删除/取消） |
| **平板端** | 支持两种模式 | 触控笔精确点击 + 手指长按 |

### 导出功能的平台差异

- **桌面端 (Tauri)**：直接保存到用户选择的本地文件夹（`tauri::api::dialog::save`），体验最佳
- **Web/PWA**：下载 `.md` / `.json` blob 文件，浏览器自动保存到下载目录
- **移动端**：分享面板调用（`navigator.share`），发送到微信/邮件/备忘录

### 封面展示适配

- 桌面端：封面图 400x300，卡片网格 3-4 列
- 平板端：封面图 300x225，卡片网格 2 列
- 移动端：封面图 200x150 或隐藏封面（列表模式），单列

### 不在本 Phase 做的事

- ❌ 桌面端直接导出到 Obsidian/Notion 本地库 —— 需要了解各软件的文件格式，放到 v1.4+
- ❌ 移动端离线编织（无网络时暂存草稿）—— 依赖 Service Worker 缓存策略，和 Phase 11 PWA 一起实现
