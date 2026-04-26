# Phase 9: 标签重生 - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

标签从静态附属品升级为可过滤、可管理、可发现的知识节点。交付内容：

1. **标签过滤器** — 时间轴顶部横向标签栏（最常使用 8-10 个），支持单选/多选 AND 过滤，带「清除全部」
2. **标签管理页** (`/tags`) — 标签云视图（按使用频率调整字体大小）、标签卡片（名称/记忆数/最近更新/相关标签 TOP 3）、标签颜色配置
3. **标签关联发现** — 记忆详情页底部显示「相关标签」（基于共现频率）
4. **标签合并** — 自动检测相似标签（忽略大小写+标准化），一键合并更新所有记忆

**不在本阶段：** 标签语义相似度（跨语言/缩写识别）、标签层级分类、AI 自动整理标签。

</domain>

<decisions>
## Implementation Decisions

### 1. 标签数据模型 — 保持 PostgreSQL 数组

- **D-01:** 继续使用 `memories.tags` (`VARCHAR(50)[]`) 作为唯一数据源，不新建 `user_tags` 表
- **D-02:** 标签元数据（颜色、别名）存储在 `users.settings` JSONB 的 `tag_metadata` 字段中
- **D-03:** 理由：Echoes 是个人应用，单用户记忆数通常在几百到几千，数组+GIN 索引完全够用；引入独立表会增加同步复杂度且收益有限

### 2. 多标签过滤 API

- **D-04:** URL 参数使用重复键：`GET /memories?tags=react&tags=golang`
- **D-05:** Gin 通过 `c.QueryArray("tags")` 读取数组
- **D-06:** SQL 使用 `@>`（包含操作符）：`WHERE tags @> ARRAY['react', 'golang']`，GIN 索引友好
- **D-07:** 兼容现有单标签 API：`?tag=react` 继续可用，内部映射为单元素数组

### 3. 相关标签算法 — 共现频率

- **D-08:** 相关标签基于「共现频率」：两个标签同时出现在多少条记忆中
- **D-09:** SQL 使用 `UNNEST` + self-join 计算，数据量小时（<5000 条）性能为毫秒级
- **D-10:** 不采用语义相似度（需要向量服务，overhead 过大）

### 4. 标签合并检测策略

- **D-11:** **自动检测**（零成本）：忽略大小写 + 去除特殊字符后完全相同（如 "React" = "react"）
- **D-12:** **高级检测**（可选触发）：用户在标签管理页点击「智能整理」时，调用 LLM 分析所有标签返回相似组（如 "js" / "javascript"、"前端" / "frontend"）
- **D-13:** 合并操作：使用 PostgreSQL `array_replace()` 批量更新所有记忆的 tags 数组

### 5. 标签颜色存储

- **D-14:** 标签颜色存储在 `users.settings` JSONB 中：
  ```json
  {
    "tag_metadata": {
      "react": { "color": "#E8F4FD" },
      "go": { "color": "#E6F5E6" }
    }
  }
  ```
- **D-15:** 提供 16 色预设柔和调色板，用户从预设中选择（不支持自定义 HEX）

### 6. 标签管理页布局

- **D-16:** 标签云视图为默认视图，字体大小按 `min(24px, 12px + log2(count+1)*2)` 计算
- **D-17:** 标签卡片视图为切换选项，每卡片展示：标签名、记忆数量、最近更新时间、相关标签 TOP 3、颜色选择器
- **D-18:** 标签过滤器在时间轴页面顶部，横向滚动，显示最常用的 8-10 个标签 + 「更多」入口

### Claude's Discretion

- 标签过滤器的具体 UI 样式（pill/chip 样式、选中态设计）
- 标签云的具体字体大小算法微调
- 标签管理页空状态文案和动效
- 标签合并确认对话框的交互细节
- 移动端标签过滤器的适配方式

</decisions>

<specifics>
## Specific Ideas

