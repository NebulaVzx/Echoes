---
phase: 14-memory-covers-weaving
plan: 01
subsystem: processor-service + memory-service
phase_number: 14
plan_number: 01
type: execute
wave: 1
requirements:
  - COV-01
  - COV-02
tech_stack:
  added:
    - Pillow (image processing)
    - DALL-E 3 API (image generation)
    - Pollinations.AI (fallback)
  patterns:
    - Redis Stream Consumer (existing pattern extended)
    - Async image generation with fallback chain
    - MinIO object storage for covers
key_files:
  created:
    - services/processor-service/app/consumers/cover_consumer.py
    - services/processor-service/app/services/image_processor.py
    - services/processor-service/app/consumers/test_cover_consumer.py
  modified:
    - services/processor-service/app/services/llm/openai_provider.py
    - services/processor-service/app/config.py
    - services/processor-service/app/main.py
    - services/processor-service/app/consumers/__init__.py
    - services/memory-service/internal/service/redis_queue.go
    - services/memory-service/internal/service/memory_service.go
    - services/memory-service/internal/transport/memory_handler.go
dependency_graph:
  requires: []
  provides:
    - cover:generate Redis Stream consumer
    - DALL-E 3 image generation with fallback
    - Memory Service cover task publishing
  affects:
    - services/processor-service/app/main.py (consumer startup)
    - services/memory-service/internal/service/memory_service.go (task publishing)
decisions:
  - "DALL-E 3 b64_json response format avoids URL expiry (Pitfall 1)"
  - "Pollinations.AI as dev fallback controlled by use_pollinations_fallback setting"
  - "og:image attempted first for link types before AI generation"
  - "Fallback cover uses HSL color from tag MD5 hash (matches frontend algorithm)"
  - "Cover generation non-blocking; frontend shows gradient+letter fallback"
metrics:
  duration_minutes: 45
  completed_date: "2026-05-09"
  tasks_completed: 3
  tests_passed: 28
---

# Phase 14 Plan 01: Cover Consumer Summary

**Cover async generation consumer.** Processor Service新增 CoverConsumer，通过 DALL-E 3 或 Pollinations.AI 生成封面图，Pillow 裁剪为 400x300，上传 MinIO，回写 memories.cover_url。

## What Was Built

### Backend (Processor Service)

1. **CoverConsumer** (`services/processor-service/app/consumers/cover_consumer.py`)
   - Inherits `RedisStreamConsumer`, stream="cover:generate"
   - Three-tier generation strategy:
     - **Links**: Try og:image first, fall back to AI generation
     - **Text/File**: Generate AI cover from title + summary
     - **All types**: Solid color + letter fallback if all AI fails
   - Uploads to MinIO `echoes-files` bucket at `covers/{user_id}/{memory_id}.jpg`
   - Reports completion via `memory_client.update_task_status`

2. **ImageProcessor** (`services/processor-service/app/services/image_processor.py`)
   - `generate_cover_image()`: DALL-E 3 via `b64_json` response format
   - `generate_cover_pollinations()`: Pollinations.AI free fallback
   - `crop_cover()`: Pillow `ImageOps.fit` to 400x300 JPEG quality=90
   - `create_fallback_cover()`: HSL color from tag MD5 + white letter
   - `upload_cover_to_minio()`: MinIO `put_object` with public URL return
   - `fetch_og_image()`: Scrapes og:image meta tag with relative URL resolution

3. **OpenAIProvider Extension** (`services/processor-service/app/services/llm/openai_provider.py`)
   - Added `generate_image()` method for DALL-E 3 image generation

4. **Config & Main** (`app/config.py`, `app/main.py`)
   - `enable_cover_consumer: bool = True`
   - `use_pollinations_fallback: bool = True`
   - CoverConsumer conditionally started in lifespan

### Backend (Memory Service)

5. **RedisTaskQueue** (`services/memory-service/internal/service/redis_queue.go`)
   - `PublishCoverGenerate()`: Publishes cover:generate tasks with user_id, content, tags, link metadata

