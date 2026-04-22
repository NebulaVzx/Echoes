---
status: testing
phase: 06-echo-assistant
source:
  - 06-01-SUMMARY.md
  - 06-02-SUMMARY.md
  - 06-03-SUMMARY.md
  - 06-04-SUMMARY.md
  - 06-05-SUMMARY.md
started: 2026-04-22T13:00:00Z
updated: 2026-04-22T13:00:00Z
---

## Current Test

number: 1
name: 冷启动冒烟测试
expected: |
  启动所有服务（docker-compose up），Gateway、Memory Service、Processor Service 正常启动无报错。
  数据库迁移自动执行，health 端点返回 ok。
  首页可正常访问。
awaiting: user response

## Tests

### 1. 冷启动冒烟测试
expected: 启动所有服务（docker-compose up），各服务正常启动无报错，数据库迁移执行，health 端点返回 ok，首页可正常访问
result: pending

### 2. 打开 Chat 侧边栏
expected: 登录后首页右上角显示 AI 助手按钮（Sparkles 图标），点击后右侧滑出约 400px 宽的侧边栏，带有滑入动画，背景有遮罩层
result: pending

### 3. 发送消息并看到 AI 回复
expected: 在侧边栏底部输入框输入"你好"，按 Enter 发送。用户消息立即出现在消息列表右侧，显示打字指示器，随后 AI 回复出现在左侧
result: pending

### 4. Markdown 渲染
expected: 发送"请用 Markdown 列三个点"，AI 回复中的列表、代码块、粗体等 Markdown 元素正确渲染，代码块有语法高亮
result: pending

### 5. 引用来源展示
expected: 先保存一条包含"Go 语言"的记忆，然后在 Chat 中问"我存了哪些关于 Go 的内容？"，AI 回复底部显示引用来源卡片，标注来自哪条记忆
result: pending

### 6. 多轮对话上下文
expected: 连续发送多条消息，AI 能记住之前的对话内容并连贯回答，而非每次独立回复
result: pending

### 7. 对话历史管理
expected: 侧边栏顶部显示历史对话列表，点击"新对话"创建新会话，点击历史项切换会话，对话消息正确加载。点击删除按钮可删除某条对话
result: pending

### 8. 暗黑模式
expected: 切换至暗黑模式后，Chat 侧边栏、消息气泡、输入框、引用卡片均正确显示深色主题，无亮色残留
result: pending

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0

## Gaps

[none yet]
