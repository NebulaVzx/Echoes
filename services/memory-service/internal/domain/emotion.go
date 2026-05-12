package domain

import (
	"time"

	"github.com/google/uuid"
)

// Emotion represents the sentiment analysis result for a memory.
type Emotion struct {
	ID           uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	MemoryID     uuid.UUID `gorm:"type:uuid;not null;index" json:"memory_id"`
	Sentiment    string    `gorm:"type:varchar(20);not null" json:"sentiment"`
	Score        int       `gorm:"type:int;not null" json:"score"`
	Reason       string    `gorm:"type:text" json:"reason,omitempty"`
	ModelVersion string    `gorm:"type:varchar(50);default:'v1'" json:"model_version"`
	AnalyzedAt   time.Time `json:"analyzed_at"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// TableName specifies the table name for Emotion.
func (Emotion) TableName() string {
	return "memory_emotions"
}

// MoodDayData represents aggregated sentiment data for a single day.
type MoodDayData struct {
	Date              string  `json:"date"`
	Score             float64 `json:"score"`
	MemoryCount       int     `json:"memory_count"`
	DominantSentiment string  `json:"dominant_sentiment"`
}

// MoodStats represents statistics for a monthly mood insight.
type MoodStats struct {
	PositiveDays  int     `json:"positive_days"`
	NegativeDays  int     `json:"negative_days"`
	NeutralDays   int     `json:"neutral_days"`
	AverageScore  float64 `json:"average_score"`
	MostActiveDay string  `json:"most_active_day"`
}

// MoodInsight represents the AI-generated monthly mood summary.
type MoodInsight struct {
	Insight string    `json:"insight"`
	Stats   MoodStats `json:"stats"`
}
