package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
)

// main is the entry point for the User service.
// Handles user registration, authentication, and profile management.
func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8001"
	}

	gin.SetMode(gin.DebugMode)
	router := gin.Default()

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"service": "user-service",
			"version": "0.1.0",
		})
	})

	log.Printf("User service starting on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start user service: %v", err)
	}
}
