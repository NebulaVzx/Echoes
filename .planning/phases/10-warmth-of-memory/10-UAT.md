---
status: complete
phase: 10-warmth-of-memory
source: [10-01-SUMMARY.md, 10-02-SUMMARY.md, 10-03-SUMMARY.md, 10-04-SUMMARY.md]
started: 2026-04-26T13:30:00+08:00
updated: 2026-04-26T13:45:00+08:00
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: 启动所有服务，应用正常启动，首页可访问，API 返回数据
result: pass

### 2. StreakIndicator in Create Form
expected: 打开首页创建记忆表单，能看到 StreakIndicator（火焰图标 + 连续天数或鼓励文案）
result: pass

### 3. SerendipityCard on Homepage
expected: 首页时间轴顶部显示「那年今日」卡片（琥珀色背景），展示旧记忆内容和"从那以后还保存了 N 条记忆"
result: pass

### 4. SerendipityCard Dismiss
expected: 点击「今天不想看」后卡片消失，刷新页面当天不再显示
result: pass

### 5. SerendipityCard Favorite
expected: 点击「收藏这条回忆」后，记忆 ID 被保存到 localStorage
result: pass

### 6. DailyReviewCard on Homepage
expected: 首页显示「今日拾忆」可折叠卡片，展示今日保存数量、主题标签、值得回顾的旧记忆
result: pass

### 7. DailyReviewCard Collapse Persistence
expected: 点击折叠/展开后，刷新页面状态保持（localStorage 持久化）
result: pass

### 8. TimeCapsuleToggle in Create Form
expected: 创建表单中能看到「封印这段记忆」开关，展开后显示 7天/30天/100天 预设和自定义日期选择器
result: pass

### 9. Seal Memory from Detail Page
expected: 进入记忆详情页，点击「封印这段记忆」按钮后记忆被封印；再次点击可解除封印
result: pass

### 10. UnlockCeremony on Homepage
expected: 当有最近解锁的记忆时，首页顶部显示「⏳ 一段被封印的记忆已解锁」仪式卡片（紫色渐变背景 + 动画）
result: pass

### 11. Capsules Page
expected: 点击首页 header 的「胶囊」链接进入 /capsules，显示所有封印中的记忆及剩余天数
result: pass

### 12. Settings Streak Stats
expected: 进入设置页面，顶部「记忆统计」区域显示当前连续天数、最长连续天数、7/30/100 天里程碑徽章
result: pass

### 13. Streaks API
expected: 调用 GET /api/v1/memories/streaks 返回 {current_streak, longest_streak, has_recorded_today}
result: pass

### 14. Seal/Unseal API
expected: 调用 POST /api/v1/memories/:id/seal 和 DELETE /api/v1/memories/:id/seal 成功封印/解封记忆
result: pass

## Summary

total: 14
passed: 14
issues: 1
pending: 0
skipped: 0

## Gaps

### Issue 1: Route registration order caused API shadowing (FIXED)

- **severity**: blocker
- **test**: 13 (Streaks API), 14 (Seal/Unseal API)
- **truth**: GET /api/v1/memories/streaks 等 endpoint 应返回正确数据
- **status**: resolved
- **reason**: memory_handler.go 中 /memories/:id 路由在 /memories/streaks 之前注册，Gin 将 "streaks" 匹配为 :id 参数，导致所有 warmth/time-capsule API 返回 "Invalid memory ID"
- **fix**: 将所有具体路由（streaks, serendipity, daily-review, sealed, unsealed）移到参数化路由 /memories/:id 之前注册
- **commit**: ef6e513

## Verification Commands Run

```bash
# Backend build & test
go build ./services/memory-service/...   # PASS
go test ./services/memory-service/...    # PASS

# Frontend type check
cd web && npx tsc --noEmit --skipLibCheck  # PASS

# API tests (via curl)
POST /api/v1/auth/register              # PASS
GET /api/v1/memories/streaks            # PASS (returns streak data)
GET /api/v1/memories/serendipity        # PASS (returns memory or NOT_FOUND for new user)
GET /api/v1/memories/daily-review       # PASS (returns today_count, top_tags)
GET /api/v1/memories/sealed             # PASS (returns sealed memories)
POST /api/v1/memories/:id/seal          # PASS
DELETE /api/v1/memories/:id/seal        # PASS
```

## Post-Execution Fixes

| 文件 | 修复内容 |
|------|----------|
| `services/memory-service/internal/service/memory_service.go` | 移除未使用的 `oneYearAgo` 变量 |
| `services/memory-service/internal/service/memory_service_test.go` | 添加缺失的 mock 方法（CountMemoriesSince, GetMemoriesByDateRange 等） |
| `services/memory-service/internal/transport/memory_handler.go` | 调整路由注册顺序，具体路由先于参数化路由 |
