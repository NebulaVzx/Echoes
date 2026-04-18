// Package router configures HTTP routes and reverse proxy for the gateway.
package router

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"time"

	"github.com/NebulaVzx/Echoes/services/gateway/internal/middleware"
	"github.com/gin-gonic/gin"
)

// Setup configures all routes and returns the Gin engine.
func Setup() *gin.Engine {
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(gin.Logger())

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"service": "gateway",
			"version": "0.2.0",
		})
	})

	// API v1 routes
	v1 := router.Group("/api/v1")

	// Apply JWT auth middleware
	v1.Use(middleware.JWTAuth())

	// Setup reverse proxies
	userProxy := newReverseProxy("USER_SERVICE_URL", "http://user-service:8001")
	memoryProxy := newReverseProxy("MEMORY_SERVICE_URL", "http://memory-service:8002")

	// Auth routes → User Service
	v1.Any("/auth/*path", func(c *gin.Context) {
		userProxy.ServeHTTP(c.Writer, c.Request)
	})

	// Memory routes → Memory Service (placeholder for Sprint 2)
	v1.Any("/memories/*path", func(c *gin.Context) {
		memoryProxy.ServeHTTP(c.Writer, c.Request)
	})

	// Search route → Memory Service (placeholder for Sprint 4)
	v1.Any("/search", func(c *gin.Context) {
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

	// Custom transport with timeout
	proxy.Transport = &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 10,
		IdleConnTimeout:     90 * time.Second,
	}

	// Modify request to set correct host and path
	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		req.Host = target.Host
	}

	return proxy
}
