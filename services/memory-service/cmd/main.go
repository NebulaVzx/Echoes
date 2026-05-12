package main

import (
	"context"
	"os"

	"github.com/NebulaVzx/Echoes/services/memory-service/internal/config"
	"github.com/NebulaVzx/Echoes/services/memory-service/internal/middleware"
	"github.com/NebulaVzx/Echoes/services/memory-service/internal/observability"
	"github.com/NebulaVzx/Echoes/services/memory-service/internal/repository"
	"github.com/NebulaVzx/Echoes/services/memory-service/internal/service"
	"github.com/NebulaVzx/Echoes/services/memory-service/internal/transport"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// main is the entry point for the Memory service.
// Initializes Zap logger, OTel tracer, and wires the router with observability middleware.
func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8002"
	}

	// Initialize Zap logger
	logger, err := observability.NewLogger("memory-service")
	if err != nil {
		panic(err)
	}
	defer logger.Sync()
	zap.ReplaceGlobals(logger)

	// Initialize OpenTelemetry tracer
	shutdown, err := observability.InitTracer("memory-service")
	if err != nil {
		logger.Fatal("failed to initialize tracer", zap.Error(err))
	}
	defer shutdown(context.Background())

	// Initialize database
	db, err := config.NewDatabase()
	if err != nil {
		logger.Fatal("failed to initialize database", zap.Error(err))
	}

	// Initialize repositories
	memoryRepo := repository.NewGormMemoryRepository(db)
	userRepo := repository.NewGormUserRepository(db)
	suggestionRepo := repository.NewGormSuggestionRepository(db)
	tagRepo := repository.NewGormTagRepository(db)
	relationRepo := repository.NewGormRelationRepository(db)
	emotionRepo := repository.NewGormEmotionRepository(db)

	// Initialize Redis task queue
	taskQueue := service.NewRedisTaskQueue()

	// Initialize vectorizer client
	vectorizerClient := service.NewVectorizerClient()

	// Initialize MinIO client (optional — nil if not configured)
	var minioClient *service.MinIOClient
	if mc, err := service.NewMinIOClient(); err == nil {
		minioClient = mc
		logger.Info("MinIO client initialized")
	} else {
		logger.Warn("MinIO client initialization failed, file uploads disabled", zap.Error(err))
	}

	// Initialize services
	memoryService := service.NewMemoryService(memoryRepo, userRepo, relationRepo, emotionRepo, taskQueue, vectorizerClient, suggestionRepo, minioClient)
	tagService := service.NewTagService(tagRepo, userRepo)

	// Initialize handlers
	memoryHandler := transport.NewMemoryHandler(memoryService)
	moodHandler := transport.NewMoodHandler(memoryService)
	tagHandler := transport.NewTagHandler(tagService)

	// Setup router with observability middleware
	gin.SetMode(gin.DebugMode)
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(middleware.OTelGin("memory-service"))
	router.Use(middleware.PrometheusMetrics("memory-service"))
	router.Use(middleware.ZapLogger(logger))

	// Register /metrics endpoint
	observability.RegisterMetricsEndpoint(router)

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
	moodHandler.RegisterRoutes(v1)
	tagHandler.RegisterRoutes(v1)

	logger.Info("memory-service starting", zap.String("port", port))
	if err := router.Run(":" + port); err != nil {
		logger.Fatal("failed to start memory service", zap.Error(err))
	}
}
