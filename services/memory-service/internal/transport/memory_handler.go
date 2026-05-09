// Package transport provides HTTP handlers for memory endpoints.
package transport

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

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

// allowedFileExtensions defines permitted file types for upload.
var allowedFileExtensions = map[string]bool{
	".txt":  true,
	".md":   true,
	".docx": true,
}

// RegisterRoutes registers memory routes on the given router.
func (h *MemoryHandler) RegisterRoutes(router *gin.RouterGroup) {
	router.POST("/memories", h.Create)
	router.GET("/memories", h.List)

	// Constellation and explore routes (must be BEFORE /memories/:id)
	router.GET("/constellation", h.GetConstellation)
	router.GET("/memories/:id/explore", h.Explore)

	// Warmth routes (must be BEFORE /memories/:id to avoid parameter shadowing)
	router.GET("/memories/streaks", h.GetStreak)
	router.GET("/memories/serendipity", h.GetSerendipity)
	router.GET("/memories/daily-review", h.GetDailyReview)

	// Time capsule routes (must be BEFORE /memories/:id)
	router.GET("/memories/sealed", h.ListSealedMemories)
	router.GET("/memories/unsealed", h.GetRecentlyUnsealed)
	router.POST("/memories/:id/seal", h.SealMemory)
	router.DELETE("/memories/:id/seal", h.UnsealMemory)

	// Parameterized memory routes
	router.GET("/memories/:id", h.Get)
	router.PUT("/memories/:id", h.Update)
	router.DELETE("/memories/:id", h.Delete)

	router.GET("/search", h.Search)
	router.GET("/memories/:id/related", h.GetRelated)

	// Suggestion routes (public, authenticated)
	router.GET("/memories/:id/suggestion", h.GetSuggestion)
	router.PATCH("/memories/:id/suggestion/feedback", h.UpdateSuggestionFeedback)

	// Weave route
	router.POST("/memories/weave", h.Weave)

	// Internal API for service-to-service communication
	internal := router.Group("/internal")
	internal.Use(internalAuthMiddleware())
	internal.PATCH("/memories/:id/tasks", h.UpdateTaskStatus)
	internal.POST("/memories/:id/tasks/:task_type/retry", h.RetryTask)
	internal.POST("/memories/:id/suggestion", h.CreateSuggestion)
	internal.PATCH("/memories/:id/text", h.UpdateTextContent)
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
// Supports both JSON (text/link) and multipart/form-data (file upload).
func (h *MemoryHandler) Create(c *gin.Context) {
	contentType := c.ContentType()
	if strings.Contains(contentType, "multipart/form-data") {
		h.createFromMultipart(c)
		return
	}
	h.createFromJSON(c)
}

// createFromJSON handles JSON-based memory creation (text/link).
func (h *MemoryHandler) createFromJSON(c *gin.Context) {
	tracer := otel.Tracer("memory-service")
	ctx, span := tracer.Start(c.Request.Context(), "CreateMemoryJSON")
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

// createFromMultipart handles file upload memory creation.
func (h *MemoryHandler) createFromMultipart(c *gin.Context) {
	tracer := otel.Tracer("memory-service")
	ctx, span := tracer.Start(c.Request.Context(), "CreateMemoryMultipart")
	defer span.End()

	userID, ok := getUserID(c)
	if !ok {
		respondWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
		return
	}

	// Parse multipart form (max 10MB + 1MB buffer for fields)
	if err := c.Request.ParseMultipartForm(11 << 20); err != nil {
		respondWithError(c, http.StatusBadRequest, "BAD_REQUEST", "Failed to parse multipart form: "+err.Error())
		return
	}

	// Extract file
	file, fileHeader, err := c.Request.FormFile("file")
	if err != nil {
		respondWithError(c, http.StatusBadRequest, "BAD_REQUEST", "File is required for file upload")
		return
	}
	defer file.Close()

	// Validate file extension
	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	if !allowedFileExtensions[ext] {
		respondWithError(c, http.StatusBadRequest, "BAD_REQUEST", "Invalid file type. Allowed: .txt, .md, .docx")
		return
	}

	// Validate file size (<= 10MB)
	const maxFileSize = 10 << 20
	if fileHeader.Size > maxFileSize {
		respondWithError(c, http.StatusBadRequest, "BAD_REQUEST", "File size exceeds 10MB limit")
		return
	}

	// Build request from form fields
	req := domain.CreateMemoryRequest{
		ContentType: "file",
		Source:      c.PostForm("source"),
	}
	if c.PostForm("is_starred") == "true" {
		req.IsStarred = true
	}
	if tagsStr := c.PostForm("tags"); tagsStr != "" {
		req.Tags = strings.Split(tagsStr, ",")
	}
	if note := c.PostForm("note"); note != "" {
		req.Note = note
	}
	if enableStr := c.PostForm("enable_ai_suggestion"); enableStr == "true" {
		req.EnableAISuggestion = true
	}

	// Create memory record first (without file info)
	memory, suggestionStatus, err := h.memoryService.Create(ctx, userID, req)
	if err != nil {
		span.SetAttributes(attribute.String("error", err.Error()))
		respondWithError(c, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}

	// Upload file to MinIO
	minioClient := h.memoryService.MinIOClient()
	if minioClient == nil {
		respondWithError(c, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "File upload service is not available")
		return
	}

	objectPath := service.BuildObjectPath(userID.String(), memory.ID.String(), fileHeader.Filename)

	// Save uploaded file to temp location
	tempFile, err := os.CreateTemp("", "echoes-upload-*"+ext)
	if err != nil {
		respondWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to create temp file")
		return
	}
	defer os.Remove(tempFile.Name())
	defer tempFile.Close()

	if _, err := io.Copy(tempFile, file); err != nil {
		respondWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to save uploaded file")
		return
	}
	tempFile.Close()

	// Upload to MinIO
	mediaURL, err := minioClient.UploadFile(ctx, objectPath, tempFile.Name(), fileHeader.Header.Get("Content-Type"))
	if err != nil {
		respondWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to upload file: "+err.Error())
		return
	}

	// Update memory with file info
	if err := h.memoryService.UpdateFileInfo(ctx, memory.ID, mediaURL, fileHeader.Filename, fileHeader.Size); err != nil {
		respondWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to update memory file info")
		return
	}

	memory.MediaURL = mediaURL
	memory.FileName = fileHeader.Filename
	memory.FileSize = fileHeader.Size

	// Publish file extraction task now that file is uploaded
	llmConfig, _ := h.memoryService.GetUserLLMConfig(ctx, userID)
	h.memoryService.PublishFileTasks(ctx, memory, llmConfig)

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

	// Multi-tag filtering: ?tags=react&tags=golang
	// Backward compatible: ?tag=react maps to single-element array
	tags := c.QueryArray("tags")
	if len(tags) == 0 {
		if singleTag := c.Query("tag"); singleTag != "" {
			tags = []string{singleTag}
		}
	}

	// Starred filter: ?starred=true
	starredOnly := c.Query("starred") == "true"

	resp, err := h.memoryService.List(c.Request.Context(), userID, page, limit, tags, starredOnly)
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
	validTypes := map[string]bool{"link:fetch": true, "text:vectorize": true, "tag:generate": true, "suggestion:generate": true, "file:extract": true, "cover:generate": true}
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

// GetConstellation handles GET /api/v1/constellation
// Query params: offset (default 0) — for "探索 farther" pagination.
func (h *MemoryHandler) GetConstellation(c *gin.Context) {
	tracer := otel.Tracer("memory-service")
	ctx, span := tracer.Start(c.Request.Context(), "GetConstellation")
	defer span.End()

	userID, ok := getUserID(c)
	if !ok {
		respondWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
		return
	}
	span.SetAttributes(attribute.String("user_id", userID.String()))

	// Parse offset from query (default 0)
	offset := 0
	if offsetStr := c.Query("offset"); offsetStr != "" {
		if parsed, err := strconv.Atoi(offsetStr); err == nil && parsed >= 0 {
			offset = parsed
		}
	}
	span.SetAttributes(attribute.Int("offset", offset))

	resp, err := h.memoryService.GetConstellation(ctx, userID, offset)
	if err != nil {
		span.SetAttributes(attribute.String("error", err.Error()))
		zap.L().Error("failed to get constellation", zap.Error(err), zap.String("user_id", userID.String()))
		respondWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred")
		return
	}

	span.SetAttributes(attribute.Int("node_count", len(resp.Nodes)), attribute.Int("edge_count", len(resp.Edges)))

	// Convert nodes to safe response format
	nodeItems := make([]map[string]interface{}, len(resp.Nodes))
	for i, n := range resp.Nodes {
		nodeItems[i] = map[string]interface{}{
			"id":           n.ID,
			"content_type": n.ContentType,
			"text_content": n.TextContent,
			"link_title":   n.LinkTitle,
			"tags":         n.Tags,
			"is_starred":   n.IsStarred,
			"created_at":   n.CreatedAt,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"nodes":    nodeItems,
			"edges":    resp.Edges,
			"has_more": resp.HasMore,
			"total":    resp.Total,
		},
	})
}

// Explore handles GET /api/v1/memories/:id/explore
func (h *MemoryHandler) Explore(c *gin.Context) {
	tracer := otel.Tracer("memory-service")
	ctx, span := tracer.Start(c.Request.Context(), "ExploreMemory")
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

	resp, err := h.memoryService.Explore(ctx, memoryID, userID)
	if err != nil {
		span.SetAttributes(attribute.String("error", err.Error()))
		switch err {
		case service.ErrMemoryNotFound:
			respondWithError(c, http.StatusNotFound, "NOT_FOUND", "Memory not found")
		case service.ErrUnauthorized:
			respondWithError(c, http.StatusForbidden, "FORBIDDEN", "Access denied")
		default:
			zap.L().Error("explore failed", zap.Error(err), zap.String("memory_id", memoryID.String()))
			respondWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred")
		}
		return
	}

	span.SetAttributes(attribute.Int("result_count", len(resp.Results)))

	// Convert results to safe response — flat structure per backend contract
	resultItems := make([]map[string]interface{}, len(resp.Results))
	for i, r := range resp.Results {
		item := r.Memory.SafeResponse()
		item["similarity"] = r.Similarity
		item["reason"] = r.Reason
		resultItems[i] = item
	}

	breadcrumbItems := make([]map[string]interface{}, len(resp.Breadcrumb))
	for i, b := range resp.Breadcrumb {
		breadcrumbItems[i] = map[string]interface{}{
			"id":    b.ID,
			"label": b.Label,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"memory_id":  resp.MemoryID,
			"results":    resultItems,
			"breadcrumb": breadcrumbItems,
		},
	})
}

// GetStreak handles GET /api/v1/memories/streaks
func (h *MemoryHandler) GetStreak(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		respondWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
		return
	}

	current, longest, hasToday, err := h.memoryService.GetStreak(c.Request.Context(), userID)
	if err != nil {
		zap.L().Error("failed to get streak", zap.Error(err), zap.String("user_id", userID.String()))
		respondWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"current_streak":     current,
			"longest_streak":     longest,
			"has_recorded_today": hasToday,
		},
	})
}

