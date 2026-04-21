// Package middleware provides HTTP middleware for the gateway.
package middleware

import (
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// RateLimiter implements per-IP token bucket rate limiting.
type RateLimiter struct {
	mu       sync.RWMutex
	buckets  map[string]*bucket
	rate     time.Duration
	burst    int
	cleanup  time.Duration
}

type bucket struct {
	tokens    int
	lastSeen  time.Time
	lastFill  time.Time
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

// Allow checks if the given IP is allowed to make a request.
func (rl *RateLimiter) Allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	b, exists := rl.buckets[ip]
	if !exists {
		b = &bucket{tokens: rl.burst - 1, lastSeen: time.Now(), lastFill: time.Now()}
		rl.buckets[ip] = b
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
		for ip, b := range rl.buckets {
			if time.Since(b.lastSeen) > rl.cleanup {
				delete(rl.buckets, ip)
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

// RateLimit returns a Gin middleware that applies rate limiting.
func RateLimit(limiter *RateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := extractClientIP(c)
		if !limiter.Allow(ip) {
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
