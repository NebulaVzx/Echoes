---
phase: 06-echo-assistant
reviewed: 2026-04-22T12:45:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - services/gateway/internal/chat/domain/conversation.go
  - services/gateway/internal/chat/repository/conversation_repository.go
  - services/gateway/internal/chat/service/chat_service.go
  - services/gateway/internal/chat/transport/chat_handler.go
  - services/gateway/internal/router/router.go
  - services/gateway/cmd/main.go
  - services/gateway/internal/middleware/auth.go
  - services/processor-service/app/services/llm/base.py
  - services/processor-service/app/services/llm/openai_provider.py
  - services/processor-service/app/services/llm/anthropic_provider.py
  - web/app/providers/chat-provider.tsx
  - web/lib/api.ts
  - web/types/chat.ts
  - web/lib/markdown.tsx
  - web/components/chat/chat-sidebar.tsx
  - web/components/chat/chat-message.tsx
  - web/components/chat/chat-message-list.tsx
  - web/components/chat/chat-input.tsx
  - web/components/chat/citation-footer.tsx
  - web/app/(main)/page.tsx
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-04-22T12:45:00Z
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Phase 06 implements the Echo Assistant chat feature with RAG orchestration. The backend Go chat package (domain/repository/service/transport) and frontend chat components are well-structured and follow existing codebase patterns. However, two critical security issues were found: (1) a broken JWT forwarding mechanism that will cause all RAG searches to fail in production, and (2) a potential auth bypass in the public route check. Additionally, there are several warnings around error handling, resource cleanup, and a significant logic bug in message history construction.

## Critical Issues

### CR-01: Broken JWT Forwarding for Memory Service Search

**File:** `services/gateway/internal/chat/service/chat_service.go:223`
**Issue:** The code attempts to extract `Authorization` from `ctx.Value("Authorization")`, but Gin middleware stores values via `c.Set("userID", ...)` — not in the Go `context.Context` values. The `ctx` passed to `searchMemories` is `c.Request.Context()`, which does NOT contain "Authorization". This means the Memory Service search call will never forward the JWT token, causing 401 errors in production when the Memory Service requires auth.

**Fix:** Pass the Authorization header explicitly from the handler to the service, or extract it from the Gin context at the handler level and pass it as a parameter:
```go
// In handler: pass auth header to service
authHeader := c.GetHeader("Authorization")
resp, err := h.service.SendMessage(c.Request.Context(), userID, &req, authHeader)

// In service: use the passed header instead of ctx.Value
func (s *ChatService) searchMemories(ctx context.Context, query string, userID uuid.UUID, authHeader string) {
    if authHeader != "" {
        req.Header.Set("Authorization", authHeader)
    }
}
```

### CR-02: Potential Auth Bypass via Path Traversal in Public Route Check

**File:** `services/gateway/internal/middleware/auth.go:98`
**Issue:** The `isPublicRoute` function uses `strings.HasPrefix(path, p+"/")` which can be bypassed with crafted paths like `/api/v1/auth/register/../memories/123`. While Gin's router normalizes paths before middleware runs in most cases, relying on string prefix matching without path normalization is a defense-in-depth gap. More critically, `/api/v1/auth` prefix matching could accidentally mark subpaths as public if new routes are added.

**Fix:** Use exact path matching or normalize the path before checking:
```go
func isPublicRoute(path string) bool {
    // Normalize path to prevent traversal bypasses
    cleanPath := filepath.Clean(path)
    publicPaths := []string{...}
    for _, p := range publicPaths {
        if cleanPath == p {
            return true
        }
    }
    return false
}
```

## Warnings

### WR-01: History Building Logic Bug — System Message Duplication

**File:** `services/gateway/internal/chat/service/chat_service.go:343-358`
**Issue:** The `buildMessages` function has a critical logic error in the history loop. On each iteration, it prepends a history message AND re-prepends the system message, causing the system message to be duplicated for every history entry. After 5 turns, the messages array will contain: `[system, msg1, system, msg2, system, msg3, ...]` instead of `[system, msg1, msg2, msg3, ...]`. This wastes tokens and may confuse the LLM.

**Fix:** Build history separately, then prepend system message once:
```go
historyMsgs := make([]map[string]string, 0, MaxHistoryMessages)
for i := len(history) - 1; i >= 0 && len(historyMsgs) < MaxHistoryMessages; i-- {
    if history[i].Role == "system" {
        continue
    }
    historyMsgs = append([]map[string]string{{
        "role": history[i].Role,
        "content": history[i].Content,
    }}, historyMsgs...)
}
messages := append([]map[string]string{{"role": "system", "content": systemContent}}, historyMsgs...)
messages = append(messages, map[string]string{"role": "user", "content": query})
```

