// Package router configures HTTP routes and reverse proxy for the gateway.
package router

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"time"

	"github.com/NebulaVzx/Echoes/services/gateway/internal/middleware"
	"github.com/NebulaVzx/Echoes/services/gateway/internal/observability"
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.uber.org/zap"
)

// Setup configures all routes and returns the Gin engine.
// Middleware chain per D-02/D-04/D-06: Recovery -> otelgin -> PrometheusMetrics -> ZapLogger -> CORS -> RateLimit -> JWTAuth
func Setup(logger *zap.Logger) *gin.Engine {
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(middleware.OTelGin("gateway"))
	router.Use(middleware.PrometheusMetrics("gateway"))
	router.Use(middleware.ZapLogger(logger))
	router.Use(middleware.CORS())
	router.RedirectTrailingSlash = false

	// Register /metrics endpoint before route groups
	observability.RegisterMetricsEndpoint(router)

	// Rate limiters: 5 req/min for auth, 60 req/min for memory APIs
	authLimiter := middleware.NewRateLimiter(12*time.Second, 5)
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
