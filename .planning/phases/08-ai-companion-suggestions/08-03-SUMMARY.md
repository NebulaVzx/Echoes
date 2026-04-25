---
phase: 08
plan: 03
name: "Backend — Processor Service Suggestion Consumer"
subsystem: processor-service
tags: [ai-suggestions, processor, consumer, llm, prompts]
dependency_graph:
  requires: [08-01]
  provides: [08-04, 08-05]
  affects: [services/processor-service]
tech_stack:
  added: []
  patterns: [Redis Stream Consumer, LLM Provider Extension, Prompt Templates, Factory Pattern]
key_files:
  created:
    - services/processor-service/app/services/llm/prompts/__init__.py
    - services/processor-service/app/services/llm/prompts/suggestion_prompts.py
    - services/processor-service/app/consumers/suggestion_consumer.py
  modified:
    - services/processor-service/app/services/llm/base.py
    - services/processor-service/app/services/llm/openai_provider.py
    - services/processor-service/app/services/llm/anthropic_provider.py
    - services/processor-service/app/clients/memory_client.py
    - services/processor-service/app/config.py
    - services/processor-service/app/main.py
decisions:
  - "D-08-03-01: generate_suggestion delegates to existing generate() method with temp=0.8 default for warmer, more creative suggestions"
  - "D-08-03-02: Link suggestions work with URL only (no title/summary) since link_consumer may have already fetched them; future enhancement can pass fetched metadata"
metrics:
  duration: "12 minutes"
  completed_date: "2026-04-25"
  tasks: 5
  files_created: 3
  files_modified: 6
---

# Phase 8 Plan 03: Backend — Processor Service Suggestion Consumer Summary

**One-liner:** Implemented the complete Processor Service suggestion generation pipeline: prompt templates with style personas, LLM provider extension, Memory Service client extension, Redis Stream consumer, and full wiring in main.py.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create Suggestion Prompt Templates | 44dfa8a | `services/processor-service/app/services/llm/prompts/__init__.py`, `suggestion_prompts.py` |
| 2 | Extend LLM Provider with generate_suggestion | f937605 | `services/processor-service/app/services/llm/base.py`, `openai_provider.py`, `anthropic_provider.py` |
| 3 | Extend Memory Service Client | 19ca738 | `services/processor-service/app/clients/memory_client.py` |
| 4 | Create Suggestion Consumer | 8027e88 | `services/processor-service/app/consumers/suggestion_consumer.py` |
| 5 | Wire in main.py and config | de3c40d | `services/processor-service/app/config.py`, `main.py` |

## What Was Built

### Prompt Templates (`suggestion_prompts.py`)
- **`STYLE_PERSONAS`** — Three style modifiers: gentle (温柔体贴), practical (务实高效), inspiring (富有洞察力)
- **`build_text_suggestion_prompt`** — Warm, understanding tone, 50-150 Chinese characters, 5 content strategy cases (negative emotion, problem/confusion, learning notes, inspiration/creativity, daily life)
- **`build_link_suggestion_prompt`** — Knowledge/insight tone, 4 link strategy cases (technical article, news/info, tutorial/course, design/inspiration)
- **`determine_suggestion_type`** — Heuristic keyword-based classification into emotion_support, knowledge_expand, action_suggest, connection, general

### LLM Provider Extension
- **`LLMProvider.generate_suggestion`** — New abstract method with default max_tokens=200 (~150 Chinese chars)
- **`OpenAIProvider.generate_suggestion`** — Delegates to `generate()` with temperature=0.8 (warmer than default 0.7)
- **`AnthropicProvider.generate_suggestion`** — Same delegation pattern, consistent defaults

### Memory Service Client Extension
- **`MemoryServiceClient.create_suggestion`** — POSTs to `/api/v1/internal/memories/{memory_id}/suggestion`
- Payload: memory_id, content, optional suggestion_type, optional metadata
- Uses internal API Bearer token auth

### Suggestion Consumer (`suggestion_consumer.py`)
- **`SuggestionConsumer`** extends `RedisStreamConsumer`
- Stream: `suggestion:generate`, Group: `processor-group`, Consumer: `processor-suggestion-1`
- **`process_message`** flow:
  1. Extract memory_id, content_type, content, style, note from message fields
  2. Build appropriate prompt (text vs link) based on content_type
  3. Create LLM provider with per-message overrides (protocol, model, temperature, API key)
  4. Generate suggestion with timing measurement (latency_ms)
  5. Validate non-empty response
  6. Classify suggestion type heuristically
  7. Persist via `memory_client.create_suggestion()`
  8. Report completion via `memory_client.update_task_status()`
- Inherits exponential backoff retry (1s, 2s, 4s) and max_retries=3 from base class
- Logs only memory_id, latency, length — never full suggestion text or user content (per T-08-07)

### Wiring
- `enable_suggestion_consumer: bool = True` added to Settings
- SuggestionConsumer imported and started in lifespan when enabled
- Added to consumers list for proper graceful shutdown

## Deviations from Plan

None — plan executed exactly as written.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: information-disclosure | `services/processor-service/app/consumers/suggestion_consumer.py` | Logs only memory_id, latency, length — no full suggestion text or user content (mitigates T-08-07) |
| threat_flag: denial | `services/processor-service/app/consumers/suggestion_consumer.py` | Inherits exponential backoff retry (1s, 2s, 4s) from base class _process_with_retry (mitigates T-08-08) |

## Known Stubs

None.

## Self-Check: PASSED

- [x] `services/processor-service/app/services/llm/prompts/suggestion_prompts.py` exists with 3 functions and STYLE_PERSONAS
- [x] `services/processor-service/app/services/llm/prompts/__init__.py` exists as package marker
- [x] `services/processor-service/app/services/llm/base.py` has `generate_suggestion` abstract method
- [x] `services/processor-service/app/services/llm/openai_provider.py` has `generate_suggestion` implementation
- [x] `services/processor-service/app/services/llm/anthropic_provider.py` has `generate_suggestion` implementation
- [x] `services/processor-service/app/clients/memory_client.py` has `create_suggestion` method
- [x] `services/processor-service/app/consumers/suggestion_consumer.py` exists with `SuggestionConsumer` class
- [x] `services/processor-service/app/config.py` has `enable_suggestion_consumer` (default True)
- [x] `services/processor-service/app/main.py` imports and wires `SuggestionConsumer`
- [x] All Python files compile successfully (`python -m py_compile`)
- [x] All 5 commits verified in git log
- [x] No accidental file deletions
