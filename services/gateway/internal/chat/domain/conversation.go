// Package domain defines the core business entities for the chat (Echo Assistant) feature.
package domain

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// Conversation represents a chat session between a user and the Echo Assistant.
type Conversation struct {
	ID        uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID    uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	Title     string    `gorm:"type:varchar(255);not null;default:'新对话'" json:"title"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// TableName specifies the table name for Conversation.
func (Conversation) TableName() string {
	return "conversations"
}

// Message represents a single message within a conversation.
type Message struct {
	ID             uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ConversationID uuid.UUID      `gorm:"type:uuid;not null;index" json:"conversation_id"`
	Role           string         `gorm:"type:varchar(20);not null" json:"role"`
	Content        string         `gorm:"type:text;not null" json:"content"`
	Citations      datatypes.JSON `gorm:"type:jsonb;default:'[]'" json:"citations"`
	CreatedAt      time.Time      `json:"created_at"`
}

// TableName specifies the table name for Message.
func (Message) TableName() string {
	return "messages"
}

// Citation represents a single citation within a message, referencing a memory.
type Citation struct {
	Index      int     `json:"index"`
	MemoryID   string  `json:"memory_id"`
	Title      string  `json:"title"`
	Similarity float64 `json:"similarity"`
}

// CreateConversationRequest represents a request to create a new conversation.
type CreateConversationRequest struct {
	Title string `json:"title" binding:"omitempty,max=255"`
}

// SendMessageRequest represents a request to send a message in a conversation.
type SendMessageRequest struct {
	ConversationID string `json:"conversation_id" binding:"omitempty,uuid"`
	Content        string `json:"content" binding:"required,max=10000"`
}

// SearchResultMemory represents a single memory search result from the Memory Service.
type SearchResultMemory struct {
	ID          uuid.UUID `json:"id"`
	Title       string    `json:"title"`
	ContentType string    `json:"content_type"`
	Content     string    `json:"content"`
	Tags        []string  `json:"tags"`
	Note        string    `json:"note"`
	CreatedAt   time.Time `json:"created_at"`
	Similarity  float64   `json:"similarity"`
}

// ChatResponse represents the response from the chat API.
type ChatResponse struct {
	Message   *Message   `json:"message"`
	Citations []Citation `json:"citations"`
}
