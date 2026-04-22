// Package repository handles database operations for conversation entities.
package repository

import (
	"context"
	"errors"

	"github.com/NebulaVzx/Echoes/services/gateway/internal/chat/domain"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ErrConversationNotFound is returned when a conversation does not exist or does not belong to the user.
var ErrConversationNotFound = errors.New("conversation not found")

// ConversationRepository defines the interface for conversation data access.
type ConversationRepository interface {
	CreateConversation(ctx context.Context, conv *domain.Conversation) error
	GetConversation(ctx context.Context, id uuid.UUID, userID uuid.UUID) (*domain.Conversation, error)
	ListConversations(ctx context.Context, userID uuid.UUID, limit int) ([]domain.Conversation, error)
	DeleteConversation(ctx context.Context, id uuid.UUID, userID uuid.UUID) error
	CreateMessage(ctx context.Context, msg *domain.Message) error
	GetMessagesByConversation(ctx context.Context, conversationID uuid.UUID, limit int) ([]domain.Message, error)
}

// GormConversationRepository implements ConversationRepository using GORM.
type GormConversationRepository struct {
	db *gorm.DB
}

// NewGormConversationRepository creates a new GORM-based conversation repository.
func NewGormConversationRepository(db *gorm.DB) ConversationRepository {
	return &GormConversationRepository{db: db}
}

// CreateConversation inserts a new conversation into the database.
func (r *GormConversationRepository) CreateConversation(ctx context.Context, conv *domain.Conversation) error {
	return r.db.WithContext(ctx).Create(conv).Error
}

// GetConversation retrieves a conversation by ID, verifying it belongs to the user.
// Returns ErrConversationNotFound if not found or not owned by the user.
func (r *GormConversationRepository) GetConversation(ctx context.Context, id uuid.UUID, userID uuid.UUID) (*domain.Conversation, error) {
	var conv domain.Conversation
	result := r.db.WithContext(ctx).Where("id = ? AND user_id = ?", id, userID).First(&conv)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrConversationNotFound
		}
		return nil, result.Error
	}
	return &conv, nil
}

// ListConversations retrieves conversations for a user, ordered by updated_at DESC.
// Default limit is 20, max is 100.
func (r *GormConversationRepository) ListConversations(ctx context.Context, userID uuid.UUID, limit int) ([]domain.Conversation, error) {
	if limit < 1 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	var conversations []domain.Conversation
	result := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("updated_at DESC").
		Limit(limit).
		Find(&conversations)
	if result.Error != nil {
		return nil, result.Error
	}
	return conversations, nil
}

// DeleteConversation removes a conversation by ID, ensuring it belongs to the user.
func (r *GormConversationRepository) DeleteConversation(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	result := r.db.WithContext(ctx).Where("id = ? AND user_id = ?", id, userID).Delete(&domain.Conversation{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrConversationNotFound
	}
	return nil
}

// CreateMessage inserts a new message into the database.
func (r *GormConversationRepository) CreateMessage(ctx context.Context, msg *domain.Message) error {
	return r.db.WithContext(ctx).Create(msg).Error
}

// GetMessagesByConversation retrieves messages for a conversation, ordered by created_at ASC.
// Default limit is 100, max is 200.
func (r *GormConversationRepository) GetMessagesByConversation(ctx context.Context, conversationID uuid.UUID, limit int) ([]domain.Message, error) {
	if limit < 1 {
		limit = 100
	}
	if limit > 200 {
		limit = 200
	}

	var messages []domain.Message
	result := r.db.WithContext(ctx).
		Where("conversation_id = ?", conversationID).
		Order("created_at ASC").
		Limit(limit).
		Find(&messages)
	if result.Error != nil {
		return nil, result.Error
	}
	return messages, nil
}