### WR-02: Silent JSON Marshal Failure for Citations

**File:** `services/gateway/internal/chat/service/chat_service.go:157`
**Issue:** `citationsJSON, _ := json.Marshal(citations)` silently ignores marshal errors. If citations contain invalid data (e.g., NaN floats from similarity scores), the marshal could fail and store an empty JSON array without logging. The error is discarded with `_`.

**Fix:** Handle the error explicitly:
```go
citationsJSON, err := json.Marshal(citations)
if err != nil {
    s.logger.Error("failed to marshal citations", zap.Error(err))
    citationsJSON = []byte("[]")
}
```

### WR-03: Unbounded Request Body Size in Chat Handler

**File:** `services/gateway/internal/chat/transport/chat_handler.go:36`
**Issue:** `c.ShouldBindJSON(&req)` does not limit request body size. While the DTO has `max=10000` on the Content field, a malicious client could send a multi-gigabyte JSON payload to exhaust memory before validation runs.

**Fix:** Add a body size limit middleware or check in the handler:
```go
const maxBodySize = 1 << 20 // 1MB
c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBodySize)
if err := c.ShouldBindJSON(&req); err != nil {
    // handle error
}
```

### WR-04: Missing Request Body Close in HTTP Client Calls

**File:** `services/gateway/internal/chat/service/chat_service.go:229-232`, `432-435`
**Issue:** Both `searchMemories` and `callLLM` create HTTP requests with `bytes.NewReader(body)` but the request body is never explicitly closed. While `http.Client.Do` handles this for request bodies in most cases, it is best practice to ensure cleanup, especially for reusable `http.Client` instances.

**Fix:** This is low severity since `http.Client` auto-closes request bodies, but for defense-in-depth with custom transports, ensure `req.Body` is closed if set manually.

### WR-05: Race Condition in Chat Provider Token Refresh

**File:** `web/lib/api.ts:219-234`
**Issue:** The `refreshPromise` mechanism prevents duplicate refresh requests, but if the original request's `AbortSignal` is triggered during the refresh wait, the retry will still proceed with the stale signal. Also, `errorMessage.includes('token')` is overly broad and could match unrelated error messages (e.g., "tokenization error" from an LLM).

**Fix:** Narrow the auth error detection:
```typescript
const isAuthError =
  errorMessage.includes('TOKEN_EXPIRED') ||
  errorMessage.includes('UNAUTHORIZED') ||
  errorMessage.includes('Invalid or expired token') ||
  errorMessage.includes('refresh token');
```

## Info

### IN-01: Unused `isNewConversation` Dead Code

**File:** `services/gateway/internal/chat/service/chat_service.go:183-188`
**Issue:** The `isNewConversation` flag is set but never used meaningfully. The comment says "frontend will get conversation_id from the message" but the Message struct does not include a `conversation_id` field in the ChatResponse. The `conversation_id` is only on the Message struct itself, which is already returned.

**Fix:** Remove the dead code block or add `ConversationID` to `ChatResponse` if the frontend needs it.

### IN-02: Inconsistent Citation Type Between Backend and Frontend

**File:** `web/types/chat.ts:16-23`, `services/gateway/internal/chat/domain/conversation.go:31`
**Issue:** Backend stores citations as `datatypes.JSON` (raw JSONB), but frontend expects `citations: Citation[]`. The API response marshals the Go `datatypes.JSON` field directly, which should work if the backend always stores valid JSON arrays. However, there's no runtime guarantee — if the database contains malformed JSON, the frontend will receive a string instead of an array.

**Fix:** Add a custom JSON marshaler for the Message type that guarantees `citations` is always an array, or use a `[]Citation` type in the Go response DTO with explicit unmarshaling.

### IN-03: Missing `key` Prop Stability in Chat Message List

**File:** `web/components/chat/chat-message-list.tsx:28-29`
**Issue:** Messages use `message.id` as the React key. For optimistic messages, the ID is `temp-${Date.now()}`, which is fine. However, if the backend returns a message with the same content but a different ID (e.g., after retry), React will remount the component instead of updating it. This is minor but could cause scroll position jumps.

**Fix:** Consider using a combination of `conversation_id + created_at + role` as a stable key for messages without server-assigned IDs, or ensure the backend always returns the same ID for the same message.

---

_Reviewed: 2026-04-22T12:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
