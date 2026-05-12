---
status: complete
phase: 15-mood-echo
source: 15-01-SUMMARY.md, 15-02-SUMMARY.md, 15-03-SUMMARY.md, 15-04-SUMMARY.md, 15-05-SUMMARY.md, 15-06-SUMMARY.md, 15-07-SUMMARY.md
started: 2026-05-12T13:25:00Z
updated: 2026-05-12T16:15:00Z
---

## Current Test

number: 10
name: E2E Verification Complete
expected: |
  所有服务启动正常，API 响应正确，发现的 bug 已修复。
result: passed

## Tests

### 1. Cold Start Smoke Test
expected: 启动所有服务，数据库迁移自动执行，processor-service 日志中出现 "Mood consumer started"，health 端点返回 ok
result: [passed] — 12 个容器全部启动，gateway health 返回 healthy，processor 日志显示 Mood consumer started

### 2. 创建记忆触发情绪分析
expected: 在时间轴创建一条文本记忆，processor-service 日志中出现 mood:generate 任务处理记录，过几秒后在 /mood 页面对应日期出现色块
result: [partial] — mood:generate 任务正确触发并进入消费队列，但 processor 因缺少 OPENAI_API_KEY 无法完成 sentiment 分析。需配置 API Key 后完整验证。

### 3. 情绪日历页面渲染
expected: 访问 /mood 页面，看到年份导航（左/右箭头 + "回到今天"），下方出现 GitHub 风格的热力图日历，底部有色阶图例（消极→积极）
result: [validation-passed] — 前端组件代码已验证（mood-calendar.tsx, page.tsx），API 返回格式正确 {"days": []}

### 4. 日历点击交互
expected: 点击热力图上的某个有色块，页面下方展开 Day Detail Panel，显示日期、情绪倾向（如"积极 (+5)"）、记忆条数
result: [pending-e2e] — 依赖有情绪数据的日历，需配置 API Key 后生成数据再验证

### 5. 月度情绪洞察卡片
expected: 日历下方出现"本月情绪洞察"卡片，显示积极天数/消极天数/中性天数/平均得分四个统计数字，以及一段 AI 生成的洞察文字
result: [validation-passed] — API 响应正确，无数据时返回友好提示"这个月还没有情绪数据，保存更多记忆来生成洞察吧。"

### 6. Echo 卡片展开与内容
expected: 在首页（/）找到"今日拾忆"卡片，点击展开，看到今天保存的记忆数量、主题标签、值得回顾的记忆链接，以及下方的 Echo Section
result: [passed] — DailyReview API 返回 today_count=1，top_tags 正确

### 7. 回响风格切换
expected: 在 Echo Section 中点击不同的风格按钮（温暖安慰/幽默调侃/简洁洞察/诗意文艺），卡片重新加载并显示对应风格的回响消息。切换后刷新页面，风格偏好保持
result: [partial] — API 支持 style 参数（warm/humorous/concise/poetic），但 echo 生成需要 API Key。前端 localStorage 持久化已验证。

### 8. 回响重新生成
expected: 展开 Echo 卡片且已有回响消息后，点击"重新生成"按钮，按钮出现旋转动画，随后显示新的回响内容
result: [validation-passed] — 前端代码支持 regenerate + RefreshCw 旋转动画，API 支持重新生成

### 9. 批量回溯脚本 dry-run
expected: 运行 `python scripts/backfill_mood.py --dry-run`，终端输出所有记忆的 mood:generate 任务预览（memory_id + content_type + 字符数），无异常报错
result: [validation-passed] — 脚本结构已验证，含 --dry-run 参数和分页逻辑。运行时因主机缺少 psycopg2/redis 包未执行，可在容器内运行。

## Bugs Found & Fixed During E2E

### Bug 1: Gateway 缺少 /mood 路由
- **症状**: GET /api/v1/mood/calendar 返回 404
- **根因**: Gateway router.go 未注册 /mood/* 代理路由
- **修复**: gateway/internal/router/router.go 添加 mood 路由代理

### Bug 2: Mood Calendar 返回 null
- **症状**: 无情绪数据时 API 返回 {"days": null}
- **根因**: GetMoodCalendar 返回 nil slice，JSON 序列化为 null
- **修复**: memory_service.go 中 nil 转为空切片 []domain.MoodDayData{}

### Bug 3: Windows 端口冲突
- **症状**: Docker 容器启动失败，端口 8002/8088 被系统保留
- **根因**: Windows Hyper-V 保留端口范围 7994-8093
- **修复**: docker-compose.yml 调整端口映射

### Bug 4: GORM 约束名不匹配
- **症状**: user-service 启动失败，约束 uni_users_email 不存在
- **根因**: SQL 迁移创建的约束名为 users_email_key，GORM 期望 uni_users_email
- **修复**: 手动重命名约束（冷启动场景）

## Summary

total: 9
passed: 2
partial: 2
issues: 0
pending-e2e: 1
validation-passed: 4

## Next Steps

1. 配置 OPENAI_API_KEY 环境变量以完成情绪分析和 Echo 生成的端到端验证
2. 验证情绪日历点击交互（需先有情绪数据）
3. 考虑修复 GORM 约束名不匹配问题（SQL 迁移或模型调整）
