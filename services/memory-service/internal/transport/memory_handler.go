// Package transport provides HTTP handlers for memory endpoints.
package transport

import (
	"errors"
	"fmt"
	"net/http"
	"os"
	"strconv"

	"github.com/NebulaVzx/Echoes/services/memory-service/internal/domain"
	"github.com/NebulaVzx/Echoes/services/memory-service/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.uber.org/zap"
)

// ValidationError represents a single field validation failure.
type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// ErrorResponse is the unified error response format for all API errors.
type ErrorResponse struct {
	Success bool `json:"success"`
	Error   struct {
		Code    string            `json:"code"`
		Message string            `json:"message"`
		Details []ValidationError `json:"details,omitempty"`
	} `json:"error"`
}

// respondWithError sends a unified error response.
func respondWithError(c *gin.Context, status int, code, message string, details ...ValidationError) {
	resp := ErrorResponse{Success: false}
	resp.Error.Code = code
	resp.Error.Message = message
	if len(details) > 0 {
		resp.Error.Details = details
	}
	c.JSON(status, resp)
}

// respondWithValidationError sends a validation error response with field-level details.
func respondWithValidationError(c *gin.Context, err error) {
	var ve validator.ValidationErrors
	if errors.As(err, &ve) {
		details := make([]ValidationError, 0, len(ve))
		for _, e := range ve {
			details = append(details, ValidationError{
				Field:   e.Field(),
				Message: fmt.Sprintf("validation failed on '%s'", e.Tag()),
			})
		}
		respondWithError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Request validation failed", details...)
		return
	}
	respondWithError(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
}

// MemoryHandler handles HTTP requests for memory operations.
type MemoryHandler struct {
	memoryService *service.MemoryService
}

// NewMemoryHandler creates a new memory HTTP handler.
func NewMemoryHandler(memoryService *service.MemoryService) *MemoryHandler {
	return &MemoryHandler{memoryService: memoryService}
}

// RegisterRoutes registers memory routes on the given router.
func (h *MemoryHandler) RegisterRoutes(router *gin.RouterGroup) {
	router.POST("/memories", h.Create)
	router.GET("/memories", h.List)
	router.GET("/memories/:id", h.Get)
	router.PUT("/memories/:id", h.Update)
	router.DELETE("/memories/:id", h.Delete)

	router.GET("/search", h.Search)
	router.GET("/memories/:id/related", h.GetRelated)

	// Suggestion routes (public, authenticated)
	router.GET("/memories/:id/suggestion", h.GetSuggestion)
	router.PATCH("/memories/:id/suggestion/feedback", h.UpdateSuggestionFeedback)

	// Internal API for service-to-service communication
	internal := router.Group("/internal")
	internal.Use(internalAuthMiddleware())
	internal.PATCH("/memories/:id/tasks", h.UpdateTaskStatus)
	internal.POST("/memories/:id/tasks/:task_type/retry", h.RetryTask)
	internal.POST("/memories/:id/suggestion", h.CreateSuggestion)
}

// getUserID extracts user ID from X-User-ID header (set by Gateway JWT middleware).
func getUserID(c *gin.Context) (uuid.UUID, bool) {
	userIDStr := c.GetHeader("X-User-ID")
	if userIDStr == "" {
		return uuid.UUID{}, false
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return uuid.UUID{}, false
	}
	return userID, true
}

// Create handles creating a new memory.
func (h *MemoryHandler) Create(c *gin.Context) {
	tracer := otel.Tracer("memory-service")
	ctx, span := tracer.Start(c.Request.Context(), "CreateMemory")
	defer span.End()

	userID, ok := getUserID(c)
	if !ok {
		respondWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
		return
	}

	var req domain.CreateMemoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondWithValidationError(c, err)
		return
	}

	memory, suggestionStatus, err := h.memoryService.Create(ctx, userID, req)
	if err != nil {
		span.SetAttributes(attribute.String("error", err.Error()))
		respondWithError(c, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}

	span.SetAttributes(attribute.String("memory_id", memory.ID.String()))
	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data": gin.H{
			"memory":            memory.SafeResponse(),
			"suggestion_status": suggestionStatus,
		},
	})
}

// List handles retrieving a paginated list of memories.
func (h *MemoryHandler) List(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		respondWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
		return
	}

	page := 1
	limit := 20
	if p := c.Query("page"); p != "" {
		if v, err := strconv.Atoi(p); err == nil && v > 0 {
			page = v
		}
	}
	if l := c.Query("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 && v <= 100 {
			limit = v
		}
	}

	tag := c.Query("tag")

	resp, err := h.memoryService.List(c.Request.Context(), userID, page, limit, tag)
	if err != nil {
		zap.L().Error("failed to list memories", zap.Error(err), zap.String("user_id", userID.String()))
		respondWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred")
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": resp})
}

