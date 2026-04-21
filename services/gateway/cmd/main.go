package main

import (
	"log"
	"os"

	"github.com/NebulaVzx/Echoes/services/gateway/internal/router"
)

// main is the entry point for the Gateway service.
func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	r := router.Setup()

	log.Printf("Gateway service starting on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start gateway: %v", err)
	}
}
