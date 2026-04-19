// Package middleware provides HTTP middleware for the gateway.
package middleware

import (
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

var jwtSecret []byte

func init() {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "echoes_dev_secret_key_change_in_production"
	}
	jwtSecret = []byte(secret)
}

// tokenClaims mirrors the claims structure used by user-service.
type tokenClaims struct {
	jwt.RegisteredClaims
}

// JWTAuth validates the Authorization header and injects user_id into context.
// It also sets X-User-ID header for downstream services.
func JWTAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip auth for public routes
		if isPublicRoute(c.Request.URL.Path) {
			c.Next()
			return
		}

		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "UNAUTHORIZED", "message": "Missing authorization header"}})
			c.Abort()
			return
		}

		// Extract Bearer token
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "UNAUTHORIZED", "message": "Invalid authorization header format"}})
			c.Abort()
			return
		}

		tokenString := parts[1]

		// Parse and validate token
		token, err := jwt.ParseWithClaims(tokenString, &tokenClaims{}, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return jwtSecret, nil
		})
		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "TOKEN_EXPIRED", "message": "Invalid or expired token"}})
			c.Abort()
			return
		}

		claims, ok := token.Claims.(*tokenClaims)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "UNAUTHORIZED", "message": "Invalid token claims"}})
			c.Abort()
			return
		}

		// Inject user_id into context and set header for downstream
		c.Set("userID", claims.Subject)
		c.Request.Header.Set("X-User-ID", claims.Subject)

		c.Next()
	}
}

// isPublicRoute checks if the request path does not require authentication.
func isPublicRoute(path string) bool {
	publicPaths := []string{
		"/api/v1/auth/register",
		"/api/v1/auth/login",
		"/api/v1/auth/providers",
		"/api/v1/auth/github",
		"/api/v1/auth/github/callback",
		"/api/v1/auth/refresh",
		"/health",
	}
	for _, p := range publicPaths {
		if strings.HasPrefix(path, p) {
			return true
		}
	}
	return false
}
