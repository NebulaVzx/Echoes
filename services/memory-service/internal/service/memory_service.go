// Package service implements the memory business logic.
package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/NebulaVzx/Echoes/services/memory-service/internal/domain"
	"github.com/NebulaVzx/Echoes/services/memory-service/internal/middleware"
	"github.com/NebulaVzx/Echoes/services/memory-service/internal/repository"
	"github.com/google/uuid"
	"github.com/lib/pq"
	"go.uber.org/zap"
)

var (
	ErrMemoryNotFound     = errors.New("memory not found")
	ErrUnauthorized       = errors.New("unauthorized access to memory")
	ErrInvalidURL         = errors.New("invalid URL: must be http or https")
	ErrSuggestionNotFound = errors.New("suggestion not found")
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
	repo           repository.MemoryRepository
	userRepo       repository.UserRepository
	queue          TaskQueue
	vectorizer     *VectorizerClient
	suggestionRepo repository.SuggestionRepository
}

// TaskQueue defines the interface for publishing async tasks.
type TaskQueue interface {
	PublishLinkFetch(ctx context.Context, memoryID uuid.UUID, linkURL string, note string, llmConfig map[string]interface{}) error
	PublishTextVectorize(ctx context.Context, memoryID uuid.UUID, content string, llmConfig map[string]interface{}) error
	PublishTagGenerate(ctx context.Context, memoryID uuid.UUID, content string, note string, llmConfig map[string]interface{}) error
	PublishSuggestionGenerate(ctx context.Context, memoryID uuid.UUID, contentType string, content string, note string, style string, timeout int, maxRetries int, llmConfig map[string]interface{}) error
	PublishTask(ctx context.Context, stream string, data map[string]interface{}) error
}

// NewMemoryService creates a new memory service.
func NewMemoryService(repo repository.MemoryRepository, userRepo repository.UserRepository, queue TaskQueue, vectorizer *VectorizerClient, suggestionRepo repository.SuggestionRepository) *MemoryService {
	return &MemoryService{
		repo:           repo,
		userRepo:       userRepo,
		queue:          queue,
		vectorizer:     vectorizer,
		suggestionRepo: suggestionRepo,
	}
}

