// Package middleware provides Gin middleware for observability.
package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/zap"
)

// ZapLogger returns a Gin middleware that logs HTTP requests with structured Zap output.
// Extracts trace_id and span_id from the OTel span context per D-04.
func ZapLogger(logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		raw := c.Request.URL.RawQuery

		// Process request
		c.Next()

		// Extract trace info from span context
		span := trace.SpanFromContext(c.Request.Context())
		spanContext := span.SpanContext()
		traceID := ""
		spanID := ""
		if spanContext.IsValid() {
			traceID = spanContext.TraceID().String()
			spanID = spanContext.SpanID().String()
		}

		// Build log fields
		fields := []zap.Field{
			zap.Int("status", c.Writer.Status()),
			zap.String("method", c.Request.Method),
			zap.String("path", path),
			zap.String("client_ip", c.ClientIP()),
			zap.Duration("duration_ms", time.Since(start)),
		}
		if traceID != "" {
			fields = append(fields, zap.String("trace_id", traceID))
		}
		if spanID != "" {
			fields = append(fields, zap.String("span_id", spanID))
		}
		if raw != "" {
			fields = append(fields, zap.String("query", raw))
		}

		// Log errors or success
		if len(c.Errors) > 0 {
			errMsgs := make([]string, 0, len(c.Errors))
			for _, e := range c.Errors {
				errMsgs = append(errMsgs, e.Error())
			}
			fields = append(fields, zap.Strings("errors", errMsgs))
			logger.Error("request failed", fields...)
		} else {
			logger.Info("request completed", fields...)
		}
	}
}
