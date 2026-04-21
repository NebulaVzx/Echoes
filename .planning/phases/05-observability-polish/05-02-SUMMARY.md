---
phase: 05-observability-polish
plan: 02
subsystem: web-frontend
completed_at: 2026-04-21
---

# Phase 05 Plan 02: Frontend Polish Summary

**One-liner:** Framer Motion page transitions, staggered card animations, skeleton loading screens, animated empty states, and button scale feedback across all main pages.

## What Was Built

Implemented frontend polish per D-05 decision: lightweight Framer Motion animations (200ms ease-out), skeleton loading states, and interactive feedback — all respecting Notion-like minimal aesthetic.

### Files Created

| File | Purpose |
|------|---------|
| `web/app/template.tsx` | AnimatePresence page transition wrapper (fade + slide, 200ms) |
| `web/app/loading.tsx` | Global Skeleton-based loading layout for Next.js App Router |
| `web/components/ui/skeleton.tsx` | Reusable Skeleton component (shadcn/ui style) |
| `web/components/empty-state.tsx` | Animated empty state with fade-in (300ms) |
| `web/components/memory/memory-list.tsx` | Stagger container for memory card entrance animations |
| `web/lib/utils.ts` | `cn()` helper for Tailwind className merging |

### Files Modified

| File | Changes |
|------|---------|
| `web/app/globals.css` | Added `btn-scale` utility class (scale 0.97, 100ms) |
| `web/components/memory/memory-card.tsx` | Wrapped in motion.div with whileHover/whileTap |
| `web/app/(main)/page.tsx` | Skeleton loading, EmptyState, MemoryList, btn-scale on buttons |
| `web/app/(main)/memory/[id]/page.tsx` | Skeleton loading, motion fade-in for errors, btn-scale |
| `web/app/(main)/search/page.tsx` | Skeleton loading, EmptyState, stagger animation for results |
| `web/app/(main)/settings/page.tsx` | Skeleton loading layout, btn-scale on buttons |
| `web/app/(auth)/login/page.tsx` | btn-scale on submit and GitHub buttons |
| `web/app/(auth)/register/page.tsx` | btn-scale on submit button |
| `web/components/memory/create-memory-form.tsx` | btn-scale on save button |
| `web/components/search/related-memories.tsx` | Inline skeleton cards instead of plain text |

## Animation Specifications (D-05)

| Animation | Params | Files |
|-----------|--------|-------|
| Page transition | opacity 0->1, y 10->0, 200ms ease-out | `template.tsx` |
| Card entrance | stagger 50ms, same params as page | `memory-list.tsx` |
| Card hover/tap | scale 1.01 / 0.98, 100ms | `memory-card.tsx` |
| Empty state | opacity 0->1, 300ms | `empty-state.tsx` |
| Button feedback | scale 0.97, 100ms | `globals.css` `.btn-scale` |
| Error state | opacity 0->1, 300ms | `memory/[id]/page.tsx`, `search/page.tsx` |

## Verification Results

- [x] TypeScript compilation: `npx tsc --noEmit` — passes with no errors
- [x] Next.js build: `npm run build` — completes successfully, all 8 pages generated
- [x] No plain "加载中..." text remains in any page component
- [x] Framer Motion imports present in template, memory-list, memory-card, empty-state, search
- [x] Skeleton usage present in loading, all page files, and related-memories

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added `web/lib/utils.ts` for `cn()` helper**
- **Found during:** Task 1
- **Issue:** Skeleton component imported `cn` from `@/lib/utils` but the file did not exist
- **Fix:** Created `web/lib/utils.ts` with `cn()` helper using `clsx` + `tailwind-merge` (standard shadcn/ui pattern)
- **Files modified:** `web/lib/utils.ts` (created)
- **Commit:** `6f3f34b`

**2. [Rule 2 - Missing Critical Functionality] Replaced plain loading text in settings and related-memories**
- **Found during:** Task 3 verification
- **Issue:** `settings/page.tsx` and `related-memories.tsx` still had plain "加载中..." text not covered in the original task list
- **Fix:** Added Skeleton-based loading to settings page and inline skeleton cards to related-memories
- **Files modified:** `web/app/(main)/settings/page.tsx`, `web/components/search/related-memories.tsx`
- **Commit:** `3ab17ce`

## Commits

| Hash | Message |
|------|---------|
| `6f3f34b` | feat(05-02): create animation infrastructure - template, skeleton, empty-state, CSS |
| `b693c83` | feat(05-02): add MemoryList stagger animation and Skeleton loading to all pages |
| `3ab17ce` | feat(05-02): add button scale feedback and replace remaining plain loading text |

## Self-Check: PASSED

- All created files exist and compile
- All commits verified in git log
- Next.js build succeeds
- No file deletions detected
- No untracked generated files
