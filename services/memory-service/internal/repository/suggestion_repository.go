// Package repository handles database operations for AI suggestion entities.
package repository

import (
	"context"
	"errors"

	"github.com/NebulaVzx/Echoes/services/memory-service/internal/domain"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrSuggestionNotFound = errors.New("suggestion not found")
)

// SuggestionRepository defines the interface for AI suggestion data access.
type SuggestionRepository interface {
	Create(ctx context.Context, suggestion *domain.AISuggestion) error
	GetByMemoryID(ctx context.Context, memoryID uuid.UUID) (*domain.AISuggestion, error)
	UpdateFeedback(ctx context.Context, memoryID uuid.UUID, feedback string) error
	DeleteByMemoryID(ctx context.Context, memoryID uuid.UUID) error
}

// GormSuggestionRepository implements SuggestionRepository using GORM.
type GormSuggestionRepository struct {
	db *gorm.DB
}

// NewGormSuggestionRepository creates a new GORM-based suggestion repository.
func NewGormSuggestionRepository(db *gorm.DB) SuggestionRepository {
	return &GormSuggestionRepository{db: db}
}

// Create inserts a new AI suggestion into the database.
func (r *GormSuggestionRepository) Create(ctx context.Context, suggestion *domain.AISuggestion) error {
	return r.db.WithContext(ctx).Create(suggestion).Error
}

// GetByMemoryID retrieves a suggestion by its associated memory ID.
// Returns ErrSuggestionNotFound if no suggestion exists for the memory.
func (r *GormSuggestionRepository) GetByMemoryID(ctx context.Context, memoryID uuid.UUID) (*domain.AISuggestion, error) {
	var suggestion domain.AISuggestion
	result := r.db.WithContext(ctx).Where("memory_id = ?", memoryID).First(&suggestion)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrSuggestionNotFound
		}
		return nil, result.Error
	}
	return &suggestion, nil
}

// UpdateFeedback updates the user_feedback field for a suggestion identified by memory_id.
func (r *GormSuggestionRepository) UpdateFeedback(ctx context.Context, memoryID uuid.UUID, feedback string) error {
	result := r.db.WithContext(ctx).Model(&domain.AISuggestion{}).
		Where("memory_id = ?", memoryID).
		Update("user_feedback", feedback)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrSuggestionNotFound
	}
	return nil
}

// DeleteByMemoryID removes a suggestion by memory ID (used for cleanup).
func (r *GormSuggestionRepository) DeleteByMemoryID(ctx context.Context, memoryID uuid.UUID) error {
	return r.db.WithContext(ctx).Where("memory_id = ?", memoryID).Delete(&domain.AISuggestion{}).Error
}