// GetSerendipity handles GET /api/v1/memories/serendipity
func (h *MemoryHandler) GetSerendipity(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		respondWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
		return
	}

	resp, err := h.memoryService.GetSerendipity(c.Request.Context(), userID)
	if err != nil {
		if errors.Is(err, service.ErrMemoryNotFound) {
			// No serendipity match is a normal state — return 200 with null data
			// so the browser doesn't flag it as a network error.
			c.JSON(http.StatusOK, gin.H{"success": true, "data": nil})
			return
		}
		zap.L().Error("failed to get serendipity", zap.Error(err), zap.String("user_id", userID.String()))
		respondWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"memory":         resp.Memory.SafeResponse(),
			"memories_since": resp.MemoriesSince,
			"years_ago":      resp.YearsAgo,
		},
	})
}

// GetDailyReview handles GET /api/v1/memories/daily-review
func (h *MemoryHandler) GetDailyReview(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		respondWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
		return
	}

	review, err := h.memoryService.GetDailyReview(c.Request.Context(), userID)
	if err != nil {
		zap.L().Error("failed to get daily review", zap.Error(err), zap.String("user_id", userID.String()))
		respondWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred")
		return
	}

	data := gin.H{
		"today_count": review.TodayCount,
		"top_tags":    review.TopTags,
	}
	if review.WorthReviewing != nil {
		data["worth_reviewing"] = review.WorthReviewing.SafeResponse()
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
}

