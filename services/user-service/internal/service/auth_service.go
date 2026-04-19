// Package service implements the authentication business logic.
package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/NebulaVzx/Echoes/services/user-service/internal/crypto"
	"github.com/NebulaVzx/Echoes/services/user-service/internal/domain"
	"github.com/NebulaVzx/Echoes/services/user-service/internal/repository"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrEmailExists        = errors.New("email already registered")
	ErrUserNotFound       = errors.New("user not found")
	ErrInvalidToken       = errors.New("invalid or expired token")
)

// AuthService handles user authentication business logic.
type AuthService struct {
	repo      repository.UserRepository
	jwtSecret []byte
}

// NewAuthService creates a new authentication service.
func NewAuthService(repo repository.UserRepository) *AuthService {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		log.Fatal("JWT_SECRET environment variable is required but not set")
	}
	return &AuthService{
		repo:      repo,
		jwtSecret: []byte(secret),
	}
}

// Register creates a new user with email and password.
func (s *AuthService) Register(ctx context.Context, req domain.RegisterRequest) (*domain.AuthResponse, error) {
	// Hash password with bcrypt (cost=12)
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	user := &domain.User{
		ID:           uuid.New(),
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		Username:     req.Username,
		IsActive:     true,
	}

	if err := s.repo.Create(ctx, user); err != nil {
		if errors.Is(err, repository.ErrEmailExists) {
			return nil, ErrEmailExists
		}
		return nil, err
	}

	tokens, err := s.generateTokens(user.ID)
	if err != nil {
		return nil, err
	}

	return &domain.AuthResponse{
		User:  *user,
		Token: *tokens,
	}, nil
}

// Login authenticates a user with email and password.
func (s *AuthService) Login(ctx context.Context, req domain.LoginRequest) (*domain.AuthResponse, error) {
	user, err := s.repo.GetByEmail(ctx, req.Email)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	tokens, err := s.generateTokens(user.ID)
	if err != nil {
		return nil, err
	}

	return &domain.AuthResponse{
		User:  *user,
		Token: *tokens,
	}, nil
}

// GetUserByID retrieves a user by their ID.
func (s *AuthService) GetUserByID(ctx context.Context, id uuid.UUID) (*domain.User, error) {
	user, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return user, nil
}

// GetUserSettings retrieves a user's LLM settings.
// The API key is decrypted and masked for safe display.
func (s *AuthService) GetUserSettings(ctx context.Context, id uuid.UUID) (*domain.LLMSettings, error) {
	user, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}

	var settings domain.LLMSettings
	if len(user.Settings) > 0 && string(user.Settings) != "{}" && string(user.Settings) != "null" {
		if err := json.Unmarshal(user.Settings, &settings); err != nil {
			return &domain.LLMSettings{}, nil
		}
	}

	// Decrypt and mask API key for display
	if settings.APIKey != "" {
		decrypted, err := crypto.Decrypt(settings.APIKey)
		if err == nil && decrypted != "" {
			settings.APIKey = crypto.MaskAPIKey(decrypted)
		}
	}
	return &settings, nil
}

// UpdateUserSettings updates a user's LLM settings.
// API keys are encrypted before storage. If the request contains a masked key,
// the existing key is preserved.
func (s *AuthService) UpdateUserSettings(ctx context.Context, id uuid.UUID, req domain.UpdateSettingsRequest) (*domain.LLMSettings, error) {
	user, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}

	// Parse existing settings to preserve API key if masked in request
	var existing domain.LLMSettings
	if len(user.Settings) > 0 && string(user.Settings) != "{}" && string(user.Settings) != "null" {
		_ = json.Unmarshal(user.Settings, &existing)
	}

	// Handle API key: if masked or empty, preserve existing encrypted key
	newKey := req.LLM.APIKey
	if newKey == "" || strings.Contains(newKey, "***") {
		req.LLM.APIKey = existing.APIKey // keep encrypted value
	} else {
		// Encrypt the new API key
		encrypted, err := crypto.Encrypt(newKey)
		if err != nil {
			return nil, fmt.Errorf("failed to encrypt API key: %w", err)
		}
		req.LLM.APIKey = encrypted
	}

	settingsJSON, err := json.Marshal(req.LLM)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal settings: %w", err)
	}

	user.Settings = settingsJSON
	if err := s.repo.Update(ctx, user); err != nil {
		return nil, fmt.Errorf("failed to update user settings: %w", err)
	}

	// Return with masked key for response
	resp := req.LLM
	if resp.APIKey != "" {
		decrypted, _ := crypto.Decrypt(resp.APIKey)
		if decrypted != "" {
			resp.APIKey = crypto.MaskAPIKey(decrypted)
		}
	}
	return &resp, nil
}

