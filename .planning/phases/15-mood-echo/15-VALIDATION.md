---
phase: 15
name: mood-echo
created: 2026-05-11
---

# Phase 15: 情绪与回响 (Mood & Echo) — Validation Strategy

## Test Framework

| Property | Value |
|----------|-------|
| Framework (Go) | Go testing + testify |
| Config file | services/memory-service/go.mod (implicit) |
| Quick run command | `cd services/memory-service && go test ./internal/... -run TestMood -v` |
| Full suite command | `cd services/memory-service && go test ./...` |

| Property | Value |
|----------|-------|
| Framework (Python) | pytest |
| Config file | services/processor-service/pytest.ini |
| Quick run command | `cd services/processor-service && pytest tests/ -k mood -v` |
| Full suite command | `cd services/processor-service && pytest tests/` |

| Property | Value |
|----------|-------|
| Framework (Frontend) | Jest (existing in web/) |
| Config file | web/package.json |
| Quick run command | `cd web && npm test -- --testNamePattern="Mood"` |
| Full suite command | `cd web && npm test` |

## Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MOOD-01 | memory_emotions table exists with correct schema | migration | `go test ./internal/repository/...` | Wave 0 |
| MOOD-02 | mood:generate Redis Stream publishes tasks | integration | `go test ./internal/service/...` | Wave 0 |
| MOOD-03 | LLM analyze_sentiment returns structured JSON | unit | `pytest tests/test_llm.py -k sentiment` | Wave 0 |
| MOOD-04 | MoodConsumer writes emotion data to DB | integration | `pytest tests/test_consumers.py -k mood` | Wave 0 |
| MOOD-05 | Batch backfill script processes all memories | integration | Manual script test | Wave 0 |
| MOOD-06 | GET /mood/calendar returns weighted avg data | unit | `go test ./internal/transport/... -run TestMoodCalendar` | Wave 0 |
| MOOD-07 | GET /mood/insight returns monthly summary | unit | `go test ./internal/transport/... -run TestMoodInsight` | Wave 0 |
| MOOD-08 | GET /memories/daily-review includes echo field | unit | `go test ./internal/transport/... -run TestDailyReviewEcho` | Wave 0 |
| MOOD-09 | Echo prompt generates text for all 4 styles | unit | `pytest tests/test_echo_prompts.py` | Wave 0 |
| MOOD-10 | /mood page renders heatmap with correct colors | e2e | `npm test -- --testNamePattern="MoodCalendar"` | Wave 0 |
| MOOD-11 | EchoCard displays echo with expand/collapse | e2e | `npm test -- --testNamePattern="EchoCard"` | Wave 0 |
| MOOD-12 | Style selector persists in localStorage | e2e | `npm test -- --testNamePattern="EchoStyle"` | Wave 0 |

## Sampling Rate

- **Per task commit:** Quick run command for affected subsystem (< 30s)
- **Per wave merge:** Full suite for affected services
- **Phase gate:** All Go tests + Python tests + frontend tests green before `/gsd-verify-work`

## Wave 0 Gaps

- [ ] `services/memory-service/internal/repository/emotion_repository_test.go` — covers MOOD-01, MOOD-06, MOOD-07
- [ ] `services/memory-service/internal/transport/mood_handler_test.go` — covers MOOD-06, MOOD-07, MOOD-08
- [ ] `services/processor-service/tests/test_mood_consumer.py` — covers MOOD-02, MOOD-03, MOOD-04
- [ ] `services/processor-service/tests/test_echo_service.py` — covers MOOD-09
- [ ] `web/components/mood/__tests__/mood-calendar.test.tsx` — covers MOOD-10
- [ ] `web/components/mood/__tests__/echo-card.test.tsx` — covers MOOD-11, MOOD-12
- [ ] `scripts/test_backfill.py` — covers MOOD-05

*(Wave 0 tasks in plans will create test scaffolds for these files)*
