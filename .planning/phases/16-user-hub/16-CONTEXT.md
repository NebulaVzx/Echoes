---
phase: 16
name: user-hub
title: 用户管理中心 — "我的数字孪生"
description: 将传统的"账户设置"升级为"AI用户画像管理中心"，让用户管理自己的记忆DNA、AI助手人格、数据主权和学习路径
milestone: v1.3 "记忆的回响"
depends_on: [15-mood-echo]
---

# Phase 16 Context

## 目标

当前 Echoes 的用户管理极其单薄：用户只能在设置页看到 Streaks 统计和 LLM 配置，连基本的头像上传、用户名修改都没有。

但我们的目标不是做一个"改密码改头像"的传统账户页，而是结合 Echoes"个人语义搜索引擎"的定位 + AI 时代趋势，打造一个**"我的数字孪生"（My Digital Twin）**——让用户看见"AI眼中的自己"，并管理这个画像。

## AI 时代用户管理趋势（2025-2026）

| 趋势 | 说明 | Echoes 的落地 |
|------|------|--------------|
| **持久化 AI 画像** | 统一的 360 度用户视图，跨渠道一致 | 基于全部记忆生成"记忆 DNA" |
| **超个性化** | 动态个体级适配，非静态分群 | AI 根据用户画像调整建议风格 |
| **Agentic 编排** | AI 自主编排用户旅程 | 自动生成学习路径、知识缺口提醒 |
| **隐私优先** | 第一方数据、用户可控 | 数据主权中心：导出、删除、隐私开关 |
| **情感化智能** | 情绪分析、最佳时机预测 | 情绪日历已在 Phase 14，此处扩展为"情绪洞察" |

