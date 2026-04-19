// Package repository handles database operations for memory entities.
package repository

import (
	"context"
	"errors"

	"github.com/NebulaVzx/Echoes/services/memory-service/internal/domain"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrMemoryNotFound = errors.New("memory not found")
)

// MemoryRepository defines the interface for memory data access.
type MemoryRepository interface {
	Create(ctx context.Context, memory *domain.Memory) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.Memory, error)
	ListByUser(ctx context.Context, userID uuid.UUID, page, limit int, tag string) ([]domain.Memory, int64, error)
	Update(ctx context.Context, memory *domain.Memory) error
	UpdateVector(ctx context.Context, id uuid.UUID, vector string) error
	Delete(ctx context.Context, id uuid.UUID, userID uuid.UUID) error
}

// GormMemoryRepository implements MemoryRepository using GORM.
type GormMemoryRepository struct {
	db *gorm.DB
}

// NewGormMemoryRepository creates a new GORM-based memory repository.
func NewGormMemoryRepository(db *gorm.DB) MemoryRepository {
	return &GormMemoryRepository{db: db}
}

// Create inserts a new memory into the database.
func (r *GormMemoryRepository) Create(ctx context.Context, memory *domain.Memory) error {
	return r.db.WithContext(ctx).Create(memory).Error
}

// GetByID retrieves a memory by its UUID.
func (r *GormMemoryRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.Memory, error) {
	var memory domain.Memory
	result := r.db.WithContext(ctx).First(&memory, "id = ?", id)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrMemoryNotFound
		}
		return nil, result.Error
	}
	return &memory, nil
}

// ListByUser retrieves memories for a user with pagination and optional tag filter.
func (r *GormMemoryRepository) ListByUser(ctx context.Context, userID uuid.UUID, page, limit int, tag string) ([]domain.Memory, int64, error) {
	var memories []domain.Memory
	var total int64

	query := r.db.WithContext(ctx).Model(&domain.Memory{}).Where("user_id = ?", userID)
	if tag != "" {
		query = query.Where("? = ANY(tags)", tag)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	result := query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&memories)
	if result.Error != nil {
		return nil, 0, result.Error
	}

	return memories, total, nil
}

// Update modifies an existing memory.
func (r *GormMemoryRepository) Update(ctx context.Context, memory *domain.Memory) error {
	return r.db.WithContext(ctx).Save(memory).Error
}

// UpdateVector updates the vector field for a memory using pgvector syntax.
func (r *GormMemoryRepository) UpdateVector(ctx context.Context, id uuid.UUID, vector string) error {
	result := r.db.WithContext(ctx).Table("memories").Where("id = ?", id).Update("vector", gorm.Expr("?::vector", vector))
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrMemoryNotFound
	}
	return nil
}

// Delete removes a memory by ID, ensuring it belongs to the user.
func (r *GormMemoryRepository) Delete(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	result := r.db.WithContext(ctx).Where("id = ? AND user_id = ?", id, userID).Delete(&domain.Memory{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrMemoryNotFound
	}
	return nil
}
