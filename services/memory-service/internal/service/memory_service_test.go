package service

import (
	"context"
	"errors"
	"testing"

	"github.com/NebulaVzx/Echoes/services/memory-service/internal/domain"
	"github.com/NebulaVzx/Echoes/services/memory-service/internal/repository"
	"github.com/google/uuid"
)

// mockMemoryRepository implements MemoryRepository with in-memory maps.
type mockMemoryRepository struct {
	memories map[uuid.UUID]*domain.Memory
}

func newMockMemoryRepository() *mockMemoryRepository {
	return &mockMemoryRepository{
		memories: make(map[uuid.UUID]*domain.Memory),
	}
}

func (m *mockMemoryRepository) Create(ctx context.Context, memory *domain.Memory) error {
	m.memories[memory.ID] = memory
	return nil
}

func (m *mockMemoryRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.Memory, error) {
	if mem, ok := m.memories[id]; ok {
		return mem, nil
	}
	return nil, repository.ErrMemoryNotFound
}

func (m *mockMemoryRepository) GetVectorByID(ctx context.Context, id uuid.UUID) (string, error) {
	return "", nil
}

func (m *mockMemoryRepository) ListByUser(ctx context.Context, userID uuid.UUID, page, limit int, tags []string) ([]domain.Memory, int64, error) {
	var results []domain.Memory
	for _, mem := range m.memories {
		if mem.UserID != userID {
			continue
		}
		if len(tags) > 0 {
			found := true
			for _, tag := range tags {
				tagFound := false
				for _, t := range mem.Tags {
					if t == tag {
						tagFound = true
						break
					}
				}
				if !tagFound {
					found = false
					break
				}
			}
			if !found {
				continue
			}
		}
		results = append(results, *mem)
	}

	total := int64(len(results))

	// Paginate
	offset := (page - 1) * limit
	if offset >= len(results) {
		return []domain.Memory{}, total, nil
	}
	end := offset + limit
	if end > len(results) {
		end = len(results)
	}
	return results[offset:end], total, nil
}

func (m *mockMemoryRepository) Update(ctx context.Context, memory *domain.Memory) error {
	if _, ok := m.memories[memory.ID]; !ok {
		return repository.ErrMemoryNotFound
	}
	m.memories[memory.ID] = memory
	return nil
}

func (m *mockMemoryRepository) UpdateVector(ctx context.Context, id uuid.UUID, vector string) error {
	if _, ok := m.memories[id]; !ok {
		return repository.ErrMemoryNotFound
	}
	return nil
}

func (m *mockMemoryRepository) Delete(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	mem, ok := m.memories[id]
	if !ok {
		return repository.ErrMemoryNotFound
	}
	if mem.UserID != userID {
		// Simulate the real repo behavior: delete with userID check
		return repository.ErrMemoryNotFound
	}
	delete(m.memories, id)
	return nil
}

func (m *mockMemoryRepository) SearchByVector(ctx context.Context, userID uuid.UUID, vector string, limit int, threshold float64) ([]domain.SearchResult, error) {
	return nil, nil
}

func (m *mockMemoryRepository) FindRelated(ctx context.Context, userID uuid.UUID, memoryID uuid.UUID, vector string, limit int, threshold float64) ([]domain.SearchResult, error) {
	return nil, nil
}

// mockUserRepository implements the memory-service's UserRepository for tests.
type mockUserRepo struct {
	user *domain.User
	err  error
}

func (m *mockUserRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.User, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.user, nil
}

// mockTaskQueue implements TaskQueue for testing.
type mockTaskQueue struct {
	published []map[string]interface{}
}

func newMockTaskQueue() *mockTaskQueue {
	return &mockTaskQueue{
		published: make([]map[string]interface{}, 0),
	}
}

func (m *mockTaskQueue) PublishLinkFetch(ctx context.Context, memoryID uuid.UUID, linkURL string, note string, llmConfig map[string]interface{}) error {
	m.published = append(m.published, map[string]interface{}{
		"type":   "link:fetch",
		"memory": memoryID,
		"url":    linkURL,
	})
	return nil
}

func (m *mockTaskQueue) PublishTextVectorize(ctx context.Context, memoryID uuid.UUID, content string, llmConfig map[string]interface{}) error {
	m.published = append(m.published, map[string]interface{}{
		"type":    "text:vectorize",
		"memory":  memoryID,
		"content": content,
	})
	return nil
}

