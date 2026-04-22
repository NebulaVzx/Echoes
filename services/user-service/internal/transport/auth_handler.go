// Package transport provides HTTP handlers for authentication endpoints.
package transport

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/NebulaVzx/Echoes/services/user-service/internal/domain"
	"github.com/NebulaVzx/Echoes/services/user-service/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
)

// ValidationError represents a single field validation failure.
type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// ErrorResponse is the unified error response format for all API errors.
type ErrorResponse struct {
	Success bool `json:"success"`
	Error   struct {
		Code    string            `json:"code"`
		Message string            `json:"message"`
		Details []ValidationError `json:"details,omitempty"`
	} `json:"error"`
}

// respondWithError sends a unified error response.
func respondWithError(c *gin.Context, status int, code, message string, details ...ValidationError) {
	resp := ErrorResponse{Success: false}
	resp.Error.Code = code
	resp.Error.Message = message
	if len(details) > 0 {
		resp.Error.Details = details
	}
	c.JSON(status, resp)
}

// respondWithValidationError sends a validation error response with field-level details.
func respondWithValidationError(c *gin.Context, err error) {
	var ve validator.ValidationErrors
	if errors.As(err, &ve) {
		details := make([]ValidationError, 0, len(ve))
		for _, e := range ve {
			details = append(details, ValidationError{
				Field:   e.Field(),
				Message: fmt.Sprintf("validation failed on '%s'", e.Tag()),
			})
		}
		respondWithError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Request validation failed", details...)
		return
	}
	respondWithError(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
}

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
	auth.GET("/me/settings", h.GetSettings)
	auth.PUT("/me/settings", h.UpdateSettings)
	auth.POST("/me/settings/test", h.TestSettings)
}

// GetAuthProviders returns available authentication providers and their configuration status.
func (h *AuthHandler) GetAuthProviders(c *gin.Context) {
	_, err := h.authService.GetGitHubAuthURL("test")
	githubAvailable := err == nil
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"providers": gin.H{
				"email":  true,
				"github": githubAvailable,
			},
		},
	})
}

// Register handles user registration.
func (h *AuthHandler) Register(c *gin.Context) {
	tracer := otel.Tracer("user-service")
	ctx, span := tracer.Start(c.Request.Context(), "Register")
	defer span.End()

	var req domain.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondWithValidationError(c, err)
		return
	}

	resp, err := h.authService.Register(ctx, req)
	if err != nil {
		switch err {
		case service.ErrEmailExists:
			respondWithError(c, http.StatusConflict, "USER_EXISTS", "Email already registered")
		default:
			respondWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to register user")
		}
		return
	}

	span.SetAttributes(attribute.String("user_id", resp.User.ID.String()))
	c.JSON(http.StatusCreated, gin.H{"success": true, "data": gin.H{
		"user":  resp.User.SafeResponse(),
		"token": resp.Token,
	}})
}

// Login handles user login.
func (h *AuthHandler) Login(c *gin.Context) {
	tracer := otel.Tracer("user-service")
	ctx, span := tracer.Start(c.Request.Context(), "Login")
	defer span.End()

	var req domain.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondWithValidationError(c, err)
		return
	}

	resp, err := h.authService.Login(ctx, req)
	if err != nil {
		switch err {
		case service.ErrInvalidCredentials:
			respondWithError(c, http.StatusUnauthorized, "INVALID_CREDENTIALS", "Invalid email or password")
		default:
			respondWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Login failed")
		}
		return
	}

	span.SetAttributes(attribute.String("user_id", resp.User.ID.String()))
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
		"user":  resp.User.SafeResponse(),
		"token": resp.Token,
	}})
}

// RefreshToken handles token refresh.
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	var req domain.RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondWithValidationError(c, err)
		return
	}

	tokens, err := h.authService.RefreshToken(c.Request.Context(), req.RefreshToken)
	if err != nil {
		respondWithError(c, http.StatusUnauthorized, "TOKEN_EXPIRED", "Invalid or expired refresh token")
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
		respondWithError(c, http.StatusServiceUnavailable, "OAUTH_NOT_CONFIGURED", "GitHub OAuth not configured. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables.")
		return
	}
	c.Redirect(http.StatusFound, authURL)
}

