// Package repository handles database operations for tag entities.
package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/NebulaVzx/Echoes/services/memory-service/internal/domain"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// TagRepository defines the interface for tag data access.
type TagRepository interface {
	ListByUser(ctx context.Context, userID uuid.UUID) ([]domain.TagInfo, error)
	GetRelatedTags(ctx context.Context, userID uuid.UUID, tag string) ([]string, error)
	MergeTags(ctx context.Context, userID uuid.UUID, sourceTag, targetTag string) (int64, error)
	FindSimilarTags(ctx context.Context, userID uuid.UUID) ([][2]string, error)
}

// GormTagRepository implements TagRepository using GORM.
type GormTagRepository struct {
	db *gorm.DB
}

// NewGormTagRepository creates a new GORM-based tag repository.
func NewGormTagRepository(db *gorm.DB) TagRepository {
	return &GormTagRepository{db: db}
}

// ListByUser retrieves all tags for a user with usage statistics.
func (r *GormTagRepository) ListByUser(ctx context.Context, userID uuid.UUID) ([]domain.TagInfo, error) {
	query := `
		SELECT
			t.tag AS name,
			COUNT(*) AS count,
			MAX(m.updated_at) AS last_updated_at
		FROM memories m,
			LATERAL UNNEST(m.tags) AS t(tag)
		WHERE m.user_id = ?
		GROUP BY t.tag
		ORDER BY count DESC, name ASC
	`
	rows, err := r.db.WithContext(ctx).Raw(query, userID).Rows()
	if err != nil {
		return nil, fmt.Errorf("failed to list tags: %w", err)
	}
	defer rows.Close()

	var tags []domain.TagInfo
	for rows.Next() {
		var t domain.TagInfo
		var lastUpdated time.Time
		if err := rows.Scan(&t.Name, &t.Count, &lastUpdated); err != nil {
			return nil, err
		}
		t.LastUpdatedAt = lastUpdated
		tags = append(tags, t)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return tags, nil
}

// GetRelatedTags finds tags that co-occur most frequently with the given tag.
func (r *GormTagRepository) GetRelatedTags(ctx context.Context, userID uuid.UUID, tag string) ([]string, error) {
	query := `
		SELECT t2.tag
		FROM memories m,
			LATERAL UNNEST(m.tags) AS t1(tag),
			LATERAL UNNEST(m.tags) AS t2(tag)
		WHERE m.user_id = ?
		  AND t1.tag = ?
		  AND t2.tag != ?
		GROUP BY t2.tag
		ORDER BY COUNT(*) DESC, t2.tag ASC
		LIMIT 5
	`
	rows, err := r.db.WithContext(ctx).Raw(query, userID, tag, tag).Rows()
	if err != nil {
		return nil, fmt.Errorf("failed to get related tags: %w", err)
	}
	defer rows.Close()

	var related []string
	for rows.Next() {
		var t string
		if err := rows.Scan(&t); err != nil {
			return nil, err
		}
		related = append(related, t)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return related, nil
}

// MergeTags replaces all occurrences of sourceTag with targetTag for a user.
func (r *GormTagRepository) MergeTags(ctx context.Context, userID uuid.UUID, sourceTag, targetTag string) (int64, error) {
	// PostgreSQL: use array_replace to swap tags, then deduplicate with array_distinct (PG 14+)
	// For PG 13 compatibility, we use a subquery approach with unnest
	query := `
		UPDATE memories
		SET tags = ARRAY(
			SELECT DISTINCT CASE WHEN x = ? THEN ? ELSE x END
			FROM UNNEST(tags) AS x
		),
		updated_at = NOW()
		WHERE user_id = ?
		  AND ? = ANY(tags)
	`
	result := r.db.WithContext(ctx).Exec(query, sourceTag, targetTag, userID, sourceTag)
	if result.Error != nil {
		return 0, fmt.Errorf("failed to merge tags: %w", result.Error)
	}
	return result.RowsAffected, nil
}

// FindSimilarTags finds tags that are similar based on case-insensitive + normalized comparison.
// Returns pairs of [canonical, duplicate] where duplicate should be merged into canonical.
func (r *GormTagRepository) FindSimilarTags(ctx context.Context, userID uuid.UUID) ([][2]string, error) {
	query := `
		SELECT DISTINCT t.tag AS name
		FROM memories m,
			LATERAL UNNEST(m.tags) AS t(tag)
		WHERE m.user_id = ?
		ORDER BY name ASC
	`
	rows, err := r.db.WithContext(ctx).Raw(query, userID).Rows()
	if err != nil {
		return nil, fmt.Errorf("failed to list tags for similarity check: %w", err)
	}
	defer rows.Close()

	var tags []string
	for rows.Next() {
		var t string
		if err := rows.Scan(&t); err != nil {
			return nil, err
		}
		tags = append(tags, t)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Normalize: lowercase, trim spaces, remove special chars
	normalize := func(s string) string {
		s = strings.ToLower(strings.TrimSpace(s))
		// Keep only alphanumeric and common chars used in tags
		var b strings.Builder
		for _, r := range s {
			if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
				b.WriteRune(r)
			}
		}
		return b.String()
	}

	groups := make(map[string][]string)
	for _, tag := range tags {
		key := normalize(tag)
		if key != "" {
			groups[key] = append(groups[key], tag)
		}
	}

	var similar [][2]string
	for _, group := range groups {
		if len(group) > 1 {
			// Pick the most common one as canonical (first in alphabetical order as tie-breaker)
			canonical := group[0]
			for i := 1; i < len(group); i++ {
				similar = append(similar, [2]string{canonical, group[i]})
			}
		}
	}
	return similar, nil
}

// compile-time check
var _ TagRepository = (*GormTagRepository)(nil)
