package main

import (
	"log"
	"os"

	"github.com/NebulaVzx/Echoes/services/memory-service/internal/config"
	"github.com/NebulaVzx/Echoes/services/memory-service/internal/repository"
	"github.com/NebulaVzx/Echoes/services/memory-service/internal/service"
	"github.com/NebulaVzx/Echoes/services/memory-service/internal/transport"
	"github.com/gin-gonic/gin"
)

// main is the entry point for the Memory service.
// Handles memory CRUD, tagging, search, and publishes async tasks to Redis Streams.
func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8002"
	}

	// Initialize database
	db, err := config.NewDatabase()
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// Initialize repositories
	memoryRepo := repository.NewGormMemoryRepository(db)
	userRepo := repository.NewGormUserRepository(db)

	// Initialize Redis task queue
	taskQueue := service.NewRedisTaskQueue()

	// Initialize service
	memoryService := service.NewMemoryService(memoryRepo, userRepo, taskQueue)

	// Initialize handler
	memoryHandler := transport.NewMemoryHandler(memoryService)

	// Setup router
	gin.SetMode(gin.DebugMode)
	router := gin.Default()

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"service": "memory-service",
			"version": "0.2.0",
		})
	})

	// API routes
	v1 := router.Group("/api/v1")
	memoryHandler.RegisterRoutes(v1)

	log.Printf("Memory service starting on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start memory service: %v", err)
	}
}
