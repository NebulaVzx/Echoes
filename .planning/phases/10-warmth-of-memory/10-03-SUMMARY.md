---
phase: 10-warmth-of-memory
plan: 10-03
status: complete
date: 2026-04-26
tasks_completed: 5
---

# 10-03 Summary: Frontend Warmth Cards (Streaks, Serendipity, Daily Review)

## What Was Built

Built and integrated three warmth UI components that transform Echoes from a storage tool into a companion, plus a streak stats section on the Settings page.

### 1. StreakIndicator (`web/components/warmth/streak-indicator.tsx`)

- Subtle indicator placed inside the create memory form
- Fetches streak data via `api.getStreaks()` on mount
- Three states:
  - **Active streak + recorded today**: Orange flame icon + "已连续记录 N 天"
  - **Active streak + not recorded today**: Dimmed flame + reminder message
  - **No streak**: Encouraging sparkles message "今天的第一条记忆，从这里开始"

### 2. SerendipityCard (`web/components/warmth/serendipity-card.tsx`)

- "That day in history" card displayed at the top of the homepage timeline
- Fetches via `api.getSerendipity()` — prioritizes memory from ~1 year ago
- Amber warmth color scheme (`bg-amber-50/80`, `border-amber-100`)
- Features:
  - Daily dismiss persisted to `localStorage` ("今天不想看")
  - Favorite button stores memory ID to localStorage
  - "查看详情" link to memory detail page
  - Shows "从那以后，你还保存了 N 条记忆" count
  - Framer Motion `AnimatePresence` + `motion.div` for smooth enter/exit

### 3. DailyReviewCard (`web/components/warmth/daily-review-card.tsx`)

- Collapsible "今日拾忆" card above the timeline
- Fetches via `api.getDailyReview()`
- Collapse state persisted to `localStorage`
- Content:
  - Today's saved memory count
  - Top 3 tags as hashtags
  - A "worth reviewing" old memory link
  - Empty state: "今天也要记得拾起些什么 ✨"
- Sky accent color (`text-sky-500` Sparkles icon)

### 4. Homepage Integration (`web/app/(main)/page.tsx`)

- Added imports for `SerendipityCard` and `DailyReviewCard`
- Placement order: **SerendipityCard → DailyReviewCard → CreateMemoryForm → TagFilterBar → MemoryList**

### 5. Create Form Integration (`web/components/memory/create-memory-form.tsx`)

- Added `StreakIndicator` import and placed it at the top of the form
- Shows subtle encouragement while user is about to create a memory

### 6. Settings Streak Stats (`web/app/(main)/settings/page.tsx`)

- New "记忆统计" section at the top of the Settings page (above LLM Connection)
- Displays:
  - Current streak with Flame icon (orange when recorded today, gray otherwise)
  - Longest streak with Trophy icon (amber)
  - 7/30/100 day milestone badges (orange when achieved, gray muted when not)
  - Encouraging message when streak is 0

### 7. API Client Extensions (`web/lib/api.ts`)

Added three warmth endpoints to `ApiClient`:
- `getStreaks()` → `GET /api/v1/memories/streaks`
- `getSerendipity()` → `GET /api/v1/memories/serendipity`
- `getDailyReview()` → `GET /api/v1/memories/daily-review`

## Key Decisions

- **StreakIndicator placement**: Inside the create form (not the timeline) — shows at the moment of creation, which is the most relevant context
- **Serendipity dismiss**: Per-day localStorage persistence, not server-side — simple and privacy-respecting
- **DailyReview collapse**: localStorage persistence, default expanded — user can opt-out of seeing it
- **Settings stats**: Display-only, no save button — streaks are computed server-side from memory data
- **Color scheme**: Amber for serendipity (warmth/nostalgia), sky blue for daily review (freshness/calm)

## Self-Check

- [x] `npx tsc --noEmit --skipLibCheck` passes (all 5 tasks)
- [x] All 3 warmth components exist in `web/components/warmth/`
- [x] Homepage integrates SerendipityCard + DailyReviewCard in correct order
- [x] Create form includes StreakIndicator
- [x] Settings page has Memory Stats section at top
- [x] All 3 API methods added to `web/lib/api.ts`
- [x] No file deletions in any commit

## Deviations

None — plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `ef43480` | feat(10-03): create StreakIndicator component and warmth API methods |
| 2 | `dc19a1b` | feat(10-03): create SerendipityCard component |
| 3 | `82cf3d2` | feat(10-03): create DailyReviewCard component |
| 4 | `b3fd45f` | feat(10-03): integrate warmth cards into homepage and create form |
| 5 | `39427fb` | feat(10-03): add streak stats section to Settings page |
