// Package service implements the memory business logic.
package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"net/http"
	"net/url"
	"os"
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
	ErrInvalidRequest     = errors.New("invalid request")
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
	relationRepo   repository.RelationRepository
	queue          TaskQueue
	vectorizer     *VectorizerClient
	suggestionRepo repository.SuggestionRepository
	minioClient    *MinIOClient
}

// TaskQueue defines the interface for publishing async tasks.
type TaskQueue interface {
	PublishLinkFetch(ctx context.Context, memoryID uuid.UUID, linkURL string, note string, llmConfig map[string]interface{}) error
	PublishTextVectorize(ctx context.Context, memoryID uuid.UUID, content string, llmConfig map[string]interface{}) error
	PublishTagGenerate(ctx context.Context, memoryID uuid.UUID, content string, note string, llmConfig map[string]interface{}) error
	PublishSuggestionGenerate(ctx context.Context, memoryID uuid.UUID, contentType string, content string, note string, style string, timeout int, maxRetries int, llmConfig map[string]interface{}) error
	PublishFileExtract(ctx context.Context, memoryID uuid.UUID, fileName string, mediaURL string, llmConfig map[string]interface{}) error
	PublishCoverGenerate(ctx context.Context, memoryID uuid.UUID, contentType string, content string, linkURL string, linkTitle string, tags []string, userID uuid.UUID, llmConfig map[string]interface{}) error
	PublishTask(ctx context.Context, stream string, data map[string]interface{}) error
}

// NewMemoryService creates a new memory service.
func NewMemoryService(repo repository.MemoryRepository, userRepo repository.UserRepository, relationRepo repository.RelationRepository, queue TaskQueue, vectorizer *VectorizerClient, suggestionRepo repository.SuggestionRepository, minioClient *MinIOClient) *MemoryService {
	return &MemoryService{
		repo:           repo,
		userRepo:       userRepo,
		relationRepo:   relationRepo,
		queue:          queue,
		vectorizer:     vectorizer,
		suggestionRepo: suggestionRepo,
		minioClient:    minioClient,
	}
}

// UpdateFileInfo updates the file-related fields of a memory after upload.
func (s *MemoryService) UpdateFileInfo(ctx context.Context, memoryID uuid.UUID, mediaURL string, fileName string, fileSize int64) error {
	memory, err := s.repo.GetByID(ctx, memoryID)
	if err != nil {
		return err
	}
	memory.MediaURL = mediaURL
	memory.FileName = fileName
	memory.FileSize = fileSize
	return s.repo.Update(ctx, memory)
}

// UpdateTextContent updates the text_content field of a memory (used by file extraction).
func (s *MemoryService) UpdateTextContent(ctx context.Context, memoryID uuid.UUID, textContent string) error {
	memory, err := s.repo.GetByID(ctx, memoryID)
	if err != nil {
		return err
	}
	memory.TextContent = sanitizeText(textContent)
	return s.repo.Update(ctx, memory)
}

// MinIOClient exposes the MinIO client for handler use.
func (s *MemoryService) MinIOClient() *MinIOClient {
	return s.minioClient
}

// GetUserLLMConfig fetches user LLM settings as a flat map.
func (s *MemoryService) GetUserLLMConfig(ctx context.Context, userID uuid.UUID) (map[string]interface{}, error) {
	return s.getUserLLMConfig(ctx, userID)
}

