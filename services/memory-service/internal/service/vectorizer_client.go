// Package service provides the Vectorizer HTTP client with Redis caching.
package service

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

// VectorizerClient calls the Vectorizer Service HTTP API to encode text to vectors.
type VectorizerClient struct {
	baseURL     string
	httpClient  *http.Client
	redisClient *redis.Client
}

// NewVectorizerClient creates a new vectorizer client.
func NewVectorizerClient() *VectorizerClient {
	baseURL := os.Getenv("VECTORIZER_SERVICE_URL")
	if baseURL == "" {
		baseURL = "http://vectorizer-service:8004"
	}

	redisAddr := os.Getenv("REDIS_URL")
	if redisAddr == "" {
		redisAddr = "redis:6379"
	}
	if strings.HasPrefix(redisAddr, "redis://") {
		redisAddr = strings.TrimPrefix(redisAddr, "redis://")
		if idx := strings.LastIndex(redisAddr, "/"); idx != -1 {
			redisAddr = redisAddr[:idx]
		}
	}

	return &VectorizerClient{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: 10 * time.Second},
		redisClient: redis.NewClient(&redis.Options{
			Addr: redisAddr,
		}),
	}
}

type encodeRequest struct {
	Text string `json:"text"`
}

type encodeResponse struct {
	Vector    []float64 `json:"vector"`
	Dimension int       `json:"dimension"`
}

// EncodeQuery converts a search query text to a pgvector-compatible vector string.
// Caches results in Redis with key "search_vector:{query_hash}" and TTL 1 hour.
// Returns error with message "搜索服务暂不可用" on vectorizer failure.
func (c *VectorizerClient) EncodeQuery(ctx context.Context, query string) (string, error) {
	// Check Redis cache first
	queryHash := sha256Hash(query)
	cacheKey := fmt.Sprintf("search_vector:%s", queryHash)
	cached, err := c.redisClient.Get(ctx, cacheKey).Result()
	if err == nil && cached != "" {
		return cached, nil
	}

	// Call Vectorizer Service
	reqBody, _ := json.Marshal(encodeRequest{Text: query})
	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/encode", bytes.NewReader(reqBody))
	if err != nil {
		return "", fmt.Errorf("搜索服务暂不可用")
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("搜索服务暂不可用")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("搜索服务暂不可用")
	}

	var result encodeResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("搜索服务暂不可用")
	}

	// Convert to pgvector literal: [0.1,0.2,...]
	vectorStr := vectorToPgVectorLiteral(result.Vector)

	// Cache in Redis for 1 hour
	_ = c.redisClient.Set(ctx, cacheKey, vectorStr, 1*time.Hour)

	return vectorStr, nil
}

func sha256Hash(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}

func vectorToPgVectorLiteral(v []float64) string {
	parts := make([]string, len(v))
	for i, f := range v {
		parts[i] = strconv.FormatFloat(f, 'f', -1, 64)
	}
	return "[" + strings.Join(parts, ",") + "]"
}
