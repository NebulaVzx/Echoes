// Package transport provides HTTP handlers for authentication endpoints.
package transport

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/NebulaVzx/Echoes/services/user-service/internal/domain"
	"github.com/NebulaVzx/Echoes/services/user-service/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// In-memory state store for GitHub OAuth CSRF protection.
// Production should use Redis with TTL.
var (
	oauthStates   = make(map[string]time.Time)
	oauthStateMux sync.Mutex
)

// generateState creates a random state string and stores it with expiration.
func generateState() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	state := hex.EncodeToString(b)
	oauthStateMux.Lock()
	oauthStates[state] = time.Now().Add(10 * time.Minute)
	oauthStateMux.Unlock()
	return state
}

// validateState checks if a state exists and hasn't expired, then removes it.
func validateState(state string) bool {
	oauthStateMux.Lock()
	expiry, ok := oauthStates[state]
	delete(oauthStates, state)
	oauthStateMux.Unlock()
	return ok && time.Now().Before(expiry)
}

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
	router.GET("/providers", h.GetAuthProviders)
	router.GET("/github", h.GitHubOAuth)
	router.GET("/github/callback", h.GitHubCallback)

	// Protected routes
	auth := router.Group("")
	auth.Use(h.AuthMiddleware())
	auth.GET("/me", h.GetMe)
}

// GetAuthProviders returns available authentication providers and their configuration status.
func (h *AuthHandler) GetAuthProviders(c *gin.Context) {
	_, err := h.authService.GetGitHubAuthURL("test")
	githubAvailable := err == nil
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"providers": gin.H{
				"email":    true,
				"github":   githubAvailable,
			},
		},
	})
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
	state := generateState()
	authURL, err := h.authService.GetGitHubAuthURL(state)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"success": false, "error": gin.H{"code": "OAUTH_NOT_CONFIGURED", "message": "GitHub OAuth 未配置，请在环境变量中设置 GITHUB_CLIENT_ID 和 GITHUB_CLIENT_SECRET"}})
		return
	}
	c.Redirect(http.StatusFound, authURL)
}

// GitHubCallback handles GitHub OAuth callback.
func (h *AuthHandler) GitHubCallback(c *gin.Context) {
	code := c.Query("code")
	state := c.Query("state")

	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": "Missing authorization code"}})
		return
	}

	if !validateState(state) {
		// Strict state validation in production; relaxed in development for testing
		if os.Getenv("ENV") == "production" {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "INVALID_STATE", "message": "Invalid or expired state"}})
			return
		}
		// In development, log but continue
		fmt.Printf("[WARN] Invalid or expired OAuth state in development: %s\n", state)
	}

	resp, err := h.authService.HandleGitHubCallback(c.Request.Context(), code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": gin.H{"code": "OAUTH_ERROR", "message": err.Error()}})
		return
	}

	// Redirect to frontend with token in URL hash (localStorage is port-isolated,
	// so the backend cannot set it directly for the frontend on a different port).
	frontendURL := "http://localhost:3000"
	c.Redirect(http.StatusFound,
		frontendURL+"#token="+resp.Token.AccessToken+
			"&refresh_token="+resp.Token.RefreshToken)
}

// getUserID extracts user ID from Gin context (direct calls) or X-User-ID header (Gateway proxy).
func getUserID(c *gin.Context) (string, bool) {
	// 1. Try Gin context (direct calls with AuthMiddleware)
	if userID, exists := c.Get("userID"); exists {
		if str, ok := userID.(string); ok && str != "" {
			return str, true
		}
	}
	// 2. Fallback to X-User-ID header (calls routed through Gateway)
	if userID := c.GetHeader("X-User-ID"); userID != "" {
		return userID, true
	}
	return "", false
}

// GetMe returns the current authenticated user.
func (h *AuthHandler) GetMe(c *gin.Context) {
	userIDStr, ok := getUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "UNAUTHORIZED", "message": "User not authenticated"}})
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

