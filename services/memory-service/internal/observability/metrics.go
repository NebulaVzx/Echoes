// Package observability provides logging, tracing, and metrics initialization.
package observability

import (
	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// RegisterMetricsEndpoint registers the GET /metrics endpoint on the given Gin engine.
func RegisterMetricsEndpoint(r *gin.Engine) {
	r.GET("/metrics", gin.WrapH(promhttp.Handler()))
}
