// Package repository handles database operations for memory relations.
package repository

import (
	"context"
	"errors"

	"github.com/NebulaVzx/Echoes/services/memory-service/internal/domain"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrRelationNotFound = errors.New("relation not found")
)

// RelationRepository defines the interface for memory relation data access.
type RelationRepository interface {
	// GetReason retrieves a cached association reason for a source-target pair.
	// Returns ErrRelationNotFound if no cached reason exists.
	GetReason(ctx context.Context, sourceID, targetID uuid.UUID) (string, error)

	// Save stores a new relation with its reason. If the pair already exists, updates the reason.
	Save(ctx context.Context, sourceID, targetID uuid.UUID, similarity float64, reason string) error

	// GetRelations retrieves all cached relations for a given source memory.
	GetRelations(ctx context.Context, sourceID uuid.UUID) ([]domain.Relation, error)
}

// GormRelationRepository implements RelationRepository using GORM.
type GormRelationRepository struct {
	db *gorm.DB
}

// NewGormRelationRepository creates a new GORM-based relation repository.
func NewGormRelationRepository(db *gorm.DB) RelationRepository {
	return &GormRelationRepository{db: db}
}

// GetReason retrieves the cached reason for a source-target pair.
func (r *GormRelationRepository) GetReason(ctx context.Context, sourceID, targetID uuid.UUID) (string, error) {
	var relation domain.Relation
	result := r.db.WithContext(ctx).
		Where("(source_id = ? AND target_id = ?) OR (source_id = ? AND target_id = ?)",
			sourceID, targetID, targetID, sourceID).
		First(&relation)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return "", ErrRelationNotFound
		}
		return "", result.Error
	}
	return relation.Reason, nil
}

// Save stores a relation. Uses ON CONFLICT to update existing pairs.
func (r *GormRelationRepository) Save(ctx context.Context, sourceID, targetID uuid.UUID, similarity float64, reason string) error {
	// Ensure consistent ordering: source_id < target_id for uniqueness
	s1, s2 := sourceID, targetID
	if sourceID.String() > targetID.String() {
		s1, s2 = targetID, sourceID
	}

	relation := domain.Relation{
		SourceID:   s1,
		TargetID:   s2,
		Similarity: similarity,
		Reason:     reason,
	}

	return r.db.WithContext(ctx).Save(&relation).Error
}

// GetRelations retrieves all cached relations for a source memory.
func (r *GormRelationRepository) GetRelations(ctx context.Context, sourceID uuid.UUID) ([]domain.Relation, error) {
	var relations []domain.Relation
	err := r.db.WithContext(ctx).
		Where("source_id = ? OR target_id = ?", sourceID, sourceID).
		Find(&relations).Error
	return relations, err
}
