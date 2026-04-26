---
phase: 12
name: memory-capture-expansion
title: 记忆捕获扩展
description: 将单调的记忆保存表单升级为功能丰富的"记忆匣"，支持文件上传、快速模板、星标、来源标注等能力
milestone: v1.3 "记忆的回响"
depends_on: [10-warmth-of-memory]
---

# Phase 11 Context

## 目标

当前记忆捕获区域只有"文字"和"链接"两种类型，交互单调。本 Phase 目标是：
1. **扩展内容类型**：支持 `.txt`、`.md`、`.docx` 文件上传和解析
2. **品牌化命名**：保存区域命名为"记忆匣"
3. **丰富捕获体验**：快速模板、来源标注、星标、草稿自动保存

## 背景

### 现状
- `content_type` 仅支持 `text` | `link`
- 数据库已预留 `media_url`、`ocr_text` 字段（未使用）
- MinIO 对象存储已部署但未用于文件上传
- Processor Service 已有异步任务框架（Redis Stream）

### 用户需求（来自用户直接反馈）
- "保存记忆区域是不是太单调了，能不能扩展文件？"
- "能不能给保存记忆区域命个名字？"
- "保存记忆还有哪些功能可以丰富？"

### PRD 历史决策
- PRD v7.0 明确"不做：语音捕获、图片/OCR、文件上传"
- **例外**：docx/md/txt 本质都是文本，与 Echoes 核心能力（文本向量化）高度契合，不属于"媒体文件"

## 范围

### 必须实现（P0）
- [ ] 文件上传支持（txt/md/docx）
- [ ] 记忆匣命名（UI 品牌化）
- [ ] 快速模板（代码/读书笔记/灵感速记）

### 应该实现（P1）
- [ ] 来源标注字段
- [ ] 星标（is_starred）
- [ ] 草稿自动保存

### 可做（P2）
- [ ] 批量导入（多文件上传）
- [ ] 智能粘贴识别（自动判断内容类型）

## 技术约束
- 复用现有 MinIO 基础设施
- 复用现有 Processor Service 异步框架
- docx 解析使用 Python `python-docx` 库
- 文件大小限制：10MB
- 所有文件内容提取后走现有 `text:vectorize` 队列

## 关键文件
- `web/components/memory/create-memory-form.tsx` — 前端表单
- `services/memory-service/internal/domain/memory.go` — 领域模型
- `services/memory-service/internal/transport/memory_handler.go` — HTTP Handler
- `services/processor-service/app/consumers/` — 异步任务消费者
- `shared/migrations/001_init.sql` — 数据库基线

## 验收标准
- 用户可上传 txt/md/docx 文件，系统自动提取文本并生成向量
- 保存区域 UI 显示"记忆匣"标题
- 快速模板减少重复输入
- 星标记忆可在首页筛选展示
