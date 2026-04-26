# 09-03 Summary: Frontend Tag Filter Integration

**Status:** Complete
**Wave:** 2

## What was done

Integrated tag filtering into the homepage with single/multi-select AND filtering, tag color display on memory cards, and related tags on the memory detail page.

### Files changed
- `web/lib/api.ts`
  - Added `TagInfo`, `RelatedTagsResponse` interfaces
  - Extended `listMemories` to support `tags?: string[]` parameter
  - Added `getTags()`, `getRelatedTags()`, `mergeTags()` methods
  - Extended `UserSettings` / `UpdateSettingsRequest` with tag metadata and categories
- `web/components/memory/tag-filter-bar.tsx` (new)
  - Fetches top tags via `api.getTags()`
  - Displays tags as clickable pills with 16-color preset palette
  - Selected state: dark background + white text
  - Shows "清除全部" when tags are selected
  - Supports `maxVisible` limit with "更多 →" link to `/tags`
  - Color mapping via `TAG_COLOR_PRESETS` with dark mode support
- `web/app/(main)/page.tsx`
  - Added `selectedTags` state
  - `loadMemories` passes `tags: selectedTags` to API
  - Memories reload when selected tags change
  - `handleTagClick` adds clicked tag to filter (prevents duplicates)
  - Added "标签" navigation link in header
- `web/components/memory/memory-card.tsx`
  - Tags display with user-configured colors from settings
  - Tags are clickable (with `stopPropagation` to prevent navigation)
  - `onTagClick` prop bubbles up to homepage filter
- `web/components/memory/memory-list.tsx`
  - Passes `onTagClick` through to `MemoryCard`
- `web/app/(main)/memory/[id]/page.tsx`
  - Added "相关标签" section fetching related tags via `api.getRelatedTags`
  - Related tags link back to homepage with filter applied

### Key decisions
- Tag filter bar is only shown when tags exist (avoids empty state clutter)
- Tag colors come from user settings `tag_metadata`, falling back to preset palette rotation
- Clicking a tag on a memory card adds it to the homepage filter (navigation without page reload)

### Verification
- Homepage shows tag filter bar with colored pills
- Multi-tag selection filters memories with AND semantics
- Clicking tag on memory card adds it to filter
- Memory detail page shows related tags section
- Dark mode colors render correctly
