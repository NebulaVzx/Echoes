package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
)

// main is the entry point for the Memory service.
// Handles memory CRUD, tagging, search, and publishes async tasks to Redis Streams.
func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8002"
	}

	gin.SetMode(gin.DebugMode)
	router := gin.Default()

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"service": "memory-service",
			"version": "0.1.0",
		})
	})

	log.Printf("Memory service starting on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start memory service: %v", err)
	}
}
