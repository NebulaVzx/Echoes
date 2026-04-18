// Package transport provides HTTP handlers for authentication endpoints.
package transport

import (
	"fmt"
	"net/http"

	"github.com/NebulaVzx/Echoes/services/user-service/internal/domain"
	"github.com/NebulaVzx/Echoes/services/user-service/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// AuthHandler handles HTTP requests for authentication.
type AuthHandler struct {
	authService *service.AuthService
}

// NewAuthHandler creates a new authentication HTTP handler.
func NewAuthHandler(authService *service.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

// RegisterRoutes registers auth routes on the given router.
func (h *AuthHandler) RegisterRoutes(router *gin.RouterGroup) {
	router.POST("/register", h.Register)
	router.POST("/login", h.Login)
	router.POST("/refresh", h.RefreshToken)
	router.POST("/logout", h.Logout)
	router.GET("/github", h.GitHubOAuth)
	router.GET("/github/callback", h.GitHubCallback)

	// Protected routes
	auth := router.Group("")
	auth.Use(h.AuthMiddleware())
	auth.GET("/me", h.GetMe)
}

// Register handles user registration.
func (h *AuthHandler) Register(c *gin.Context) {
	var req domain.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}

	resp, err := h.authService.Register(c.Request.Context(), req)
	if err != nil {
		switch err {
		case service.ErrEmailExists:
			c.JSON(http.StatusConflict, gin.H{"success": false, "error": gin.H{"code": "USER_EXISTS", "message": "Email already registered"}})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": gin.H{"code": "INTERNAL_ERROR", "message": "Failed to register user"}})
		}
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "data": gin.H{
		"user":  resp.User.SafeResponse(),
		"token": resp.Token,
	}})
}

// Login handles user login.
func (h *AuthHandler) Login(c *gin.Context) {
	var req domain.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}

	resp, err := h.authService.Login(c.Request.Context(), req)
	if err != nil {
		switch err {
		case service.ErrInvalidCredentials:
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "INVALID_CREDENTIALS", "message": "Invalid email or password"}})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": gin.H{"code": "INTERNAL_ERROR", "message": "Login failed"}})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
		"user":  resp.User.SafeResponse(),
		"token": resp.Token,
	}})
}

// RefreshToken handles token refresh.
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	var req domain.RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}

	tokens, err := h.authService.RefreshToken(c.Request.Context(), req.RefreshToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "TOKEN_EXPIRED", "message": "Invalid or expired refresh token"}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": tokens})
}

// Logout handles user logout (client-side token deletion).
func (h *AuthHandler) Logout(c *gin.Context) {
	// In a stateless JWT system, logout is handled client-side by deleting the token.
	// Optionally, we could add the token to a Redis blacklist here.
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Logout successful"})
}

// GitHubOAuth initiates GitHub OAuth flow.
func (h *AuthHandler) GitHubOAuth(c *gin.Context) {
	// Placeholder for Sprint 1 - will be implemented in detail
	c.JSON(http.StatusNotImplemented, gin.H{"success": false, "message": "GitHub OAuth will be implemented soon"})
}

// GitHubCallback handles GitHub OAuth callback.
func (h *AuthHandler) GitHubCallback(c *gin.Context) {
	// Placeholder for Sprint 1 - will be implemented in detail
	c.JSON(http.StatusNotImplemented, gin.H{"success": false, "message": "GitHub OAuth will be implemented soon"})
}

// GetMe returns the current authenticated user.
func (h *AuthHandler) GetMe(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "UNAUTHORIZED", "message": "User not authenticated"}})
		return
	}

	userIDStr, ok := userID.(string)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "UNAUTHORIZED", "message": "Invalid user ID"}})
		return
	}

	userIDUUID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "UNAUTHORIZED", "message": "Invalid user ID format"}})
		return
	}

	user, err := h.authService.GetUserByID(c.Request.Context(), userIDUUID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": gin.H{"code": "NOT_FOUND", "message": "User not found"}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": user.SafeResponse()})
}

// AuthMiddleware validates JWT access tokens and injects userID into context.
func (h *AuthHandler) AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "UNAUTHORIZED", "message": "Missing authorization header"}})
			c.Abort()
			return
		}

		// Extract Bearer token
		var tokenString string
		if _, err := fmt.Sscanf(authHeader, "Bearer %s", &tokenString); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "UNAUTHORIZED", "message": "Invalid authorization header format"}})
			c.Abort()
			return
		}

		userID, err := h.authService.ValidateToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "TOKEN_EXPIRED", "message": "Invalid or expired token"}})
			c.Abort()
			return
		}

		c.Set("userID", userID.String())
		c.Next()
	}
}

