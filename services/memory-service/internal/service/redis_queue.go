// Package service provides Redis Stream task queue implementation.
package service

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
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
func (q *RedisTaskQueue) PublishLinkFetch(memoryID uuid.UUID, linkURL string, llmConfig map[string]interface{}) error {
	fields := map[string]interface{}{
		"memory_id": memoryID.String(),
		"link_url":  linkURL,
	}
	mergeLLMConfig(fields, llmConfig)
	return q.publish("link:fetch", fields)
}

// PublishTextVectorize publishes a text vectorization task with optional LLM config.
func (q *RedisTaskQueue) PublishTextVectorize(memoryID uuid.UUID, content string, llmConfig map[string]interface{}) error {
	fields := map[string]interface{}{
		"memory_id": memoryID.String(),
		"content":   content,
	}
	mergeLLMConfig(fields, llmConfig)
	return q.publish("text:vectorize", fields)
}

// PublishTagGenerate publishes a tag generation task with optional LLM config.
func (q *RedisTaskQueue) PublishTagGenerate(memoryID uuid.UUID, content string, llmConfig map[string]interface{}) error {
	fields := map[string]interface{}{
		"memory_id": memoryID.String(),
		"content":   content,
	}
	mergeLLMConfig(fields, llmConfig)
	return q.publish("tag:generate", fields)
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
func (q *RedisTaskQueue) PublishTask(ctx context.Context, stream string, fields map[string]interface{}) error {
	_, err := q.client.XAdd(ctx, &redis.XAddArgs{
		Stream: stream,
		Values: fields,
	}).Result()
	if err != nil {
		return fmt.Errorf("failed to publish to stream %s: %w", stream, err)
	}
	return nil
}

// publish adds a message to a Redis Stream.
func (q *RedisTaskQueue) publish(stream string, fields map[string]interface{}) error {
	return q.PublishTask(context.Background(), stream, fields)
}
