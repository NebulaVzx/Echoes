---
phase: 14
name: mood-echo
title: 情绪日历与每日回响
description: AI分析记忆情绪倾向生成可视化日历，并每日推送一条旧记忆让用户与过去重逢
milestone: v1.3 "记忆的回响"
depends_on: [14-memory-covers-weaving]
---

# Phase 14 Context

## 目标

增加情感维度和用户粘性：让用户看见自己的情绪波动，每天收到一条温暖的旧记忆推送。

## 范围

### P1 — 记忆情绪日历（Mood Calendar）
- AI 分析每条记忆情绪（积极/中性/消极 + 强度 1-10）
- GitHub contribution graph 风格的热力图
- 年视图 / 月视图 / 主题视图
- AI 生成月度情绪洞察总结

### P1 — 每日记忆回响（Daily Echo）
- 每天推送一条旧记忆（优先"那年今日"，fallback 随机）
- AI 生成温暖的"回响语"
- 首页可折叠卡片展示
- 回响历史页面

## 技术约束
- 情绪分析复用现有 LLM Provider（~500 tokens/条）
- 每日回响定时任务（Cron 或 Redis 延迟队列）
- 情绪结果缓存，不重复分析

## 验收标准
- 情绪日历可展示全年 365 天数据
- 每日回响点击率 > 50%
- 回响语有温度、不煽情
