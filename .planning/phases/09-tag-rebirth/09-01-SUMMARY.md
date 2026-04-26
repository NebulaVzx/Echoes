# 09-01 Summary: Database Schema + User Settings Extension

**Status:** Complete
**Wave:** 1

## What was done

Extended `users.settings` JSONB to support per-user tag metadata (colors) and tag categories without breaking existing settings.

### Files changed
- `services/user-service/internal/domain/auth.go`
  - Added `TagMeta` struct with `Color` field
  - Added `TagCategory` struct with `Name` and `Tags` fields
  - Extended `UserSettings` with `TagMetadata map[string]TagMeta` and `TagCategories []TagCategory`
  - Extended `UpdateSettingsRequest` with `Tags map[string]TagMeta` and `TagCategories *[]TagCategory`
- `services/user-service/internal/service/auth_service.go`
  - `GetUserSettings` now returns `TagMetadata` and `TagCategories` from stored settings
  - `UpdateUserSettings` merges incoming tag metadata and categories into existing settings
- `shared/migrations/002_tag_support.sql` was not needed (existing schema sufficient; `users.settings` JSONB already exists)

### Key decisions
- Tag colors are stored per-user in `users.settings`, not in a global table — keeps schema simple and allows personalized color schemes
- No separate migration needed because `users.settings` is already JSONB with default `{}`

### Verification
- `go build ./services/user-service/...` passes
- API `GET /auth/me/settings` returns `tag_metadata` and `tag_categories` correctly
- API `PUT /auth/me/settings` persists tag metadata and categories
