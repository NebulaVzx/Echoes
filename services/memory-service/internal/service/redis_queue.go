// Package service provides Redis Stream task queue implementation.
package service

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
)

// RedisTaskQueue publishes async tasks to Redis Streams.
type RedisTaskQueue struct {
	client *redis.Client
}

// NewRedisTaskQueue creates a new Redis task queue.
func NewRedisTaskQueue() *RedisTaskQueue {
	redisAddr := os.Getenv("REDIS_URL")
	if redisAddr == "" {
		redisAddr = "redis:6379"
	}

	// Parse redis://host:port/db format to host:port
	if strings.HasPrefix(redisAddr, "redis://") {
		redisAddr = strings.TrimPrefix(redisAddr, "redis://")
		// Remove trailing /N (database number)
		if idx := strings.LastIndex(redisAddr, "/"); idx != -1 {
			redisAddr = redisAddr[:idx]
		}
	}

	client := redis.NewClient(&redis.Options{
		Addr: redisAddr,
	})

	return &RedisTaskQueue{client: client}
}

// PublishLinkFetch publishes a link fetch task to Redis Stream with optional LLM config.
// Accepts context for trace propagation per D-02.
func (q *RedisTaskQueue) PublishLinkFetch(ctx context.Context, memoryID uuid.UUID, linkURL string, note string, llmConfig map[string]interface{}) error {
	fields := map[string]interface{}{
		"memory_id": memoryID.String(),
		"link_url":  linkURL,
	}
	if note != "" {
		fields["note"] = note
	}
	mergeLLMConfig(fields, llmConfig)
	return q.PublishTask(ctx, "link:fetch", fields)
}

// PublishTextVectorize publishes a text vectorization task with optional LLM config.
// Accepts context for trace propagation per D-02.
func (q *RedisTaskQueue) PublishTextVectorize(ctx context.Context, memoryID uuid.UUID, content string, llmConfig map[string]interface{}) error {
	fields := map[string]interface{}{
		"memory_id": memoryID.String(),
		"content":   content,
	}
	mergeLLMConfig(fields, llmConfig)
	return q.PublishTask(ctx, "text:vectorize", fields)
}

// PublishTagGenerate publishes a tag generation task with optional LLM config.
// Accepts context for trace propagation per D-02.
func (q *RedisTaskQueue) PublishTagGenerate(ctx context.Context, memoryID uuid.UUID, content string, note string, llmConfig map[string]interface{}) error {
	fields := map[string]interface{}{
		"memory_id": memoryID.String(),
		"content":   content,
	}
	if note != "" {
		fields["note"] = note
	}
	mergeLLMConfig(fields, llmConfig)
	return q.PublishTask(ctx, "tag:generate", fields)
}

// PublishSuggestionGenerate publishes an AI suggestion generation task to Redis Stream.
// Accepts context for trace propagation per D-02.
func (q *RedisTaskQueue) PublishSuggestionGenerate(ctx context.Context, memoryID uuid.UUID, contentType string, content string, note string, style string, timeout int, maxRetries int, llmConfig map[string]interface{}) error {
	fields := map[string]interface{}{
		"memory_id":    memoryID.String(),
		"content_type": contentType,
		"content":      content,
		"style":        style,
		"timeout":      timeout,
		"max_retries":  maxRetries,
	}
	if note != "" {
		fields["note"] = note
	}
	mergeLLMConfig(fields, llmConfig)
	return q.PublishTask(ctx, "suggestion:generate", fields)
}

// PublishFileExtract publishes a file text extraction task to Redis Stream.
// Called after a file memory is created — the consumer will download from MinIO,
// extract text, and publish text:vectorize + tag:generate tasks.
func (q *RedisTaskQueue) PublishFileExtract(ctx context.Context, memoryID uuid.UUID, fileName string, mediaURL string, llmConfig map[string]interface{}) error {
	fields := map[string]interface{}{
		"memory_id":  memoryID.String(),
		"file_name":  fileName,
		"media_url":  mediaURL,
	}
	mergeLLMConfig(fields, llmConfig)
	return q.PublishTask(ctx, "file:extract", fields)
}

// mergeLLMConfig merges LLM settings into the message fields if present.
func mergeLLMConfig(fields map[string]interface{}, llmConfig map[string]interface{}) {
	if llmConfig == nil {
		return
	}
	for k, v := range llmConfig {
		if v != nil && v != "" {
			fields[k] = v
		}
	}
}

// PublishTask publishes a generic task to a Redis Stream.
// Injects traceparent from context per D-02 for distributed trace propagation.
func (q *RedisTaskQueue) PublishTask(ctx context.Context, stream string, fields map[string]interface{}) error {
	// Inject trace context into message fields using W3C Trace Context propagator
	carrier := propagation.MapCarrier{}
	propagator := otel.GetTextMapPropagator()
	propagator.Inject(ctx, carrier)
	if traceparent := carrier["traceparent"]; traceparent != "" {
		fields["traceparent"] = traceparent
	}

	_, err := q.client.XAdd(ctx, &redis.XAddArgs{
		Stream: stream,
		Values: fields,
	}).Result()
	if err != nil {
		return fmt.Errorf("failed to publish to stream %s: %w", stream, err)
	}
	return nil
}
