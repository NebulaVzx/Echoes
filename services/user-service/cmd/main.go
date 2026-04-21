package main

import (
	"context"
	"os"

	"github.com/NebulaVzx/Echoes/services/user-service/internal/config"
	"github.com/NebulaVzx/Echoes/services/user-service/internal/middleware"
	"github.com/NebulaVzx/Echoes/services/user-service/internal/observability"
	"github.com/NebulaVzx/Echoes/services/user-service/internal/repository"
	"github.com/NebulaVzx/Echoes/services/user-service/internal/service"
	"github.com/NebulaVzx/Echoes/services/user-service/internal/transport"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// main is the entry point for the User service.
// Initializes Zap logger, OTel tracer, and wires the router with observability middleware.
func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8001"
	}

	// Initialize Zap logger
	logger, err := observability.NewLogger("user-service")
	if err != nil {
		panic(err)
	}
	defer logger.Sync()
	zap.ReplaceGlobals(logger)

	// Initialize OpenTelemetry tracer
	shutdown, err := observability.InitTracer("user-service")
	if err != nil {
		logger.Fatal("failed to initialize tracer", zap.Error(err))
	}
	defer shutdown(context.Background())

	// Connect to database
	db, err := config.NewDatabase()
	if err != nil {
		logger.Fatal("failed to connect to database", zap.Error(err))
	}

	// Initialize layers
	userRepo := repository.NewGormUserRepository(db)
	authService := service.NewAuthService(userRepo)
	authHandler := transport.NewAuthHandler(authService)

	// Setup router with observability middleware
	gin.SetMode(gin.DebugMode)
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(middleware.OTelGin("user-service"))
	router.Use(middleware.PrometheusMetrics("user-service"))
	router.Use(middleware.ZapLogger(logger))

	// Register /metrics endpoint
	observability.RegisterMetricsEndpoint(router)

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

	logger.Info("user-service starting", zap.String("port", port))
	if err := router.Run(":" + port); err != nil {
		logger.Fatal("failed to start user service", zap.Error(err))
	}
}
