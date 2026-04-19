// Package service implements the memory business logic.
package service

import (
	"context"
	"errors"
	"fmt"
	"html"
	"net/url"
	"regexp"
	"strings"

	"github.com/NebulaVzx/Echoes/services/memory-service/internal/domain"
	"github.com/NebulaVzx/Echoes/services/memory-service/internal/repository"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

var (
	ErrMemoryNotFound = errors.New("memory not found")
	ErrUnauthorized   = errors.New("unauthorized access to memory")
	ErrInvalidURL     = errors.New("invalid URL: must be http or https")
)

// dangerousHTMLTags matches potentially harmful HTML tags.
var dangerousHTMLTags = regexp.MustCompile(`(?i)<(script|iframe|object|embed|form|input|style)[\s\S]*?>|</(script|iframe|object|embed|form|input|style)>`)

// sanitizeText removes dangerous HTML tags and escapes remaining HTML.
func sanitizeText(input string) string {
	// Remove dangerous tags
	cleaned := dangerousHTMLTags.ReplaceAllString(input, "")
	// Escape any remaining HTML to prevent rendering
	return html.EscapeString(cleaned)
}

// sanitizeTags cleans each tag string.
func sanitizeTags(tags []string) []string {
	cleaned := make([]string, 0, len(tags))
	for _, tag := range tags {
		t := strings.TrimSpace(tag)
		if t == "" {
			continue
		}
		// Remove HTML from tags
		t = dangerousHTMLTags.ReplaceAllString(t, "")
		t = html.EscapeString(t)
		if t != "" {
			cleaned = append(cleaned, t)
		}
	}
	return cleaned
}

// validateLinkURL ensures the URL is valid and uses http/https scheme.
func validateLinkURL(rawURL string) error {
	u, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil {
		return fmt.Errorf("%w: %v", ErrInvalidURL, err)
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("%w: scheme must be http or https, got %s", ErrInvalidURL, u.Scheme)
	}
	if u.Host == "" {
		return fmt.Errorf("%w: missing host", ErrInvalidURL)
	}
	return nil
}

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
	// Validate and sanitize link URL
	if req.ContentType == "link" {
		if err := validateLinkURL(req.LinkURL); err != nil {
			return nil, err
		}
	}

	// Sanitize user inputs
	textContent := sanitizeText(req.TextContent)
	note := sanitizeText(req.Note)
	tags := sanitizeTags(req.Tags)

	memory := &domain.Memory{
		ID:               uuid.New(),
		UserID:           userID,
		ContentType:      req.ContentType,
		TextContent:      textContent,
		LinkURL:          req.LinkURL,
		Tags:             pq.StringArray(tags),
		Note:             note,
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

	// Sanitize user inputs
	memory.Tags = pq.StringArray(sanitizeTags(req.Tags))
	memory.Note = sanitizeText(req.Note)

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
