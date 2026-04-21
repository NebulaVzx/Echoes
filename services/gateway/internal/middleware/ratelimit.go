// Package middleware provides HTTP middleware for the gateway.
package middleware

import (
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// RateLimiter implements per-key token bucket rate limiting.
// The key can be an IP address (for unauthenticated routes) or a user ID
// (for authenticated routes), preventing a single user from exhausting
// the global quota.
type RateLimiter struct {
	mu      sync.RWMutex
	buckets map[string]*bucket
	rate    time.Duration
	burst   int
	cleanup time.Duration
}

type bucket struct {
	tokens   int
	lastSeen time.Time
	lastFill time.Time
}

// NewRateLimiter creates a rate limiter with the given fill rate and burst size.
// rate: interval between token additions (e.g., 12*time.Second for 5 req/min)
// burst: maximum tokens (requests) allowed in a burst
func NewRateLimiter(rate time.Duration, burst int) *RateLimiter {
	rl := &RateLimiter{
		buckets: make(map[string]*bucket),
		rate:    rate,
		burst:   burst,
		cleanup: 10 * time.Minute,
	}
	go rl.cleanupLoop()
	return rl
}

// Allow checks if the given key is allowed to make a request.
func (rl *RateLimiter) Allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	b, exists := rl.buckets[key]
	if !exists {
		b = &bucket{tokens: rl.burst - 1, lastSeen: time.Now(), lastFill: time.Now()}
		rl.buckets[key] = b
		return true
	}

	// Refill tokens based on elapsed time
	elapsed := time.Since(b.lastFill)
	tokensToAdd := int(elapsed / rl.rate)
	if tokensToAdd > 0 {
		b.tokens = min(b.tokens+tokensToAdd, rl.burst)
		b.lastFill = time.Now()
	}

	b.lastSeen = time.Now()

	if b.tokens > 0 {
		b.tokens--
		return true
	}
	return false
}

func (rl *RateLimiter) cleanupLoop() {
	ticker := time.NewTicker(rl.cleanup)
	defer ticker.Stop()
	for range ticker.C {
		rl.mu.Lock()
		for key, b := range rl.buckets {
			if time.Since(b.lastSeen) > rl.cleanup {
				delete(rl.buckets, key)
			}
		}
		rl.mu.Unlock()
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// extractClientIP extracts the real client IP from the request.
func extractClientIP(c *gin.Context) string {
	// Check X-Forwarded-For header (common for proxies)
	if xff := c.GetHeader("X-Forwarded-For"); xff != "" {
		return xff
	}
	// Check X-Real-Ip header
	if xri := c.GetHeader("X-Real-Ip"); xri != "" {
		return xri
	}
	// Fall back to remote address
	host, _, err := net.SplitHostPort(c.Request.RemoteAddr)
	if err != nil {
		return c.Request.RemoteAddr
	}
	return host
}

// KeyExtractor defines a function that extracts a rate-limiting key from a Gin context.
type KeyExtractor func(c *gin.Context) string

// ipExtractor extracts the client IP for rate limiting unauthenticated routes.
func ipExtractor(c *gin.Context) string {
	return extractClientIP(c)
}

// userIDExtractor extracts the user ID from the X-User-ID header for per-user
// rate limiting. Falls back to the client IP if the header is absent.
func userIDExtractor(c *gin.Context) string {
	if userID := c.GetHeader("X-User-ID"); userID != "" {
		return "user:" + userID
	}
	return extractClientIP(c)
}

// RateLimit returns a Gin middleware that applies IP-based rate limiting.
// This is the backward-compatible wrapper; it uses the client IP as the key.
func RateLimit(limiter *RateLimiter) gin.HandlerFunc {
	return RateLimitWithExtractor(limiter, ipExtractor)
}

// RateLimitByUser returns a Gin middleware that applies per-user rate limiting.
// It uses the X-User-ID header set by the Gateway JWT middleware. If the header
// is missing (e.g., unauthenticated request), it falls back to the client IP.
func RateLimitByUser(limiter *RateLimiter) gin.HandlerFunc {
	return RateLimitWithExtractor(limiter, userIDExtractor)
}

// RateLimitWithExtractor returns a Gin middleware that applies rate limiting
// using a custom key extractor. This allows flexible per-IP or per-user limiting.
func RateLimitWithExtractor(limiter *RateLimiter, extractor KeyExtractor) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := extractor(c)
		if !limiter.Allow(key) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "RATE_LIMITED",
					"message": "Too many requests. Please try again later.",
				},
			})
			c.Abort()
			return
		}
		c.Next()
	}
}
