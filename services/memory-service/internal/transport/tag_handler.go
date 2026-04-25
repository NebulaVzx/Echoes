// Package transport provides HTTP handlers for tag endpoints.
package transport

import (
	"net/http"

	"github.com/NebulaVzx/Echoes/services/memory-service/internal/domain"
	"github.com/NebulaVzx/Echoes/services/memory-service/internal/service"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// TagHandler handles HTTP requests for tag operations.
type TagHandler struct {
	tagService *service.TagService
}

// NewTagHandler creates a new tag HTTP handler.
func NewTagHandler(tagService *service.TagService) *TagHandler {
	return &TagHandler{tagService: tagService}
}

// RegisterRoutes registers tag routes on the given router.
func (h *TagHandler) RegisterRoutes(router *gin.RouterGroup) {
	router.GET("/tags", h.List)
	router.GET("/tags/:name/related", h.GetRelated)
	router.POST("/tags/merge", h.Merge)
	router.GET("/tags/similar", h.FindSimilar)
}

// List handles retrieving all tags for the authenticated user.
func (h *TagHandler) List(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		respondWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
		return
	}

	resp, err := h.tagService.ListTags(c.Request.Context(), userID)
	if err != nil {
		zap.L().Error("failed to list tags", zap.Error(err), zap.String("user_id", userID.String()))
		respondWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred")
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": resp})
}

// GetRelated handles retrieving related tags for a given tag.
func (h *TagHandler) GetRelated(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		respondWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
		return
	}

	tag := c.Param("name")
	if tag == "" {
		respondWithError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Tag name is required")
		return
	}

	resp, err := h.tagService.GetRelatedTags(c.Request.Context(), userID, tag)
	if err != nil {
		zap.L().Error("failed to get related tags", zap.Error(err), zap.String("tag", tag))
		respondWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred")
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": resp})
}

// Merge handles merging one tag into another.
func (h *TagHandler) Merge(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		respondWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
		return
	}

	var req domain.MergeTagsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondWithValidationError(c, err)
		return
	}

	affected, err := h.tagService.MergeTags(c.Request.Context(), userID, req)
	if err != nil {
		zap.L().Error("failed to merge tags", zap.Error(err), zap.String("source", req.SourceTag), zap.String("target", req.TargetTag))
		respondWithError(c, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"affected": affected}})
}

// FindSimilar handles retrieving tags that are similar and should be merged.
func (h *TagHandler) FindSimilar(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		respondWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
		return
	}

	pairs, err := h.tagService.FindSimilarTags(c.Request.Context(), userID)
	if err != nil {
		zap.L().Error("failed to find similar tags", zap.Error(err))
		respondWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred")
		return
	}

	// Convert [2]string to objects for better JSON
	results := make([]map[string]string, len(pairs))
	for i, p := range pairs {
		results[i] = map[string]string{
			"canonical": p[0],
			"duplicate": p[1],
		}
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"pairs": results}})
}
