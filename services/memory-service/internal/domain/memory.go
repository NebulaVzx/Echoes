// Package domain defines the core business entities for the memory service.
package domain

import (
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

// Memory represents a saved content item in the Echoes system.
type Memory struct {
	ID               uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID           uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	ContentType      string    `gorm:"type:varchar(20);not null" json:"content_type"`
	TextContent      string    `gorm:"type:text" json:"text_content,omitempty"`
	LinkURL          string    `gorm:"type:text" json:"link_url,omitempty"`
	LinkTitle        string    `gorm:"type:text" json:"link_title,omitempty"`
	LinkSummary      string    `gorm:"type:text" json:"link_summary,omitempty"`
	MediaURL         string    `gorm:"type:text" json:"media_url,omitempty"`
	MediaDuration    int       `gorm:"type:int" json:"media_duration,omitempty"`
	OCRText          string    `gorm:"type:text" json:"ocr_text,omitempty"`
	TranscriptText   string    `gorm:"type:text" json:"transcript_text,omitempty"`
	Vector           string    `gorm:"type:vector(1024);->:false;<-:false" json:"-"` // exclude from JSON, handled separately
	Tags             pq.StringArray `gorm:"type:varchar(50)[]" json:"tags"`
	Note             string    `gorm:"type:text" json:"note,omitempty"`
	Metadata         string    `gorm:"type:jsonb" json:"metadata,omitempty"`
	ProcessingStatus string    `gorm:"type:varchar(20);default:'pending'" json:"processing_status"`
	Visibility       string     `gorm:"type:varchar(20);default:'private'" json:"visibility"`
	SealedUntil      *time.Time `gorm:"type:timestamp with time zone" json:"sealed_until,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

// TableName specifies the table name for Memory.
func (Memory) TableName() string {
	return "memories"
}

// SafeResponse returns a memory object safe for JSON serialization.
func (m Memory) SafeResponse() map[string]interface{} {
	return map[string]interface{}{
		"id":                m.ID,
		"user_id":           m.UserID,
		"content_type":      m.ContentType,
		"text_content":      m.TextContent,
		"link_url":          m.LinkURL,
		"link_title":        m.LinkTitle,
		"link_summary":      m.LinkSummary,
		"tags":              m.Tags,
		"note":              m.Note,
		"processing_status": m.ProcessingStatus,
		"visibility":        m.Visibility,
		"sealed_until":      m.SealedUntil,
		"created_at":        m.CreatedAt,
		"updated_at":        m.UpdatedAt,
	}
}

// CreateMemoryRequest represents a request to create a new memory.
type CreateMemoryRequest struct {
	ContentType        string     `json:"content_type" binding:"required,oneof=text link"`
	TextContent        string     `json:"text_content" binding:"omitempty,max=10000"`
	LinkURL            string     `json:"link_url" binding:"omitempty,url,max=2048"`
	Tags               []string   `json:"tags" binding:"omitempty,dive,max=50"`
	Note               string     `json:"note" binding:"omitempty,max=1000"`
	EnableAISuggestion bool       `json:"enable_ai_suggestion" binding:"omitempty"`
	SealedUntil        *time.Time `json:"sealed_until,omitempty"`
}

// SealMemoryRequest represents a request to seal a memory until a future date.
type SealMemoryRequest struct {
	SealedUntil time.Time `json:"sealed_until" binding:"required"`
}

// UnsealMemoryRequest represents a request to unseal a memory.
type UnsealMemoryRequest struct{}

// DailyReview represents the daily review stats for a user.
type DailyReview struct {
	TodayCount     int      `json:"today_count"`
	TopTags        []string `json:"top_tags"`
	WorthReviewing *Memory  `json:"worth_reviewing,omitempty"`
}

// StreakResponse represents the user's streak information.
type StreakResponse struct {
	CurrentStreak    int  `json:"current_streak"`
	LongestStreak    int  `json:"longest_streak"`
	HasRecordedToday bool `json:"has_recorded_today"`
}

// SerendipityResponse represents a "that day in history" memory.
type SerendipityResponse struct {
	Memory       *Memory `json:"memory"`
	MemoriesSince int    `json:"memories_since"`
	YearsAgo     int     `json:"years_ago"`
}

// UpdateMemoryRequest represents a request to update a memory.
type UpdateMemoryRequest struct {
	Tags []string `json:"tags" binding:"omitempty,dive,max=50"`
	Note string   `json:"note" binding:"omitempty,max=1000"`
}

// ListMemoriesResponse represents a paginated list of memories.
type ListMemoriesResponse struct {
	Memories []map[string]interface{} `json:"memories"`
	Total    int64                    `json:"total"`
	Page     int                      `json:"page"`
	Limit    int                      `json:"limit"`
	HasMore  bool                     `json:"has_more"`
}

// SubTaskState represents a single sub-task's status in metadata JSONB.
type SubTaskState struct {
	Status     string `json:"status"`
	Error      string `json:"error,omitempty"`
	UpdatedAt  string `json:"updated_at"`
	RetryCount int    `json:"retry_count,omitempty"`
}

// SearchResult represents a memory with its similarity score from semantic search.
type SearchResult struct {
	Memory     Memory  `json:"memory"`
	Similarity float64 `json:"similarity"`
}

// SearchResponse represents the response from semantic search.
type SearchResponse struct {
	Results []SearchResult `json:"results"`
	Query   string         `json:"query"`
}

// RelatedResponse represents the response for similar memories.
type RelatedResponse struct {
	Results  []SearchResult `json:"results"`
	MemoryID uuid.UUID      `json:"memory_id"`
}

// AISuggestion represents an AI-generated companion suggestion for a memory.
type AISuggestion struct {
	ID             uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	MemoryID       uuid.UUID `gorm:"type:uuid;not null;index" json:"memory_id"`
	Content        string    `gorm:"type:text;not null" json:"content"`
	SuggestionType string    `gorm:"type:varchar(20)" json:"suggestion_type,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
	UserFeedback   string    `gorm:"type:varchar(20)" json:"user_feedback,omitempty"`
	Metadata       string    `gorm:"type:jsonb" json:"metadata,omitempty"`
}

// TableName specifies the table name for AISuggestion.
func (AISuggestion) TableName() string {
	return "ai_suggestions"
}

// CreateSuggestionRequest represents a request to create an AI suggestion (internal API).
type CreateSuggestionRequest struct {
	MemoryID       uuid.UUID              `json:"memory_id" binding:"required"`
	Content        string                 `json:"content" binding:"required,max=500"`
	SuggestionType string                 `json:"suggestion_type" binding:"omitempty,oneof=emotion_support knowledge_expand action_suggest connection general"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
}

// UpdateSuggestionFeedbackRequest represents a request to update user feedback on a suggestion.
type UpdateSuggestionFeedbackRequest struct {
	UserFeedback string `json:"user_feedback" binding:"required,oneof=liked disliked ignored"`
}

// SuggestionResponse represents a single AI suggestion in API responses.
type SuggestionResponse struct {
	ID             uuid.UUID `json:"id"`
	MemoryID       uuid.UUID `json:"memory_id"`
	Content        string    `json:"content"`
	SuggestionType string    `json:"suggestion_type,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
	UserFeedback   string    `json:"user_feedback,omitempty"`
}

// TaskStatusUpdate is the request body for the internal task status API.
type TaskStatusUpdate struct {
	TaskType string                 `json:"task_type" binding:"required,oneof=link:fetch text:vectorize tag:generate suggestion:generate"`
	Status   string                 `json:"status" binding:"required,oneof=pending processing completed failed"`
	Error    string                 `json:"error,omitempty"`
	Result   map[string]interface{} `json:"result,omitempty"` // e.g., {"tags": [...]}, {"vector": [...]}, {"title": "...", "summary": "..."}
}

// AggregateStatus computes overall processing_status from sub-task states.
// Rules per D-14:
//   - Any processing -> "processing"
//   - Mixed failed+completed -> "partial_failed"
//   - All failed -> "failed"
//   - All completed -> "completed"
//   - Default (no tasks) -> "pending"
func AggregateStatus(tasks map[string]SubTaskState) string {
	if len(tasks) == 0 {
		return "pending"
	}
	hasProcessing := false
	hasFailed := false
	hasCompleted := false
	for _, task := range tasks {
		switch task.Status {
		case "processing":
			hasProcessing = true
		case "failed":
			hasFailed = true
		case "completed":
			hasCompleted = true
		}
	}
	if hasProcessing {
		return "processing"
	}
	if hasFailed && hasCompleted {
		return "partial_failed"
	}
	if hasFailed && !hasCompleted {
		return "failed"
	}
	return "completed"
}