来源：
- [AI Personalization Trends 2026](https://mrkt360.com/ai-personalization-trends-2026/)
- [AI-Driven Personalization: The Future of Customer Experience](https://www.gleap.io/blog/ai-driven-personalization-customer-experience)

## 范围

### P0 — 记忆 DNA（Memory DNA）⭐ 核心创意

**一句话**：基于用户全部记忆，AI 生成动态"知识画像"——类似于 Spotify Wrapped，但是针对你的知识库。

**展示内容**：
- **知识领域分布**：饼图/雷达图展示用户关注的领域（技术/生活/艺术/商业...）
- **阅读偏好**：长文 vs 短文、中文 vs 英文、原创 vs 转载
- **记录节奏**：什么时间记录最多（晨型人/夜猫子）、周几最活跃
- **标签演化**：标签数量增长曲线、新兴标签、衰退标签
- **记忆影响力**：被引用最多的记忆、最常关联的记忆
- **AI 洞察**："你是一个偏爱深夜记录的技术学习者，最近对 AI 的关注度上升了 300%"

**生成方式**：
- 定期异步任务（每周/每月）分析用户全部记忆
- 结果存入 `user_insights` 表
- 前端展示为可分享的精美卡片（类似 GitHub Unwrapped）

### P0 — AI 助手人格（Echo Persona）

**一句话**：让用户选择/定制 AI 助手的性格，从"工具"升级为"伙伴"。

**已有基础**：v1.2 有"建议风格"（温柔/实用/启发），可扩展为完整人格。

**人格选项**：
- **温柔学姐**：语气温暖、鼓励为主、会问你"最近累不累"
- **毒舌导师**：直言不讳、挑刺、但给出精准建议
- **极简主义者**：不说废话、 bullet points、一行解决
- **好奇探索者**：不停追问、引导你深入思考
- **老朋友**：像认识多年的朋友、会引用你以前的记忆

**技术实现**：
- 人格选择 → 影响所有 LLM Prompt 的 system prompt 前缀
- 不同人格有不同的话术模板和 emoji 使用习惯
- 用户可自定义人格（输入描述，AI 生成对应 system prompt）

### P1 — 数据主权中心（Data Sovereignty）

**一句话**：用户完全掌控自己的数据——看见、导出、删除。

**功能**：
- **数据仪表盘**：
  - 总记忆数、总字数、覆盖主题数
  - 存储占用（MinIO 文件大小）
  - AI 调用统计（本月用了多少 tokens）
- **一键导出**：
  - Markdown 格式（所有记忆 + 标签 + 来源）
  - JSON 格式（完整数据结构）
  - Obsidian / Notion 兼容格式
- **隐私开关**：
  - 是否允许记忆参与 AI 训练/分析
  - 是否开启情绪分析
  - 数据保留期限（自动删除 N 天前的记忆）
- **账户删除**：
  - 软删除（保留 30 天可恢复）
  - 硬删除（彻底抹除）

### P1 — 学习路径（Learning Path）

**一句话**：AI 分析用户的记忆，发现知识缺口，生成个性化学习建议。

**功能**：
- **知识地图**：已掌握 vs 待探索的领域可视化
- **缺口发现**："你存了 10 篇 Go 文章但还没存过 Rust，要不要看看？"
- **路径推荐**：基于已有记忆，推荐下一步学习方向
- **进度追踪**：标记"已掌握""学习中""待学习"

### P2 — 账户基础功能（补漏）

**传统账户管理，当前缺失的功能**：
- [ ] 头像上传（Gravatar fallback + 本地上传）
- [ ] 用户名修改
- [ ] 密码修改
- [ ] 邮箱变更
- [ ] 双因素认证（TOTP）
- [ ] 活跃会话管理（查看/踢出其他设备）
- [ ] 注销账户

## 技术约束
- 记忆 DNA 分析为异步任务，不影响主流程
- 人格切换通过 system prompt 注入，不修改 LLM 模型
- 数据导出需要考虑大数据量（分页/流式）
- 头像上传复用 MinIO 已有基础设施

## 实现决策

### 记忆 DNA 生成策略（D-01）

- **D-01-01:** 触发方式：每周日凌晨自动生成 + 用户手动刷新按钮
- **D-01-02:** 计算方式：全量重算（非增量），领域分布/标签演化等统计需要全量数据
- **D-01-03:** 结果存储：新增 `user_insights` 表（非 JSONB），便于查询历史趋势和对比上期
- **D-01-04:** 缓存策略：结果写入表后前端缓存 1 小时
- **D-01-05:** 首次生成门槛：用户达到 10 条记忆后触发，避免空状态尴尬
- **D-01-06:** 异步队列：新增 `dna:generate` Redis Stream，consumer 在 processor-service 中

### AI 助手人格与现有风格的关系（D-02）

- **D-02-01:** 人格是"建议风格"的超集（扩展而非替换）
- **D-02-02:** 现有风格映射：gentle→温柔学姐、practical→极简主义者、inspiring→好奇探索者
- **D-02-03:** Phase 16 实现 4 种人格：温柔学姐、极简主义者、好奇探索者、老朋友（最具 Echoes 特色）
- **D-02-04:** 毒舌导师延后到 P1：需要更精细的 prompt 工程避免冒犯
- **D-02-05:** 自定义人格（P1）：用户输入描述 → AI 生成对应 system prompt
- **D-02-06:** 影响范围：所有 AI 交互统一注入（建议、Echo Assistant、编织、回响、DNA 洞察）
- **D-02-07:** 存储：`users.settings.echo_persona`，processor-service LLM Provider 调用前注入人格 system prompt 前缀
- **D-02-08:** 每种人格独立 prompt 模板文件：`personas/{name}.txt`

### 数据导出实现方式（D-03）

- **D-03-01:** < 1000 条记忆：前端直接生成 Markdown/JSON，浏览器自动下载
- **D-03-02:** >= 1000 条记忆：后端异步生成 → MinIO 存储 → 前端轮询下载链接
- **D-03-03:** 格式优先级：Markdown 第一（Obsidian/Notion 兼容）、JSON 第二
- **D-03-04:** Obsidian/Notion 专用格式为 P1（复用 Markdown + frontmatter）
- **D-03-05:** Markdown 导出：每条记忆 = 一个文件，frontmatter 包含标签/来源/创建时间，可选按标签分文件夹

### Profile 页与设置页的边界（D-04）

- **D-04-01:** `/profile`（我的画像）= 展示 + 发现：记忆 DNA 可视化、学习路径、AI 人格选择、数据仪表盘、记忆统计
- **D-04-02:** `/settings`（设置）= 配置 + 控制：LLM 连接、处理偏好、搜索偏好、界面偏好、隐私开关、账户安全、数据导出、注销
- **D-04-03:** 记忆统计从 `/settings` Section 0 迁移到 `/profile`
- **D-04-04:** AI 人格选择放在 `/profile`（"我是谁"的展示，不是配置）
- **D-04-05:** 数据导出放在 `/settings`（工具性行为）
- **D-04-06:** 隐私开关放在 `/settings`（控制行为）
- **D-04-07:** 导航新增"我的画像"入口，与"设置"并列

### Claude's Discretion

- 记忆 DNA 可视化组件选型（雷达图/饼图/折线图库选择）
- 学习路径知识地图的具体可视化方式
- 头像上传裁剪组件的交互细节
- 数据导出进度条/通知的 UI 设计

---

## 关键文件
- `services/user-service/internal/domain/user.go` — User 结构扩展
- `services/memory-service/internal/repository/memory_repository.go` — 统计查询
- `web/app/(main)/settings/page.tsx` — 设置页扩展
- `web/app/(main)/profile/page.tsx` — 新增用户画像页

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求与边界
- `.planning/ROADMAP.md` §Phase 16 — Phase goal and scope
- `CLAUDE.md` §Technology Stack — 技术栈和架构模式
- `CLAUDE.md` §Async Task Flow — Redis Stream 消费者模式

### 后端集成点
- `services/user-service/internal/domain/user.go` — User 模型（已含 Username/AvatarURL/Settings JSONB）
- `services/user-service/internal/service/auth_service.go` — 用户认证逻辑
- `services/memory-service/internal/repository/memory_repository.go` — 记忆查询与统计
- `services/processor-service/app/consumers/` — 现有消费者模式（file/link/suggestion/tag/cover/mood）
- `services/processor-service/app/services/llm/` — LLM Provider 工厂模式
- `shared/migrations/` — 数据库迁移目录

### 前端集成点
- `web/app/(main)/settings/page.tsx` — 现有设置页（6 个 section，需调整边界）
- `web/app/(main)/profile/page.tsx` — 现有占位页面（需实现画像功能）
- `web/lib/api.ts` — API 客户端模式

### 已有 Phase 上下文
- `.planning/phases/15-mood-echo/15-CONTEXT.md` — DailyReview/情绪分析模式可参考
- `.planning/phases/14-memory-covers-weaving/14-CONTEXT.md` — 异步消费者模式（cover_consumer）

---

## Existing Code Insights

### Reusable Assets
- **LLM Provider 工厂** (`processor-service/app/services/llm/`): 注入人格 system prompt 前缀
- **Redis Stream Consumer 基类** (`processor-service/app/consumers/base.py`): 新增 `DNAConsumer` 继承基类
- **MinIO Client** (`memory-service/internal/service/memory_service.go`): 复用上传导出文件
- **Settings JSONB** (`user-service` users 表): 人格选择、隐私开关直接存入 settings 字段
- **Streaks API** (`services/memory-service`): 已有连续记录统计，复用模式扩展为 DNA 统计

### Established Patterns
- **异步任务流**: 保存/触发 → 发布 Redis Stream → Consumer 处理 → 回写数据库。DNA 分析完全遵循此模式。
- **消费者模式**: processor-service 中每个 consumer 独立文件，继承 BaseConsumer，处理特定 queue。
- **API 响应封装**: 后端使用统一 JSON 封装，前端使用 `api.ts` 中的 `SafeResponse()`。
- **数据库迁移**: 新表通过 `shared/migrations/` 添加，命名格式 `00X_description.sql`。

### Integration Points
- **新增 Redis Stream queue**: `dna:generate`
- **新增 processor-service consumer**: `dna_consumer.py`
- **新增数据库表**: `user_insights`
- **扩展 user-service API**: 头像上传、密码修改、邮箱变更、账户注销
- **扩展 memory-service API**: 统计聚合查询（领域分布、标签演化、记录节奏）
- **新增前端页面**: `/profile` 画像页（记忆 DNA、学习路径、AI 人格、数据仪表盘）
- **调整前端页面**: `/settings` 移除记忆统计，新增隐私开关、数据导出、账户安全

---

## Specific Ideas

- 记忆 DNA 卡片分享时生成精美图片（类似 GitHub Unwrapped），可用 html-to-image 库
- "老朋友"人格的 prompt 中可注入用户最近 5 条记忆作为上下文，让 AI 像真的认识你一样交流
- 学习路径的知识地图可复用 Phase 13 的 ConstellationGraph 组件，节点 = 知识领域
- 头像上传复用 MinIO 已有基础设施，裁剪用 `react-cropper`，存储路径 `avatars/{user_id}.jpg`
- 数据导出 Markdown 的 frontmatter 格式兼容 Obsidian：`---
tags: [tag1, tag2]
source: url
created: 2026-01-01
---`

---

## Deferred Ideas

- **毒舌导师人格** — 需要更精细的 prompt 工程，P1 阶段评估
- **自定义人格** — 用户输入描述生成 system prompt，P1 阶段实现
- **Obsidian/Notion 专用导出格式** — 复用 Markdown + frontmatter，P1 阶段
- **系统钥匙串集成**（macOS Keychain / Windows Credential）— v1.4+ 安全增强
- **生物识别登录**（Face ID / Touch ID / Windows Hello）— 需要原生模块，Expo 阶段
- **跨设备同步设置** — 依赖 v1.4+ 的同步协议

---

## 验收标准
- 用户可在"我的画像"页面看到记忆 DNA 分析
- AI 助手人格切换后，建议风格明显变化
- 数据可一键导出为 Markdown
- 基础账户功能（头像/密码/注销）可用

---

## 跨平台兼容性考虑

### 数据导出的平台差异

| 平台 | 导出体验 | 实现方式 |
|------|---------|---------|
| **桌面端 (Tauri)** | 最优：弹出保存对话框，用户选择本地文件夹 | `tauri::api::dialog::save` + 流式写入大文件 |
| **Web/PWA** | 中等：浏览器自动下载到默认目录 | 生成 blob URL，创建 `<a download>` 触发下载 |
| **移动端** | 受限：通过分享面板发送 | `navigator.share({ files: [file] })`，受 iOS/Android 分享限制 |

**大数据量处理**：用户可能有 10,000+ 条记忆，导出不能阻塞 UI：
- 桌面端：后台线程写入，显示进度条
- Web/PWA：Service Worker 后台生成，完成后通知

### 头像上传的统一

三端统一使用 MinIO 存储，但选择方式不同：
- 桌面端：文件选择器 + 拖拽图片到头像区域
- 移动端：相机拍照 + 相册选择（`<input capture="environment">`）
- 裁剪组件：统一使用 `react-cropper`，触摸事件需测试

### 账户安全功能的平台差异

- **双因素认证 (TOTP)**：三端统一，扫码绑定用 `qrcode.react`
- **活跃会话管理**：桌面端可显示"本机"标识，移动端显示设备型号
- **注销账户**：桌面端增加"导出数据后再注销"的强提示（因为本地文件不会被自动删除）

### 不在本 Phase 做的事

- ❌ 桌面端与系统钥匙串集成（macOS Keychain / Windows Credential）—— 安全增强，放到 v1.4+
- ❌ 生物识别登录（Face ID / Touch ID / Windows Hello）—— 需要原生模块， Expo 阶段再考虑
- ❌ 跨设备同步设置 —— 依赖 v1.4+ 的同步协议
