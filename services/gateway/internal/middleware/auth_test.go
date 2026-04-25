package middleware

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func TestIsPublicRoute_ExactMatch(t *testing.T) {
	tests := []struct {
		path     string
		expected bool
	}{
		{"/health", true},
		{"/api/v1/auth/login", true},
		{"/api/v1/auth/register", true},
		{"/api/v1/auth/providers", true},
		{"/api/v1/auth/github", true},
		{"/api/v1/auth/refresh", true},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			got := isPublicRoute(tt.path)
			if got != tt.expected {
				t.Errorf("isPublicRoute(%q) = %v, want %v", tt.path, got, tt.expected)
			}
		})
	}
}

func TestIsPublicRoute_PrefixMatch(t *testing.T) {
	tests := []struct {
		path     string
		expected bool
	}{
		{"/api/v1/auth/github/callback", true},
		{"/api/v1/auth/github/callback?code=xxx", true},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			got := isPublicRoute(tt.path)
			if got != tt.expected {
				t.Errorf("isPublicRoute(%q) = %v, want %v", tt.path, got, tt.expected)
			}
		})
	}
}

func TestIsPublicRoute_PathTraversal(t *testing.T) {
	// CR-02: filepath.Clean should normalize path traversal attempts,
	// preventing bypass of authentication.
	tests := []struct {
		path     string
		expected bool
	}{
		{"/health/../api/v1/memories", false},
		{"/api/v1/auth/login/../../memories", false},
		{"/api/v1/auth/login/..", false}, // Clean → /api/v1/auth
		{"/../api/v1/memories", false},   // Clean → /api/v1/memories
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			got := isPublicRoute(tt.path)
			if got != tt.expected {
				t.Errorf("isPublicRoute(%q) = %v, want %v (clean path: %s)", tt.path, got, tt.expected, filepath.Clean(tt.path))
			}
		})
	}
}

func TestIsPublicRoute_ProtectedPaths(t *testing.T) {
	tests := []struct {
		path     string
		expected bool
	}{
		{"/api/v1/memories", false},
		{"/api/v1/search", false},
		{"/api/v1/chat/messages", false},
		{"/api/v1/memories/123", false},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			got := isPublicRoute(tt.path)
			if got != tt.expected {
				t.Errorf("isPublicRoute(%q) = %v, want %v", tt.path, got, tt.expected)
			}
		})
	}
}

// generateTestJWT creates a signed JWT token with the given subject and expiration.
func generateTestJWT(subject string, exp time.Time, secret []byte) string {
	claims := tokenClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   subject,
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(exp),
		},
	}
	token, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(secret)
	return token
}

func TestAuthMiddleware_ValidToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	// Note: JWTAuth uses the package-level jwtSecret set by init().
	// We use the same secret via JWT_SECRET env variable in test command.

	validToken := generateTestJWT("550e8400-e29b-41d4-a716-446655440000",
		time.Now().Add(15*time.Minute), jwtSecret)

	router := gin.New()
	router.Use(JWTAuth())
	called := false
	router.GET("/api/v1/memories", func(c *gin.Context) {
		called = true
		userID, exists := c.Get("userID")
		if !exists {
			t.Error("userID should be set in context")
		}
		if userID != "550e8400-e29b-41d4-a716-446655440000" {
			t.Errorf("userID = %v, want 550e8400-e29b-41d4-a716-446655440000", userID)
		}
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/memories", nil)
	req.Header.Set("Authorization", "Bearer "+validToken)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected 200, got %d. Body: %s", w.Code, w.Body.String())
	}
	if !called {
		t.Error("Handler should have been called with valid token")
	}
}

func TestAuthMiddleware_MissingToken(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(JWTAuth())
	called := false
	router.GET("/api/v1/memories", func(c *gin.Context) {
		called = true
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/memories", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401, got %d", w.Code)
	}
	if called {
		t.Error("Handler should NOT have been called without token")
	}
}

