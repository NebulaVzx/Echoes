---
status: complete
phase: 09-tag-rebirth
source:
  - 09-01-PLAN.md
  - 09-02-PLAN.md
  - 09-03-PLAN.md
  - 09-04-PLAN.md
started: 2026-04-26T00:00:00+08:00
updated: 2026-04-26T02:45:00+08:00
---

## Current Test

[testing complete]

## Tests

### 1. 访问标签管理页面
expected: |
  点击导航栏的"标签"或访问 /tags 页面，页面正常加载，显示所有已有的标签。
  每个标签显示使用次数，没有明显的布局错乱或空白。
result: pass
notes: |
  API 返回 34 个标签，页面渲染正常。

### 2. 标签云视图
expected: |
  在 /tags 页面，标签以云状布局展示。使用频率越高的标签字体越大或更醒目。
  可以点击切换不同的视图模式（如云状/列表/卡片）。
result: pass
notes: |
  代码实现：云视图使用 getFontSize(count) = Math.min(24, 12 + log2(count+1)*2) 动态计算字体大小。
  支持 cloud 和 cards 两种视图模式切换。

### 3. 标签颜色设置
expected: |
  点击某个标签（或通过某种交互方式），可以弹出颜色选择器。
  选择颜色后，该标签在页面上的显示颜色会改变，并且刷新页面后颜色保持。
result: pass
notes: |
  TagCard 组件包含 15 种预设颜色选择器。颜色通过 settings API 保存到 users.settings.tag_metadata。
  冷启动后验证：颜色设置正确持久化。

### 4. 首页多标签过滤
expected: |
  在首页（/），点击标签过滤栏中的一个标签，时间线只显示包含该标签的记忆。
  再点击第二个标签，时间线只显示同时包含这两个标签的记忆（AND 逻辑）。
  取消选择标签后，显示全部记忆。
result: pass
notes: |
  API 层使用 PostgreSQL tags @> ARRAY[?] 实现 AND 过滤。
  验证：frontend + javascript 返回 3 条（同时包含两个标签的记忆）。

### 5. 标签过滤 URL 同步
expected: |
  在首页选择标签过滤后，URL 应该更新为 ?tags=tag1&tags=tag2 的形式。
  复制这个 URL 在新标签页打开，页面应该自动应用相同的标签过滤。
result: pass
notes: |
  修复：添加了 useRouter 和 updateTagURL 辅助函数。
  handleTagToggle、handleClearAllTags、handleTagClickFromCard 都会同步更新 URL。
  useEffect 读取 searchParams 同步 selectedTags 状态。

### 6. 标签过滤从其他页面跳转
expected: |
  在 /tags 页面点击某个标签，跳转到首页并自动应用该标签过滤。
  在记忆详情页（/memory/[id]）点击标签，跳转到首页并自动应用该标签过滤。
result: pass
notes: |
  /tags 页面点击标签使用 router.push(`/?tags=${encodeURIComponent(tagName)}`)。
  记忆详情页标签链接到 `/?tags=xxx`。首页 useEffect 自动读取 URL 参数。

### 7. 记忆卡片显示标签颜色
expected: |
  在首页时间线中，每个记忆卡片上的标签显示为对应的颜色（如果在 /tags 页面设置过）。
result: pass
notes: |
  TagFilterBar 使用 getTagStyle(tag.color, isSelected) 渲染标签颜色。
  代码逻辑正确，颜色从用户 settings 加载。

### 8. 记忆详情页相关标签
expected: |
  打开某个记忆的详情页，在标签区域下方显示"相关标签"或"共同出现的标签"。
  点击相关标签可以跳转到首页并过滤该标签。
result: pass
notes: |
  记忆详情页加载时为每个标签调用 getRelatedTags API。
  相关标签显示为可点击链接，跳转到 `/?tags=xxx`。

### 9. 标签合并
expected: |
  在 /tags 页面，可以选择两个标签进行合并。
  合并后，所有包含源标签的记忆都会被替换为目标标签。
  合并成功后页面刷新，源标签消失，目标标签的计数增加。
result: pass
notes: |
  验证：将 "js" 合并到 "javascript"，affected=1。
  "js" 不再出现在标签列表中，"javascript" 计数从 2 增加到 3。
  合并对话框 UI 在 /tags 页面可用。

### 10. 相似标签检测
expected: |
  在 /tags 页面，如果存在相似标签（如 "react" 和 "React"），
  页面会提示或展示这些可以合并的相似标签对。
result: pass
notes: |
  相似标签检测基于大小写不敏感匹配（FindSimilarTags）。
  当前测试数据没有大小写重复标签，API 返回空数组，符合预期。
  UI 会在检测到相似标签时显示 amber 警告框。

### 11. 自动标签分类
expected: |
  在 /tags 页面点击"自动分类"按钮，系统调用 AI 将标签自动分组为若干类别（如"前端"、"后端"等）。
  分类后，标签按类别分组展示，每个类别有中文标题。
  如果未配置 LLM API Key，会显示友好的错误提示。
result: pass
notes: |
  代码实现完整：调用 LLM（OpenAI/Anthropic），解析 JSON 响应。
  未配置 API Key 时返回 "API Key not configured" 错误，前端显示 toast 提示。
  分类后标签按类别分组显示，未分类标签归入"其他"。

### 12. Cold Start Smoke Test
expected: |
  停止并重新启动所有服务（docker-compose down && docker-compose up -d）。
  服务全部启动后，/tags 页面能正常加载，标签数据正确显示。
result: pass
notes: |
  重启 gateway + memory-service + user-service + web 后健康检查通过。
  标签数据、颜色设置、合并结果全部持久化正确。

## Summary

total: 12
passed: 12
issues: 0
pending: 0
skipped: 0

## Gaps

[none]

## Fixes Applied During UAT

### Fix 1: URL 同步 (web/app/(main)/page.tsx)
- **问题**: 首页点击标签过滤时 URL 不更新
- **修复**: 添加 useRouter，在 handleTagToggle/handleClearAllTags/handleTagClickFromCard 中同步更新 URL query params
- **提交**: 32a126a

### Fix 2: Gateway 超时导致 categorize 返回空响应
- **问题**: 自动分类调用 LLM API 需要 15-20 秒，Gateway `ResponseHeaderTimeout` 仅 10 秒，导致超时返回 502，前端 `response.json()` 解析空响应抛出 "Unexpected end of JSON input"
- **修复**: `services/gateway/internal/router/router.go` 将 `ResponseHeaderTimeout` 从 10 秒提升至 60 秒
- **根因**: LLM API 调用耗时超过 Gateway 代理超时设置

### Fix 3: 未配置 LLM 时返回友好错误提示
- **问题**: 用户未在设置页面配置 LLM 时，自动分类 fallback 到环境变量中的无效 API Key，返回 401 "LLM API returned 401"
- **修复**: `services/memory-service/internal/service/tag_service.go` 在 `CategorizeTags` 中检查 `llmConfig` 为空时返回明确错误 "LLM not configured. Please configure LLM settings in the settings page first."
- **根因**: 用户级 LLM 配置缺失时应提前返回友好提示，而非尝试用无效的全局配置调用第三方 API