// TestLLMConnection attempts to connect to the specified LLM provider with the given config.
func (s *AuthService) TestLLMConnection(ctx context.Context, llm domain.LLMSettings) error {
	provider := strings.ToLower(llm.Provider)
	if provider == "" {
		provider = "openai"
	}

	apiKey := llm.APIKey
	if strings.Contains(apiKey, "***") {
		// Masked key means "keep existing" — fetch user's actual key for test
		// This should be handled by the caller (handler) providing the decrypted key
		apiKey = ""
	}

	switch provider {
	case "openai":
		return testOpenAI(ctx, llm.Model, apiKey)
	case "anthropic":
		return testAnthropic(ctx, llm.Model, apiKey)
	default:
		return fmt.Errorf("unsupported provider: %s", provider)
	}
}

func testOpenAI(ctx context.Context, model, apiKey string) error {
	if apiKey == "" {
		apiKey = os.Getenv("OPENAI_API_KEY")
	}
	if apiKey == "" {
		return errors.New("OpenAI API Key 未配置")
	}
	if model == "" {
		model = "gpt-4o-mini"
	}

	body, _ := json.Marshal(map[string]interface{}{
		"model":       model,
		"messages":    []map[string]string{{"role": "user", "content": "hi"}},
		"max_tokens":  1,
	})
	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.openai.com/v1/chat/completions", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("连接 OpenAI 失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errResp struct {
			Error struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&errResp)
		if errResp.Error.Message != "" {
			return fmt.Errorf("OpenAI 错误: %s", errResp.Error.Message)
		}
		return fmt.Errorf("OpenAI 返回 HTTP %d", resp.StatusCode)
	}
	return nil
}

func testAnthropic(ctx context.Context, model, apiKey string) error {
	if apiKey == "" {
		apiKey = os.Getenv("ANTHROPIC_API_KEY")
	}
	if apiKey == "" {
		return errors.New("Anthropic API Key 未配置")
	}
	if model == "" {
		model = "claude-sonnet-4-20250514"
	}

	body, _ := json.Marshal(map[string]interface{}{
		"model":      model,
		"max_tokens": 1,
		"messages":   []map[string]string{{"role": "user", "content": "hi"}},
	})
	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("连接 Anthropic 失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errResp struct {
			Error struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&errResp)
		if errResp.Error.Message != "" {
			return fmt.Errorf("Anthropic 错误: %s", errResp.Error.Message)
		}
		return fmt.Errorf("Anthropic 返回 HTTP %d", resp.StatusCode)
	}
	return nil
}

// RefreshToken generates a new access token from a valid refresh token.
func (s *AuthService) RefreshToken(ctx context.Context, refreshToken string) (*domain.TokenPair, error) {
	claims, err := s.parseToken(refreshToken)
	if err != nil {
		return nil, ErrInvalidToken
	}

	userID, err := uuid.Parse(claims.Subject)
	if err != nil {
		return nil, ErrInvalidToken
	}

	// Verify user still exists
	_, err = s.repo.GetByID(ctx, userID)
	if err != nil {
		return nil, ErrInvalidToken
	}

	return s.generateTokens(userID)
}

// ValidateToken parses and validates a JWT access token.
func (s *AuthService) ValidateToken(tokenString string) (uuid.UUID, error) {
	claims, err := s.parseToken(tokenString)
	if err != nil {
		return uuid.Nil, ErrInvalidToken
	}

	userID, err := uuid.Parse(claims.Subject)
	if err != nil {
		return uuid.Nil, ErrInvalidToken
	}

	return userID, nil
}

// tokenClaims defines the JWT claims structure.
type tokenClaims struct {
	jwt.RegisteredClaims
}

// generateTokens creates a new access and refresh token pair.
func (s *AuthService) generateTokens(userID uuid.UUID) (*domain.TokenPair, error) {
	now := time.Now()

	// Access token: 15 minutes
	accessClaims := tokenClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(15 * time.Minute)),
		},
	}
	accessToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims).SignedString(s.jwtSecret)
	if err != nil {
		return nil, fmt.Errorf("failed to sign access token: %w", err)
	}

	// Refresh token: 7 days
	refreshClaims := tokenClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(7 * 24 * time.Hour)),
		},
	}
	refreshToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims).SignedString(s.jwtSecret)
	if err != nil {
		return nil, fmt.Errorf("failed to sign refresh token: %w", err)
	}

	return &domain.TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    900, // 15 minutes in seconds
	}, nil
}

// parseToken validates and parses a JWT token string.
func (s *AuthService) parseToken(tokenString string) (*tokenClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &tokenClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return s.jwtSecret, nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*tokenClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token claims")
	}

	return claims, nil
}

// GitHub OAuth helpers

// ErrOAuthNotConfigured is returned when GitHub OAuth environment variables are not set.
var ErrOAuthNotConfigured = fmt.Errorf("GitHub OAuth not configured: GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must be set")

