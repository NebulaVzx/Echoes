---
phase: 14-memory-covers-weaving
plan: 02
status: complete
completed: 2026-05-09
---

# Plan 14-02 Summary: Weave API

## Objective
实现 AI 编织 API。扩展 domain 验证支持 content_type="weave" 和 task_type="cover:generate"，新增 POST /api/v1/memories/weave 端点，支持四种编织模式（article/story/summary/todo），生成带来源标注的编织文章并持久化为新 memory。

## Tasks Completed

### Task 1: 更新 Domain 验证绑定
- `CreateMemoryRequest.ContentType` binding 从 `oneof=text link file` 扩展为 `oneof=text link file weave`
- `TaskStatusUpdate.TaskType` binding 扩展为包含 `cover:generate`
- 新增 `WeaveRequest` domain 类型（SourceIDs, Mode, Title）
- 新增 `WeaveMode` 常量（article/story/summary/todo）

### Task 2: 实现 WeaveMemories 服务方法
- `WeaveMemories` 方法：验证 source memories 所有权，构建 LLM prompt，调用 LLM，创建 weave memory
- `buildWeavePrompt` 方法：根据 mode 选择模板，为每条记忆生成编号内容块
- `extractWeaveContent` 方法：按 content_type 提取合适的内容片段
- `appendSourceList` 方法：自动附加来源列表
- `callLLMForWeave` / `callOpenAIForWeave` / `callAnthropicForWeave`：复用现有 LLM 调用模式，max_tokens=2000，temperature=0.7
- 支持 OpenAI 和 Anthropic 协议

### Task 3: 添加 Weave HTTP Handler 端点
- `POST /api/v1/memories/weave` 端点注册在 `/memories` 路由组
- `Weave` handler：验证请求，调用服务，返回 201 + weave memory
- `RetryTask` validTypes map 已包含 `cover:generate`

## Deviations from Plan

**[Rule 1 - Bug] PublishCoverGenerate signature mismatch** — 14-01 代理实现的 `PublishCoverGenerate` 包含 `userID uuid.UUID` 参数（在 `redis_queue.go` 和 `TaskQueue` 接口中）。计划中的示例代码缺少此参数。实际实现使用带 userID 的版本，与 14-01 保持一致。

## Key Files Created/Modified

| File | Change |
|------|--------|
| `services/memory-service/internal/domain/memory.go` | Added WeaveRequest, WeaveMode, updated bindings |
| `services/memory-service/internal/service/memory_service.go` | Added WeaveMemories + 6 helper methods |
| `services/memory-service/internal/transport/memory_handler.go` | Added Weave handler + route registration |
| `services/memory-service/internal/service/memory_service_test.go` | Added PublishCoverGenerate to mock, 6 weave tests |

## Self-Check: PASSED

- `go build ./...` 无错误
- `go test ./internal/service/...` 全部通过
- CreateMemoryRequest binding 包含 "weave"
- TaskStatusUpdate binding 包含 "cover:generate"
- POST /api/v1/memories/weave 端点可用
- 四种 mode 使用不同 prompt 模板
- weave memory metadata 包含 weave_source_ids 和 weave_mode

## Commits

- `f7a858c` feat(14-02): update domain validations for weave and cover:generate
- `TBD` feat(14-02): implement WeaveMemories service method with LLM integration
- `TBD` feat(14-02): add Weave HTTP handler and route registration
- `TBD` test(14-02): add weave tests and mockTaskQueue fix