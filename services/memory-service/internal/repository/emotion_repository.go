package repository

import (
	"context"
	"errors"
	"time"

	"github.com/NebulaVzx/Echoes/services/memory-service/internal/domain"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrEmotionNotFound = errors.New("emotion not found")
)

// EmotionRepository defines the interface for emotion data access.
type EmotionRepository interface {
	Create(ctx context.Context, emotion *domain.Emotion) error
	GetByMemoryID(ctx context.Context, memoryID uuid.UUID) (*domain.Emotion, error)
	GetByMemoryIDAndVersion(ctx context.Context, memoryID uuid.UUID, modelVersion string) (*domain.Emotion, error)
	GetCalendarData(ctx context.Context, userID uuid.UUID, year int) ([]domain.MoodDayData, error)
}

// GormEmotionRepository implements EmotionRepository using GORM.
type GormEmotionRepository struct {
	db *gorm.DB
}

// NewGormEmotionRepository creates a new GORM-based emotion repository.
func NewGormEmotionRepository(db *gorm.DB) EmotionRepository {
	return &GormEmotionRepository{db: db}
}

// Create inserts a new emotion record into the database.
func (r *GormEmotionRepository) Create(ctx context.Context, emotion *domain.Emotion) error {
	return r.db.WithContext(ctx).Create(emotion).Error
}

// GetByMemoryID retrieves the most recent emotion for a memory.
func (r *GormEmotionRepository) GetByMemoryID(ctx context.Context, memoryID uuid.UUID) (*domain.Emotion, error) {
	var emotion domain.Emotion
	err := r.db.WithContext(ctx).Where("memory_id = ?", memoryID).Order("analyzed_at DESC").First(&emotion).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrEmotionNotFound
		}
		return nil, err
	}
	return &emotion, nil
}

// GetByMemoryIDAndVersion retrieves an emotion by memory ID and model version.
func (r *GormEmotionRepository) GetByMemoryIDAndVersion(ctx context.Context, memoryID uuid.UUID, modelVersion string) (*domain.Emotion, error) {
	var emotion domain.Emotion
	err := r.db.WithContext(ctx).Where("memory_id = ? AND model_version = ?", memoryID, modelVersion).First(&emotion).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrEmotionNotFound
		}
		return nil, err
	}
	return &emotion, nil
}

// GetCalendarData aggregates emotion data by day for a user's calendar view.
// Uses Asia/Shanghai timezone per D-07 and RESEARCH.md Pitfall 3.
func (r *GormEmotionRepository) GetCalendarData(ctx context.Context, userID uuid.UUID, year int) ([]domain.MoodDayData, error) {
	query := `
		SELECT
			DATE(m.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') as day,
			AVG(CASE
				WHEN e.sentiment = 'positive' THEN e.score
				WHEN e.sentiment = 'negative' THEN -e.score
				ELSE 0
			END) as weighted_score,
			COUNT(*) as memory_count,
			MODE() WITHIN GROUP (ORDER BY e.sentiment) as dominant_sentiment
		FROM memories m
		JOIN memory_emotions e ON m.id = e.memory_id
		WHERE m.user_id = ?
		  AND EXTRACT(YEAR FROM m.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') = ?
		GROUP BY DATE(m.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai')
		ORDER BY day
	`
	rows, err := r.db.WithContext(ctx).Raw(query, userID, year).Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []domain.MoodDayData
	for rows.Next() {
		var d domain.MoodDayData
		var day time.Time
		err := rows.Scan(&day, &d.Score, &d.MemoryCount, &d.DominantSentiment)
		if err != nil {
			return nil, err
		}
		d.Date = day.Format("2006-01-02")
		results = append(results, d)
	}
	return results, rows.Err()
}
