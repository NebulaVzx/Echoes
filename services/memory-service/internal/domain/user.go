// Package domain defines the core business entities for the memory service.
package domain

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// User mirrors the user-service user model for read-only access.
type User struct {
	ID        uuid.UUID      `gorm:"type:uuid;primary_key" json:"id"`
	Settings  datatypes.JSON `gorm:"type:jsonb" json:"settings,omitempty"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
}

// TableName specifies the table name for User.
func (User) TableName() string {
	return "users"
}
