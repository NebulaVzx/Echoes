// Package domain defines the core business entities for the user service.
package domain

import (
	"time"

	"github.com/google/uuid"
)

// User represents a registered user in the Echoes system.
type User struct {
	ID             uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	Email          string    `gorm:"type:varchar(255);uniqueIndex;not null" json:"email"`
	PasswordHash   string    `gorm:"type:varchar(255)" json:"-"` // never expose in JSON
	Username       string    `gorm:"type:varchar(100)" json:"username"`
	AvatarURL      string    `gorm:"type:text" json:"avatar_url"`
	OAuthProvider  string    `gorm:"column:oauth_provider;type:varchar(50)" json:"oauth_provider,omitempty"`
	OAuthID        string    `gorm:"column:oauth_id;type:varchar(255)" json:"-"`
	IsActive       bool      `gorm:"default:true" json:"is_active"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// TableName specifies the table name for User.
func (User) TableName() string {
	return "users"
}

// SafeResponse returns a user object safe for JSON serialization (no sensitive fields).
func (u User) SafeResponse() map[string]interface{} {
	return map[string]interface{}{
		"id":             u.ID,
		"email":          u.Email,
		"username":       u.Username,
		"avatar_url":     u.AvatarURL,
		"oauth_provider": u.OAuthProvider,
		"is_active":      u.IsActive,
		"created_at":     u.CreatedAt,
	}
}
