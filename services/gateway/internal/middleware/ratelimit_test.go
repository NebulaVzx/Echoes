package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestRateLimiter_Allow_WithinBurst(t *testing.T) {
	rl := NewRateLimiter(1*time.Second, 3)

	key := "test-key-1"

	// First 3 requests should be allowed (burst=3)
	for i := 0; i < 3; i++ {
		if !rl.Allow(key) {
			t.Errorf("Allow() request %d should be allowed (within burst)", i+1)
		}
	}

	// 4th request should be denied (burst exhausted)
	if rl.Allow(key) {
		t.Error("Allow() 4th request should be denied (burst exhausted)")
	}
}

func TestRateLimiter_Allow_Refill(t *testing.T) {
	// Fast refill rate for test: 50ms per token, burst=2
	rl := NewRateLimiter(50*time.Millisecond, 2)

	key := "test-key-refill"

	// Exhaust burst
	if !rl.Allow(key) {
		t.Error("Allow() first request should be allowed")
	}
	if !rl.Allow(key) {
		t.Error("Allow() second request should be allowed")
	}
	if rl.Allow(key) {
		t.Error("Allow() third request should be denied (burst exhausted)")
	}

	// Wait for refill (one token refills every 50ms)
	time.Sleep(80 * time.Millisecond)

	// After refill, one more request should be allowed
	if !rl.Allow(key) {
		t.Error("Allow() after refill should be allowed")
	}

	// But the next one should be denied again
	if rl.Allow(key) {
		t.Error("Allow() immediately after refill request should be denied")
	}
}

func TestRateLimiter_Allow_DifferentKeys(t *testing.T) {
	rl := NewRateLimiter(1*time.Second, 2)

	// Key A: use 2 tokens (exhausted)
	rl.Allow("key-a")
	rl.Allow("key-a")

	// Key B should still have its own burst
	if !rl.Allow("key-b") {
		t.Error("Allow() for key-b should be allowed (independent bucket)")
	}
	if !rl.Allow("key-b") {
		t.Error("Allow() second request for key-b should be allowed")
	}
	if rl.Allow("key-b") {
		t.Error("Allow() third request for key-b should be denied")
	}

	// Key A should still be exhausted
	if rl.Allow("key-a") {
		t.Error("Allow() for key-a should still be denied after other key usage")
	}
}

func TestRateLimiter_RateLimitMiddleware_Denies(t *testing.T) {
	gin.SetMode(gin.TestMode)

	rl := NewRateLimiter(1*time.Hour, 1) // Very restrictive: 1 req/hour

	router := gin.New()
	called := false
	router.GET("/test", RateLimit(rl), func(c *gin.Context) {
		called = true
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// First request: should pass
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("First request: expected 200, got %d", w.Code)
	}
	if !called {
		t.Error("Handler should have been called on first request")
	}

	// Second request: should be rate limited
	called = false
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)
	if w.Code != http.StatusTooManyRequests {
		t.Errorf("Second request: expected 429, got %d", w.Code)
	}
	if called {
		t.Error("Handler should NOT have been called on rate-limited request")
	}
}

func TestRateLimiter_RateLimitByUser_Middleware(t *testing.T) {
	gin.SetMode(gin.TestMode)

	rl := NewRateLimiter(1*time.Hour, 2)

	router := gin.New()
	router.GET("/test", RateLimitByUser(rl), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// User A: 2 requests allowed
	for i := 0; i < 2; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/test", nil)
		req.Header.Set("X-User-ID", "user-a")
		router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Errorf("User A request %d: expected 200, got %d", i+1, w.Code)
		}
	}

	// User A: 3rd request should be denied
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	req.Header.Set("X-User-ID", "user-a")
	router.ServeHTTP(w, req)
	if w.Code != http.StatusTooManyRequests {
		t.Errorf("User A 3rd request: expected 429, got %d", w.Code)
	}

	// User B: should still be allowed (different bucket)
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/test", nil)
	req.Header.Set("X-User-ID", "user-b")
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("User B request: expected 200, got %d", w.Code)
	}
}

func TestRateLimiter_UniqueKeys(t *testing.T) {
	rl := NewRateLimiter(1*time.Second, 1)

	// Each unique key gets its own initial burst allowance
	for i := 0; i < 50; i++ {
		key := "unique-key-" + string(rune('A'+i%26)) + string(rune('0'+i/26))
		if !rl.Allow(key) {
			t.Errorf("Allow() for unique key %q should be allowed", key)
		}
		// Second request with same key should fail
		if rl.Allow(key) {
			t.Errorf("Allow() second request for key %q should be denied", key)
		}
	}
}