// GitHubCallback handles GitHub OAuth callback.
func (h *AuthHandler) GitHubCallback(c *gin.Context) {
	code := c.Query("code")
	state := c.Query("state")

	if code == "" {
		respondWithError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Missing authorization code")
		return
	}

	if !validateState(state) {
		// Strict state validation in production; relaxed in development for testing
		if os.Getenv("ENV") == "production" {
			respondWithError(c, http.StatusBadRequest, "INVALID_STATE", "Invalid or expired state")
			return
		}
		// In development, log but continue
		fmt.Printf("[WARN] Invalid or expired OAuth state in development: %s\n", state)
	}

	resp, err := h.authService.HandleGitHubCallback(c.Request.Context(), code)
	if err != nil {
		respondWithError(c, http.StatusInternalServerError, "OAUTH_ERROR", "GitHub OAuth authentication failed")
		return
	}

	// Redirect to /login with token in URL hash.
	// /login is a public route (middleware won't intercept), and AuthProvider
	// on the login page will detect the hash, extract tokens, then auto-redirect
	// to the home page.
	frontendURL := "http://localhost:3000/login"
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
		respondWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
		return
	}

	userIDUUID, err := uuid.Parse(userIDStr)
	if err != nil {
		respondWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "Invalid user ID format")
		return
	}

	user, err := h.authService.GetUserByID(c.Request.Context(), userIDUUID)
	if err != nil {
		respondWithError(c, http.StatusNotFound, "NOT_FOUND", "User not found")
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": user.SafeResponse()})
}

// GetSettings returns the current user's LLM settings.
// When called internally (X-Internal-Request header), returns the raw decrypted API key.
func (h *AuthHandler) GetSettings(c *gin.Context) {
	userIDStr, ok := getUserID(c)
	if !ok {
		respondWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
		return
	}

	userIDUUID, err := uuid.Parse(userIDStr)
	if err != nil {
		respondWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "Invalid user ID format")
		return
	}

	settings, err := h.authService.GetUserSettings(c.Request.Context(), userIDUUID)
	if err != nil {
		switch err {
		case service.ErrUserNotFound:
			respondWithError(c, http.StatusNotFound, "NOT_FOUND", "User not found")
		default:
			respondWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to retrieve settings")
		}
		return
	}

	// Internal service calls (e.g. Gateway) need the raw decrypted API key
	if c.GetHeader("X-Internal-Request") == "true" {
		decrypted, err := h.authService.GetUserAPIKeyForTesting(c.Request.Context(), userIDUUID)
		if err == nil && decrypted != "" {
			settings.APIKey = decrypted
		}
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": settings})
}

// UpdateSettings updates the current user's LLM settings.
func (h *AuthHandler) UpdateSettings(c *gin.Context) {
	userIDStr, ok := getUserID(c)
	if !ok {
		respondWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
		return
	}

	userIDUUID, err := uuid.Parse(userIDStr)
	if err != nil {
		respondWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "Invalid user ID format")
		return
	}

	var req domain.UpdateSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondWithValidationError(c, err)
		return
	}

	settings, err := h.authService.UpdateUserSettings(c.Request.Context(), userIDUUID, req)
	if err != nil {
		switch err {
		case service.ErrUserNotFound:
			respondWithError(c, http.StatusNotFound, "NOT_FOUND", "User not found")
		default:
			respondWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to update settings")
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": settings})
}

// TestSettings tests LLM connectivity with the provided configuration.
func (h *AuthHandler) TestSettings(c *gin.Context) {
	userIDStr, ok := getUserID(c)
	if !ok {
		respondWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
		return
	}

	userIDUUID, err := uuid.Parse(userIDStr)
	if err != nil {
		respondWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "Invalid user ID format")
		return
	}

	var req domain.TestLLMRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondWithValidationError(c, err)
		return
	}

	// If API key is masked, use the user's stored key for testing
	if strings.Contains(req.LLM.APIKey, "***") {
		decryptedKey, err := h.authService.GetUserAPIKeyForTesting(c.Request.Context(), userIDUUID)
		if err == nil && decryptedKey != "" {
			req.LLM.APIKey = decryptedKey
		} else {
			req.LLM.APIKey = ""
		}
	}

	if err := h.authService.TestLLMConnection(c.Request.Context(), req.LLM); err != nil {
		respondWithError(c, http.StatusOK, "LLM_CONNECTION_FAILED", err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Connection successful"})
}

// AuthMiddleware validates JWT access tokens and injects userID into context.
func (h *AuthHandler) AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			respondWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "Missing authorization header")
			c.Abort()
			return
		}

		// Extract Bearer token
		var tokenString string
		if _, err := fmt.Sscanf(authHeader, "Bearer %s", &tokenString); err != nil {
			respondWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "Invalid authorization header format")
			c.Abort()
			return
		}

		userID, err := h.authService.ValidateToken(tokenString)
		if err != nil {
			respondWithError(c, http.StatusUnauthorized, "TOKEN_EXPIRED", "Invalid or expired token")
			c.Abort()
			return
		}

		c.Set("userID", userID.String())
		c.Next()
	}
}