func TestAuthMiddleware_InvalidTokenFormat(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(JWTAuth())
	called := false
	router.GET("/api/v1/memories", func(c *gin.Context) {
		called = true
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/memories", nil)
	req.Header.Set("Authorization", "Basic dXNlcjpwYXNz")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401 for Basic auth format, got %d", w.Code)
	}
	if called {
		t.Error("Handler should NOT have been called with Basic auth")
	}
}

func TestAuthMiddleware_ExpiredToken(t *testing.T) {
	gin.SetMode(gin.TestMode)

	expiredToken := generateTestJWT("550e8400-e29b-41d4-a716-446655440000",
		time.Now().Add(-1*time.Hour), jwtSecret)

	router := gin.New()
	router.Use(JWTAuth())
	called := false
	router.GET("/api/v1/memories", func(c *gin.Context) {
		called = true
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/memories", nil)
	req.Header.Set("Authorization", "Bearer "+expiredToken)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401 for expired token, got %d", w.Code)
	}
	if called {
		t.Error("Handler should NOT have been called with expired token")
	}
}

func TestAuthMiddleware_WrongSecret(t *testing.T) {
	gin.SetMode(gin.TestMode)

	wrongSecret := []byte("a-completely-different-secret-key")
	tokenWithWrongSecret := generateTestJWT("550e8400-e29b-41d4-a716-446655440000",
		time.Now().Add(15*time.Minute), wrongSecret)

	router := gin.New()
	router.Use(JWTAuth())
	called := false
	router.GET("/api/v1/memories", func(c *gin.Context) {
		called = true
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/memories", nil)
	req.Header.Set("Authorization", "Bearer "+tokenWithWrongSecret)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401 for wrong-secret token, got %d", w.Code)
	}
	if called {
		t.Error("Handler should NOT have been called with wrong-secret token")
	}
}

func TestAuthMiddleware_PublicRouteBypass(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(JWTAuth())
	called := false
	router.GET("/health", func(c *gin.Context) {
		called = true
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/health", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected 200 for public health route, got %d", w.Code)
	}
	if !called {
		t.Error("Handler should have been called for public route without token")
	}
}

// CORS middleware tests

func TestCORSMiddleware_Preflight(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(CORS())
	router.OPTIONS("/api/v1/memories", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("OPTIONS", "/api/v1/memories", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("Access-Control-Request-Method", "GET")
	router.ServeHTTP(w, req)

	// Preflight should return 204 or 200
	if w.Code != http.StatusOK && w.Code != http.StatusNoContent {
		t.Errorf("Expected 200 or 204 for preflight, got %d", w.Code)
	}

	// Should have CORS headers
	allowOrigin := w.Header().Get("Access-Control-Allow-Origin")
	if allowOrigin != "http://localhost:3000" {
		t.Errorf("Access-Control-Allow-Origin = %q, want %q", allowOrigin, "http://localhost:3000")
	}

	allowMethods := w.Header().Get("Access-Control-Allow-Methods")
	if allowMethods == "" {
		t.Error("Access-Control-Allow-Methods should not be empty")
	}
}

func TestCORSMiddleware_ActualRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(CORS())
	router.GET("/api/v1/memories", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/memories", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected 200, got %d", w.Code)
	}

	allowOrigin := w.Header().Get("Access-Control-Allow-Origin")
	if allowOrigin != "http://localhost:3000" {
		t.Errorf("Access-Control-Allow-Origin = %q, want %q", allowOrigin, "http://localhost:3000")
	}
}

func TestCORSMiddleware_DisallowedOrigin(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(CORS())
	router.GET("/api/v1/memories", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/memories", nil)
	req.Header.Set("Origin", "https://evil.com")
	router.ServeHTTP(w, req)

	// Request should still succeed (CORS is browser-enforced)
	// but Access-Control-Allow-Origin should NOT be set to the disallowed origin
	allowOrigin := w.Header().Get("Access-Control-Allow-Origin")
	if allowOrigin == "https://evil.com" {
		t.Error("Access-Control-Allow-Origin should NOT be evil.com")
	}
}

func TestCORSMiddleware_AllowedCredentials(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(CORS())
	router.GET("/api/v1/memories", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/memories", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected 200, got %d", w.Code)
	}

	// Credentials should be allowed since cors.go sets AllowCredentials: true
	allowCreds := w.Header().Get("Access-Control-Allow-Credentials")
	if allowCreds != "true" {
		t.Errorf("Access-Control-Allow-Credentials = %q, want %q", allowCreds, "true")
	}
}

// TestAuthMiddleware_ValidTokenWithUserID verifies that X-User-ID header is set for downstream.
func TestAuthMiddleware_ValidTokenWithUserID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	validToken := generateTestJWT("550e8400-e29b-41d4-a716-446655440000",
		time.Now().Add(15*time.Minute), jwtSecret)

	router := gin.New()
	router.Use(JWTAuth())
	var capturedHeader string
	router.GET("/api/v1/memories", func(c *gin.Context) {
		capturedHeader = c.Request.Header.Get("X-User-ID")
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/memories", nil)
	req.Header.Set("Authorization", "Bearer "+validToken)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200, got %d", w.Code)
	}
	if capturedHeader != "550e8400-e29b-41d4-a716-446655440000" {
		t.Errorf("X-User-ID = %q, want %q", capturedHeader, "550e8400-e29b-41d4-a716-446655440000")
	}
}

// TestAuthMiddleware_EmptyBearerToken tests the edge case of "Bearer " with no token.
func TestAuthMiddleware_EmptyBearerToken(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(JWTAuth())
	called := false
	router.GET("/api/v1/memories", func(c *gin.Context) {
		called = true
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/memories", nil)
	req.Header.Set("Authorization", "Bearer ")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401 for empty Bearer token, got %d", w.Code)
	}
	if called {
		t.Error("Handler should NOT have been called with empty token")
	}
}
