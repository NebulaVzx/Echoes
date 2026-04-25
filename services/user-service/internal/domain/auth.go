// Package domain defines authentication-related structures.
package domain

import "strconv"

// RegisterRequest represents a user registration request.
type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email,max=255"`
	Password string `json:"password" binding:"required,min=8,max=128"`
	Username string `json:"username" binding:"required,min=2,max=50"`
}

// LoginRequest represents a user login request.
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email,max=255"`
	Password string `json:"password" binding:"required,max=128"`
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
	Provider              string      `json:"llm_provider" binding:"omitempty,max=50"`
	Protocol              string      `json:"llm_protocol" binding:"omitempty,oneof=openai anthropic"`
	Model                 string      `json:"llm_model" binding:"omitempty,max=100"`
	Temperature           interface{} `json:"llm_temperature" binding:"omitempty"`
	APIKey                string      `json:"api_key,omitempty" binding:"omitempty,max=500"`
	BaseURL               string      `json:"base_url,omitempty" binding:"omitempty,url,max=500"`
	IncludeNoteInAnalysis bool        `json:"include_note_in_analysis" binding:"omitempty"`
}

// GetTemperature returns the temperature as a float64, defaulting to 0.7.
func (s LLMSettings) GetTemperature() float64 {
	switch v := s.Temperature.(type) {
	case float64:
		return v
	case string:
		f, err := strconv.ParseFloat(v, 64)
		if err == nil {
			return f
		}
	}
	return 0.7
}

// SearchSettings represents per-user search configuration.
type SearchSettings struct {
	SimilarityThreshold float64 `json:"similarity_threshold,omitempty" binding:"omitempty,gte=0,lte=1"`
}

// RAGSettings represents per-user RAG configuration.
type RAGSettings struct {
	MemoryLimit int `json:"rag_memory_limit,omitempty" binding:"omitempty,gte=1,lte=20"`
}

// PaginationSettings represents per-user pagination preferences.
type PaginationSettings struct {
	Mode string `json:"mode,omitempty" binding:"omitempty,oneof=load_more page_numbers"`
}

// UserSettings represents the complete user settings.
type UserSettings struct {
	LLMSettings
	SearchSimilarityThreshold float64 `json:"search_similarity_threshold,omitempty" binding:"omitempty,gte=0,lte=1"`
	RAGMemoryLimit            int     `json:"rag_memory_limit,omitempty" binding:"omitempty,gte=1,lte=20"`
	PaginationMode            string  `json:"pagination_mode,omitempty" binding:"omitempty,oneof=load_more page_numbers"`
}

// UpdateSettingsRequest represents a request to update user settings.
type UpdateSettingsRequest struct {
	LLM        *LLMSettings        `json:"llm,omitempty"`
	Search     *SearchSettings     `json:"search,omitempty"`
	RAG        *RAGSettings        `json:"rag,omitempty"`
	Pagination *PaginationSettings `json:"pagination,omitempty"`
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
