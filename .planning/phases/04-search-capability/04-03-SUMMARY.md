---
phase: 04-search-capability
plan: 03
subsystem: web-frontend
tags: [search, ui, nextjs, semantic-search, related-memories]
dependency_graph:
  requires: [04-02]
  provides: []
  affects: [web/lib/api.ts, web/components/search/*, web/app/(main)/*]
tech-stack:
  added: []
  patterns:
    - React Suspense for search params hydration
    - Client-side data fetching with useEffect
    - Reusable search input component
    - Similarity score display (percentage)
key-files:
  created:
    - web/components/search/search-input.tsx
    - web/components/search/related-memories.tsx
    - web/app/(main)/search/page.tsx
  modified:
    - web/lib/api.ts
    - web/app/(main)/page.tsx
    - web/app/(main)/memory/[id]/page.tsx
decisions: []
metrics:
  duration: "~15 minutes"
  completed_date: "2026-04-21"
---

# Phase 04 Plan 03: Frontend Search Interface Summary

**One-liner:** Next.js search UI with top-nav search input, semantic results page with similarity scores, and "你可能还感兴趣" related memories on detail pages.

## What Was Built

### 1. API Layer (web/lib/api.ts)

Added search and related-memories API methods to the existing ApiClient:

- `SearchResult` interface — extends `Memory` with `similarity: number`
- `SearchResponse` interface — `{ results: SearchResult[], query: string }`
- `RelatedResponse` interface — `{ results: SearchResult[], memory_id: string }`
- `searchMemories({ q, limit? })` — calls `GET /api/v1/search?q=...&limit=...`
- `getRelatedMemories(id, { limit? })` — calls `GET /api/v1/memories/:id/related?limit=...`

### 2. SearchInput Component (web/components/search/search-input.tsx)

Reusable client-side search input with:

- Search icon (magnifying glass SVG) inside the input
- Placeholder: "搜索你的记忆..."
- On Enter/submit, navigates to `/search?q={encodeURIComponent(query)}`
- Dark mode compatible styling
- Responsive: flex-1 with max-w-md, centers in available header space

### 3. Search Results Page (web/app/(main)/search/page.tsx)

Full search results page with:

- Header with logo, SearchInput, and theme toggle (consistent with other pages)
- Query display: `"{query}" 的搜索结果`
- Result count when results exist
- Loading state: "搜索中..."
- Error state with red error message
- Empty state with search icon and friendly message: `没有找到相关记忆，换个关键词试试？`
- Results displayed as MemoryCard components with similarity badge: `相关度 X%`
- React Suspense boundary for useSearchParams hydration safety
- Single-column layout: `max-w-3xl mx-auto px-4`

### 4. RelatedMemories Component (web/components/search/related-memories.tsx)

Related memories section for memory detail pages:

- Fetches up to 3 related memories via `getRelatedMemories(memoryId, { limit: 3 })`
- Heading: "你可能还感兴趣"
- Loading state shows heading + "加载中..."
- Returns `null` when no related memories found (section hidden)
- Displays MemoryCard + similarity score for each result
- Silently fails on errors (non-critical feature)

### 5. Nav Integration

SearchInput integrated into headers on:

- Homepage (`web/app/(main)/page.tsx`)
- Memory detail page (`web/app/(main)/memory/[id]/page.tsx`)
- Search page (`web/app/(main)/search/page.tsx`)

Consistent header layout across all pages:
```
[Logo + Echoes + 拾忆] | [SearchInput] | [ThemeToggle + user actions]
```

## Deviations from Plan

None — plan executed exactly as written.

## Auth Gates

None encountered.

## Known Stubs

None. All components are fully wired to real API endpoints.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| None | — | No new security-relevant surface introduced |

## Verification

- [x] TypeScript compilation passes: `cd web && npx tsc --noEmit`
- [x] Next.js build passes: `cd web && npm run build` (8 routes including /search)
- [x] SearchInput navigates to `/search?q={query}` on Enter
- [x] Search page displays results with `相关度 X%` similarity scores
- [x] Empty search shows friendly Chinese message
- [x] RelatedMemories component fetches and displays up to 3 related memories
- [x] All pages use consistent single-column layout (`max-w-3xl`)
- [x] Dark mode compatible on all new components

## Self-Check: PASSED

- [x] `web/components/search/search-input.tsx` exists
- [x] `web/components/search/related-memories.tsx` exists
- [x] `web/app/(main)/search/page.tsx` exists
- [x] `web/lib/api.ts` modified with search methods
- [x] `web/app/(main)/page.tsx` modified with SearchInput
- [x] `web/app/(main)/memory/[id]/page.tsx` modified with SearchInput + RelatedMemories
- [x] Commit 60c4b1b exists (API methods)
- [x] Commit 2ff1674 exists (SearchInput + nav integration)
- [x] Commit c39094e exists (Search page + RelatedMemories)
- [x] Commit f5b9996 exists (gitignore update)
