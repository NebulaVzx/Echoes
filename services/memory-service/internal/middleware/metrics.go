// Package middleware provides Gin middleware for observability.
package middleware

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	otelgin "go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"
)

var (
	httpRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests",
		},
		[]string{"service", "method", "path", "status_code"},
	)

	httpRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "HTTP request duration in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"service", "method", "path"},
	)
)

var (
	memoryProcessingTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "memory_processing_total",
			Help: "Total number of memory processing status transitions",
		},
		[]string{"status"},
	)
)

func init() {
	prometheus.MustRegister(httpRequestsTotal)
	prometheus.MustRegister(httpRequestDuration)
	prometheus.MustRegister(memoryProcessingTotal)
}

// RecordMemoryProcessing records a memory processing status transition.
func RecordMemoryProcessing(status string) {
	memoryProcessingTotal.WithLabelValues(status).Inc()
}

// PrometheusMetrics returns a Gin middleware that records HTTP request metrics.
// Uses c.FullPath() for path normalization to avoid high cardinality from dynamic IDs per D-06.
func PrometheusMetrics(service string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip metrics endpoint itself to avoid self-scrape noise
		if c.Request.URL.Path == "/metrics" {
			c.Next()
			return
		}

		start := time.Now()
		c.Next()
		duration := time.Since(start).Seconds()

		// Normalize path: use route pattern if available, else raw path
		path := c.FullPath()
		if path == "" {
			path = c.Request.URL.Path
		}

		statusCode := strconv.Itoa(c.Writer.Status())
		method := c.Request.Method

		httpRequestsTotal.WithLabelValues(service, method, path, statusCode).Inc()
		httpRequestDuration.WithLabelValues(service, method, path).Observe(duration)
	}
}

// OTelGin returns the OpenTelemetry Gin middleware for trace generation/extraction.
func OTelGin(serviceName string) gin.HandlerFunc {
	return otelgin.Middleware(serviceName)
}
