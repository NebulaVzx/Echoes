---
phase: 06-echo-assistant
plan: 04
subsystem: frontend
tags: [nextjs, react, typescript, tailwind, framer-motion, markdown, chat-ui]

requires:
  - phase: 06-01
    provides: "Chat domain models (Conversation, Message, Citation)"
  - phase: 06-02
    provides: "LLM Provider chat() interface for multi-turn generation"
  - phase: 06-03
    provides: "Go Chat service with RAG orchestration and REST API endpoints"
provides:
  - "Complete set of chat UI components in web/components/chat/"
  - "Markdown renderer with GFM, syntax highlighting, and inline citation badges"
  - "Chat TypeScript types in web/types/chat.ts"
  - "Framer Motion sidebar slide animation with mobile backdrop"
affects:
  - "06-05 (integration: ChatProvider, API client, homepage wiring)"

tech-stack:
  added:
    - "react-markdown ^9.1.0"
    - "remark-gfm ^4.0.1"
    - "rehype-highlight ^7.0.2"
    - "highlight.js ^11.11.1"
  patterns:
    - "Pure presentational components receiving data via props and callbacks"
    - "Framer Motion AnimatePresence + motion.aside for sidebar slide animation"
    - "react-markdown wrapped in div for className support (prose typography)"
    - "Citation markers [N] split and rendered as clickable badges linking to /memory/{id}"
    - "Tailwind dark: classes for dark mode throughout all components"

key-files:
  created:
    - "web/types/chat.ts"
    - "web/lib/markdown.tsx"
    - "web/components/chat/chat-sidebar.tsx"
    - "web/components/chat/chat-header.tsx"
    - "web/components/chat/chat-message-list.tsx"
    - "web/components/chat/chat-message.tsx"
    - "web/components/chat/chat-input.tsx"
    - "web/components/chat/chat-history-list.tsx"
    - "web/components/chat/chat-history-item.tsx"
    - "web/components/chat/typing-indicator.tsx"
    - "web/components/chat/citation-footer.tsx"
  modified:
    - "web/package.json"
    - "web/lib/markdown.tsx"

key-decisions:
  - "ReactMarkdown className prop not supported in v9; wrap in div with prose classes instead"
  - "Citation parsing uses string split by [\\d+] regex, rendering each segment with ReactMarkdown or as clickable badge"
  - "Chat sidebar uses fixed positioning with z-50, mobile backdrop at z-40, full-width on mobile and 400px on desktop"
  - "All components are 'use client' since they use React state, effects, and event handlers"
  - "Textarea input with Enter-to-send and Shift+Enter for newline (standard chat UX)"

patterns-established:
  - "Chat components follow single-responsibility: each file exports one default component"
  - "Props interface named {ComponentName}Props for consistency"
  - "Callback props use simple function signatures (onSend, onSelect, onDelete) rather than event objects"
  - "Dark mode via Tailwind dark: prefix on all color-related classes"
  - "Lucide icons used consistently (Sparkles, Send, X, History, Plus, MessageSquare, Trash2, ExternalLink, ArrowLeft)"

requirements-completed:
  - CHAT-01
  - CHAT-03
  - CHAT-04
  - CHAT-05
  - CHAT-11

duration: 20min
completed: 2026-04-22
---

# Phase 6 Plan 4: Frontend Chat UI Components Summary

**Complete set of chat UI components for Echo Assistant: sidebar with Framer Motion animation, message bubbles with Markdown rendering and inline citations, typing indicator, conversation history, and input area — all with dark mode support.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-04-22T03:59:11Z
- **Completed:** 2026-04-22T04:19:11Z
- **Tasks:** 2
- **Files created:** 11
- **Files modified:** 2

## Accomplishments

- Chat TypeScript types (`web/types/chat.ts`): Conversation, Message, Citation, SendMessageRequest, SendMessageResponse, ListConversationsResponse, ListMessagesResponse
- Markdown renderer (`web/lib/markdown.tsx`): ReactMarkdown with remark-gfm, rehype-highlight, github-dark theme, inline citation badge parsing
- Chat sidebar (`chat-sidebar.tsx`): Framer Motion slide-in from right, mobile backdrop, 400px desktop width, history/message view toggle
- Chat header (`chat-header.tsx`): Echo Assistant branding, new chat, history toggle, close buttons
- Chat message list (`chat-message-list.tsx`): Auto-scroll to bottom, empty state, typing indicator integration
- Chat message (`chat-message.tsx`): User messages (blue bubble, right-aligned), assistant messages (white/gray bubble, left-aligned), citation footer
- Chat input (`chat-input.tsx`): Textarea with focus ring, Enter-to-send, Shift+Enter newline, disabled state during loading
- Chat history list (`chat-history-list.tsx`): Conversation list with new chat button, empty state
- Chat history item (`chat-history-item.tsx`): Title display, active state highlighting, hover delete button
- Typing indicator (`typing-indicator.tsx`): Three-dot pulsing bounce animation with staggered delays
- Citation footer (`citation-footer.tsx`): Source cards with index badge, title, external link icon, linking to memory detail

