// Package repository handles database operations for user entities.
package repository

import (
	"context"
	"errors"

	"github.com/NebulaVzx/Echoes/services/user-service/internal/domain"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrUserNotFound = errors.New("user not found")
	ErrEmailExists  = errors.New("email already exists")
)

// UserRepository defines the interface for user data access.
type UserRepository interface {
	Create(ctx context.Context, user *domain.User) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.User, error)
	GetByEmail(ctx context.Context, email string) (*domain.User, error)
	GetByOAuth(ctx context.Context, provider, oauthID string) (*domain.User, error)
	Update(ctx context.Context, user *domain.User) error
}

// GormUserRepository implements UserRepository using GORM.
type GormUserRepository struct {
	db *gorm.DB
}

// NewGormUserRepository creates a new GORM-based user repository.
func NewGormUserRepository(db *gorm.DB) UserRepository {
	return &GormUserRepository{db: db}
}

// Create inserts a new user into the database.
func (r *GormUserRepository) Create(ctx context.Context, user *domain.User) error {
	// Check for existing email first to return a clean error
	var count int64
	r.db.WithContext(ctx).Model(&domain.User{}).Where("email = ?", user.Email).Count(&count)
	if count > 0 {
		return ErrEmailExists
	}

	result := r.db.WithContext(ctx).Create(user)
	if result.Error != nil {
		return result.Error
	}
	return nil
}

// GetByID retrieves a user by their UUID.
func (r *GormUserRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.User, error) {
	var user domain.User
	result := r.db.WithContext(ctx).First(&user, "id = ?", id)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, result.Error
	}
	return &user, nil
}

// GetByEmail retrieves a user by their email address.
func (r *GormUserRepository) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	var user domain.User
	result := r.db.WithContext(ctx).First(&user, "email = ?", email)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, result.Error
	}
	return &user, nil
}

// GetByOAuth retrieves a user by their OAuth provider and ID.
func (r *GormUserRepository) GetByOAuth(ctx context.Context, provider, oauthID string) (*domain.User, error) {
	var user domain.User
	result := r.db.WithContext(ctx).First(&user, "oauth_provider = ? AND oauth_id = ?", provider, oauthID)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, result.Error
	}
	return &user, nil
}

// Update modifies an existing user's fields.
func (r *GormUserRepository) Update(ctx context.Context, user *domain.User) error {
	return r.db.WithContext(ctx).Save(user).Error
}

// isDuplicateKeyError checks if the error is a PostgreSQL unique constraint violation.
func isDuplicateKeyError(err error) bool {
	if err == nil {
		return false
	}
	// PostgreSQL unique violation code: 23505
	return errors.Is(err, gorm.ErrDuplicatedKey)
}