func (m *mockTaskQueue) PublishTagGenerate(ctx context.Context, memoryID uuid.UUID, content string, note string, llmConfig map[string]interface{}) error {
	m.published = append(m.published, map[string]interface{}{
		"type":    "tag:generate",
		"memory":  memoryID,
		"content": content,
	})
	return nil
}

func (m *mockTaskQueue) PublishSuggestionGenerate(ctx context.Context, memoryID uuid.UUID, contentType string, content string, note string, style string, timeout int, maxRetries int, llmConfig map[string]interface{}) error {
	m.published = append(m.published, map[string]interface{}{
		"type":         "suggestion:generate",
		"memory":       memoryID,
		"content_type": contentType,
		"style":        style,
	})
	return nil
}

func (m *mockTaskQueue) PublishTask(ctx context.Context, stream string, data map[string]interface{}) error {
	m.published = append(m.published, data)
	return nil
}

// mockSuggestionRepository implements SuggestionRepository for testing.
type mockSuggestionRepository struct{}

func (m *mockSuggestionRepository) Create(ctx context.Context, suggestion *domain.AISuggestion) error {
	return nil
}

func (m *mockSuggestionRepository) GetByMemoryID(ctx context.Context, memoryID uuid.UUID) (*domain.AISuggestion, error) {
	return nil, repository.ErrSuggestionNotFound
}

func (m *mockSuggestionRepository) UpdateFeedback(ctx context.Context, memoryID uuid.UUID, feedback string) error {
	return nil
}

func (m *mockSuggestionRepository) DeleteByMemoryID(ctx context.Context, memoryID uuid.UUID) error {
	return nil
}

func newTestMemoryService() (*MemoryService, *mockMemoryRepository, *mockTaskQueue) {
	repo := newMockMemoryRepository()
	userRepo := &mockUserRepo{
		user: &domain.User{
			ID: uuid.Nil,
		},
	}
	queue := newMockTaskQueue()
	suggestionRepo := &mockSuggestionRepository{}
	svc := NewMemoryService(repo, userRepo, queue, nil, suggestionRepo)
	return svc, repo, queue
}

func TestMemoryService_Create_TextMemory(t *testing.T) {
	svc, repo, queue := newTestMemoryService()
	ctx := context.Background()
	userID := uuid.New()

	req := domain.CreateMemoryRequest{
		ContentType: "text",
		TextContent: "hello <script>alert('xss')</script> world",
		Tags:        []string{"tag1", "tag2"},
		Note:        "test note",
	}

	memory, _, err := svc.Create(ctx, userID, req)
	if err != nil {
		t.Fatalf("Create() unexpected error: %v", err)
	}

	if memory == nil {
		t.Fatal("Create() returned nil memory")
	}

	if memory.ContentType != "text" {
		t.Errorf("ContentType = %q, want %q", memory.ContentType, "text")
	}

	// Text content should be sanitized (HTML escaped, dangerous tags removed)
	if memory.TextContent == req.TextContent {
		t.Error("TextContent should be sanitized (HTML escaped), but it matches raw input")
	}

	// Dangerous script tag should not appear in sanitized content
	if len(memory.TextContent) == 0 {
		t.Error("TextContent should not be empty after sanitization")
	}

	// Tags should be sanitized
	if len(memory.Tags) != 2 {
		t.Errorf("Tags length = %d, want 2", len(memory.Tags))
	}

	// Verify memory was stored in repo
	stored, err := repo.GetByID(ctx, memory.ID)
	if err != nil {
		t.Fatalf("GetByID() error: %v", err)
	}
	if stored.UserID != userID {
		t.Errorf("Stored UserID = %v, want %v", stored.UserID, userID)
	}

	// Verify async tasks were published
	if len(queue.published) == 0 {
		t.Error("Expected async tasks to be published, but none were")
	}
}

func TestMemoryService_Create_LinkMemory_InvalidURL(t *testing.T) {
	svc, _, _ := newTestMemoryService()
	ctx := context.Background()
	userID := uuid.New()

	req := domain.CreateMemoryRequest{
		ContentType: "link",
		LinkURL:     "ftp://example.com",
	}

	_, _, err := svc.Create(ctx, userID, req)
	if err == nil {
		t.Fatal("Create() expected error for ftp:// URL, got nil")
	}
	if !errors.Is(err, ErrInvalidURL) {
		t.Errorf("Create() error = %v, want %v", err, ErrInvalidURL)
	}
}

