---
name: Phase 10 Context
description: 记忆的温度 - Context for research and planning
type: context
---

# Phase 10: 记忆的温度 - Context

**Gathered:** 2026-04-26
**Status:** Ready for planning

<domain>
## Phase Boundary

让记忆产生情感价值，从"存储工具"升级为"陪伴者"。交付内容：

1. **记忆 Streaks** — 连续记录天数的温和鼓励，subtle 展示在创建表单下方
2. **那年今日（Serendipity）** — 每天首页时间轴顶部展示一条旧记忆，与过去的自己重逢
3. **时间胶囊** — 保存记忆时可选择封印到未来某个日期解锁，到期时首页显示仪式卡片
4. **每日回顾** — 首页顶部可折叠的「今日拾忆」卡片，展示今日保存数量和主题

**不在本阶段：**
- 社交分享功能
- 复杂的统计图表/数据可视化
- 推送通知系统（解锁时仅在用户打开应用时展示）
- 跨用户对比/排行榜

</domain>

<decisions>
## Implementation Decisions

### 1. Streaks 连续计算逻辑

**D-01: 宽松连续模式（Grace-Based）**
- 允许断 1 天（第 2 天未保存才归零）
- 基于用户本地时区判断自然日
- 里程碑：7/30/100 天，温和庆祝（无强通知）
- 展示位置：创建记忆表单下方 subtle 显示
- 文案温暖："已连续记录 N 天"，避免焦虑感

**D-02: Streaks 数据存储**
- 不新增独立表，通过查询 `memories` 表的 `created_at` 按天聚合计算
- 缓存：考虑在 `users.settings` JSONB 中存储 `last_streak_date` 和 `current_streak` 减少查询
- 但 Phase 10 第一版先实时查询，简单可靠

### 2. 时间胶囊数据模型

**D-03: 新增 `sealed_until` 字段**
- `memories` 表新增 `sealed_until TIMESTAMP` 字段（可为 NULL）
- 新增索引：`idx_memories_sealed_until`
- 时间轴查询默认过滤：`sealed_until IS NULL OR sealed_until <= NOW()`
- 理由：`metadata` JSONB 无法有效索引日期查询，独立字段更可靠

**D-04: 封印期间可见性**
- 时间轴：完全隐藏封印中的记忆
- 独立入口：新增「时间胶囊」页面（`/capsules` 或在设置/标签区域），展示所有封印中的记忆及剩余天数
- 解锁时：首页顶部显示仪式卡片，3 秒后自动融入时间轴

### 3. 那年今日展示方式

**D-05: 时间轴顶部特殊卡片**
- 插入首页时间轴最顶部，轻微不同背景样式 + 日期徽章
- 内容选择：优先"一年前的今天"，没有则选"随机高价值旧记忆"（基于标签丰富度/内容长度）
- 底部显示"从那以后，你还保存了 N 条相关记忆"
- 可点击「今天不想看」跳过当天，第二天再次出现
- 每天只展示一次（通过本地状态或 API 标记）

### 4. 时间胶囊预设与入口

**D-06: 双入口设计**
- **创建表单底部**：添加「🔒 封印这段记忆」toggle，展开预设选择
- **详情页 Actions 区**：对已保存的记忆也可封印
- 预设时长：7天 / 30天 / 100天 / 自定义日期

**D-07: 解锁仪式**
- 首页顶部显示仪式卡片：「⏳ 一段被封印的记忆已解锁」
- Framer Motion 淡入 + 轻微缩放动效
- 卡片展示解锁记忆的内容摘要 + 「打开看看」按钮
- 3 秒后或用户点击后融入正常时间轴

### 5. 每日回顾

**D-08: 可折叠卡片**
- 首页时间轴上方（那年今日之下或替代）
- 展示：今日保存数量、今日主题标签 TOP 3、一条值得回顾的旧记忆
- 无新记忆时显示鼓励文案：「今天也要记得拾起些什么 ✨」
- 默认展开，用户可手动折叠（状态记住）

