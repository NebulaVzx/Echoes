// Package repository handles database operations for memory entities.
package repository

import (
	"context"
	"errors"

	"github.com/NebulaVzx/Echoes/services/memory-service/internal/domain"
	"github.com/google/uuid"
	"github.com/lib/pq"
	"gorm.io/gorm"
)

var (
	ErrMemoryNotFound = errors.New("memory not found")
)

// MemoryRepository defines the interface for memory data access.
type MemoryRepository interface {
	Create(ctx context.Context, memory *domain.Memory) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.Memory, error)
	GetVectorByID(ctx context.Context, id uuid.UUID) (string, error)
	ListByUser(ctx context.Context, userID uuid.UUID, page, limit int, tags []string) ([]domain.Memory, int64, error)
	Update(ctx context.Context, memory *domain.Memory) error
	UpdateVector(ctx context.Context, id uuid.UUID, vector string) error
	Delete(ctx context.Context, id uuid.UUID, userID uuid.UUID) error
	SearchByVector(ctx context.Context, userID uuid.UUID, vector string, limit int, threshold float64) ([]domain.SearchResult, error)
	FindRelated(ctx context.Context, userID uuid.UUID, memoryID uuid.UUID, vector string, limit int, threshold float64) ([]domain.SearchResult, error)
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
// Supports multi-tag AND filtering using tags @> ARRAY[...].
func (r *GormMemoryRepository) ListByUser(ctx context.Context, userID uuid.UUID, page, limit int, tags []string) ([]domain.Memory, int64, error) {
	var memories []domain.Memory
	var total int64

	query := r.db.WithContext(ctx).Model(&domain.Memory{}).Where("user_id = ?", userID)
	if len(tags) > 0 {
		query = query.Where("tags @> ?", pq.Array(tags))
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

// GetVectorByID retrieves just the vector field for a memory by its UUID.
// Needed because the domain.Memory struct has Vector marked as read/write skip for GORM.
func (r *GormMemoryRepository) GetVectorByID(ctx context.Context, id uuid.UUID) (string, error) {
	var vector string
	err := r.db.WithContext(ctx).Raw("SELECT vector::text FROM memories WHERE id = ?", id).Scan(&vector).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", ErrMemoryNotFound
		}
		return "", err
	}
	return vector, nil
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

// SearchByVector performs semantic search using pgvector cosine similarity.
// threshold 0.75 means distance <= 0.25 (pgvector <=> returns cosine distance).
func (r *GormMemoryRepository) SearchByVector(ctx context.Context, userID uuid.UUID, vector string, limit int, threshold float64) ([]domain.SearchResult, error) {
	var results []domain.SearchResult
	distanceThreshold := 1.0 - threshold
	query := `
		SELECT id, user_id, content_type, text_content, link_url, link_title, link_summary,
			   tags, note, processing_status, visibility, created_at, updated_at,
			   1 - (vector <=> ?::vector) as similarity
		FROM memories
		WHERE user_id = ?
		  AND vector IS NOT NULL
		  AND processing_status IN ('completed', 'partial_failed')
		  AND (vector <=> ?::vector) <= ?
		ORDER BY vector <=> ?::vector
		LIMIT ?
	`
	rows, err := r.db.WithContext(ctx).Raw(query, vector, userID, vector, distanceThreshold, vector, limit).Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var m domain.Memory
		var similarity float64
		err := rows.Scan(
			&m.ID, &m.UserID, &m.ContentType, &m.TextContent, &m.LinkURL, &m.LinkTitle, &m.LinkSummary,
			&m.Tags, &m.Note, &m.ProcessingStatus, &m.Visibility, &m.CreatedAt, &m.UpdatedAt,
			&similarity,
		)
		if err != nil {
			return nil, err
		}
		results = append(results, domain.SearchResult{Memory: m, Similarity: similarity})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return results, nil
}

// FindRelated finds memories similar to a given memory, excluding the memory itself.
func (r *GormMemoryRepository) FindRelated(ctx context.Context, userID uuid.UUID, memoryID uuid.UUID, vector string, limit int, threshold float64) ([]domain.SearchResult, error) {
	var results []domain.SearchResult
	distanceThreshold := 1.0 - threshold
	query := `
		SELECT id, user_id, content_type, text_content, link_url, link_title, link_summary,
			   tags, note, processing_status, visibility, created_at, updated_at,
			   1 - (vector <=> ?::vector) as similarity
		FROM memories
		WHERE user_id = ?
		  AND id != ?
		  AND vector IS NOT NULL
		  AND processing_status IN ('completed', 'partial_failed')
		  AND (vector <=> ?::vector) <= ?
		ORDER BY vector <=> ?::vector
		LIMIT ?
	`
	rows, err := r.db.WithContext(ctx).Raw(query, vector, userID, memoryID, vector, distanceThreshold, vector, limit).Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var m domain.Memory
		var similarity float64
		err := rows.Scan(
			&m.ID, &m.UserID, &m.ContentType, &m.TextContent, &m.LinkURL, &m.LinkTitle, &m.LinkSummary,
			&m.Tags, &m.Note, &m.ProcessingStatus, &m.Visibility, &m.CreatedAt, &m.UpdatedAt,
			&similarity,
		)
		if err != nil {
			return nil, err
		}
		results = append(results, domain.SearchResult{Memory: m, Similarity: similarity})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return results, nil
}
