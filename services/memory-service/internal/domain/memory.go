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
	Metadata         string    `gorm:"type:jsonb;->:false;<-:false" json:"metadata,omitempty"`
	ProcessingStatus string    `gorm:"type:varchar(20);default:'pending'" json:"processing_status"`
	Visibility       string    `gorm:"type:varchar(20);default:'private'" json:"visibility"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
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
		"created_at":        m.CreatedAt,
		"updated_at":        m.UpdatedAt,
	}
}

// CreateMemoryRequest represents a request to create a new memory.
type CreateMemoryRequest struct {
	ContentType string   `json:"content_type" binding:"required,oneof=text link"`
	TextContent string   `json:"text_content"`
	LinkURL     string   `json:"link_url"`
	Tags        []string `json:"tags"`
	Note        string   `json:"note"`
}

// UpdateMemoryRequest represents a request to update a memory.
type UpdateMemoryRequest struct {
	Tags []string `json:"tags"`
	Note string   `json:"note"`
}

// ListMemoriesResponse represents a paginated list of memories.
type ListMemoriesResponse struct {
	Memories []map[string]interface{} `json:"memories"`
	Total    int64                    `json:"total"`
	Page     int                      `json:"page"`
	Limit    int                      `json:"limit"`
}
