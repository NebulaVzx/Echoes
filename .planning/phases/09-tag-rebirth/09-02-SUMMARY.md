# 09-02 Summary: Backend Tag APIs

**Status:** Complete
**Wave:** 1

## What was done

Implemented tag-related backend APIs in Memory Service: list all tags with stats, get related tags (co-occurrence), merge tags, and extended memory list to support multi-tag AND filtering.

### Files changed
- `services/memory-service/internal/domain/tag.go` (new)
  - `TagStats` — tag name, memory count, last used time
  - `RelatedTag` — tag name + co-occurrence count
  - `MergeTagsRequest` — source/target tag for merge
- `services/memory-service/internal/repository/tag_repository.go` (new)
  - `GetAllTags` — UNNEST aggregation query for per-user tag stats
  - `GetRelatedTags` — co-occurrence query using self-join on memories
  - `MergeTags` — atomic UPDATE replacing source tag with target tag via ARRAY CASE
- `services/memory-service/internal/repository/memory_repository.go`
  - `ListByUser` signature changed from `tag string` to `tags []string`
  - Uses `tags @> ?` with `pq.Array(tags)` for multi-tag AND filtering
  - Single-tag backward compatibility preserved (1-element array)
- `services/memory-service/internal/service/tag_service.go` (new)
  - `GetAllTags`, `GetRelatedTags`, `MergeTags` business logic
  - Merge normalizes to lowercase, trims whitespace, rejects self-merge
- `services/memory-service/internal/transport/tag_handler.go` (new)
  - `GET /tags` — list all tags with stats
  - `GET /tags/:name/related` — get related tags
  - `POST /tags/merge` — merge two tags
- `services/memory-service/internal/transport/memory_handler.go`
  - List handler uses `c.QueryArray("tags")` for multi-tag filtering
  - Backward compatibility: `?tag=single` still works
- `services/memory-service/internal/service/memory_service.go`
  - `List` signature updated to accept `tags []string`
- `services/memory-service/cmd/main.go`
  - Wired `TagRepository`, `TagService`, `TagHandler` into DI
- `services/gateway/internal/router/router.go`
  - `ResponseHeaderTimeout` increased from 10s to 60s to accommodate LLM API calls (e.g. tag categorization)

### Key decisions
- Multi-tag filtering uses PostgreSQL `@>` operator (array containment) for AND semantics
- Tag merge is atomic at DB level; no need for transaction wrapper in service layer
- Related tags use memory self-join + co-occurrence count for relevance ranking

### Verification
- `go build ./services/memory-service/...` passes
- `GET /api/v1/tags` returns tag list with counts
- `GET /api/v1/tags/:name/related` returns co-occurring tags
- `POST /api/v1/tags/merge` replaces source with target across all memories
- `GET /api/v1/memories?tags=tag1&tags=tag2` returns memories matching both tags
