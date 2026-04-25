// Package domain defines tag-related business entities.
package domain

import (
	"time"
)

// TagInfo represents a tag with its usage statistics.
type TagInfo struct {
	Name           string    `json:"name"`
	Count          int       `json:"count"`
	LastUpdatedAt  time.Time `json:"last_updated_at"`
	RelatedTags    []string  `json:"related_tags,omitempty"`
}

// TagListResponse represents the response for listing all tags.
type TagListResponse struct {
	Tags []TagInfo `json:"tags"`
}

// RelatedTagsResponse represents the response for related tags.
type RelatedTagsResponse struct {
	Tag         string   `json:"tag"`
	RelatedTags []string `json:"related_tags"`
}

// MergeTagsRequest represents a request to merge tags.
type MergeTagsRequest struct {
	SourceTag string `json:"source_tag" binding:"required"`
	TargetTag string `json:"target_tag" binding:"required"`
}
