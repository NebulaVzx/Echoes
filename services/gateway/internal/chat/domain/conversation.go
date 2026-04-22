// Package domain defines the core business entities for the chat service.
package domain

import (
	"time"

	"github.com/google/uuid"
)

// Conversation represents a chat session between a user and the AI assistant.
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
	ID             uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ConversationID uuid.UUID `gorm:"type:uuid;not null;index" json:"conversation_id"`
	Role           string    `gorm:"type:varchar(20);not null" json:"role"`
	Content        string    `gorm:"type:text;not null" json:"content"`
	Citations      string    `gorm:"type:jsonb;default:'[]'" json:"citations"`
	CreatedAt      time.Time `json:"created_at"`
}

// TableName specifies the table name for Message.
func (Message) TableName() string {
	return "messages"
}

// Citation represents a reference to a memory used in an AI response.
type Citation struct {
	Index      int       `json:"index"`
	MemoryID   uuid.UUID `json:"memory_id"`
	Title      string    `json:"title"`
	Similarity float64   `json:"similarity"`
}

// SendMessageRequest represents a request to send a message in a conversation.
type SendMessageRequest struct {
	ConversationID string `json:"conversation_id,omitempty" binding:"omitempty,uuid"`
	Content        string `json:"content" binding:"required,max=10000"`
}

// ChatResponse represents the response from sending a message.
type ChatResponse struct {
	Message   Message    `json:"message"`
	Citations []Citation `json:"citations,omitempty"`
}

// SearchResultMemory represents a memory retrieved from the search API for RAG context.
type SearchResultMemory struct {
	ID          uuid.UUID `json:"id"`
	Title       string    `json:"title"`
	ContentType string    `json:"content_type"`
	Content     string    `json:"content"`
	Tags        []string  `json:"tags"`
	Note        string    `json:"note,omitempty"`
	Similarity  float64   `json:"similarity"`
	CreatedAt   time.Time `json:"created_at"`
}

// SearchResponse represents the response from the Memory Service search API.
type SearchResponse struct {
	Results []struct {
		Memory     SearchResultMemory `json:"memory"`
		Similarity float64            `json:"similarity"`
	} `json:"results"`
	Query string `json:"query"`
}

// ListConversationsResponse represents a list of conversations.
type ListConversationsResponse struct {
	Conversations []Conversation `json:"conversations"`
}

// ListMessagesResponse represents a list of messages in a conversation.
type ListMessagesResponse struct {
	Messages []Message `json:"messages"`
}