6. **MemoryService** (`services/memory-service/internal/service/memory_service.go`)
   - `TaskQueue` interface extended with `PublishCoverGenerate`
   - `publishTasks()` calls `PublishCoverGenerate` for all content types
   - `RetryTask()` supports `cover:generate` retry

7. **MemoryHandler** (`services/memory-service/internal/transport/memory_handler.go`)
   - Retry endpoint validTypes includes `cover:generate`

### Tests

- **28 unit tests** covering all generation paths, fallback chain, og:image, file type, error handling
- All tests pass (`pytest app/consumers/test_cover_consumer.py -v`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Retry task validation missing cover:generate**
- **Found during:** Task 3 verification
- **Issue:** `RetryTask` validTypes map and `memory_handler.go` validTypes did not include `cover:generate`
- **Fix:** Added `cover:generate` to both validation maps and added retry switch case
- **Files modified:** `memory_service.go`, `memory_handler.go`
- **Commit:** `887dc46`

**2. [Rule 1 - Bug] Test environment missing OPENAI_API_KEY**
- **Found during:** Task 2 verification
- **Issue:** Tests mocking `generate_cover_image` still failed because the consumer checks for API key presence before calling DALL-E
- **Fix:** Added `patch.dict("os.environ", {"OPENAI_API_KEY": "sk-test-key"})` to all DALL-E path tests
- **Files modified:** `test_cover_consumer.py`
- **Commit:** `46fbc93`

**3. [Rule 3 - Blocking Issue] Missing opentelemetry and prometheus dependencies**
- **Found during:** Task 1 test execution
- **Issue:** `ModuleNotFoundError: No module named 'opentelemetry'` when running tests
- **Fix:** Installed `opentelemetry-api`, `opentelemetry-sdk`, `opentelemetry-instrumentation-fastapi`, `opentelemetry-exporter-otlp`, `prometheus_client`
- **Note:** These are runtime environment dependencies; not committed

## Known Stubs

None. All planned functionality is fully implemented and tested.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| T-14-01 mitigate | `openai_provider.py` | API key from env var, HTTPS only, never logged |
| T-14-02 mitigate | `image_processor.py` | Prompt extracts only title+200 chars, no user-controlled prompt |
| T-14-04 mitigate | `cover_consumer.py` | Async queue naturally throttles; Pollinations fallback for dev |
| T-14-05 mitigate | `image_processor.py` | Object path uses UUIDs: `covers/{user_id}/{memory_id}.jpg` |

## Self-Check

- [x] `cover_consumer.py` exists and inherits RedisStreamConsumer
- [x] `image_processor.py` exists with all exported functions
- [x] `openai_provider.py` has `generate_image` method
- [x] `config.py` has `enable_cover_consumer` and `use_pollinations_fallback`
- [x] `main.py` conditionally starts CoverConsumer
- [x] `redis_queue.go` has `PublishCoverGenerate`
- [x] `memory_service.go` TaskQueue interface includes new method
- [x] `publishTasks` calls `PublishCoverGenerate`
- [x] 28 unit tests pass
- [x] Processor service imports successfully
- [x] Memory service compiles successfully

## Self-Check: PASSED

## Commits

| Commit | Message | Files |
|--------|---------|-------|
| `6251a28` | test(14-01): add CoverConsumer and ImageProcessor with TDD tests | cover_consumer.py, image_processor.py, test_cover_consumer.py |
| `46fbc93` | feat(14-01): extend OpenAIProvider, config, and main for cover generation | openai_provider.py, config.py, main.py, test_cover_consumer.py |
| `1acacc0` | feat(14-01): Memory Service publishes cover:generate tasks | redis_queue.go, memory_service.go |
| `887dc46` | fix(14-01): add cover:generate to retry task validation and handler | memory_service.go, memory_handler.go |
| `2ec1e8f` | chore(14-01): export CoverConsumer from consumers __init__ | __init__.py |
