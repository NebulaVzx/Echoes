// Package service implements the authentication business logic.
package service

import (
	"context"
	"errors"
	"fmt"
	"os"
	"time"

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
		secret = "echoes_dev_secret_key_change_in_production"
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
