---
phase: 08
plan: 05
name: "Frontend — Memory Card + Detail Page"
subsystem: frontend
tags: [frontend, react, memory-card, detail-page]
dependency_graph:
  requires: [08-01, 08-02, 08-04]
  provides: []
  affects: [web]
tech_stack:
  added: []
  patterns: [React hooks, Framer Motion, Tailwind CSS]
key_files:
  created:
    - web/components/memory/suggestion-detail-section.tsx
  modified:
    - web/components/memory/memory-card.tsx
    - web/app/(main)/memory/[id]/page.tsx
    - web/lib/api.ts
---

# Plan 08-05 Summary

## What Was Built

AI suggestion display on memory cards (discovery) and detail pages (deep interaction).

### Components

1. **Memory Card Sparkles Marker** (`memory-card.tsx`)
   - Fetches suggestion on mount via `api.getSuggestion(memory.id)`
   - Shows ✨ (Sparkles) icon only when suggestion actually exists
   - CSS group-hover tooltip with first 60 chars of suggestion
   - Tooltip positioned above icon with arrow indicator
   - Fetch is cancellable (useEffect cleanup)
   - Amber-colored icon for subtle visual distinction

2. **Suggestion Detail Section** (`suggestion-detail-section.tsx`)
   - Full suggestion display on memory detail page
   - Loading skeleton while fetching
   - Returns null if no suggestion (section hidden)
   - Amber-themed card with content, type label, feedback buttons
   - Suggestion type labels: 情绪支持, 知识拓展, 行动建议, 关联发现, 一般建议
   - Feedback buttons: "有用" (liked) / "不用了" (disliked)
   - Shows confirmation text after feedback
   - Creation timestamp formatted in Chinese locale
   - Framer Motion fade-in animation

3. **Detail Page Integration** (`memory/[id]/page.tsx`)
   - `SuggestionDetailSection` imported and rendered
   - Placed between action buttons and RelatedMemories section
   - `memoryId` prop passed correctly

### API Types

- `MemoryWithSuggestion` interface added to `web/lib/api.ts`

## Deviations

None. All tasks completed per plan.

## Verification

- [x] `npm run build` in web/ directory succeeds
- [x] `grep -c "Sparkles" web/components/memory/memory-card.tsx` >= 1
- [x] `grep -c "SuggestionDetailSection" web/app/(main)/memory/[id]/page.tsx` >= 1

## Self-Check

**PASSED**
