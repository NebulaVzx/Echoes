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

// LLMSettings represents per-user LLM configuration.
type LLMSettings struct {
	Provider    string  `json:"llm_provider" binding:"omitempty,oneof=openai anthropic"`
	Model       string  `json:"llm_model" binding:"omitempty,max=100"`
	Temperature float64 `json:"llm_temperature" binding:"omitempty,gte=0,lte=2"`
	APIKey      string  `json:"api_key,omitempty" binding:"omitempty"`
}

// UpdateSettingsRequest represents a request to update user settings.
type UpdateSettingsRequest struct {
	LLM LLMSettings `json:"llm" binding:"required"`
}

// TestLLMRequest represents a request to test LLM connectivity.
type TestLLMRequest struct {
	LLM LLMSettings `json:"llm" binding:"required"`
}

// GitHubOAuthState stores state for OAuth CSRF protection.
type GitHubOAuthState struct {
	State     string `json:"state"`
	ExpiresAt int64  `json:"expires_at"` // Unix timestamp
}
