---
phase: 15
name: web-clipper-bridges
title: 浏览器插件与记忆桥梁
description: Chrome/Edge浏览器插件实现一键网页保存，以及AI发现两条无关记忆间的隐藏联系
milestone: v1.3 "记忆的回响"
depends_on: [16-user-hub]
---

# Phase 15 Context

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