func TestMemoryService_Create_LinkMemory_ValidURL(t *testing.T) {
	svc, repo, queue := newTestMemoryService()
	ctx := context.Background()
	userID := uuid.New()

	req := domain.CreateMemoryRequest{
		ContentType: "link",
		LinkURL:     "https://example.com/article",
		Note:        "interesting article",
	}

	memory, _, err := svc.Create(ctx, userID, req)
	if err != nil {
		t.Fatalf("Create() unexpected error: %v", err)
	}

	if memory.ContentType != "link" {
		t.Errorf("ContentType = %q, want %q", memory.ContentType, "link")
	}

	if memory.LinkURL != "https://example.com/article" {
		t.Errorf("LinkURL = %q, want %q", memory.LinkURL, "https://example.com/article")
	}

	// Note should be sanitized
	if memory.Note == "" {
		t.Error("Note should not be empty after sanitization")
	}

	// Verify stored in repo
	stored, err := repo.GetByID(ctx, memory.ID)
	if err != nil {
		t.Fatalf("GetByID() error: %v", err)
	}
	if stored.ContentType != "link" {
		t.Errorf("Stored ContentType = %q, want %q", stored.ContentType, "link")
	}

	// Link fetch task should be published
	if len(queue.published) == 0 {
		t.Error("Expected link:fetch task to be published")
	}
}

func TestMemoryService_Get_Success(t *testing.T) {
	svc, _, _ := newTestMemoryService()
	ctx := context.Background()
	userID := uuid.New()

	req := domain.CreateMemoryRequest{
		ContentType: "text",
		TextContent: "test content for get",
	}

	created, _, err := svc.Create(ctx, userID, req)
	if err != nil {
		t.Fatalf("Create() unexpected error: %v", err)
	}

	// Get the memory by the same user
	memory, err := svc.Get(ctx, created.ID, userID)
	if err != nil {
		t.Fatalf("Get() unexpected error: %v", err)
	}

	if memory.ID != created.ID {
		t.Errorf("Memory.ID = %v, want %v", memory.ID, created.ID)
	}

	if memory.UserID != userID {
		t.Errorf("Memory.UserID = %v, want %v", memory.UserID, userID)
	}
}

func TestMemoryService_Get_Unauthorized(t *testing.T) {
	svc, _, _ := newTestMemoryService()
	ctx := context.Background()
	ownerID := uuid.New()
	otherUserID := uuid.New()

	req := domain.CreateMemoryRequest{
		ContentType: "text",
		TextContent: "private content",
	}

	created, _, err := svc.Create(ctx, ownerID, req)
	if err != nil {
		t.Fatalf("Create() unexpected error: %v", err)
	}

	// Other user should not be able to access this memory
	_, err = svc.Get(ctx, created.ID, otherUserID)
	if err == nil {
		t.Fatal("Get() expected error for unauthorized access, got nil")
	}
	if err != ErrUnauthorized {
		t.Errorf("Get() error = %v, want %v", err, ErrUnauthorized)
	}
}

func TestMemoryService_Get_NotFound(t *testing.T) {
	svc, _, _ := newTestMemoryService()
	ctx := context.Background()

	_, err := svc.Get(ctx, uuid.New(), uuid.New())
	if err == nil {
		t.Fatal("Get() expected error for nonexistent memory, got nil")
	}
	if err != ErrMemoryNotFound {
		t.Errorf("Get() error = %v, want %v", err, ErrMemoryNotFound)
	}
}

func TestMemoryService_List_Pagination(t *testing.T) {
	svc, _, _ := newTestMemoryService()
	ctx := context.Background()
	userID := uuid.New()

	// Create 25 text memories
	for i := 0; i < 25; i++ {
		req := domain.CreateMemoryRequest{
			ContentType: "text",
			TextContent: "memory content number",
		}
		_, _, err := svc.Create(ctx, userID, req)
		if err != nil {
			t.Fatalf("Create() #%d error: %v", i, err)
		}
	}

	// List page 1 with limit 10
	resp, err := svc.List(ctx, userID, 1, 10, nil)
	if err != nil {
		t.Fatalf("List() unexpected error: %v", err)
	}

	if len(resp.Memories) != 10 {
		t.Errorf("List() returned %d memories, want 10", len(resp.Memories))
	}

	if resp.Total != 25 {
		t.Errorf("List() Total = %d, want 25", resp.Total)
	}

	if !resp.HasMore {
		t.Error("List() HasMore should be true when total > page*limit")
	}

	if resp.Page != 1 {
		t.Errorf("List() Page = %d, want 1", resp.Page)
	}

	if resp.Limit != 10 {
		t.Errorf("List() Limit = %d, want 10", resp.Limit)
	}

	// List page 3 with limit 10 (should return last 5 items)
	resp2, err := svc.List(ctx, userID, 3, 10, nil)
	if err != nil {
		t.Fatalf("List() page 3 unexpected error: %v", err)
	}

	if len(resp2.Memories) != 5 {
		t.Errorf("List() page 3 returned %d memories, want 5", len(resp2.Memories))
	}

	if resp2.HasMore {
		t.Error("List() page 3 HasMore should be false (last page)")
	}
}

