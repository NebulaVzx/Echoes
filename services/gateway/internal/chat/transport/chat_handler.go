// Package transport provides HTTP handlers for chat endpoints.
package transport

import (
	"errors"
	"net/http"

	"github.com/NebulaVzx/Echoes/services/gateway/internal/chat/domain"
	"github.com/NebulaVzx/Echoes/services/gateway/internal/chat/repository"
	"github.com/NebulaVzx/Echoes/services/gateway/internal/chat/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// ChatHandler handles HTTP requests for chat operations.
type ChatHandler struct {
	service *service.ChatService
	logger  *zap.Logger
}

// NewChatHandler creates a new chat HTTP handler.
func NewChatHandler(service *service.ChatService, logger *zap.Logger) *ChatHandler {
	return &ChatHandler{service: service, logger: logger}
}

// SendMessage handles POST /api/v1/chat/messages.
func (h *ChatHandler) SendMessage(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		respondWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
		return
	}

	var req domain.SendMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondWithError(c, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}

	resp, err := h.service.SendMessage(c.Request.Context(), userID, &req)
	if err != nil {
		h.logger.Error("send message failed", zap.Error(err), zap.String("user_id", userID.String()))
		if err == repository.ErrConversationNotFound {
			respondWithError(c, http.StatusNotFound, "NOT_FOUND", "Conversation not found")
			return
		}
		respondWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": resp})
}

// ListConversations handles GET /api/v1/chat/conversations.
func (h *ChatHandler) ListConversations(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		respondWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
		return
	}

	conversations, err := h.service.ListConversations(c.Request.Context(), userID)
	if err != nil {
		h.logger.Error("list conversations failed", zap.Error(err), zap.String("user_id", userID.String()))
		respondWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred")
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"conversations": conversations}})
}

// DeleteConversation handles DELETE /api/v1/chat/conversations/:id.
func (h *ChatHandler) DeleteConversation(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		respondWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
		return
	}

	conversationID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondWithError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid conversation ID")
		return
	}

	if err := h.service.DeleteConversation(c.Request.Context(), userID, conversationID); err != nil {
		if err == repository.ErrConversationNotFound {
			respondWithError(c, http.StatusNotFound, "NOT_FOUND", "Conversation not found")
			return
		}
		h.logger.Error("delete conversation failed", zap.Error(err), zap.String("conversation_id", conversationID.String()))
		respondWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred")
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// GetMessages handles GET /api/v1/chat/conversations/:id/messages.
func (h *ChatHandler) GetMessages(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		respondWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
		return
	}

	conversationID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondWithError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid conversation ID")
		return
	}

	messages, err := h.service.GetMessages(c.Request.Context(), userID, conversationID)
	if err != nil {
		if err == repository.ErrConversationNotFound {
			respondWithError(c, http.StatusNotFound, "NOT_FOUND", "Conversation not found")
			return
		}
		h.logger.Error("get messages failed", zap.Error(err), zap.String("conversation_id", conversationID.String()))
		respondWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred")
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"messages": messages}})
}

// getUserID extracts user ID from Gin context (set by JWT middleware).
func getUserID(c *gin.Context) (uuid.UUID, error) {
	userIDStr, exists := c.Get("userID")
	if !exists {
		return uuid.UUID{}, errors.New("userID not found in context")
	}
	userIDString, ok := userIDStr.(string)
	if !ok {
		return uuid.UUID{}, errors.New("userID is not a string")
	}
	return uuid.Parse(userIDString)
}

// respondWithError sends a unified error response.
func respondWithError(c *gin.Context, status int, code, message string) {
	c.JSON(status, gin.H{
		"success": false,
		"error": gin.H{
			"code":    code,
			"message": message,
		},
	})
}
