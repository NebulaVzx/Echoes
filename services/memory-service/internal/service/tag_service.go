// Package service implements tag business logic.
package service

import (
	"context"
	"fmt"

	"github.com/NebulaVzx/Echoes/services/memory-service/internal/domain"
	"github.com/NebulaVzx/Echoes/services/memory-service/internal/repository"
	"github.com/google/uuid"
)

// TagService handles tag business logic.
type TagService struct {
	tagRepo repository.TagRepository
}

// NewTagService creates a new tag service.
func NewTagService(tagRepo repository.TagRepository) *TagService {
	return &TagService{tagRepo: tagRepo}
}

// ListTags returns all tags for a user with usage statistics.
func (s *TagService) ListTags(ctx context.Context, userID uuid.UUID) (*domain.TagListResponse, error) {
	tags, err := s.tagRepo.ListByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to list tags: %w", err)
	}
	return &domain.TagListResponse{Tags: tags}, nil
}

// GetRelatedTags returns tags that co-occur with the given tag.
func (s *TagService) GetRelatedTags(ctx context.Context, userID uuid.UUID, tag string) (*domain.RelatedTagsResponse, error) {
	related, err := s.tagRepo.GetRelatedTags(ctx, userID, tag)
	if err != nil {
		return nil, fmt.Errorf("failed to get related tags: %w", err)
	}
	return &domain.RelatedTagsResponse{
		Tag:         tag,
		RelatedTags: related,
	}, nil
}

// MergeTags replaces all occurrences of sourceTag with targetTag.
func (s *TagService) MergeTags(ctx context.Context, userID uuid.UUID, req domain.MergeTagsRequest) (int64, error) {
	if req.SourceTag == req.TargetTag {
		return 0, fmt.Errorf("source and target tags are the same")
	}
	affected, err := s.tagRepo.MergeTags(ctx, userID, req.SourceTag, req.TargetTag)
	if err != nil {
		return 0, fmt.Errorf("failed to merge tags: %w", err)
	}
	return affected, nil
}

// FindSimilarTags finds tags that should be merged (case-insensitive duplicates).
func (s *TagService) FindSimilarTags(ctx context.Context, userID uuid.UUID) ([][2]string, error) {
	return s.tagRepo.FindSimilarTags(ctx, userID)
}