### Claude's Discretion
- Streaks 的具体视觉样式（火焰图标 vs 日历图标 vs 文字）
- 那年今日卡片的精确背景色/边框样式
- 时间胶囊仪式卡片的具体动效时长和曲线
- 每日回顾卡片的布局细节
- 「高价值旧记忆」的选择算法（标签数、内容长度、是否含链接等权重）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需求与边界
- `.planning/REQUIREMENTS.md` §3 — Phase 10 完整需求（FEAT-19 ~ FEAT-31）
- `.planning/ROADMAP.md` §Phase 10 — 阶段边界和目标
- `.planning/PROJECT.md` §设计原则 — 陪伴感>功能性、不打扰、视觉克制

### 技术架构
- `CLAUDE.md` — 技术栈、目录结构、API 约定、命名规范
- `PRD.md` — 完整 API 定义、数据库 Schema

### 现有代码（复用资产）
- `services/memory-service/internal/domain/memory.go` — Memory struct，需扩展 `SealedUntil`
- `services/memory-service/internal/repository/memory_repository.go` — ListByUser 查询逻辑
- `services/memory-service/internal/transport/memory_handler.go` — handler 模式
- `web/components/memory/create-memory-form.tsx` — 创建表单（添加封印 toggle）
- `web/components/memory/memory-card.tsx` — 记忆卡片样式
- `web/app/(main)/page.tsx` — 首页布局（那年今日/每日回顾插入位置）
- `web/lib/api.ts` — API 客户端

### 数据库
- `shared/migrations/001_init.sql` — 现有 Schema

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `api.listMemories()` — 需扩展支持 `include_sealed` 参数（用于时间胶囊页面）
- `MemoryCard` 组件 — 标签展示、点击交互可直接复用
- `CreateMemoryForm` — toggle 开关模式（已用于 AI 建议开关），封印 toggle 可复用同样交互
- `users.settings` JSONB — 存储每日回顾折叠状态、streak 相关缓存
- PostgreSQL `DATE()` 函数 — 用于按天聚合计算 streaks

### Established Patterns
- Go service 分层：domain → repository → service → transport
- 前端数据获取：React `useEffect` + `useCallback`
- 暗黑模式：`dark:` Tailwind 前缀
- 动效：Framer Motion `motion.div` + `initial/animate/transition`
- 日期处理：前端 `toLocaleDateString('zh-CN')`，后端 `time.Time`

### Integration Points
- Memory Service：`ListByUser` 需增加 `excludeSealed` 参数（默认 true）
- Gateway：无需修改（`/*` 已转发到 Memory Service）
- 前端：首页 `page.tsx` 需插入那年今日和每日回顾卡片
- 创建表单：`create-memory-form.tsx` 添加封印选项

</code_context>

<specifics>
## Specific Ideas

### Streaks 展示示例
创建表单下方 subtle 显示：
```
🔥 已连续记录 12 天
```
或空状态：
```
✨ 今天的第一条记忆，从这里开始
```

### 那年今日卡片样式
```
┌─────────────────────────────────────────┐
│ 📅 一年前的今天                          │
│                                         │
│  "当时记录的一段文字..."                 │
│                                         │
│  从那以后，你还保存了 47 条记忆          │
│                              [今天不想看] │
└─────────────────────────────────────────┘
```

### 时间胶囊解锁仪式
```
┌─────────────────────────────────────────┐
│ ⏳ 一段被封印的记忆已解锁                │
│                                         │
│  "30 天前你封印的这段记忆..."            │
│                                         │
│         [ 打开看看 ]                     │
└─────────────────────────────────────────┘
```

### 每日回顾空状态
```
┌─────────────────────────────────────────┐
│ 今日拾忆                                │
│                                         │
│  今天也要记得拾起些什么 ✨               │
│  哪怕是一句话、一个链接                  │
└─────────────────────────────────────────┘
```

</specifics>

<deferred>
## Deferred Ideas

- **情绪趋势分析** — 基于 AI 建议的情绪类型分析用户情绪变化（v1.3+）
- **年度回顾** — 年底生成年度记忆报告（v1.3+）
- **记忆图谱** — 可视化记忆之间的关联网络（v1.4+）
- **多人共享时间胶囊** — 与朋友共同封印记忆（v1.4+，需要社交功能）

</deferred>

---

*Phase: 10-warmth-of-memory*
*Context gathered: 2026-04-26*
