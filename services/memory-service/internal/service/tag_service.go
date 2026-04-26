// Package service implements tag business logic.
package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/NebulaVzx/Echoes/services/memory-service/internal/crypto"
	"github.com/NebulaVzx/Echoes/services/memory-service/internal/domain"
	"github.com/NebulaVzx/Echoes/services/memory-service/internal/repository"
	"github.com/google/uuid"
)

// TagService handles tag business logic.
type TagService struct {
	tagRepo  repository.TagRepository
	userRepo repository.UserRepository
}

// NewTagService creates a new tag service.
func NewTagService(tagRepo repository.TagRepository, userRepo repository.UserRepository) *TagService {
	return &TagService{tagRepo: tagRepo, userRepo: userRepo}
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

// CategorizeTags uses LLM to automatically categorize tags into groups.
func (s *TagService) CategorizeTags(ctx context.Context, userID uuid.UUID) (*domain.CategorizeTagsResponse, error) {
	// 1. Get all tags for the user
	tagsResp, err := s.tagRepo.ListByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to list tags: %w", err)
	}
	if len(tagsResp) == 0 {
		return &domain.CategorizeTagsResponse{Categories: []domain.TagCategory{}}, nil
	}

	tagNames := make([]string, len(tagsResp))
	for i, t := range tagsResp {
		tagNames[i] = t.Name
	}

	// 2. Get user LLM config
	llmConfig, err := s.getUserLLMConfig(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get LLM config: %w", err)
	}

	// 3. Call LLM to categorize
	categories, err := s.callLLMCategorize(ctx, tagNames, llmConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to categorize tags: %w", err)
	}

	return &domain.CategorizeTagsResponse{Categories: categories}, nil
}

// getUserLLMConfig fetches user settings and extracts LLM config.
func (s *TagService) getUserLLMConfig(ctx context.Context, userID uuid.UUID) (map[string]interface{}, error) {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	settingsStr := user.Settings.String()
	if len(user.Settings) == 0 || settingsStr == "{}" || settingsStr == "null" {
		return nil, nil
	}

	var settings struct {
		LLMProvider    string  `json:"llm_provider"`
		LLMProtocol    string  `json:"llm_protocol"`
		LLMModel       string  `json:"llm_model"`
		LLMTemperature float64 `json:"llm_temperature"`
		APIKey         string  `json:"api_key"`
		BaseURL        string  `json:"base_url"`
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
		decrypted, err := crypto.Decrypt(settings.APIKey)
		if err == nil && decrypted != "" {
			config["api_key"] = decrypted
		} else {
			config["api_key"] = settings.APIKey
		}
	}
	if settings.BaseURL != "" {
		config["base_url"] = settings.BaseURL
	}
	return config, nil
}

// callLLMCategorize calls the LLM API to categorize tags.
func (s *TagService) callLLMCategorize(ctx context.Context, tags []string, llmConfig map[string]interface{}) ([]domain.TagCategory, error) {
	// Build prompt
	prompt := fmt.Sprintf(`你是一个标签分类助手。请将以下标签自动归类到合适的类别中。

标签列表: %s

要求:
1. 每个类别给一个简洁的中文名称（2-6个字）
2. 每个标签只能属于一个类别
3. 如果标签数量很少或无法明确归类，可以放入"其他"
4. 类别数量控制在 3-8 个之间

返回格式（纯 JSON，不要 markdown 代码块）:
{
  "categories": [
    {"name": "类别名称", "tags": ["tag1", "tag2"]},
    ...
  ]
}`, strings.Join(tags, ", "))

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

	temperature := 0.3
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
		return s.callOpenAIFormat(ctx, baseURL, apiKey, model, temperature, prompt)
	case "anthropic":
		return s.callAnthropicFormat(ctx, baseURL, apiKey, model, temperature, prompt)
	default:
		return s.callOpenAIFormat(ctx, baseURL, apiKey, model, temperature, prompt)
	}
}

// callOpenAIFormat calls an OpenAI-compatible API.
func (s *TagService) callOpenAIFormat(ctx context.Context, baseURL, apiKey, model string, temperature float64, prompt string) ([]domain.TagCategory, error) {
	if apiKey == "" {
		apiKey = os.Getenv("OPENAI_API_KEY")
	}
	if apiKey == "" {
		return nil, fmt.Errorf("API Key not configured")
	}
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}

	body, _ := json.Marshal(map[string]interface{}{
		"model":       model,
		"temperature": temperature,
		"messages": []map[string]string{
			{"role": "system", "content": "你是一个标签分类助手，只返回 JSON 格式。"},
			{"role": "user", "content": prompt},
		},
	})

	base := strings.TrimSuffix(baseURL, "/")
	if !strings.HasSuffix(base, "/v1") {
		base = base + "/v1"
	}

	req, err := http.NewRequestWithContext(ctx, "POST", base+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("LLM API returned %d", resp.StatusCode)
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	if len(result.Choices) == 0 {
		return nil, fmt.Errorf("no response from LLM")
	}

	return parseCategorizeResponse(result.Choices[0].Message.Content)
}

// callAnthropicFormat calls the Anthropic API.
func (s *TagService) callAnthropicFormat(ctx context.Context, baseURL, apiKey, model string, temperature float64, prompt string) ([]domain.TagCategory, error) {
	if apiKey == "" {
		apiKey = os.Getenv("ANTHROPIC_API_KEY")
	}
	if apiKey == "" {
		return nil, fmt.Errorf("API Key not configured")
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
		"max_tokens":  4096,
		"system":      "你是一个标签分类助手，只返回 JSON 格式。",
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
		return nil, err
	}
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("LLM API returned %d", resp.StatusCode)
	}

	var result struct {
		Content []struct {
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	if len(result.Content) == 0 {
		return nil, fmt.Errorf("no response from LLM")
	}

	return parseCategorizeResponse(result.Content[0].Text)
}

// parseCategorizeResponse parses the LLM response into categories.
func parseCategorizeResponse(content string) ([]domain.TagCategory, error) {
	// Clean up markdown code blocks if present
	content = strings.TrimSpace(content)
	if strings.HasPrefix(content, "```json") {
		content = strings.TrimPrefix(content, "```json")
		content = strings.TrimSuffix(content, "```")
		content = strings.TrimSpace(content)
	} else if strings.HasPrefix(content, "```") {
		content = strings.TrimPrefix(content, "```")
		content = strings.TrimSuffix(content, "```")
		content = strings.TrimSpace(content)
	}

	var result struct {
		Categories []domain.TagCategory `json:"categories"`
	}
	if err := json.Unmarshal([]byte(content), &result); err != nil {
		return nil, fmt.Errorf("failed to parse LLM response: %w", err)
	}
	return result.Categories, nil
}
