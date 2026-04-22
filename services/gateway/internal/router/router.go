// Package router configures HTTP routes and reverse proxy for the gateway.
package router

import (
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

	// Rate limiters: 30 req/s for auth (relaxed for Docker shared IP), 60 req/s for APIs
	// NOTE: In Docker all host requests share the same IP (e.g. 172.19.0.1), so auth
	// burst must be high enough to avoid false-positive 429s across all users.
	authLimiter := middleware.NewRateLimiter(time.Second, 30)
	defaultLimiter := middleware.NewRateLimiter(time.Second, 60)

	// Health check (no rate limit)
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"service": "gateway",
			"version": "0.2.0",
		})
	})

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

	// Chat routes — handled by Gateway directly (not proxied)
	chatRepo := chatRepository.NewGormConversationRepository(db)
	chatSvc := chatService.NewChatService(
		chatRepo,
		os.Getenv("MEMORY_SERVICE_URL"),
		os.Getenv("PROCESSOR_SERVICE_URL"),
		logger,
	)
	chatHandler := chatTransport.NewChatHandler(chatSvc, logger)

	protected.POST("/chat/messages", chatHandler.SendMessage)
	protected.GET("/chat/conversations", chatHandler.ListConversations)
	protected.DELETE("/chat/conversations/:id", chatHandler.DeleteConversation)
	protected.GET("/chat/conversations/:id/messages", chatHandler.GetMessages)

	return router
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

	// Custom transport with timeout and OTel trace propagation to downstream services
	proxy.Transport = otelhttp.NewTransport(&http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 10,
		IdleConnTimeout:     90 * time.Second,
	})

	// Modify request to set correct host and path
	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		req.Host = target.Host
	}

	return proxy
}
