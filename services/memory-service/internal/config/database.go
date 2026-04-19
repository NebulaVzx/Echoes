// Package config handles database connection setup.
package config

import (
	"fmt"
	"os"

	"github.com/NebulaVzx/Echoes/services/memory-service/internal/domain"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// NewDatabase creates a new PostgreSQL database connection using GORM.
func NewDatabase() (*gorm.DB, error) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://echoes_user:echoes_password@postgres:5432/echoes?sslmode=disable"
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Enable vector extension (pgvector, required for VECTOR type)
	if err := db.Exec("CREATE EXTENSION IF NOT EXISTS vector").Error; err != nil {
		return nil, fmt.Errorf("failed to create vector extension: %w", err)
	}

	// Auto-migrate the memories and users tables
	if err := db.AutoMigrate(&domain.Memory{}, &domain.User{}); err != nil {
		return nil, fmt.Errorf("failed to auto-migrate: %w", err)
	}

	return db, nil
}