// GetGitHubAuthURL generates the GitHub OAuth authorization URL.
func (s *AuthService) GetGitHubAuthURL(state string) (string, error) {
	clientID := os.Getenv("GITHUB_CLIENT_ID")
	if clientID == "" {
		return "", ErrOAuthNotConfigured
	}
	redirectURI := os.Getenv("GITHUB_REDIRECT_URI")
	if redirectURI == "" {
		redirectURI = "http://localhost:8088/api/v1/auth/github/callback"
	}
	return fmt.Sprintf(
		"https://github.com/login/oauth/authorize?client_id=%s&redirect_uri=%s&scope=user:email&state=%s",
		clientID, redirectURI, state,
	), nil
}

// GitHubUserInfo holds the user data from GitHub API.
type GitHubUserInfo struct {
	ID        int64  `json:"id"`
	Login     string `json:"login"`
	Email     string `json:"email"`
	AvatarURL string `json:"avatar_url"`
	Name      string `json:"name"`
}

// HandleGitHubCallback exchanges the code for an access token, fetches user info,
// and creates or logs in the user.
func (s *AuthService) HandleGitHubCallback(ctx context.Context, code string) (*domain.AuthResponse, error) {
	clientID := os.Getenv("GITHUB_CLIENT_ID")
	clientSecret := os.Getenv("GITHUB_CLIENT_SECRET")
	redirectURI := os.Getenv("GITHUB_REDIRECT_URI")
	if redirectURI == "" {
		redirectURI = "http://localhost:8088/api/v1/auth/github/callback"
	}

	// 1. Exchange code for access token
	tokenReqBody := fmt.Sprintf(
		"client_id=%s&client_secret=%s&code=%s&redirect_uri=%s",
		clientID, clientSecret, code, redirectURI,
	)
	req, err := http.NewRequestWithContext(ctx, "POST", "https://github.com/login/oauth/access_token", strings.NewReader(tokenReqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create token request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to exchange code: %w", err)
	}
	defer resp.Body.Close()

	var tokenResp struct {
		AccessToken string `json:"access_token"`
		TokenType   string `json:"token_type"`
		Scope       string `json:"scope"`
		Error       string `json:"error"`
		ErrorDesc   string `json:"error_description"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, fmt.Errorf("failed to decode token response: %w", err)
	}
	if tokenResp.Error != "" {
		return nil, fmt.Errorf("github error: %s - %s", tokenResp.Error, tokenResp.ErrorDesc)
	}

	// 2. Fetch user info from GitHub
	userReq, err := http.NewRequestWithContext(ctx, "GET", "https://api.github.com/user", nil)
	if err != nil {
		return nil, err
	}
	userReq.Header.Set("Authorization", "Bearer "+tokenResp.AccessToken)
	userReq.Header.Set("Accept", "application/vnd.github.v3+json")

	userResp, err := http.DefaultClient.Do(userReq)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch user info: %w", err)
	}
	defer userResp.Body.Close()

	var githubUser GitHubUserInfo
	if err := json.NewDecoder(userResp.Body).Decode(&githubUser); err != nil {
		return nil, fmt.Errorf("failed to decode user info: %w", err)
	}

	if githubUser.ID == 0 {
		return nil, errors.New("failed to get github user info")
	}

	// 3. Try to find existing user by OAuth
	oauthID := fmt.Sprintf("%d", githubUser.ID)
	user, err := s.repo.GetByOAuth(ctx, "github", oauthID)
	if err != nil && !errors.Is(err, repository.ErrUserNotFound) {
		return nil, err
	}

	// 4. Create user if not exists (or link to existing user with same email)
	if user == nil {
		email := githubUser.Email
		if email == "" {
			email = fmt.Sprintf("%s@github.local", githubUser.Login)
		}
		username := githubUser.Name
		if username == "" {
			username = githubUser.Login
		}

		user = &domain.User{
			ID:            uuid.New(),
			Email:         email,
			Username:      username,
			AvatarURL:     githubUser.AvatarURL,
			OAuthProvider: "github",
			OAuthID:       oauthID,
			IsActive:      true,
		}
		if err := s.repo.Create(ctx, user); err != nil {
			if errors.Is(err, repository.ErrEmailExists) {
				// Try to find and link existing user with the same email
				existingUser, getErr := s.repo.GetByEmail(ctx, email)
				if getErr == nil && existingUser != nil {
					existingUser.OAuthProvider = "github"
					existingUser.OAuthID = oauthID
					if existingUser.AvatarURL == "" {
						existingUser.AvatarURL = githubUser.AvatarURL
					}
					if err := s.repo.Update(ctx, existingUser); err != nil {
						return nil, fmt.Errorf("failed to link oauth to existing user: %w", err)
					}
					user = existingUser
				} else {
					return nil, fmt.Errorf("failed to create oauth user: %w", err)
				}
			} else {
				return nil, fmt.Errorf("failed to create oauth user: %w", err)
			}
		}
	}

	// 5. Generate tokens
	tokens, err := s.generateTokens(user.ID)
	if err != nil {
		return nil, err
	}

	return &domain.AuthResponse{
		User:  *user,
		Token: *tokens,
	}, nil
}
