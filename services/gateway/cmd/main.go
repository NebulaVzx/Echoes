package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
)

// main is the entry point for the Gateway service.
// It sets up the Gin HTTP router and starts listening on the configured port.
func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	gin.SetMode(gin.DebugMode)
	router := gin.Default()

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"service": "gateway",
			"version": "0.1.0",
		})
	})

	// API v1 routes placeholder
	v1 := router.Group("/api/v1")
	{
		v1.GET("/", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"message": "Welcome to Echoes API",
				"version": "v1",
			})
		})
	}

	log.Printf("Gateway service starting on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start gateway: %v", err)
	}
}
