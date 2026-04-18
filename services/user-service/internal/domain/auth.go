// Package domain defines authentication-related structures.
package domain

// RegisterRequest represents a user registration request.
type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
	Username string `json:"username" binding:"required,min=2,max=50"`
}

// LoginRequest represents a user login request.
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// TokenPair contains access and refresh tokens.
type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"` // seconds
}

// AuthResponse is the unified response for register/login.
type AuthResponse struct {
	User  User      `json:"user"`
	Token TokenPair `json:"token"`
}

// RefreshRequest represents a token refresh request.
type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

// GitHubOAuthState stores state for OAuth CSRF protection.
type GitHubOAuthState struct {
	State     string    `json:"state"`
	ExpiresAt int64     `json:"expires_at"` // Unix timestamp
}