- 标签颜色预设（16色柔和调色板）：`#E8F4FD`(天蓝) `#E6F5E6`(薄荷绿) `#FFF4E6`(暖橙) `#F3E8FF`(淡紫) `#FFE4E6`(浅粉) `#E0F7FA`(青蓝) `#F5F5DC`(米色) `#E8F5E9`(淡绿) `#FFF8E1`(暖黄) `#FCE4EC`(玫瑰) `#E3F2FD`(淡蓝) `#E0F2F1`(水鸭) `#F9FBE7`(柠檬) `#EDE7F6`(薰衣草) `#ECEFF1`(蓝灰) `#FBE9E7`(珊瑚)
- 标签过滤器选中态：深色填充 + 白色文字，未选中：浅色背景 + 灰色文字
- 多选时显示「清除全部」按钮在标签栏右侧
- 标签云的空状态：「还没有标签，保存第一条记忆后会自动生成」
- 标签合并的确认弹窗：显示「将 X 个记忆中的 [旧标签] 替换为 [新标签]」

</specifics>

<canonical_refs>
## Canonical References

### 需求与边界
- `.planning/REQUIREMENTS.md` §2 — Phase 9 完整需求（FEAT-09 ~ FEAT-18），含标签过滤器、标签管理页、标签关联发现、标签合并详细描述
- `.planning/ROADMAP.md` §Phase 9 — 阶段边界和目标
- `.planning/PROJECT.md` §设计原则 — 陪伴感>功能性、不打扰、视觉克制

### 技术架构
- `CLAUDE.md` — 技术栈、目录结构、API 约定、命名规范
- `PRD.md` — 完整 API 定义、数据库 Schema

### 现有标签相关代码
- `services/memory-service/internal/domain/memory.go` — Memory struct 的 `Tags pq.StringArray` 字段定义
- `services/memory-service/internal/repository/memory_repository.go` — `ListByUser` 已支持 `tag` 单标签过滤
- `services/memory-service/internal/transport/memory_handler.go` — 路由注册和 handler 模式
- `services/processor-service/app/consumers/tag_consumer.py` — LLM 标签生成逻辑（了解标签来源）
- `web/lib/api.ts` — API 客户端，已有 `listMemories({ tag?: string })` 方法
- `web/components/memory/memory-card.tsx` — 标签展示样式（`#tag` 格式，pill 样式）
- `web/app/(main)/page.tsx` — 首页布局（标签过滤器将放在 CreateMemoryForm 和 Timeline 之间）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `api.listMemories()` — 只需扩展参数为 `tags?: string[]`，向后兼容
- `MemoryCard` 组件 — 标签展示样式可直接复用，但需增加可选的点击过滤交互
- `CreateMemoryForm` 中的 tag input — 标签 chip 样式可复用于标签过滤器
- `users.settings` JSONB — 已有完整的 Get/Update API，直接复用添加 `tag_metadata`
- PostgreSQL GIN 索引 `idx_memories_tags` — 已存在，多标签 `@>` 查询可直接利用

### Established Patterns
- Go service 分层：domain → repository → service → transport，新 API 需遵循此结构
- API 统一响应格式：`{ success: true, data: {...} }`
- 前端数据获取：React `useEffect` + `useCallback` 模式，`loadMemories` 函数可直接扩展 `tags` 参数
- 暗黑模式：所有组件必须支持 `dark:` Tailwind 前缀
- 动效：Framer Motion `motion.div` + `whileHover`/`whileTap`

### Integration Points
- Memory Service：新增 `/tags` 路由组（`GET /tags`, `POST /tags/merge`, `GET /tags/:name/related`）
- Gateway：无需修改（`/*` 已转发到 Memory Service）
- 前端：新增 `/tags` 页面（`web/app/(main)/tags/page.tsx`），在首页添加 `TagFilter` 组件
- User Service：`UpdateUserSettings` / `GetUserSettings` 需支持 `tag_metadata` 字段

</code_context>

<deferred>
## Deferred Ideas

- **语义标签相似度**：跨语言/缩写识别（如 "前端" ↔ "frontend"、"js" ↔ "javascript"），当前仅通过可选 LLM 触发实现，更完善的版本可放入后续阶段
- **标签层级/分类**：如 "技术 > 前端 > React"，需求复杂度超出 Phase 9 范围
- **标签自动清理**：检测长期未使用的孤儿标签并提示清理
- **标签搜索/自动补全**：创建记忆时输入标签的实时搜索建议

</deferred>

---

*Phase: 09-tag-rebirth*
*Context gathered: 2026-04-25*
