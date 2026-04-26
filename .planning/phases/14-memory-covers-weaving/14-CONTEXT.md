---
phase: 13
name: memory-covers-weaving
title: 记忆封面与AI编织
description: 为每条记忆自动生成视觉封面图，并支持将多条记忆AI编织成连贯文章
milestone: v1.3 "记忆的回响"
depends_on: [13-memory-constellation]
---

# Phase 13 Context

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