// Get handles retrieving a single memory by ID.
func (h *MemoryHandler) Get(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		respondWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
		return
	}

	memoryID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondWithError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid memory ID")
		return
	}

	memory, err := h.memoryService.Get(c.Request.Context(), memoryID, userID)
	if err != nil {
		switch err {
		case service.ErrMemoryNotFound:
			respondWithError(c, http.StatusNotFound, "NOT_FOUND", "Memory not found")
		case service.ErrUnauthorized:
			respondWithError(c, http.StatusForbidden, "FORBIDDEN", "Access denied")
		default:
			zap.L().Error("failed to get memory", zap.Error(err), zap.String("memory_id", memoryID.String()))
			respondWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred")
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": memory.SafeResponse()})
}

// Update handles updating a memory's tags and note.
func (h *MemoryHandler) Update(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		respondWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
		return
	}

	memoryID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondWithError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid memory ID")
		return
	}

	var req domain.UpdateMemoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondWithValidationError(c, err)
		return
	}

	memory, err := h.memoryService.Update(c.Request.Context(), memoryID, userID, req)
	if err != nil {
		switch err {
		case service.ErrMemoryNotFound:
			respondWithError(c, http.StatusNotFound, "NOT_FOUND", "Memory not found")
		case service.ErrUnauthorized:
			respondWithError(c, http.StatusForbidden, "FORBIDDEN", "Access denied")
		default:
			zap.L().Error("failed to update memory", zap.Error(err), zap.String("memory_id", memoryID.String()))
			respondWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred")
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": memory.SafeResponse()})
}

// internalAuthMiddleware validates the INTERNAL_API_TOKEN for service-to-service calls.
func internalAuthMiddleware() gin.HandlerFunc {
	expectedToken := os.Getenv("INTERNAL_API_TOKEN")
	if expectedToken == "" {
		// In development, allow if not configured (but log warning)
		return func(c *gin.Context) {
			c.Next()
		}
	}
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" || authHeader != "Bearer "+expectedToken {
			respondWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "Invalid internal API token")
			c.Abort()
			return
		}
		c.Next()
	}
}

// UpdateTaskStatus handles PATCH /api/v1/internal/memories/:id/tasks
func (h *MemoryHandler) UpdateTaskStatus(c *gin.Context) {
	memoryID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondWithError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid memory ID")
		return
	}

	var req domain.TaskStatusUpdate
	if err := c.ShouldBindJSON(&req); err != nil {
		respondWithValidationError(c, err)
		return
	}

	if err := h.memoryService.UpdateTaskStatus(c.Request.Context(), memoryID, req); err != nil {
		switch err {
		case service.ErrMemoryNotFound:
			respondWithError(c, http.StatusNotFound, "NOT_FOUND", "Memory not found")
		default:
			zap.L().Error("failed to update task status", zap.Error(err), zap.String("memory_id", memoryID.String()))
			respondWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred")
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// RetryTask handles POST /api/v1/internal/memories/:id/tasks/:task_type/retry
// Per D-15: re-publishes a failed sub-task to Redis Stream for reprocessing.
func (h *MemoryHandler) RetryTask(c *gin.Context) {
	memoryID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondWithError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid memory ID")
		return
	}

	taskType := c.Param("task_type")
	validTypes := map[string]bool{"link:fetch": true, "text:vectorize": true, "tag:generate": true}
	if !validTypes[taskType] {
		respondWithError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid task_type")
		return
	}

	if err := h.memoryService.RetryTask(c.Request.Context(), memoryID, taskType); err != nil {
		switch err {
		case service.ErrMemoryNotFound:
			respondWithError(c, http.StatusNotFound, "NOT_FOUND", "Memory not found")
		default:
			zap.L().Error("failed to retry task", zap.Error(err), zap.String("memory_id", memoryID.String()), zap.String("task_type", taskType))
			respondWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred")
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// Search handles semantic search for memories.
func (h *MemoryHandler) Search(c *gin.Context) {
	tracer := otel.Tracer("memory-service")
	ctx, span := tracer.Start(c.Request.Context(), "SearchMemories")
	defer span.End()

	userID, ok := getUserID(c)
	if !ok {
		respondWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
		return
	}

	query := c.Query("q")
	if query == "" {
		respondWithError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Query parameter 'q' is required")
		return
	}
	span.SetAttributes(attribute.String("query", query))

	limit := 10
	if l := c.Query("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 && v <= 100 {
			limit = v
		}
	}
	span.SetAttributes(attribute.Int("limit", limit))

	resp, err := h.memoryService.Search(ctx, userID, query, limit)
	if err != nil {
		span.SetAttributes(attribute.String("error", err.Error()))
		if err.Error() == "搜索服务暂不可用" {
			respondWithError(c, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "Search service temporarily unavailable")
			return
		}
		zap.L().Error("search failed", zap.Error(err), zap.String("query", query))
		respondWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred")
		return
	}

	span.SetAttributes(attribute.Int("result_count", len(resp.Results)))

	// Convert results to safe response format with similarity
	items := make([]map[string]interface{}, len(resp.Results))
	for i, r := range resp.Results {
		items[i] = r.Memory.SafeResponse()
		items[i]["similarity"] = r.Similarity
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
		"results": items,
		"query":   resp.Query,
	}})
}

// GetRelated handles retrieving similar memories for a given memory.
func (h *MemoryHandler) GetRelated(c *gin.Context) {
	tracer := otel.Tracer("memory-service")
	ctx, span := tracer.Start(c.Request.Context(), "GetRelatedMemories")
	defer span.End()

	userID, ok := getUserID(c)
	if !ok {
		respondWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
		return
	}

	memoryID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondWithError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid memory ID")
		return
	}
	span.SetAttributes(attribute.String("memory_id", memoryID.String()))

	limit := 3
	if l := c.Query("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 && v <= 20 {
			limit = v
		}
	}
	span.SetAttributes(attribute.Int("limit", limit))

	resp, err := h.memoryService.Related(ctx, memoryID, userID, limit)
	if err != nil {
		span.SetAttributes(attribute.String("error", err.Error()))
		switch err {
		case service.ErrMemoryNotFound:
			respondWithError(c, http.StatusNotFound, "NOT_FOUND", "Memory not found")
		case service.ErrUnauthorized:
			respondWithError(c, http.StatusForbidden, "FORBIDDEN", "Access denied")
		default:
			zap.L().Error("get related failed", zap.Error(err), zap.String("memory_id", memoryID.String()))
			respondWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred")
		}
		return
	}

	span.SetAttributes(attribute.Int("result_count", len(resp.Results)))

	items := make([]map[string]interface{}, len(resp.Results))
	for i, r := range resp.Results {
		items[i] = r.Memory.SafeResponse()
		items[i]["similarity"] = r.Similarity
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
		"results":   items,
		"memory_id": resp.MemoryID,
	}})
}

