---
phase: 12
name: memory-constellation
title: 记忆星图与探索模式
description: 基于向量相似度构建记忆关联网络可视化，支持从任意记忆出发无限钻取探索，受 Flipbook 生成式视觉交互启发
milestone: v1.3 "记忆的回响"
depends_on: [12-memory-capture-expansion]
---

# Phase 12 Context

## 目标

解决"保存了 1000 条记忆却依然感觉知识碎片化"的问题。通过可视化关联网络和探索式交互，让用户**发现记忆之间的隐藏连接**。

## Flipbook 启发

Flipbook（Zain Shah, 2026-04）展示了"生成式视觉互联网"——界面由 AI 实时生成，用户通过点击任意位置无限钻取。

Echoes 不照搬像素流（成本过高且不适用于生产力工具），但吸收其核心洞见：
- **视觉优先**：信息用图传达，而非纯文本列表
- **无限钻取**：从任意节点出发，无边界的探索
- **状态化**：界面随用户意图动态生成

## 范围

### P0 — 记忆星图（Memory Constellation）
- 力导向图可视化（react-force-graph-2d）
- 节点 = 记忆，边 = 向量相似度 > 0.75
- 按标签聚类着色
- 悬停/点击/双击交互

### P0 — 探索模式（Exploration Mode）
- 从任意记忆出发，展示 5-8 条关联记忆
- AI 生成"为什么相关"的关联说明
- 支持无限钻取（点击关联记忆成为新中心）
- 面包屑路径记录

### P1 — 星图优化
- 大数据量降级（Sigma.js）
- 筛选/搜索节点
- 3D 模式（预留）

## 技术约束
- 个人用户记忆量通常 < 10,000，react-force-graph 可处理 5,000 节点
- 相似度计算复用现有 pgvector
- 关联说明调用 LLM（复用现有 Provider）
- 批量相似度查询需优化（预计算或分页）

## 关键文件
- `web/components/constellation/` — 新组件目录
- `services/memory-service/internal/repository/memory_repository.go` — 向量查询
- `services/memory-service/internal/transport/memory_handler.go` — 新增 /graph /explore 接口

## 验收标准
- 星图页面可流畅展示 500+ 节点
- 探索模式钻取深度 >= 3 层
- 关联说明有洞察性（用户反馈"原来还有这个联系"）
