// Package router configures HTTP routes and reverse proxy for the gateway.
package router

import (
	"context"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"time"

	chatRepository "github.com/NebulaVzx/Echoes/services/gateway/internal/chat/repository"
	chatService "github.com/NebulaVzx/Echoes/services/gateway/internal/chat/service"
	chatTransport "github.com/NebulaVzx/Echoes/services/gateway/internal/chat/transport"
	"github.com/NebulaVzx/Echoes/services/gateway/internal/middleware"
	"github.com/NebulaVzx/Echoes/services/gateway/internal/observability"
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// Setup configures all routes and returns the Gin engine.
// Middleware chain per D-02/D-04/D-06: Recovery -> otelgin -> PrometheusMetrics -> ZapLogger -> CORS -> RateLimit -> JWTAuth
func Setup(logger *zap.Logger, db *gorm.DB) *gin.Engine {
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(middleware.OTelGin("gateway"))
	router.Use(middleware.PrometheusMetrics("gateway"))
	router.Use(middleware.ZapLogger(logger))
	router.Use(middleware.CORS())
	router.RedirectTrailingSlash = false

	// Register /metrics endpoint before route groups
	observability.RegisterMetricsEndpoint(router)

	// Rate limiters: relaxed for local development — prevents abuse without blocking normal browsing.
	// rate = interval between token refills. 50ms = 20 req/s average. 500ms = 2 req/s average.
	// burst = max concurrent requests allowed in a single burst.
	// NOTE: In Docker all host requests share the same IP, so per-IP auth limit must be generous.
	authLimiter := middleware.NewRateLimiter(500*time.Millisecond, 30)   // 2 req/s avg, burst 30
	defaultLimiter := middleware.NewRateLimiter(50*time.Millisecond, 200) // 20 req/s avg, burst 200

	// Health check (no rate limit) — aggregated: gateway + downstream services
	router.GET("/health", healthCheckHandler)

	// API v1 routes
	v1 := router.Group("/api/v1")

	// Auth routes: strict rate limit, no JWT (public routes)
	auth := v1.Group("/auth")
	auth.Use(middleware.RateLimit(authLimiter))
	userProxy := newReverseProxy("USER_SERVICE_URL", "http://user-service:8001")
	auth.Any("", func(c *gin.Context) {
		userProxy.ServeHTTP(c.Writer, c.Request)
	})
	auth.Any("/*path", func(c *gin.Context) {
		userProxy.ServeHTTP(c.Writer, c.Request)
	})

	// Apply JWT auth + per-user rate limit for protected routes
	protected := v1.Group("")
	protected.Use(middleware.JWTAuth())
	protected.Use(middleware.RateLimitByUser(defaultLimiter))
	memoryProxy := newReverseProxy("MEMORY_SERVICE_URL", "http://memory-service:8002")

	// Memory routes → Memory Service
	protected.Any("/memories", func(c *gin.Context) {
		memoryProxy.ServeHTTP(c.Writer, c.Request)
	})
	protected.Any("/memories/*path", func(c *gin.Context) {
		memoryProxy.ServeHTTP(c.Writer, c.Request)
	})

	// Search route → Memory Service
	protected.Any("/search", func(c *gin.Context) {
		memoryProxy.ServeHTTP(c.Writer, c.Request)
	})

	// Tag routes → Memory Service
	protected.Any("/tags", func(c *gin.Context) {
		memoryProxy.ServeHTTP(c.Writer, c.Request)
	})
	protected.Any("/tags/*path", func(c *gin.Context) {
		memoryProxy.ServeHTTP(c.Writer, c.Request)
	})

	// Mood routes → Memory Service
	protected.Any("/mood", func(c *gin.Context) {
		memoryProxy.ServeHTTP(c.Writer, c.Request)
	})
	protected.Any("/mood/*path", func(c *gin.Context) {
		memoryProxy.ServeHTTP(c.Writer, c.Request)
	})

	// Constellation route → Memory Service
	protected.Any("/constellation", func(c *gin.Context) {
		memoryProxy.ServeHTTP(c.Writer, c.Request)
	})

	// Chat routes — handled by Gateway directly (not proxied)
	chatRepo := chatRepository.NewGormConversationRepository(db)
	chatSvc := chatService.NewChatService(
		chatRepo,
		os.Getenv("MEMORY_SERVICE_URL"),
		os.Getenv("PROCESSOR_SERVICE_URL"),
		os.Getenv("USER_SERVICE_URL"),
		logger,
	)
	chatHandler := chatTransport.NewChatHandler(chatSvc, logger)

	protected.POST("/chat/messages", chatHandler.SendMessage)
	protected.GET("/chat/conversations", chatHandler.ListConversations)
	protected.DELETE("/chat/conversations/:id", chatHandler.DeleteConversation)
	protected.GET("/chat/conversations/:id/messages", chatHandler.GetMessages)

	return router
}

// healthCheckHandler performs aggregated health checks against downstream services.
// Returns 200 if all services healthy, 503 if any service is unreachable.
func healthCheckHandler(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
	defer cancel()

	services := map[string]string{
		"user":   checkServiceHealth(ctx, os.Getenv("USER_SERVICE_URL"), "http://user-service:8001", "/api/v1/auth/me"),
		"memory": checkServiceHealth(ctx, os.Getenv("MEMORY_SERVICE_URL"), "http://memory-service:8002", "/api/v1/memories"),
	}

	overallStatus := "healthy"
	httpStatus := http.StatusOK
	for _, status := range services {
		if status != "ok" {
			overallStatus = "degraded"
			httpStatus = http.StatusServiceUnavailable
			break
		}
	}

	c.JSON(httpStatus, gin.H{
		"status":   overallStatus,
		"gateway":  "ok",
		"services": services,
		"version":  "0.2.0",
	})
}

// checkServiceHealth probes a downstream service with an HTTP HEAD request.
// Returns "ok" if the service responds with 2xx/3xx/4xx, or "unreachable" on error/5xx.
func checkServiceHealth(ctx context.Context, envURL, defaultURL, path string) string {
	targetURL := envURL
	if targetURL == "" {
		targetURL = defaultURL
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodHead, targetURL+path, nil)
	if err != nil {
		return "unreachable"
	}
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "unreachable"
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 200 && resp.StatusCode < 500 {
		return "ok"
	}
	return "unreachable"
}

// newReverseProxy creates a reverse proxy to a backend service.
func newReverseProxy(envKey, defaultURL string) *httputil.ReverseProxy {
	targetURL := os.Getenv(envKey)
	if targetURL == "" {
		targetURL = defaultURL
	}

	target, err := url.Parse(targetURL)
	if err != nil {
		panic(err)
	}

	proxy := httputil.NewSingleHostReverseProxy(target)

	// Custom transport with explicit timeouts and OTel trace propagation to downstream services
	// ResponseHeaderTimeout set to 60s to accommodate LLM API calls (e.g. tag categorization)
	proxy.Transport = otelhttp.NewTransport(&http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 10,
		IdleConnTimeout:     90 * time.Second,
		// Explicit connection timeouts to prevent indefinite blocking
		DialContext: (&net.Dialer{
			Timeout:   5 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		TLSHandshakeTimeout:   5 * time.Second,
		ResponseHeaderTimeout: 60 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	})

	// Modify request to set correct host and path
	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		req.Host = target.Host
	}

	return proxy
}
