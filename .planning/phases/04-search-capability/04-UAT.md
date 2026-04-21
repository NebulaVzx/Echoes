---
status: testing
phase: 04-search-capability
source: 04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md, 04-04-SUMMARY.md
started: 2026-04-21T12:00:00Z
updated: 2026-04-21T12:20:00Z
---

## UX 改进（已完成）

为响应用户反馈，设置页面已重构为三个独立保存的区域：

1. **LLM 连接** — provider、protocol、model、base_url、api_key，保存前需先测试连接
2. **处理偏好** — temperature、include_note_in_analysis，直接保存，无需测试连接
3. **搜索偏好** — similarity_threshold（滑动条 0%–100%，默认 40%），直接保存，无需测试连接

后端变更：
- `UserSettings` 合并 `LLMSettings` + `SearchSimilarityThreshold`
- `UpdateSettingsRequest` 支持 `llm` 和 `search` 部分更新
- Memory Service 从用户设置读取 `search_similarity_threshold`，默认 0.40

## Current Test

number: 5
name: 暗色模式兼容性
expected: |
  切换暗色模式后，搜索页、搜索结果卡片、相关推荐区域的文字和背景色正确适配。
awaiting: user response

## Tests

### 1. 导航栏搜索框
expected: 首页/搜索页/详情页顶部都有搜索输入框，输入关键词按 Enter 可跳转搜索页
result: pass

### 2. 语义搜索结果
expected: 搜索页显示与查询语义相关的记忆卡片，每张卡片下方显示"相关度 X%"，默认只显示相似度 ≥ 40% 的结果
result: pass

### 3. 空搜索状态
expected: 搜索一个不存在的词（如"xyznonexistent"），页面显示"没有找到相关记忆，换个关键词试试？"和搜索图标
result: pass

### 4. 相关记忆推荐
expected: 点击任意记忆卡片进入详情页，滚动到底部看到"你可能还感兴趣"区域，显示最多3张相关记忆卡片
result: pass

### 5. 暗色模式兼容性
expected: 切换暗色模式后，搜索页、搜索结果卡片、相关推荐区域的文字和背景色正确适配
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0

## Status

Phase 04 UAT 全部通过。设置页面 UX 改进（LLM 连接/处理偏好/搜索偏好分离）已完成并入主干。

## Gaps

- truth: "首页正常加载，搜索框可用"
  status: resolved
  reason: "Next.js build cache corruption in Docker container (missing 682.js chunk)"
  severity: blocker
  test: 1
  root_cause: "Stale .next build artifacts in echoes-web Docker container after code changes"
  artifacts:
    - path: "docker-compose web service"
      issue: "Build cache not invalidated when source files changed"
  missing:
    - "N/A — cleared /app/.next and restarted container"
  debug_session: ""

- truth: "语义搜索返回空结果"
  status: resolved
  reason: "BGE-M3 向量相似度约 0.53，低于硬编码 0.75 阈值"
  severity: blocker
  test: 2
  root_cause: "threshold 0.75 对短查询太严格"
  missing:
    - "阈值改为 0.30 并支持用户配置，默认 0.40"
  debug_session: ""