// PublishFileTasks publishes file extraction task after upload is complete.
// Uses presigned URL so the consumer can download without MinIO credentials.
func (s *MemoryService) PublishFileTasks(ctx context.Context, memory *domain.Memory, llmConfig map[string]interface{}) {
	if memory.ContentType == "file" && memory.MediaURL != "" && s.minioClient != nil {
		objectPath := BuildObjectPath(memory.UserID.String(), memory.ID.String(), memory.FileName)
		presignedURL, err := s.minioClient.GetPresignedGetURL(ctx, objectPath)
		if err != nil {
			zap.L().Error("failed to generate presigned URL", zap.Error(err), zap.String("memory_id", memory.ID.String()))
			return
		}
		if err := s.queue.PublishFileExtract(ctx, memory.ID, memory.FileName, presignedURL, llmConfig); err != nil {
			zap.L().Error("failed to publish file:extract task", zap.Error(err), zap.String("memory_id", memory.ID.String()))
		}
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
	if req.ContentType == "file" && strings.TrimSpace(req.TextContent) == "" {
		// File memories have empty text_content initially — extraction is async
		// The caller must provide file metadata separately
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
		Source:           sanitizeText(req.Source),
		IsStarred:        req.IsStarred,
		Metadata:         "{}",
		ProcessingStatus: "pending",
		Visibility:       "private",
	}

	// Set sealed_until if provided and is in the future
	if req.SealedUntil != nil && req.SealedUntil.After(time.Now()) {
		memory.SealedUntil = req.SealedUntil
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
	} else if settings.LLMProvider != "" {
		// Fallback: infer protocol from provider (defense against legacy data)
		if settings.LLMProvider == "anthropic" {
			config["llm_protocol"] = "anthropic"
		} else {
			config["llm_protocol"] = "openai"
		}
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

	// For file memories, publish file extraction task
	if memory.ContentType == "file" && memory.MediaURL != "" {
		_ = s.queue.PublishFileExtract(ctx, memory.ID, memory.FileName, memory.MediaURL, llmConfig)
		return // File extraction will trigger vectorize + tag after text is extracted
	}

	// For text/link memories, publish text vectorization directly
	content := s.extractContent(memory)
	if content != "" {
		_ = s.queue.PublishTextVectorize(ctx, memory.ID, content, llmConfig)
		_ = s.queue.PublishTagGenerate(ctx, memory.ID, content, memory.Note, llmConfig)
	}

	// Publish cover generation task for all content types
	// Cover generation is non-blocking; failure is handled gracefully by frontend fallback
	coverContent := content
	if memory.ContentType == "file" {
		coverContent = memory.TextContent // file text may be empty initially (extracted async)
	}
	_ = s.queue.PublishCoverGenerate(ctx, memory.ID, memory.ContentType, coverContent, memory.LinkURL, memory.LinkTitle, []string(memory.Tags), memory.UserID, llmConfig)
}

// extractContent extracts the primary content for vectorization/tagging.
func (s *MemoryService) extractContent(memory *domain.Memory) string {
	if memory.ContentType == "text" {
		return memory.TextContent
	}
	if memory.ContentType == "link" {
		return memory.LinkURL
	}
	if memory.ContentType == "file" {
		return memory.TextContent // Extracted text from file
	}
	return ""
}

// List returns paginated memories for a user.
func (s *MemoryService) List(ctx context.Context, userID uuid.UUID, page, limit int, tags []string, starredOnly bool) (*domain.ListMemoriesResponse, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	memories, total, err := s.repo.ListByUser(ctx, userID, page, limit, tags, true, starredOnly)
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

// GetConstellation returns graph nodes and edges for the constellation view.
// Per D-01: returns recent 100 memories + all starred memories.
// Supports pagination via offset parameter for "探索更远" load-more.
func (s *MemoryService) GetConstellation(ctx context.Context, userID uuid.UUID, offset int) (*domain.ConstellationResponse, error) {
	// Fetch recent 100 memories (with offset for pagination)
	recentNodes, total, err := s.repo.GetConstellationNodes(ctx, userID, 100, offset, false)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch constellation nodes: %w", err)
	}

	// Fetch all starred memories
	starredNodes, err := s.repo.GetStarredMemories(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch starred memories: %w", err)
	}

	// Merge: recent first, then add starred that aren't already included
	nodeMap := make(map[uuid.UUID]domain.ConstellationNode)
	for _, n := range recentNodes {
		nodeMap[n.ID] = n
	}
	for _, n := range starredNodes {
		if _, exists := nodeMap[n.ID]; !exists {
			nodeMap[n.ID] = n
		}
	}

	nodes := make([]domain.ConstellationNode, 0, len(nodeMap))
	for _, n := range nodeMap {
		nodes = append(nodes, n)
	}

	// Build edges: for each node, find top-3 related memories above threshold 0.75
	// Limit to avoid O(n^2) explosion — only connect within the returned node set
	threshold := 0.75
	nodeIDs := make(map[string]bool)
	for _, n := range nodes {
		nodeIDs[n.ID.String()] = true
	}

	var edges []domain.ConstellationEdge
	for _, node := range nodes {
		vector, err := s.repo.GetVectorByID(ctx, node.ID)
		if err != nil || vector == "" {
			continue
		}
		related, err := s.repo.FindRelated(ctx, userID, node.ID, vector, 3, threshold)
		if err != nil {
			continue
		}
		for _, r := range related {
			// Only create edge if target is also in our node set
			if nodeIDs[r.Memory.ID.String()] {
				// Avoid duplicate edges: only add when source < target (string compare)
				s1, s2 := node.ID.String(), r.Memory.ID.String()
				if s1 < s2 {
					edges = append(edges, domain.ConstellationEdge{
						Source:     s1,
						Target:     s2,
						Similarity: r.Similarity,
					})
				}
			}
		}
	}

	// hasMore: total eligible memories > current offset + fetched recent nodes
	hasMore := total > int64(offset+len(recentNodes))

	return &domain.ConstellationResponse{
		Nodes:   nodes,
		Edges:   edges,
		HasMore: hasMore,
		Total:   total,
	}, nil
}

// Explore returns related memories for a given memory with AI-generated connection reasons.
// Per D-02: checks cache first, calls LLM on miss, saves result to cache.
func (s *MemoryService) Explore(ctx context.Context, memoryID, userID uuid.UUID) (*domain.ExploreResponse, error) {
	// Verify ownership
	memory, err := s.Get(ctx, memoryID, userID)
	if err != nil {
		return nil, err
	}

	// Fetch related memories (limit 8, threshold 0.75 per RESEARCH.md)
	vector, err := s.repo.GetVectorByID(ctx, memoryID)
	if err != nil || vector == "" {
		return nil, fmt.Errorf("memory has no vector")
	}
	relatedResults, err := s.repo.FindRelated(ctx, userID, memoryID, vector, 8, 0.75)
	if err != nil {
		return nil, fmt.Errorf("failed to find related memories: %w", err)
	}

	// Build explore results with reasons
	results := make([]domain.ExploreResult, 0, len(relatedResults))
	for _, r := range relatedResults {
		reason, err := s.getRelationReason(ctx, memoryID, r.Memory.ID, memory, &r.Memory)
		if err != nil {
			// LLM failure is non-blocking — use default reason
			reason = "这两段记忆在语义上有关联"
		}
		results = append(results, domain.ExploreResult{
			Memory:     r.Memory,
			Similarity: r.Similarity,
			Reason:     reason,
		})
	}

	return &domain.ExploreResponse{
		MemoryID: memoryID,
		Results:  results,
		Breadcrumb: []domain.BreadcrumbItem{
			{ID: memoryID, Label: s.extractLabel(memory)},
		},
	}, nil
}

// getRelationReason retrieves a cached reason or generates one via LLM.
func (s *MemoryService) getRelationReason(ctx context.Context, sourceID, targetID uuid.UUID, sourceMemory, targetMemory *domain.Memory) (string, error) {
	// 1. Check cache
	reason, err := s.relationRepo.GetReason(ctx, sourceID, targetID)
	if err == nil && reason != "" {
		return reason, nil
	}

	// 2. Generate via LLM
	reason, err = s.generateAssociationReason(ctx, sourceMemory, targetMemory)
	if err != nil {
		return "", err
	}

	// 3. Save to cache (best effort)
	_ = s.relationRepo.Save(ctx, sourceID, targetID, 0.0, reason)

	return reason, nil
}

// generateAssociationReason calls LLM to explain why two memories are related.
func (s *MemoryService) generateAssociationReason(ctx context.Context, sourceMemory, targetMemory *domain.Memory) (string, error) {
	llmConfig, err := s.getUserLLMConfig(ctx, sourceMemory.UserID)
	if err != nil || len(llmConfig) == 0 {
		return "", fmt.Errorf("LLM not configured")
	}

	sourceContent := s.extractContentForReason(sourceMemory)
	targetContent := s.extractContentForReason(targetMemory)

	prompt := fmt.Sprintf(`分析以下两段记忆内容的语义关联，用 1-2 句话解释它们为什么相关。

记忆 A：
%s

记忆 B：
%s

请从主题、概念、情感或时间线等维度分析关联。只输出关联说明，不要额外解释。`,
		truncateForPrompt(sourceContent, 500),
		truncateForPrompt(targetContent, 500))

	protocol := ""
	if p, ok := llmConfig["llm_protocol"].(string); ok && p != "" {
		protocol = p
	} else if p, ok := llmConfig["llm_provider"].(string); ok && p != "" {
		protocol = p
	}
	if protocol == "" {
		protocol = "openai"
	}

	model := "gpt-4o-mini"
	if m, ok := llmConfig["llm_model"].(string); ok && m != "" {
		model = m
	}

	temperature := 0.5
	if t, ok := llmConfig["llm_temperature"].(float64); ok && t != 0 {
		temperature = t
	}

	apiKey := ""
	if k, ok := llmConfig["api_key"].(string); ok {
		apiKey = k
	}

	baseURL := ""
	if u, ok := llmConfig["base_url"].(string); ok {
		baseURL = u
	}

	switch protocol {
	case "openai", "deepseek", "moonshot", "qwen":
		return s.callOpenAIForReason(ctx, baseURL, apiKey, model, temperature, prompt)
	case "anthropic":
		return s.callAnthropicForReason(ctx, baseURL, apiKey, model, temperature, prompt)
	default:
		return s.callOpenAIForReason(ctx, baseURL, apiKey, model, temperature, prompt)
	}
}

// extractContentForReason extracts the best content for LLM analysis.
func (s *MemoryService) extractContentForReason(memory *domain.Memory) string {
	if memory.ContentType == "text" {
		return memory.TextContent
	}
	if memory.ContentType == "link" {
		if memory.LinkTitle != "" {
			return memory.LinkTitle + "\n" + memory.LinkSummary
		}
		return memory.LinkURL
	}
	if memory.ContentType == "file" {
		if memory.TextContent != "" {
			return memory.TextContent
		}
		return memory.FileName
	}
	return ""
}

// extractLabel creates a short label for breadcrumb display.
func (s *MemoryService) extractLabel(memory *domain.Memory) string {
	if memory.LinkTitle != "" {
		return memory.LinkTitle
	}
	if memory.TextContent != "" {
		if len(memory.TextContent) > 30 {
			return memory.TextContent[:30] + "..."
		}
		return memory.TextContent
	}
	if memory.FileName != "" {
		return memory.FileName
	}
	return "未命名记忆"
}

// truncateForPrompt truncates text to maxLen characters for LLM prompt.
func truncateForPrompt(text string, maxLen int) string {
	if len(text) <= maxLen {
		return text
	}
	return text[:maxLen] + "..."
}

// callOpenAIForReason calls OpenAI-compatible API for association reason.
func (s *MemoryService) callOpenAIForReason(ctx context.Context, baseURL, apiKey, model string, temperature float64, prompt string) (string, error) {
	if apiKey == "" {
		apiKey = os.Getenv("OPENAI_API_KEY")
	}
	if apiKey == "" {
		return "", fmt.Errorf("API Key not configured")
	}
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}

	body, _ := json.Marshal(map[string]interface{}{
		"model":       model,
		"temperature": temperature,
		"max_tokens":  256,
		"messages": []map[string]string{
			{"role": "system", "content": "你是一个语义分析助手，擅长发现内容之间的隐藏联系。只输出关联说明，不要额外解释。"},
			{"role": "user", "content": prompt},
		},
	})

	base := strings.TrimSuffix(baseURL, "/")
	if !strings.HasSuffix(base, "/v1") {
		base = base + "/v1"
	}

	req, err := http.NewRequestWithContext(ctx, "POST", base+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("LLM API returned %d", resp.StatusCode)
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	if len(result.Choices) == 0 {
		return "", fmt.Errorf("no response from LLM")
	}

	return strings.TrimSpace(result.Choices[0].Message.Content), nil
}

// callAnthropicForReason calls Anthropic API for association reason.
func (s *MemoryService) callAnthropicForReason(ctx context.Context, baseURL, apiKey, model string, temperature float64, prompt string) (string, error) {
	if apiKey == "" {
		apiKey = os.Getenv("ANTHROPIC_API_KEY")
	}
	if apiKey == "" {
		return "", fmt.Errorf("API Key not configured")
	}
	if baseURL == "" {
		baseURL = "https://api.anthropic.com/v1"
	}
	if model == "" {
		model = "claude-sonnet-4-20250514"
	}

	body, _ := json.Marshal(map[string]interface{}{
		"model":       model,
		"temperature": temperature,
		"max_tokens":  256,
		"system":      "你是一个语义分析助手，擅长发现内容之间的隐藏联系。只输出关联说明，不要额外解释。",
		"messages": []map[string]string{
			{"role": "user", "content": prompt},
		},
	})

	base := strings.TrimSuffix(baseURL, "/")
	if !strings.HasSuffix(base, "/v1") {
		base = base + "/v1"
	}

	req, err := http.NewRequestWithContext(ctx, "POST", base+"/messages", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("LLM API returned %d", resp.StatusCode)
	}

	var result struct {
		Content []struct {
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	if len(result.Content) == 0 {
		return "", fmt.Errorf("no response from LLM")
	}

	return strings.TrimSpace(result.Content[0].Text), nil
}

// GetStreak calculates the user's current and longest recording streaks.
// Uses grace-based logic: allows a 1-day gap before breaking the streak.
func (s *MemoryService) GetStreak(ctx context.Context, userID uuid.UUID) (int, int, bool, error) {
	// Fetch all non-sealed memories for the user, ordered by creation date desc
	memories, err := s.repo.GetMemoriesByDateRange(ctx, userID, time.Time{}, time.Now())
	if err != nil {
		return 0, 0, false, fmt.Errorf("failed to fetch memories for streak: %w", err)
	}
	if len(memories) == 0 {
		return 0, 0, false, nil
	}

	// Extract unique dates (normalized to UTC midnight)
	dateSet := make(map[string]bool)
	var dates []time.Time
	for _, m := range memories {
		dateKey := m.CreatedAt.UTC().Format("2006-01-02")
		if !dateSet[dateKey] {
			dateSet[dateKey] = true
			// Normalize to midnight UTC for consistent gap calculation
			normalized := time.Date(m.CreatedAt.UTC().Year(), m.CreatedAt.UTC().Month(), m.CreatedAt.UTC().Day(), 0, 0, 0, 0, time.UTC)
			dates = append(dates, normalized)
		}
	}

	// Sort dates descending (most recent first)
	for i := 0; i < len(dates)-1; i++ {
		for j := i + 1; j < len(dates); j++ {
			if dates[i].Before(dates[j]) {
				dates[i], dates[j] = dates[j], dates[i]
			}
		}
	}

	now := time.Now().UTC()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	yesterday := today.Add(-24 * time.Hour)

	hasRecordedToday := false
	if len(dates) > 0 && dates[0].Equal(today) {
		hasRecordedToday = true
	}

	// Calculate current streak with 1-day grace period
	currentStreak := 0
	if hasRecordedToday {
		currentStreak = 1
	} else if len(dates) > 0 && dates[0].Equal(yesterday) {
		// Grace: recorded yesterday, today is still within grace
		currentStreak = 1
	}

	for i := 1; i < len(dates); i++ {
		gap := dates[i-1].Sub(dates[i]).Hours() / 24
		if gap <= 2 { // Within 2 days = consecutive with grace (1-day gap allowed)
			if currentStreak == 0 {
				// Starting from a grace period
				if dates[i-1].Equal(yesterday) && dates[i].Before(yesterday.Add(-24*time.Hour)) {
					break
				}
			}
			currentStreak++
		} else {
			break
		}
	}

	// Calculate longest streak
	longestStreak := 0
	if len(dates) > 0 {
		longestStreak = 1
	}
	currentRun := 1
	for i := 1; i < len(dates); i++ {
		gap := dates[i-1].Sub(dates[i]).Hours() / 24
		if gap <= 2 {
			currentRun++
			if currentRun > longestStreak {
				longestStreak = currentRun
			}
		} else {
			currentRun = 1
		}
	}

	return currentStreak, longestStreak, hasRecordedToday, nil
}

// GetSerendipity returns a "that day in history" memory for the user.
// Prioritizes a memory from exactly 1 year ago; falls back to a random old memory.
func (s *MemoryService) GetSerendipity(ctx context.Context, userID uuid.UUID) (*domain.SerendipityResponse, error) {
	now := time.Now()

	// Try to find memory from exactly 1 year ago (same month/day)
	memories, err := s.repo.GetMemoriesOnDate(ctx, userID, int(now.Month()), now.Day())
	if err != nil {
		return nil, fmt.Errorf("failed to fetch memories on date: %w", err)
	}

	var selected *domain.Memory
	yearsAgo := 1

	// Filter to memories from approximately 1 year ago (within a 30-day window)
	for i := range memories {
		age := now.Sub(memories[i].CreatedAt).Hours() / 24
		if age >= 335 && age <= 395 { // ~1 year with tolerance
			selected = &memories[i]
			break
		}
	}

	// Fallback: random memory older than 30 days
	if selected == nil {
		cutoff := now.AddDate(0, 0, -30)
		randomMem, err := s.repo.GetRandomMemory(ctx, userID, cutoff)
		if err != nil {
			if errors.Is(err, repository.ErrMemoryNotFound) {
				return nil, ErrMemoryNotFound
			}
			return nil, fmt.Errorf("failed to fetch random memory: %w", err)
		}
		selected = &randomMem
		yearsAgo = 0
	}

	// Count memories created since the selected memory
	countSince, err := s.repo.CountMemoriesSince(ctx, userID, selected.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to count memories since: %w", err)
	}

	return &domain.SerendipityResponse{
		Memory:        selected,
		MemoriesSince: int(countSince),
		YearsAgo:      yearsAgo,
	}, nil
}

// GetDailyReview returns daily stats: today's count, top tags, and a memory worth reviewing.
func (s *MemoryService) GetDailyReview(ctx context.Context, userID uuid.UUID) (*domain.DailyReview, error) {
	now := time.Now()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	endOfDay := startOfDay.Add(24 * time.Hour)

	// Get today's memories
	todayMemories, err := s.repo.GetMemoriesByDateRange(ctx, userID, startOfDay, endOfDay)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch today's memories: %w", err)
	}

	// Count and extract top tags
	tagCounts := make(map[string]int)
	for _, m := range todayMemories {
		for _, tag := range m.Tags {
			tagCounts[tag]++
		}
	}

	// Get top 3 tags by frequency
	type tagCount struct {
		Tag   string
		Count int
	}
	var tagList []tagCount
	for tag, count := range tagCounts {
		tagList = append(tagList, tagCount{Tag: tag, Count: count})
	}
	for i := 0; i < len(tagList)-1; i++ {
		for j := i + 1; j < len(tagList); j++ {
			if tagList[i].Count < tagList[j].Count {
				tagList[i], tagList[j] = tagList[j], tagList[i]
			}
		}
	}

	topTags := make([]string, 0, 3)
	for i := 0; i < len(tagList) && i < 3; i++ {
		topTags = append(topTags, tagList[i].Tag)
	}

	// Find a memory worth reviewing: old, has tags/content, not from today
	var worthReviewing *domain.Memory
	cutoff := now.AddDate(0, 0, -30)
	oldMemories, err := s.repo.GetMemoriesByDateRange(ctx, userID, time.Time{}, cutoff)
	if err == nil && len(oldMemories) > 0 {
		// Pick the one with the most tags (proxy for "rich content")
		best := oldMemories[0]
		for _, m := range oldMemories {
			if len(m.Tags) > len(best.Tags) {
				best = m
			}
		}
		worthReviewing = &best
	}

	return &domain.DailyReview{
		TodayCount:     len(todayMemories),
		TopTags:        topTags,
		WorthReviewing: worthReviewing,
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
	memory.Source = sanitizeText(req.Source)
	if req.IsStarred != nil {
		memory.IsStarred = *req.IsStarred
	}

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
	validTypes := map[string]bool{"link:fetch": true, "text:vectorize": true, "tag:generate": true, "suggestion:generate": true, "file:extract": true, "cover:generate": true}
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
	case "cover:generate":
		content := s.extractContent(memory)
		if memory.ContentType == "file" {
			content = memory.TextContent
		}
		_ = s.queue.PublishCoverGenerate(ctx, memory.ID, memory.ContentType, content, memory.LinkURL, memory.LinkTitle, []string(memory.Tags), memory.UserID, llmConfig)
		return nil // PublishCoverGenerate handles its own error; we return nil for retry flow
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

// SealMemory seals a memory until a future date.
func (s *MemoryService) SealMemory(ctx context.Context, userID, memoryID uuid.UUID, sealedUntil time.Time) error {
	if sealedUntil.Before(time.Now()) {
		return ErrInvalidRequest
	}
	return s.repo.SealMemory(ctx, userID, memoryID, sealedUntil)
}

// UnsealMemory removes the seal from a memory.
func (s *MemoryService) UnsealMemory(ctx context.Context, userID, memoryID uuid.UUID) error {
	return s.repo.UnsealMemory(ctx, userID, memoryID)
}

// ListSealedMemories returns paginated memories that are currently sealed.
func (s *MemoryService) ListSealedMemories(ctx context.Context, userID uuid.UUID, page, limit int) (*domain.ListMemoriesResponse, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	memories, total, err := s.repo.ListSealedMemories(ctx, userID, page, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to list sealed memories: %w", err)
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

// GetRecentlyUnsealed returns memories that became unsealed in the last 24 hours.
func (s *MemoryService) GetRecentlyUnsealed(ctx context.Context, userID uuid.UUID) ([]domain.Memory, error) {
	since := time.Now().Add(-24 * time.Hour)
	return s.repo.GetRecentlyUnsealed(ctx, userID, since)
}
