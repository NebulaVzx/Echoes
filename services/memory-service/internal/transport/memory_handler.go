// Package transport provides HTTP handlers for memory endpoints.
package transport

import (
	"net/http"
	"os"
	"strconv"

	"github.com/NebulaVzx/Echoes/services/memory-service/internal/domain"
	"github.com/NebulaVzx/Echoes/services/memory-service/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

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

	// Internal API for service-to-service communication
	internal := router.Group("/internal")
	internal.Use(internalAuthMiddleware())
	internal.PATCH("/memories/:id/tasks", h.UpdateTaskStatus)
	internal.POST("/memories/:id/tasks/:task_type/retry", h.RetryTask)
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
	userID, ok := getUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "UNAUTHORIZED", "message": "User not authenticated"}})
		return
	}

	var req domain.CreateMemoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}

	memory, err := h.memoryService.Create(c.Request.Context(), userID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "data": memory.SafeResponse()})
}

// List handles retrieving a paginated list of memories.
func (h *MemoryHandler) List(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "UNAUTHORIZED", "message": "User not authenticated"}})
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
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": gin.H{"code": "INTERNAL_ERROR", "message": err.Error()}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": resp})
}

// Get handles retrieving a single memory by ID.
func (h *MemoryHandler) Get(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "UNAUTHORIZED", "message": "User not authenticated"}})
		return
	}

	memoryID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": "Invalid memory ID"}})
		return
	}

	memory, err := h.memoryService.Get(c.Request.Context(), memoryID, userID)
	if err != nil {
		switch err {
		case service.ErrMemoryNotFound:
			c.JSON(http.StatusNotFound, gin.H{"success": false, "error": gin.H{"code": "NOT_FOUND", "message": "Memory not found"}})
		case service.ErrUnauthorized:
			c.JSON(http.StatusForbidden, gin.H{"success": false, "error": gin.H{"code": "FORBIDDEN", "message": "Access denied"}})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": gin.H{"code": "INTERNAL_ERROR", "message": err.Error()}})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": memory.SafeResponse()})
}

// Update handles updating a memory's tags and note.
func (h *MemoryHandler) Update(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "UNAUTHORIZED", "message": "User not authenticated"}})
		return
	}

	memoryID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": "Invalid memory ID"}})
		return
	}

	var req domain.UpdateMemoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}

	memory, err := h.memoryService.Update(c.Request.Context(), memoryID, userID, req)
	if err != nil {
		switch err {
		case service.ErrMemoryNotFound:
			c.JSON(http.StatusNotFound, gin.H{"success": false, "error": gin.H{"code": "NOT_FOUND", "message": "Memory not found"}})
		case service.ErrUnauthorized:
			c.JSON(http.StatusForbidden, gin.H{"success": false, "error": gin.H{"code": "FORBIDDEN", "message": "Access denied"}})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": gin.H{"code": "INTERNAL_ERROR", "message": err.Error()}})
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
			c.AbortWithStatusJSON(401, gin.H{"success": false, "error": gin.H{"code": "UNAUTHORIZED", "message": "Invalid internal API token"}})
			return
		}
		c.Next()
	}
}

// UpdateTaskStatus handles PATCH /api/v1/internal/memories/:id/tasks
func (h *MemoryHandler) UpdateTaskStatus(c *gin.Context) {
	memoryID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": "Invalid memory ID"}})
		return
	}

	var req domain.TaskStatusUpdate
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}

	if err := h.memoryService.UpdateTaskStatus(c.Request.Context(), memoryID, req); err != nil {
		switch err {
		case service.ErrMemoryNotFound:
			c.JSON(http.StatusNotFound, gin.H{"success": false, "error": gin.H{"code": "NOT_FOUND", "message": "Memory not found"}})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": gin.H{"code": "INTERNAL_ERROR", "message": err.Error()}})
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
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": "Invalid memory ID"}})
		return
	}

	taskType := c.Param("task_type")
	validTypes := map[string]bool{"link:fetch": true, "text:vectorize": true, "tag:generate": true}
	if !validTypes[taskType] {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": "Invalid task_type"}})
		return
	}

	if err := h.memoryService.RetryTask(c.Request.Context(), memoryID, taskType); err != nil {
		switch err {
		case service.ErrMemoryNotFound:
			c.JSON(http.StatusNotFound, gin.H{"success": false, "error": gin.H{"code": "NOT_FOUND", "message": "Memory not found"}})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": gin.H{"code": "INTERNAL_ERROR", "message": err.Error()}})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// Search handles semantic search for memories.
func (h *MemoryHandler) Search(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "UNAUTHORIZED", "message": "User not authenticated"}})
		return
	}

	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": "Query parameter 'q' is required"}})
		return
	}

	limit := 10
	if l := c.Query("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 && v <= 100 {
			limit = v
		}
	}

	resp, err := h.memoryService.Search(c.Request.Context(), userID, query, limit)
	if err != nil {
		if err.Error() == "搜索服务暂不可用" {
			c.JSON(http.StatusServiceUnavailable, gin.H{"success": false, "error": gin.H{"code": "SERVICE_UNAVAILABLE", "message": err.Error()}})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": gin.H{"code": "INTERNAL_ERROR", "message": err.Error()}})
		return
	}

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
	userID, ok := getUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "UNAUTHORIZED", "message": "User not authenticated"}})
		return
	}

	memoryID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": "Invalid memory ID"}})
		return
	}

	limit := 3
	if l := c.Query("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 && v <= 20 {
			limit = v
		}
	}

	resp, err := h.memoryService.Related(c.Request.Context(), memoryID, userID, limit)
	if err != nil {
		switch err {
		case service.ErrMemoryNotFound:
			c.JSON(http.StatusNotFound, gin.H{"success": false, "error": gin.H{"code": "NOT_FOUND", "message": "Memory not found"}})
		case service.ErrUnauthorized:
			c.JSON(http.StatusForbidden, gin.H{"success": false, "error": gin.H{"code": "FORBIDDEN", "message": "Access denied"}})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": gin.H{"code": "INTERNAL_ERROR", "message": err.Error()}})
		}
		return
	}

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
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "UNAUTHORIZED", "message": "User not authenticated"}})
		return
	}

	memoryID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "VALIDATION_ERROR", "message": "Invalid memory ID"}})
		return
	}

	if err := h.memoryService.Delete(c.Request.Context(), memoryID, userID); err != nil {
		switch err {
		case service.ErrMemoryNotFound:
			c.JSON(http.StatusNotFound, gin.H{"success": false, "error": gin.H{"code": "NOT_FOUND", "message": "Memory not found"}})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": gin.H{"code": "INTERNAL_ERROR", "message": err.Error()}})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Memory deleted"})
}
