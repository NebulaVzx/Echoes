// Package service implements the memory business logic.
package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/NebulaVzx/Echoes/services/memory-service/internal/domain"
	"github.com/NebulaVzx/Echoes/services/memory-service/internal/repository"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

var (
	ErrMemoryNotFound = errors.New("memory not found")
	ErrUnauthorized   = errors.New("unauthorized access to memory")
)

// MemoryService handles memory CRUD business logic.
type MemoryService struct {
	repo  repository.MemoryRepository
	queue TaskQueue
}

// TaskQueue defines the interface for publishing async tasks.
type TaskQueue interface {
	PublishLinkFetch(memoryID uuid.UUID, linkURL string) error
	PublishTextVectorize(memoryID uuid.UUID, content string) error
	PublishTagGenerate(memoryID uuid.UUID, content string) error
}

// NewMemoryService creates a new memory service.
func NewMemoryService(repo repository.MemoryRepository, queue TaskQueue) *MemoryService {
	return &MemoryService{
		repo:  repo,
		queue: queue,
	}
}

// Create creates a new memory and publishes async tasks.
func (s *MemoryService) Create(ctx context.Context, userID uuid.UUID, req domain.CreateMemoryRequest) (*domain.Memory, error) {
	// Validate request based on content type
	if req.ContentType == "text" && strings.TrimSpace(req.TextContent) == "" {
		return nil, errors.New("text content is required for text memories")
	}
	if req.ContentType == "link" && strings.TrimSpace(req.LinkURL) == "" {
		return nil, errors.New("link URL is required for link memories")
	}

	memory := &domain.Memory{
		ID:          uuid.New(),
		UserID:      userID,
		ContentType: req.ContentType,
		TextContent: req.TextContent,
		LinkURL:     req.LinkURL,
		Tags:        pq.StringArray(req.Tags),
		Note:        req.Note,
		ProcessingStatus: "pending",
		Visibility:       "private",
	}

	if err := s.repo.Create(ctx, memory); err != nil {
		return nil, fmt.Errorf("failed to create memory: %w", err)
	}

	// Publish async tasks
	s.publishTasks(memory)

	return memory, nil
}

// publishTasks publishes async processing tasks based on memory type.
func (s *MemoryService) publishTasks(memory *domain.Memory) {
	// For link memories, publish link fetch task
	if memory.ContentType == "link" && memory.LinkURL != "" {
		_ = s.queue.PublishLinkFetch(memory.ID, memory.LinkURL)
	}

	// For all memories, publish text vectorization
	content := s.extractContent(memory)
	if content != "" {
		_ = s.queue.PublishTextVectorize(memory.ID, content)
		_ = s.queue.PublishTagGenerate(memory.ID, content)
	}
}

// extractContent extracts the primary content for vectorization/tagging.
func (s *MemoryService) extractContent(memory *domain.Memory) string {
	if memory.ContentType == "text" {
		return memory.TextContent
	}
	if memory.ContentType == "link" {
		return memory.LinkURL
	}
	return ""
}

// List returns paginated memories for a user.
func (s *MemoryService) List(ctx context.Context, userID uuid.UUID, page, limit int, tag string) (*domain.ListMemoriesResponse, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	memories, total, err := s.repo.ListByUser(ctx, userID, page, limit, tag)
	if err != nil {
		return nil, fmt.Errorf("failed to list memories: %w", err)
	}

	items := make([]map[string]interface{}, len(memories))
	for i, m := range memories {
		items[i] = m.SafeResponse()
	}

	return &domain.ListMemoriesResponse{
		Memories: items,
		Total:    total,
		Page:     page,
		Limit:    limit,
	}, nil
}

// Get returns a single memory by ID, verifying user ownership.
func (s *MemoryService) Get(ctx context.Context, memoryID, userID uuid.UUID) (*domain.Memory, error) {
	memory, err := s.repo.GetByID(ctx, memoryID)
	if err != nil {
		if errors.Is(err, repository.ErrMemoryNotFound) {
			return nil, ErrMemoryNotFound
		}
		return nil, err
	}

	if memory.UserID != userID {
		return nil, ErrUnauthorized
	}

	return memory, nil
}

// Update updates a memory's tags and note.
func (s *MemoryService) Update(ctx context.Context, memoryID, userID uuid.UUID, req domain.UpdateMemoryRequest) (*domain.Memory, error) {
	memory, err := s.Get(ctx, memoryID, userID)
	if err != nil {
		return nil, err
	}

	memory.Tags = pq.StringArray(req.Tags)
	memory.Note = req.Note

	if err := s.repo.Update(ctx, memory); err != nil {
		return nil, fmt.Errorf("failed to update memory: %w", err)
	}

	return memory, nil
}

// Delete removes a memory by ID.
func (s *MemoryService) Delete(ctx context.Context, memoryID, userID uuid.UUID) error {
	if err := s.repo.Delete(ctx, memoryID, userID); err != nil {
		if errors.Is(err, repository.ErrMemoryNotFound) {
			return ErrMemoryNotFound
		}
		return err
	}
	return nil
}