// UpdateTextContent handles PATCH /api/v1/internal/memories/:id/text
// Called by Processor Service after extracting text from uploaded files.
func (h *MemoryHandler) UpdateTextContent(c *gin.Context) {
	memoryID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		respondWithError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid memory ID")
		return
	}

	var req struct {
		TextContent string `json:"text_content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondWithValidationError(c, err)
		return
	}

	if err := h.memoryService.UpdateTextContent(c.Request.Context(), memoryID, req.TextContent); err != nil {
		switch err {
		case service.ErrMemoryNotFound:
			respondWithError(c, http.StatusNotFound, "NOT_FOUND", "Memory not found")
		default:
			zap.L().Error("failed to update text content", zap.Error(err), zap.String("memory_id", memoryID.String()))
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

// Weave handles POST /api/v1/memories/weave
func (h *MemoryHandler) Weave(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		respondWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
		return
	}

	var req domain.WeaveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondWithValidationError(c, err)
		return
	}

	memory, err := h.memoryService.WeaveMemories(c.Request.Context(), userID, req)
	if err != nil {
		zap.L().Error("weave failed", zap.Error(err), zap.String("user_id", userID.String()))
		respondWithError(c, http.StatusInternalServerError, "WEAVE_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data": gin.H{
			"memory": memory.SafeResponse(),
		},
	})
}

// SealMemory handles POST /api/v1/memories/:id/seal
func (h *MemoryHandler) SealMemory(c *gin.Context) {
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

	var req domain.SealMemoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondWithValidationError(c, err)
		return
	}

	if err := h.memoryService.SealMemory(c.Request.Context(), userID, memoryID, req.SealedUntil); err != nil {
		if errors.Is(err, service.ErrInvalidRequest) {
			respondWithError(c, http.StatusBadRequest, "INVALID_REQUEST", "Cannot seal to a past date")
			return
		}
		zap.L().Error("failed to seal memory", zap.Error(err), zap.String("memory_id", memoryID.String()))
		respondWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred")
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// UnsealMemory handles DELETE /api/v1/memories/:id/seal
func (h *MemoryHandler) UnsealMemory(c *gin.Context) {
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

	if err := h.memoryService.UnsealMemory(c.Request.Context(), userID, memoryID); err != nil {
		zap.L().Error("failed to unseal memory", zap.Error(err), zap.String("memory_id", memoryID.String()))
		respondWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred")
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ListSealedMemories handles GET /api/v1/memories/sealed
func (h *MemoryHandler) ListSealedMemories(c *gin.Context) {
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

	resp, err := h.memoryService.ListSealedMemories(c.Request.Context(), userID, page, limit)
	if err != nil {
		zap.L().Error("failed to list sealed memories", zap.Error(err), zap.String("user_id", userID.String()))
		respondWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred")
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": resp})
}

// GetRecentlyUnsealed handles GET /api/v1/memories/unsealed
func (h *MemoryHandler) GetRecentlyUnsealed(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		respondWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
		return
	}

	memories, err := h.memoryService.GetRecentlyUnsealed(c.Request.Context(), userID)
	if err != nil {
		zap.L().Error("failed to get recently unsealed", zap.Error(err), zap.String("user_id", userID.String()))
		respondWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred")
		return
	}

	results := make([]map[string]interface{}, len(memories))
	for i, m := range memories {
		results[i] = m.SafeResponse()
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"memories": results}})
}