## Task Commits

Each task was committed atomically:

1. **Task 1: Create chat types and Markdown renderer with citations** - `7763ffe` (feat)
2. **Task 2: Create all chat UI components** - `70d010e` (feat)

## Files Created/Modified

### Created
- `web/types/chat.ts` - Chat TypeScript types (Conversation, Message, Citation, request/response DTOs)
- `web/components/chat/chat-sidebar.tsx` - Main sidebar container with Framer Motion slide animation
- `web/components/chat/chat-header.tsx` - Header with branding and action buttons
- `web/components/chat/chat-message-list.tsx` - Scrollable message area with auto-scroll
- `web/components/chat/chat-message.tsx` - Message bubble with Markdown + citation support
- `web/components/chat/chat-input.tsx` - Textarea input with send button
- `web/components/chat/chat-history-list.tsx` - Conversation list panel
- `web/components/chat/chat-history-item.tsx` - Single conversation list item
- `web/components/chat/typing-indicator.tsx` - Three-dot loading animation
- `web/components/chat/citation-footer.tsx` - Source reference cards

### Modified
- `web/lib/markdown.tsx` - Markdown renderer with ReactMarkdown, remark-gfm, rehype-highlight, citation parsing
- `web/package.json` - Added react-markdown, remark-gfm, rehype-highlight, highlight.js dependencies

## Decisions Made

- ReactMarkdown v9 does not support `className` prop directly; wrap in `<div className="prose ...">` instead
- Citation parsing splits content by `[\d+]` regex, rendering text segments through ReactMarkdown and citation markers as clickable `<a>` badges
- Sidebar uses `fixed top-0 right-0` with `z-50`, mobile backdrop at `z-40`, responsive width `w-full sm:w-[400px]`
- All components marked `'use client'` since they use React hooks (useState, useEffect, useRef) and event handlers
- Chat input uses `<textarea>` (not `<input>`) to support multi-line messages with Shift+Enter

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ReactMarkdown className prop type error**
- **Found during:** Task 1 (markdown renderer creation)
- **Issue:** `react-markdown` v9 TypeScript types do not include `className` prop; passing it causes TS2322 error
- **Fix:** Wrapped `<ReactMarkdown>` in a `<div>` with `className="prose prose-sm dark:prose-invert max-w-none"` instead of passing className directly to ReactMarkdown
- **Files modified:** `web/lib/markdown.tsx`
- **Verification:** `cd web && npx tsc --noEmit` exits 0
- **Committed in:** 70d010e (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor TypeScript compatibility fix. No scope creep.

## Issues Encountered

- None beyond the ReactMarkdown className type incompatibility which was auto-fixed inline

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| threat_flag: xss-mitigation | `web/lib/markdown.tsx` | ReactMarkdown escapes HTML by default; no raw HTML injection risk |
| threat_flag: citation-spoofing | `web/components/chat/chat-message.tsx` | Citation memory_ids come from backend (user-scoped search); frontend only renders what backend provides |

## Known Stubs

| File | Line | Description | Reason |
|------|------|-------------|--------|
| `chat-sidebar.tsx` | props | `messages`, `conversations`, `onSendMessage`, etc. are passed as props | These will be wired by ChatProvider in 06-05; components are pure presentational |
| `chat-message.tsx` | ~16 | `message.citations` may be empty for non-RAG responses | Expected behavior; CitationFooter only renders when citations exist |

## Next Phase Readiness

- All chat UI components are ready for integration in 06-05
- 06-05 will create: `ChatProvider` (React Context), extend `web/lib/api.ts` with chat API methods, wire `ChatSidebar` into homepage header
- Backend API endpoints from 06-03 are ready to receive calls from the frontend

## Self-Check: PASSED

- [x] `web/types/chat.ts` exists with all required interfaces
- [x] `web/lib/markdown.tsx` exists and exports `MarkdownRenderer`
- [x] `web/components/chat/chat-sidebar.tsx` exists with Framer Motion animation
- [x] `web/components/chat/chat-header.tsx` exists with close/history/new buttons
- [x] `web/components/chat/chat-message-list.tsx` exists with auto-scroll
- [x] `web/components/chat/chat-message.tsx` exists with user/assistant styling
- [x] `web/components/chat/chat-input.tsx` exists with textarea + send button
- [x] `web/components/chat/chat-history-list.tsx` exists with conversation list
- [x] `web/components/chat/chat-history-item.tsx` exists with delete button on hover
- [x] `web/components/chat/typing-indicator.tsx` exists with 3 bouncing dots
- [x] `web/components/chat/citation-footer.tsx` exists with source cards
- [x] All components are 'use client'
- [x] All components use `dark:` Tailwind classes
- [x] TypeScript compilation passes: `cd web && npx tsc --noEmit` exits 0
- [x] Commit 7763ffe exists
- [x] Commit 70d010e exists

---
*Phase: 06-echo-assistant*
*Completed: 2026-04-22*
