package main

import (
	"log"
	"os"

	"github.com/NebulaVzx/Echoes/services/user-service/internal/config"
	"github.com/NebulaVzx/Echoes/services/user-service/internal/repository"
	"github.com/NebulaVzx/Echoes/services/user-service/internal/service"
	"github.com/NebulaVzx/Echoes/services/user-service/internal/transport"
	"github.com/gin-gonic/gin"
)

// main is the entry point for the User service.
func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8001"
	}

	// Connect to database
	db, err := config.NewDatabase()
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Initialize layers
	userRepo := repository.NewGormUserRepository(db)
	authService := service.NewAuthService(userRepo)
	authHandler := transport.NewAuthHandler(authService)

	// Setup router
	gin.SetMode(gin.DebugMode)
	router := gin.Default()

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"service": "user-service",
			"version": "0.2.0",
		})
	})

	// Auth routes
	v1 := router.Group("/api/v1")
	auth := v1.Group("/auth")
	authHandler.RegisterRoutes(auth)

	log.Printf("User service starting on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start user service: %v", err)
	}
}
