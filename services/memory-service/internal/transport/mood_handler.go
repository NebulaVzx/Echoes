// Package transport provides HTTP handlers for memory endpoints.
package transport

import (
	"net/http"
	"strconv"
	"time"

	"github.com/NebulaVzx/Echoes/services/memory-service/internal/service"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// MoodHandler handles mood-related HTTP endpoints.
type MoodHandler struct {
	memoryService *service.MemoryService
}

// NewMoodHandler creates a new mood HTTP handler.
func NewMoodHandler(memoryService *service.MemoryService) *MoodHandler {
	return &MoodHandler{memoryService: memoryService}
}

// RegisterRoutes registers mood routes on the given router.
func (h *MoodHandler) RegisterRoutes(router *gin.RouterGroup) {
	router.GET("/mood/calendar", h.GetMoodCalendar)
	router.GET("/mood/insight", h.GetMoodInsight)
}

// GetMoodCalendar handles GET /api/v1/mood/calendar?year=2026
func (h *MoodHandler) GetMoodCalendar(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		respondWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
		return
	}

	year := time.Now().Year()
	if y := c.Query("year"); y != "" {
		if v, err := strconv.Atoi(y); err == nil && v > 2000 && v < 2100 {
			year = v
		}
	}

	days, err := h.memoryService.GetMoodCalendar(c.Request.Context(), userID, year)
	if err != nil {
		zap.L().Error("failed to get mood calendar", zap.Error(err), zap.String("user_id", userID.String()))
		respondWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred")
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":   gin.H{"days": days},
	})
}

// GetMoodInsight handles GET /api/v1/mood/insight?year=2026&month=5
func (h *MoodHandler) GetMoodInsight(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		respondWithError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
		return
	}

	year := time.Now().Year()
	if y := c.Query("year"); y != "" {
		if v, err := strconv.Atoi(y); err == nil && v > 2000 && v < 2100 {
			year = v
		}
	}

	month := int(time.Now().Month())
	if m := c.Query("month"); m != "" {
		if v, err := strconv.Atoi(m); err == nil && v >= 1 && v <= 12 {
			month = v
		}
	}

	insight, err := h.memoryService.GetMoodInsight(c.Request.Context(), userID, year, month)
	if err != nil {
		zap.L().Error("failed to get mood insight", zap.Error(err), zap.String("user_id", userID.String()))
		respondWithError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred")
		return
	}


	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":   insight,
	})
}
