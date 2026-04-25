package middleware

import (
	"testing"
)

func TestIsPublicRoute_ExactMatch(t *testing.T) {
	tests := []struct {
		path     string
		expected bool
	}{
		{"/health", true},
		{"/api/v1/auth/login", true},
		{"/api/v1/auth/register", true},
		{"/api/v1/auth/providers", true},
		{"/api/v1/auth/github", true},
		{"/api/v1/auth/refresh", true},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			got := isPublicRoute(tt.path)
			if got != tt.expected {
				t.Errorf("isPublicRoute(%q) = %v, want %v", tt.path, got, tt.expected)
			}
		})
	}
}

func TestIsPublicRoute_PrefixMatch(t *testing.T) {
	tests := []struct {
		path     string
		expected bool
	}{
		{"/api/v1/auth/github/callback", true},
		{"/api/v1/auth/github/callback?code=xxx", true},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			got := isPublicRoute(tt.path)
			if got != tt.expected {
				t.Errorf("isPublicRoute(%q) = %v, want %v", tt.path, got, tt.expected)
			}
		})
	}
}

func TestIsPublicRoute_PathTraversal(t *testing.T) {
	// CR-02: filepath.Clean should normalize path traversal attempts,
	// preventing bypass of authentication.
	tests := []struct {
		path     string
		expected bool
	}{
		{"/health/../api/v1/memories", false},
		{"/api/v1/auth/login/../../memories", false},
		{"/api/v1/auth/login/..", false}, // Clean → /api/v1/auth
		{"/../api/v1/memories", false},   // Clean → /api/v1/memories
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			got := isPublicRoute(tt.path)
			if got != tt.expected {
				t.Errorf("isPublicRoute(%q) = %v, want %v (clean path: %s)", tt.path, got, tt.expected, filepath.Clean(tt.path))
			}
		})
	}
}

func TestIsPublicRoute_ProtectedPaths(t *testing.T) {
	tests := []struct {
		path     string
		expected bool
	}{
		{"/api/v1/memories", false},
		{"/api/v1/search", false},
		{"/api/v1/chat/messages", false},
		{"/api/v1/memories/123", false},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			got := isPublicRoute(tt.path)
			if got != tt.expected {
				t.Errorf("isPublicRoute(%q) = %v, want %v", tt.path, got, tt.expected)
			}
		})
	}
}