// Delete handles deleting a memory.
func (h *MemoryHandler) Delete(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		respondWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
		return
	}

	memoryID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondWithError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid memory ID")
		return
	}

	if err := h.memoryService.Delete(c.Request.Context(), memoryID, userID); err != nil {
		switch err {
		case service.ErrMemoryNotFound:
			respondWithError(c, http.StatusNotFound, "NOT_FOUND", "Memory not found")
		default:
			zap.L().Error("failed to delete memory", zap.Error(err), zap.String("memory_id", memoryID.String()))
			respondWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred")
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Memory deleted"})
}

// GetSuggestion handles retrieving the AI suggestion for a memory.
func (h *MemoryHandler) GetSuggestion(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		respondWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
		return
	}

	memoryID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondWithError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid memory ID")
		return
	}

	suggestion, err := h.memoryService.GetSuggestion(c.Request.Context(), memoryID, userID)
	if err != nil {
		switch err {
		case service.ErrMemoryNotFound:
			respondWithError(c, http.StatusNotFound, "NOT_FOUND", "Memory not found")
		case service.ErrUnauthorized:
			respondWithError(c, http.StatusForbidden, "FORBIDDEN", "Access denied")
		case service.ErrSuggestionNotFound:
			respondWithError(c, http.StatusNotFound, "NOT_FOUND", "Suggestion not found")
		default:
			zap.L().Error("failed to get suggestion", zap.Error(err), zap.String("memory_id", memoryID.String()))
			respondWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred")
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": suggestion})
}

// UpdateSuggestionFeedback handles updating user feedback for a suggestion.
func (h *MemoryHandler) UpdateSuggestionFeedback(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		respondWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
		return
	}

	memoryID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondWithError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid memory ID")
		return
	}

	var req domain.UpdateSuggestionFeedbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondWithValidationError(c, err)
		return
	}

	if err := h.memoryService.UpdateSuggestionFeedback(c.Request.Context(), memoryID, userID, req.UserFeedback); err != nil {
		switch err {
		case service.ErrMemoryNotFound:
			respondWithError(c, http.StatusNotFound, "NOT_FOUND", "Memory not found")
		case service.ErrUnauthorized:
			respondWithError(c, http.StatusForbidden, "FORBIDDEN", "Access denied")
		case service.ErrSuggestionNotFound:
			respondWithError(c, http.StatusNotFound, "NOT_FOUND", "Suggestion not found")
		default:
			zap.L().Error("failed to update suggestion feedback", zap.Error(err), zap.String("memory_id", memoryID.String()))
			respondWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred")
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// CreateSuggestion handles POST /api/v1/internal/memories/:id/suggestion
// Called by Processor Service after generating a suggestion.
func (h *MemoryHandler) CreateSuggestion(c *gin.Context) {
	memoryID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondWithError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid memory ID")
		return
	}

	var req domain.CreateSuggestionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondWithValidationError(c, err)
		return
	}

	// Ensure memory_id in body matches URL param
	if req.MemoryID != memoryID {
		respondWithError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Memory ID mismatch")
		return
	}

	suggestion, err := h.memoryService.CreateSuggestion(c.Request.Context(), memoryID, req)
	if err != nil {
		zap.L().Error("failed to create suggestion", zap.Error(err), zap.String("memory_id", memoryID.String()))
		respondWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred")
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "data": suggestion})
}
