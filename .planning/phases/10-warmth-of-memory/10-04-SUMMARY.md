---
phase: 10-warmth-of-memory
plan: 10-04
status: complete
date: 2026-04-26
tasks_completed: 6
---

# 10-04 Summary: Frontend Time Capsule Integration

## What Was Built

Integrated time capsule functionality throughout the Echoes frontend, allowing users to seal memories for future unlocking with a ceremonial reveal experience.

### 1. TimeCapsuleToggle (`web/components/warmth/time-capsule-toggle.tsx`)

- Toggle component for sealing memories at creation time
- Two states: "封印这段记忆" (inactive) / "🔒 已封印" (active, amber color)
- Expanded state shows 3 preset buttons: 7天 / 30天 / 100天
- Custom date picker with `min=today` validation
- Calls `onChange` with ISO string or null

### 2. Create Form Integration (`web/components/memory/create-memory-form.tsx`)

- Imported `TimeCapsuleToggle` component
- Added `sealedUntil` state to form
- Toggle rendered between AI suggestion toggle and submit button
- Passes `sealed_until` to `api.createMemory` when set
- Resets `sealedUntil` to null on successful creation

### 3. Memory Detail Seal/Unseal (`web/app/(main)/memory/[id]/page.tsx`)

- Added `handleSeal` handler (default 30 days from detail page)
- Added `handleUnseal` handler
- Seal button: gray style with Lock icon, "封印这段记忆"
- Unseal button: amber style with Unlock icon, shows unlock date
- Local state updates after successful API call

### 4. UnlockCeremony (`web/components/warmth/unlock-ceremony.tsx`)

- Fetches recently unsealed memories via `api.getRecentlyUnsealed()`
- Shows one memory at a time with dismiss (X) button
- Framer Motion `AnimatePresence` + `motion.div` with scale/fade animation
- Violet gradient styling (`from-violet-50 to-purple-50`) for ceremony feel
- "打开看看" button links to memory detail page

### 5. Homepage Integration (`web/app/(main)/page.tsx`)

- Imported `UnlockCeremony` component
- Placed at top of warmth card stack (most urgent/time-sensitive)
- Final order: **UnlockCeremony → SerendipityCard → DailyReviewCard → CreateMemoryForm → TagFilterBar → MemoryList**

### 6. Capsules Navigation + Page

- Added "胶囊" nav link with Clock icon in homepage header (next to Settings)
- Created `web/app/(main)/capsules/page.tsx` listing all sealed memories
- Shows remaining days until unlock as a violet badge on each card
- Empty state: "还没有封印的记忆。在创建记忆时选择「封印」，未来某个时刻它会重新出现。"
- Uses `MemoryCard` component for visual consistency

### 7. API Type Extension (`web/lib/api.ts`)

- Added `sealed_until?: string` field to `Memory` interface
- Required for TypeScript compilation of detail page seal/unseal logic

## Key Decisions

- **Toggle placement**: Between AI suggestion and submit button — logical flow of optional features before primary action
- **Detail page default seal**: 30 days — a meaningful but not excessive duration
- **UnlockCeremony priority**: Above SerendipityCard because time-sensitive unlocks are more urgent than nostalgic discoveries
- **Capsules page**: Simple list with day counter badge, reusing MemoryCard for consistency
- **Nav link label**: "胶囊" (short for 时间胶囊) to fit in the compact header

## Self-Check

- [x] `npx tsc --noEmit --skipLibCheck` passes (all 6 tasks)
- [x] `web/components/warmth/time-capsule-toggle.tsx` exists
- [x] Create form integrates TimeCapsuleToggle with sealedUntil state
- [x] Memory detail page has seal/unseal buttons
- [x] `web/components/warmth/unlock-ceremony.tsx` exists with Framer Motion
- [x] Homepage has UnlockCeremony at top of warmth cards
- [x] Homepage header has "胶囊" nav link with Clock icon
- [x] `web/app/(main)/capsules/page.tsx` exists and lists sealed memories
- [x] `Memory` interface includes `sealed_until` field
- [x] No file deletions in any commit

## Deviations

None — plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `2a08199` | feat(10-04): create TimeCapsuleToggle component with preset durations |
| 2 | `0e5c738` | feat(10-04): integrate TimeCapsuleToggle into create memory form |
| 3 | `7f59301` | feat(10-04): add seal/unseal buttons to memory detail page |
| 4 | `427f891` | feat(10-04): create UnlockCeremony component with Framer Motion |
| 5 | `0e3e8bf` | feat(10-04): integrate UnlockCeremony into homepage |
| 6 | `00959e4` | feat(10-04): add capsules navigation link and /capsules page |
