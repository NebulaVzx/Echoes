// Package middleware provides HTTP middleware for the gateway.
package middleware

import (
	"os"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// CORS returns a Gin middleware configured for cross-origin requests.
// It uses gin-contrib/cors for proper origin validation, Vary header handling,
// and preflight caching. Origins are configurable via the ALLOWED_ORIGINS env var.
func CORS() gin.HandlerFunc {
	config := cors.DefaultConfig()

	config.AllowOrigins = []string{"http://localhost:3000"}
	if extra := os.Getenv("ALLOWED_ORIGINS"); extra != "" {
		for _, o := range strings.Split(extra, ",") {
			o = strings.TrimSpace(o)
			if o != "" {
				config.AllowOrigins = append(config.AllowOrigins, o)
			}
		}
	}

	config.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization", "X-User-ID"}
	config.ExposeHeaders = []string{"Content-Length"}
	config.AllowCredentials = true
	config.MaxAge = 12 * time.Hour

	return cors.New(config)
}
