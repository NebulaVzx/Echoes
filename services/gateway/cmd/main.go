package main

import (
	"context"
	"os"

	"github.com/NebulaVzx/Echoes/services/gateway/internal/observability"
	"github.com/NebulaVzx/Echoes/services/gateway/internal/router"
	"go.uber.org/zap"
)

// main is the entry point for the Gateway service.
// Initializes Zap logger, OTel tracer, and wires the router with observability middleware.
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

	// Setup router with logger
	r := router.Setup(logger)

	logger.Info("gateway starting", zap.String("port", port))
	if err := r.Run(":" + port); err != nil {
		logger.Fatal("failed to start gateway", zap.Error(err))
	}
}