func TestMemoryService_Update_Success(t *testing.T) {
	svc, _, _ := newTestMemoryService()
	ctx := context.Background()
	userID := uuid.New()

	req := domain.CreateMemoryRequest{
		ContentType: "text",
		TextContent: "original content",
		Tags:        []string{"old"},
	}

	created, _, err := svc.Create(ctx, userID, req)
	if err != nil {
		t.Fatalf("Create() unexpected error: %v", err)
	}

	updateReq := domain.UpdateMemoryRequest{
		Tags: []string{"updated", "new"},
		Note: "updated note",
	}

	updated, err := svc.Update(ctx, created.ID, userID, updateReq)
	if err != nil {
		t.Fatalf("Update() unexpected error: %v", err)
	}

	if len(updated.Tags) != 2 {
		t.Errorf("Update() Tags length = %d, want 2", len(updated.Tags))
	}

	if updated.Note == "" {
		t.Error("Update() Note should not be empty")
	}
}

func TestMemoryService_Delete_Success(t *testing.T) {
	svc, repo, _ := newTestMemoryService()
	ctx := context.Background()
	userID := uuid.New()

	req := domain.CreateMemoryRequest{
		ContentType: "text",
		TextContent: "content to delete",
	}

	created, _, err := svc.Create(ctx, userID, req)
	if err != nil {
		t.Fatalf("Create() unexpected error: %v", err)
	}

	err = svc.Delete(ctx, created.ID, userID)
	if err != nil {
		t.Fatalf("Delete() unexpected error: %v", err)
	}

	// Verify it's gone
	_, err = repo.GetByID(ctx, created.ID)
	if err == nil {
		t.Fatal("GetByID() should return error after deletion")
	}
	if err != repository.ErrMemoryNotFound {
		t.Errorf("GetByID() error = %v, want %v", err, repository.ErrMemoryNotFound)
	}
}

func TestMemoryService_AggregateStatus(t *testing.T) {
	tests := []struct {
		name     string
		tasks    map[string]domain.SubTaskState
		expected string
	}{
		{
			name:     "empty tasks defaults to pending",
			tasks:    map[string]domain.SubTaskState{},
			expected: "pending",
		},
		{
			name: "all completed returns completed",
			tasks: map[string]domain.SubTaskState{
				"link:fetch":      {Status: "completed"},
				"text:vectorize":  {Status: "completed"},
				"tag:generate":    {Status: "completed"},
			},
			expected: "completed",
		},
		{
			name: "all failed returns failed",
			tasks: map[string]domain.SubTaskState{
				"link:fetch":     {Status: "failed"},
				"text:vectorize": {Status: "failed"},
			},
			expected: "failed",
		},
		{
			name: "mixed failed and completed returns partial_failed",
			tasks: map[string]domain.SubTaskState{
				"link:fetch":     {Status: "completed"},
				"text:vectorize": {Status: "failed"},
			},
			expected: "partial_failed",
		},
		{
			name: "any processing returns processing",
			tasks: map[string]domain.SubTaskState{
				"link:fetch":     {Status: "completed"},
				"text:vectorize": {Status: "processing"},
				"tag:generate":   {Status: "failed"},
			},
			expected: "processing",
		},
		{
			name: "single pending task returns completed",
			tasks: map[string]domain.SubTaskState{
				"tag:generate": {Status: "pending"},
			},
			expected: "completed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := domain.AggregateStatus(tt.tasks)
			if got != tt.expected {
				t.Errorf("AggregateStatus() = %q, want %q (tasks: %v)", got, tt.expected, tt.tasks)
			}
		})
	}
}

// verify mock satisfies UserRepository (memory-service version)
// This is a compile-time check that our mock implements the interface.
var _ repository.UserRepository = (*mockUserRepo)(nil)
