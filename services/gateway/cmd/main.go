package main

import (
	"context"
	"os"

	"github.com/NebulaVzx/Echoes/services/gateway/internal/observability"
	"github.com/NebulaVzx/Echoes/services/gateway/internal/router"
	"go.uber.org/zap"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// main is the entry point for the Gateway service.
// Initializes Zap logger, OTel tracer, DB connection, and wires the router with observability middleware.
func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Initialize Zap logger
	logger, err := observability.NewLogger("gateway")
	if err != nil {
		panic(err)
	}
	defer logger.Sync()
	zap.ReplaceGlobals(logger)

	// Initialize OpenTelemetry tracer
	shutdown, err := observability.InitTracer("gateway")
	if err != nil {
		logger.Fatal("failed to initialize tracer", zap.Error(err))
	}
	defer shutdown(context.Background())

	// Initialize database connection for chat persistence
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "host=postgres user=echoes_user password=password dbname=echoes port=5432 sslmode=disable"
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		logger.Fatal("failed to connect to database", zap.Error(err))
	}

	// Setup router with logger and DB
	r := router.Setup(logger, db)

	logger.Info("gateway starting", zap.String("port", port))
	if err := r.Run(":" + port); err != nil {
		logger.Fatal("failed to start gateway", zap.Error(err))
	}
}