// Create creates a new memory and publishes async tasks.
// Returns the created memory, suggestion status ("pending", "skipped", "failed"), and any error.
func (s *MemoryService) Create(ctx context.Context, userID uuid.UUID, req domain.CreateMemoryRequest) (*domain.Memory, string, error) {
	// Validate request based on content type
	if req.ContentType == "text" && strings.TrimSpace(req.TextContent) == "" {
		return nil, "", errors.New("text content is required for text memories")
	}
	if req.ContentType == "link" && strings.TrimSpace(req.LinkURL) == "" {
		return nil, "", errors.New("link URL is required for link memories")
	}
	// Validate and sanitize link URL
	if req.ContentType == "link" {
		if err := validateLinkURL(req.LinkURL); err != nil {
			return nil, "", err
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
		Metadata:         "{}",
		ProcessingStatus: "pending",
		Visibility:       "private",
	}

	if err := s.repo.Create(ctx, memory); err != nil {
		return nil, "", fmt.Errorf("failed to create memory: %w", err)
	}

	// Fetch user LLM settings and publish async tasks
	llmConfig, _ := s.getUserLLMConfig(ctx, userID)
	s.publishTasks(ctx, memory, llmConfig)

	// Publish suggestion generation task if user enabled it
	suggestionStatus := "skipped"
	if req.EnableAISuggestion {
		style, timeout, maxRetries := s.getUserSuggestionConfig(ctx, userID)
		content := s.extractContent(memory)
		if content != "" {
			err := s.queue.PublishSuggestionGenerate(ctx, memory.ID, memory.ContentType, content, memory.Note, style, timeout, maxRetries, llmConfig)
			if err != nil {
				zap.L().Error("failed to publish suggestion task", zap.Error(err), zap.String("memory_id", memory.ID.String()))
				suggestionStatus = "failed"
			} else {
				suggestionStatus = "pending"
			}
		}
	}

	return memory, suggestionStatus, nil
}

// getUserLLMConfig fetches user settings and extracts LLM config as a flat map.
func (s *MemoryService) getUserLLMConfig(ctx context.Context, userID uuid.UUID) (map[string]interface{}, error) {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	settingsStr := user.Settings.String()
	if len(user.Settings) == 0 || settingsStr == "{}" || settingsStr == "null" {
		return nil, nil
	}

	var settings struct {
		LLMProvider           string  `json:"llm_provider"`
		LLMProtocol           string  `json:"llm_protocol"`
		LLMModel              string  `json:"llm_model"`
		LLMTemperature        float64 `json:"llm_temperature"`
		APIKey                string  `json:"api_key"`
		BaseURL               string  `json:"base_url"`
		IncludeNoteInAnalysis bool    `json:"include_note_in_analysis"`
	}
	if err := json.Unmarshal([]byte(settingsStr), &settings); err != nil {
		return nil, err
	}

	config := make(map[string]interface{})
	if settings.LLMProvider != "" {
		config["llm_provider"] = settings.LLMProvider
	}
	if settings.LLMProtocol != "" {
		config["llm_protocol"] = settings.LLMProtocol
	}
	if settings.LLMModel != "" {
		config["llm_model"] = settings.LLMModel
	}
	if settings.LLMTemperature != 0 {
		config["llm_temperature"] = settings.LLMTemperature
	}
	if settings.APIKey != "" {
		config["api_key"] = settings.APIKey
	}
	if settings.BaseURL != "" {
		config["base_url"] = settings.BaseURL
	}
	if settings.IncludeNoteInAnalysis {
		config["include_note_in_analysis"] = true
	}
	return config, nil
}

// publishTasks publishes async processing tasks based on memory type.
// Accepts context for trace propagation to Redis Stream messages per D-02.
func (s *MemoryService) publishTasks(ctx context.Context, memory *domain.Memory, llmConfig map[string]interface{}) {
	// For link memories, publish link fetch task
	if memory.ContentType == "link" && memory.LinkURL != "" {
		_ = s.queue.PublishLinkFetch(ctx, memory.ID, memory.LinkURL, memory.Note, llmConfig)
	}

	// For all memories, publish text vectorization
	content := s.extractContent(memory)
	if content != "" {
		_ = s.queue.PublishTextVectorize(ctx, memory.ID, content, llmConfig)
		_ = s.queue.PublishTagGenerate(ctx, memory.ID, content, memory.Note, llmConfig)
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

	hasMore := int64(page*limit) < total

	return &domain.ListMemoriesResponse{
		Memories: items,
		Total:    total,
		Page:     page,
		Limit:    limit,
		HasMore:  hasMore,
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

// UpdateTaskStatus updates a sub-task status and recomputes aggregated status.
func (s *MemoryService) UpdateTaskStatus(ctx context.Context, memoryID uuid.UUID, update domain.TaskStatusUpdate) error {
	memory, err := s.repo.GetByID(ctx, memoryID)
	if err != nil {
		if errors.Is(err, repository.ErrMemoryNotFound) {
			return ErrMemoryNotFound
		}
		return err
	}

	// Parse existing metadata
	var metadata map[string]interface{}
	if memory.Metadata != "" {
		if err := json.Unmarshal([]byte(memory.Metadata), &metadata); err != nil {
			metadata = make(map[string]interface{})
		}
	} else {
		metadata = make(map[string]interface{})
	}

	tasksRaw, _ := metadata["tasks"].(map[string]interface{})
	if tasksRaw == nil {
		tasksRaw = make(map[string]interface{})
	}

	// Build new sub-task state
	taskState := map[string]interface{}{
		"status":     update.Status,
		"updated_at": time.Now().UTC().Format(time.RFC3339),
	}
	if update.Error != "" {
		taskState["error"] = update.Error
	}
	if update.Result != nil {
		taskState["result"] = update.Result
	}

	tasksRaw[update.TaskType] = taskState
	metadata["tasks"] = tasksRaw

	// Convert to SubTaskState map for aggregation
	tasks := make(map[string]domain.SubTaskState)
	for k, v := range tasksRaw {
		if vm, ok := v.(map[string]interface{}); ok {
			state := domain.SubTaskState{Status: "pending"}
			if s, ok := vm["status"].(string); ok {
				state.Status = s
			}
			if e, ok := vm["error"].(string); ok {
				state.Error = e
			}
			tasks[k] = state
		}
	}

	aggregated := domain.AggregateStatus(tasks)

	// Update memory fields
	metaJSON, err := json.Marshal(metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}
	memory.Metadata = string(metaJSON)
	memory.ProcessingStatus = aggregated

	// Record processing status metric
	middleware.RecordMemoryProcessing(aggregated)

	// Apply result fields if present
	if update.Result != nil {
		if update.TaskType == "link:fetch" {
			if title, ok := update.Result["title"].(string); ok {
				memory.LinkTitle = title
			}
			if summary, ok := update.Result["summary"].(string); ok {
				memory.LinkSummary = summary
			}
		}
		if update.TaskType == "tag:generate" {
			if tagsRaw, ok := update.Result["tags"].([]interface{}); ok {
				tags := make([]string, 0, len(tagsRaw))
				for _, t := range tagsRaw {
					if ts, ok := t.(string); ok && ts != "" {
						tags = append(tags, ts)
					}
				}
				if len(tags) > 0 {
					memory.Tags = pq.StringArray(tags)
				}
			}
		}
		if update.TaskType == "text:vectorize" {
			if vecRaw, ok := update.Result["vector"].([]interface{}); ok {
				vecStrs := make([]string, len(vecRaw))
				for i, v := range vecRaw {
					vecStrs[i] = fmt.Sprintf("%v", v)
				}
				vectorLiteral := "[" + strings.Join(vecStrs, ",") + "]"
				if err := s.repo.UpdateVector(ctx, memoryID, vectorLiteral); err != nil {
					return fmt.Errorf("failed to update vector: %w", err)
				}
			} else {
				return fmt.Errorf("vector result has unexpected type: %T", update.Result["vector"])
			}
		}
	}

	return s.repo.Update(ctx, memory)
}

// UpdateMemoryVector updates the vector field directly (used by vectorizer).
func (s *MemoryService) UpdateMemoryVector(ctx context.Context, memoryID uuid.UUID, vector string) error {
	return s.repo.UpdateVector(ctx, memoryID, vector)
}

// getUserSearchThreshold fetches the user's similarity threshold, defaulting to 0.40.
func (s *MemoryService) getUserSearchThreshold(ctx context.Context, userID uuid.UUID) float64 {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return 0.40
	}
	settingsStr := user.Settings.String()
	if len(user.Settings) == 0 || settingsStr == "{}" || settingsStr == "null" {
		return 0.40
	}
	var settings struct {
		SearchSimilarityThreshold float64 `json:"search_similarity_threshold"`
	}
	if err := json.Unmarshal([]byte(settingsStr), &settings); err != nil {
		return 0.40
	}
	if settings.SearchSimilarityThreshold <= 0 || settings.SearchSimilarityThreshold > 1.0 {
		return 0.40
	}
	return settings.SearchSimilarityThreshold
}

// Search performs semantic search using vector similarity.
func (s *MemoryService) Search(ctx context.Context, userID uuid.UUID, query string, limit int) (*domain.SearchResponse, error) {
	if limit < 1 || limit > 100 {
		limit = 10
	}
	vectorStr, err := s.vectorizer.EncodeQuery(ctx, query)
	if err != nil {
		return nil, err
	}
	threshold := s.getUserSearchThreshold(ctx, userID)
	results, err := s.repo.SearchByVector(ctx, userID, vectorStr, limit, threshold)
	if err != nil {
		return nil, fmt.Errorf("search failed: %w", err)
	}
	return &domain.SearchResponse{
		Results: results,
		Query:   query,
	}, nil
}

// Related finds memories similar to the given memory ID.
func (s *MemoryService) Related(ctx context.Context, memoryID, userID uuid.UUID, limit int) (*domain.RelatedResponse, error) {
	if limit < 1 || limit > 20 {
		limit = 3
	}
	// Fetch the source memory to get its vector
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
	// Fetch vector separately since GORM skips the vector field on read
	vector, err := s.repo.GetVectorByID(ctx, memoryID)
	if err != nil {
		return nil, fmt.Errorf("memory has no vector")
	}
	if vector == "" {
		return nil, fmt.Errorf("memory has no vector")
	}
	threshold := s.getUserSearchThreshold(ctx, userID)
	results, err := s.repo.FindRelated(ctx, userID, memoryID, vector, limit, threshold)
	if err != nil {
		return nil, fmt.Errorf("related search failed: %w", err)
	}
	return &domain.RelatedResponse{
		Results:  results,
		MemoryID: memoryID,
	}, nil
}

// RetryTask re-publishes a failed sub-task to the appropriate Redis Stream.
// Per D-15: user can retry individual failed sub-tasks.
func (s *MemoryService) RetryTask(ctx context.Context, memoryID uuid.UUID, taskType string) error {
	memory, err := s.repo.GetByID(ctx, memoryID)
	if err != nil {
		if errors.Is(err, repository.ErrMemoryNotFound) {
			return ErrMemoryNotFound
		}
		return err
	}

	// Validate task type
	validTypes := map[string]bool{"link:fetch": true, "text:vectorize": true, "tag:generate": true, "suggestion:generate": true}
	if !validTypes[taskType] {
		return fmt.Errorf("invalid task_type: %s", taskType)
	}

	// Fetch user LLM settings for retry
	llmConfig, _ := s.getUserLLMConfig(ctx, memory.UserID)

	// Build publish data based on task type and memory content
	data := map[string]interface{}{
		"memory_id": memory.ID.String(),
	}
	// Merge LLM config into publish data
	for k, v := range llmConfig {
		data[k] = v
	}
	switch taskType {
	case "link:fetch":
		if memory.LinkURL == "" {
			return fmt.Errorf("memory has no link_url for link:fetch task")
		}
		data["link_url"] = memory.LinkURL
		if memory.Note != "" {
			data["note"] = memory.Note
		}
	case "text:vectorize":
		content := memory.TextContent
		if memory.LinkTitle != "" && memory.LinkSummary != "" {
			content = memory.LinkTitle + "\n" + memory.LinkSummary
		}
		if content == "" {
			return fmt.Errorf("memory has no content for text:vectorize task")
		}
		data["content"] = content
	case "tag:generate":
		content := memory.TextContent
		if memory.LinkTitle != "" && memory.LinkSummary != "" {
			content = memory.LinkTitle + "\n" + memory.LinkSummary
		}
		if content == "" {
			return fmt.Errorf("memory has no content for tag:generate task")
		}
		data["content"] = content
		if memory.Note != "" {
			data["note"] = memory.Note
		}
	case "suggestion:generate":
		style, timeout, maxRetries := s.getUserSuggestionConfig(ctx, memory.UserID)
		content := s.extractContent(memory)
		if content == "" {
			return fmt.Errorf("memory has no content for suggestion:generate task")
		}
		data["content_type"] = memory.ContentType
		data["content"] = content
		data["style"] = style
		data["timeout"] = timeout
		data["max_retries"] = maxRetries
		if memory.Note != "" {
			data["note"] = memory.Note
		}
		if memory.ContentType == "link" {
			if memory.LinkTitle != "" {
				data["link_title"] = memory.LinkTitle
			}
			if memory.LinkSummary != "" {
				data["link_summary"] = memory.LinkSummary
			}
		}
	}

	// Publish to Redis Stream
	if err := s.queue.PublishTask(ctx, taskType, data); err != nil {
		return fmt.Errorf("failed to publish retry task: %w", err)
	}

	// Update sub-task state back to pending
	var metadata map[string]interface{}
	if memory.Metadata != "" {
		if err := json.Unmarshal([]byte(memory.Metadata), &metadata); err != nil {
			metadata = make(map[string]interface{})
		}
	} else {
		metadata = make(map[string]interface{})
	}

	tasksRaw, _ := metadata["tasks"].(map[string]interface{})
	if tasksRaw == nil {
		tasksRaw = make(map[string]interface{})
	}

	// Get existing state to preserve retry count
	existingState := map[string]interface{}{
		"status":     "pending",
		"updated_at": time.Now().UTC().Format(time.RFC3339),
	}
	if oldState, ok := tasksRaw[taskType].(map[string]interface{}); ok {
		if rc, ok := oldState["retry_count"].(float64); ok {
			existingState["retry_count"] = int(rc) + 1
		} else {
			existingState["retry_count"] = 1
		}
	} else {
		existingState["retry_count"] = 1
	}
	tasksRaw[taskType] = existingState
	metadata["tasks"] = tasksRaw

	metaJSON, err := json.Marshal(metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}
	memory.Metadata = string(metaJSON)

	// Recompute aggregated status
	tasks := make(map[string]domain.SubTaskState)
	for k, v := range tasksRaw {
		if vm, ok := v.(map[string]interface{}); ok {
			state := domain.SubTaskState{Status: "pending"}
			if s, ok := vm["status"].(string); ok {
				state.Status = s
			}
			tasks[k] = state
		}
	}
	memory.ProcessingStatus = domain.AggregateStatus(tasks)

	return s.repo.Update(ctx, memory)
}

// getUserSuggestionConfig fetches the user's AI suggestion configuration.
// Returns style (default "inspiring"), timeout seconds (default 30), maxRetries (default 3).
func (s *MemoryService) getUserSuggestionConfig(ctx context.Context, userID uuid.UUID) (string, int, int) {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return "inspiring", 30, 3
	}
	settingsStr := user.Settings.String()
	if len(user.Settings) == 0 || settingsStr == "{}" || settingsStr == "null" {
		return "inspiring", 30, 3
	}
	var settings struct {
		AISuggestionStyle      string `json:"ai_suggestion_style"`
		AISuggestionTimeout    int    `json:"ai_suggestion_timeout"`
		AISuggestionMaxRetries int    `json:"ai_suggestion_max_retries"`
	}
	if err := json.Unmarshal([]byte(settingsStr), &settings); err != nil {
		return "inspiring", 30, 3
	}
	style := settings.AISuggestionStyle
	if style == "" {
		style = "inspiring"
	}
	timeout := settings.AISuggestionTimeout
	if timeout <= 0 {
		timeout = 30
	}
	maxRetries := settings.AISuggestionMaxRetries
	if maxRetries <= 0 {
		maxRetries = 3
	}
	return style, timeout, maxRetries
}

// GetSuggestion retrieves the AI suggestion for a memory, verifying ownership.
func (s *MemoryService) GetSuggestion(ctx context.Context, memoryID, userID uuid.UUID) (*domain.AISuggestion, error) {
	// Verify memory ownership first
	memory, err := s.Get(ctx, memoryID, userID)
	if err != nil {
		return nil, err
	}
	suggestion, err := s.suggestionRepo.GetByMemoryID(ctx, memory.ID)
	if err != nil {
		if errors.Is(err, repository.ErrSuggestionNotFound) {
			return nil, ErrSuggestionNotFound
		}
		return nil, err
	}
	return suggestion, nil
}

// CreateSuggestion creates an AI suggestion for a memory (called by internal API from Processor).
func (s *MemoryService) CreateSuggestion(ctx context.Context, memoryID uuid.UUID, req domain.CreateSuggestionRequest) (*domain.AISuggestion, error) {
	suggestion := &domain.AISuggestion{
		ID:             uuid.New(),
		MemoryID:       memoryID,
		Content:        req.Content,
		SuggestionType: req.SuggestionType,
		Metadata:       "{}",
	}
	if req.Metadata != nil {
		metaJSON, err := json.Marshal(req.Metadata)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal metadata: %w", err)
		}
		suggestion.Metadata = string(metaJSON)
	}
	if err := s.suggestionRepo.Create(ctx, suggestion); err != nil {
		return nil, fmt.Errorf("failed to create suggestion: %w", err)
	}
	return suggestion, nil
}

// UpdateSuggestionFeedback updates user feedback for a suggestion.
func (s *MemoryService) UpdateSuggestionFeedback(ctx context.Context, memoryID, userID uuid.UUID, feedback string) error {
	// Verify memory ownership
	_, err := s.Get(ctx, memoryID, userID)
	if err != nil {
		return err
	}
	if err := s.suggestionRepo.UpdateFeedback(ctx, memoryID, feedback); err != nil {
		if errors.Is(err, repository.ErrSuggestionNotFound) {
			return ErrSuggestionNotFound
		}
		return err
	}
	return nil
}
