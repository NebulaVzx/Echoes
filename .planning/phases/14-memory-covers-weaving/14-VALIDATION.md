---
phase: 14
name: memory-covers-weaving
title: 记忆封面与AI编织
date: 2026-05-09
---

# Phase 14 Validation Strategy

## Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (frontend) + Go testing (backend) |
| Config file | `web/package.json` scripts (jest), Go default |
| Quick run command | `cd web && npm test -- --testPathPattern="memory-card"` |
| Full suite command | `cd web && npm test && cd ../services/memory-service && go test ./...` |

## Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COV-01 | CoverConsumer processes message and generates image | unit | `pytest services/processor-service/app/consumers/test_cover_consumer.py` | No (Wave 0) |
| COV-02 | Redis Stream `cover:generate` publishes and consumes | integration | Manual (needs Redis + DALL-E key) | No (Wave 0) |
| COV-03 | Cover URL returned in memory list response | unit | `go test ./services/memory-service/... -run TestListMemories` | Partial (existing) |
| COV-05 | Fallback cover generated on DALL-E failure | unit | `pytest services/processor-service/...` | No (Wave 0) |
| WEA-01 | Multi-select Ctrl+click toggles selection | e2e | `playwright test web/e2e/weave.spec.ts` | No (Wave 0) |
| WEA-02 | Weave API creates memory with content_type="weave" | unit | `go test ./services/memory-service/... -run TestCreateWeave` | No (Wave 0) |
| WEA-05 | Markdown export downloads .md file | e2e | `playwright test web/e2e/weave-export.spec.ts` | No (Wave 0) |

## Sampling Rate

- **Per task commit:** `cd web && npm run build` (frontend) + `cd services/memory-service && go build ./...` (backend)
- **Per wave merge:** Full build + TypeScript check + Go compile
- **Phase gate:** Full suite green before `/gsd-verify-work`

## Wave 0 Gaps

- [ ] `services/processor-service/app/consumers/test_cover_consumer.py` — covers COV-01, COV-05
- [ ] `services/memory-service/internal/transport/memory_handler_test.go` — weave endpoint test
- [ ] `web/e2e/weave.spec.ts` — multi-select + weave flow
- [ ] `web/e2e/weave-export.spec.ts` — Markdown export
