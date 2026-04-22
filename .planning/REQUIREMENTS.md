---
name: Echoes v1.1 Requirements
description: Echo Assistant 对话式 AI 助手 + v1.0 已知问题修复
type: requirements
---

# 需求规格 (v1.1)

## 1. Echo Assistant (P0)

### 1.1 对话界面
- **CHAT-01** 用户在首页可打开/关闭 Chat 侧边栏（类似 Notion AI 的侧边栏风格）
- **CHAT-02** 侧边栏显示对话历史列表（按时间倒序），支持新建对话
- **CHAT-03** 对话界面显示用户和 AI 消息，支持 Markdown 渲染
- **CHAT-04** 发送消息后显示加载状态（typing indicator）
- **CHAT-05** 支持暗黑模式（复用现有主题系统）

### 1.2 RAG 检索
- **CHAT-06** 用户提问后，系统先通过语义搜索检索相关记忆（复用现有 /search API）
- **CHAT-07** 检索结果按相似度排序，取 Top N（默认 5 条）作为上下文
- **CHAT-08** 检索不到相关记忆时，AI 明确告知"未找到相关记忆"

### 1.3 LLM 回答生成
- **CHAT-09** 使用现有 LLM Provider 抽象层生成回答（OpenAI / Anthropic）
- **CHAT-10** Prompt 包含检索到的记忆内容作为上下文
- **CHAT-11** 回答中引用来源（显示"来自记忆《xxx》"或类似格式）
- **CHAT-12** 支持多轮对话（上下文保留最近 N 轮）

### 1.4 对话历史
- **CHAT-13** 对话记录持久化到数据库（conversations 表 + messages 表）
- **CHAT-14** 用户可查看历史对话列表并切换
- **CHAT-15** 用户可删除单条对话

## 2. Bug 修复 (P1)

### 2.1 OAuth State 清理
- **BUG-01** OAuth state map 添加 TTL 机制（过期自动清理，如 10 分钟）
- **BUG-02** 启动定期清理 goroutine 或使用 sync.Map + 时间戳

### 2.2 Gateway 健康检查
- **BUG-03** Gateway 新增 /health 端点，检查下游服务（User Service、Memory Service）可用性
- **BUG-04** 下游服务不可用时返回 503 + 具体哪个服务异常
- **BUG-05** 反向代理增加连接超时和重试机制

### 2.3 前端分页 UI
- **BUG-06** 时间轴页面添加分页组件（页码/加载更多按钮）
- **BUG-07** 分页组件支持移动端（无限滚动或简洁页码）
- **BUG-08** 切换页码时保留当前滚动位置或平滑滚动到顶部

### 2.4 Go 单元测试
- **BUG-09** User Service 核心领域逻辑单元测试（注册/登录验证）
- **BUG-10** Memory Service 核心领域逻辑单元测试（CRUD/搜索）
- **BUG-11** Gateway 中间件单元测试（JWT/限流/CORS）

---

## 未来需求（v1.2 之后）

- Chat 消息支持流式输出（SSE）
- 对话导出（Markdown / PDF）
- AI 主动建议（基于新保存的记忆提示"你可能想问..."）
- 多人协作共享记忆

## 排除范围

- 语音输入/输出 — 超出当前范围
- 图片/视频理解 — 需要多模态模型
- 实时同步（WebSocket）— 当前为轮询架构

## 需求追溯

| 需求 ID | 描述 | 所属阶段 | 状态 |
|---------|------|----------|------|
| CHAT-01 | Chat 侧边栏 UI | Phase 6 | 已完成 (06-04) |
| CHAT-02 | 对话历史列表 | Phase 6 | 已完成 (06-04) |
| CHAT-03 | 消息 Markdown 渲染 | Phase 6 | 已完成 (06-04) |
| CHAT-04 | 发送加载状态 | Phase 6 | 已完成 (06-04) |
| CHAT-05 | 暗黑模式 | Phase 6 | 已完成 (06-04) |
| CHAT-06 | RAG 语义检索 | Phase 6 | 已完成 (06-03) |
| CHAT-07 | Top N 排序 | Phase 6 | 已完成 (06-03) |
| CHAT-08 | 无结果提示 | Phase 6 | 已完成 (06-03) |
| CHAT-09 | LLM 回答生成 | Phase 6 | 已完成 (06-02) |
| CHAT-10 | Prompt 上下文 | Phase 6 | 已完成 (06-03) |
| CHAT-11 | 引用来源 | Phase 6 | 已完成 (06-04) |
| CHAT-12 | 多轮对话 | Phase 6 | 已完成 (06-03) |
| CHAT-13 | 对话持久化 | Phase 6 | 已完成 (06-03) |
| CHAT-14 | 历史对话列表 | Phase 6 | 已完成 (06-03) |
| CHAT-15 | 删除对话 | Phase 6 | 已完成 (06-03) |
| BUG-01 | OAuth state TTL | Phase 7 | 待实现 |
| BUG-02 | 定期清理 | Phase 7 | 待实现 |
| BUG-03 | Gateway 健康检查 | Phase 7 | 待实现 |
| BUG-04 | 503 响应 | Phase 7 | 待实现 |
| BUG-05 | 超时重试 | Phase 7 | 待实现 |
| BUG-06 | 前端分页 | Phase 7 | 待实现 |
| BUG-07 | 分页移动端 | Phase 7 | 待实现 |
| BUG-08 | 分页滚动 | Phase 7 | 待实现 |
| BUG-09 | User Service 单元测试 | Phase 7 | 待实现 |
| BUG-10 | Memory Service 单元测试 | Phase 7 | 待实现 |
| BUG-11 | Gateway 中间件单元测试 | Phase 7 | 待实现 |

---

*Requirements for v1.1 Echo Assistant milestone. Created: 2026-04-22*
