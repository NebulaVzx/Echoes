// Package service provides chat business logic including RAG orchestration.
package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/NebulaVzx/Echoes/services/gateway/internal/chat/domain"
	"github.com/NebulaVzx/Echoes/services/gateway/internal/chat/repository"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/datatypes"
)

const (
	MaxHistoryMessages = 10  // Keep last 10 messages (5 turns)
	DefaultRAGLimit    = 5   // Top 5 memories for RAG
	MaxTokens          = 1000 // LLM max_tokens for chat responses
)

// systemPromptTemplate is the Chinese system prompt for RAG-based Q&A.
// Memories are numbered [1], [2], etc. for citation.
const systemPromptTemplate = `你是用户的个人知识库助手"拾忆"。你基于用户保存的记忆片段回答问题。

## 任务
根据下面提供的记忆片段，回答用户的问题。你的回答必须严格基于提供的记忆内容，不得添加外部知识或猜测。

## 记忆片段
%s

## 约束
1. 【严格基于记忆】只使用提供的记忆片段中的信息回答问题
2. 【引用标注】每个事实性陈述必须标注来源，格式为 [1]、[2] 等
3. 【信息不足】如果记忆片段不足以回答问题，明确说明"根据您的记忆，我找不到相关信息"
4. 【语言一致】使用与用户问题相同的语言回答
5. 【禁止推测】不要推断、假设或添加记忆片段中未明确提及的信息
6. 【直接回答】不要以"根据您的记忆"开头，直接提供带引用的答案`

const systemPromptNoMemories = `你是用户的个人知识库助手"拾忆"。

用户没有保存相关的记忆片段。请明确告知用户"根据您的记忆，我找不到相关信息"，并建议用户保存相关内容后再提问。

## 约束
1. 【信息不足】明确说明"根据您的记忆，我找不到相关信息"
2. 【语言一致】使用与用户问题相同的语言回答
3. 【禁止推测】不要推断、假设或添加任何外部知识`

// userLLMConfig holds per-user LLM settings fetched from User Service.
type userLLMConfig struct {
	Provider    string  `json:"llm_provider"`
	Protocol    string  `json:"llm_protocol"`
	Model       string  `json:"llm_model"`
	Temperature float64 `json:"llm_temperature"`
	APIKey      string  `json:"api_key"`
	BaseURL     string  `json:"base_url"`
}

// ChatService orchestrates RAG retrieval, prompt assembly, and LLM generation.
type ChatService struct {
	repo           repository.ConversationRepository
	memoryURL      string
	processorURL   string
	userServiceURL string
	httpClient     *http.Client
	logger         *zap.Logger
}

// NewChatService creates a new chat service.
func NewChatService(repo repository.ConversationRepository, memoryURL, processorURL, userServiceURL string, logger *zap.Logger) *ChatService {
	if memoryURL == "" {
		memoryURL = "http://memory-service:8002"
	}
	if processorURL == "" {
		processorURL = "http://processor-service:8001"
	}
	if userServiceURL == "" {
		userServiceURL = "http://user-service:8001"
	}
	return &ChatService{
		repo:           repo,
		memoryURL:      memoryURL,
		processorURL:   processorURL,
		userServiceURL: userServiceURL,
		httpClient:     &http.Client{Timeout: 30 * time.Second},
		logger:         logger,
	}
}

// SendMessage handles a single chat turn: save user message, RAG search, LLM call, save response.
func (s *ChatService) SendMessage(ctx context.Context, userID uuid.UUID, req *domain.SendMessageRequest, authHeader string) (*domain.ChatResponse, error) {
	// 1. Determine or create conversation
	var conversationID uuid.UUID
	var isNewConversation bool

	if req.ConversationID == "" {
		isNewConversation = true
		conversationID = uuid.New()
		title := req.Content
		if len([]rune(title)) > 30 {
			title = string([]rune(title)[:30]) + "..."
		}
		conv := &domain.Conversation{
			ID:     conversationID,
			UserID: userID,
			Title:  title,
		}
		if err := s.repo.CreateConversation(ctx, conv); err != nil {
			s.logger.Error("failed to create conversation", zap.Error(err), zap.String("user_id", userID.String()))
			return nil, fmt.Errorf("failed to create conversation: %w", err)
		}
	} else {
		var err error
		conversationID, err = uuid.Parse(req.ConversationID)
		if err != nil {
			return nil, fmt.Errorf("invalid conversation_id: %w", err)
		}
		// Verify ownership
		_, err = s.repo.GetConversation(ctx, conversationID, userID)
		if err != nil {
			return nil, err
		}
	}

	// 2. Save user message
	userMsg := &domain.Message{
		ConversationID: conversationID,
		Role:           "user",
		Content:        req.Content,
	}
	if err := s.repo.CreateMessage(ctx, userMsg); err != nil {
		s.logger.Error("failed to save user message", zap.Error(err), zap.String("conversation_id", conversationID.String()))
		return nil, fmt.Errorf("failed to save user message: %w", err)
	}

	// 3. Call Memory Service for RAG retrieval
	memories, err := s.searchMemories(ctx, req.Content, userID, authHeader)
	if err != nil {
		s.logger.Error("memory search failed", zap.Error(err), zap.String("query", req.Content))
		// Continue with empty memories — system prompt will handle it
		memories = nil
	}

	// 4. Fetch recent history
	history, err := s.repo.GetMessagesByConversation(ctx, conversationID, MaxHistoryMessages+1)
	if err != nil {
		s.logger.Error("failed to fetch message history", zap.Error(err), zap.String("conversation_id", conversationID.String()))
		history = nil
	}

	// 5. Build messages array for LLM
	messages := s.buildMessages(req.Content, memories, history)

	// 5.5 Fetch user's LLM settings from User Service
	llmConfig, err := s.getUserLLMConfig(ctx, userID, authHeader)
	if err != nil {
		s.logger.Warn("failed to fetch user LLM config, using defaults", zap.Error(err), zap.String("user_id", userID.String()))
		llmConfig = nil
	}

	// 6. Call Processor Service LLM
	llmResponse, err := s.callLLM(ctx, messages, llmConfig)
	var assistantContent string
	var citations []domain.Citation
	if err != nil {
		s.logger.Error("llm call failed", zap.Error(err), zap.String("conversation_id", conversationID.String()))
		assistantContent = "抱歉，AI 服务暂时不可用，请稍后再试。"
		citations = nil
	} else {
		// 7. Parse citations
		citations, assistantContent = s.parseCitations(llmResponse, memories)
	}

	// 8. Save assistant message
	citationsJSON, _ := json.Marshal(citations)
	assistantMsg := &domain.Message{
		ConversationID: conversationID,
		Role:           "assistant",
		Content:        assistantContent,
		Citations:      datatypes.JSON(citationsJSON),
	}
	if err := s.repo.CreateMessage(ctx, assistantMsg); err != nil {
		s.logger.Error("failed to save assistant message", zap.Error(err), zap.String("conversation_id", conversationID.String()))
		return nil, fmt.Errorf("failed to save assistant message: %w", err)
	}

	// 9. Return response
	resp := &domain.ChatResponse{
		Message: &domain.Message{
			ID:             assistantMsg.ID,
			ConversationID: assistantMsg.ConversationID,
			Role:           assistantMsg.Role,
			Content:        assistantMsg.Content,
			Citations:      assistantMsg.Citations,
			CreatedAt:      assistantMsg.CreatedAt,
		},
		Citations: citations,
	}

	// If new conversation, include the conversation ID in the response for frontend
	if isNewConversation {
		// We can't modify the Message struct, but the frontend will get conversation_id from the message
		// The conversation was already created with the ID
		_ = conversationID
	}

	return resp, nil
}

// ListConversations returns the user's conversations ordered by updated_at DESC.
func (s *ChatService) ListConversations(ctx context.Context, userID uuid.UUID) ([]domain.Conversation, error) {
	return s.repo.ListConversations(ctx, userID, 50)
}

// DeleteConversation deletes a conversation and its messages after verifying ownership.
func (s *ChatService) DeleteConversation(ctx context.Context, userID uuid.UUID, conversationID uuid.UUID) error {
	return s.repo.DeleteConversation(ctx, conversationID, userID)
}

// GetMessages returns messages for a conversation after verifying ownership.
func (s *ChatService) GetMessages(ctx context.Context, userID uuid.UUID, conversationID uuid.UUID) ([]domain.Message, error) {
	// Verify ownership
	_, err := s.repo.GetConversation(ctx, conversationID, userID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetMessagesByConversation(ctx, conversationID, 200)
}

// searchMemories calls the Memory Service search API for RAG retrieval.
func (s *ChatService) searchMemories(ctx context.Context, query string, userID uuid.UUID, authHeader string) ([]domain.SearchResultMemory, error) {
	searchURL := fmt.Sprintf("%s/api/v1/search?q=%s&limit=%d", s.memoryURL, url.QueryEscape(query), DefaultRAGLimit)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, searchURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create search request: %w", err)
	}

	// Forward JWT token to Memory Service
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}
	// Also set X-User-ID for internal auth fallback
	req.Header.Set("X-User-ID", userID.String())

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("memory service search failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("memory service returned status %d", resp.StatusCode)
	}

	var searchResp struct {
		Success bool `json:"success"`
		Data    struct {
			Results []struct {
				Memory     map[string]interface{} `json:"memory"`
				Similarity float64                `json:"similarity"`
			} `json:"results"`
			Query string `json:"query"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&searchResp); err != nil {
		return nil, fmt.Errorf("failed to decode search response: %w", err)
	}

	if !searchResp.Success {
		return nil, fmt.Errorf("memory service search returned success=false")
	}

	memories := make([]domain.SearchResultMemory, 0, len(searchResp.Data.Results))
	for _, r := range searchResp.Data.Results {
		m := domain.SearchResultMemory{
			Similarity: r.Similarity,
		}
		// Extract fields from map
		if idStr, ok := r.Memory["id"].(string); ok {
			m.ID, _ = uuid.Parse(idStr)
		}
		if title, ok := r.Memory["link_title"].(string); ok && title != "" {
			m.Title = title
		} else if text, ok := r.Memory["text_content"].(string); ok && text != "" {
			// Use first 50 chars of text content as title fallback
			runes := []rune(text)
			if len(runes) > 50 {
				m.Title = string(runes[:50]) + "..."
			} else {
				m.Title = text
			}
		}
		if ct, ok := r.Memory["content_type"].(string); ok {
			m.ContentType = ct
		}
		if content, ok := r.Memory["text_content"].(string); ok {
			m.Content = content
		} else if summary, ok := r.Memory["link_summary"].(string); ok {
			m.Content = summary
		}
		if tags, ok := r.Memory["tags"].([]interface{}); ok {
			m.Tags = make([]string, 0, len(tags))
			for _, t := range tags {
				if ts, ok := t.(string); ok {
					m.Tags = append(m.Tags, ts)
				}
			}
		}
		if note, ok := r.Memory["note"].(string); ok {
			m.Note = note
		}
		if createdAt, ok := r.Memory["created_at"].(string); ok {
			m.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
		}
		memories = append(memories, m)
	}

	return memories, nil
}

// assembleSystemPrompt builds the system prompt from retrieved memories.
func (s *ChatService) assembleSystemPrompt(memories []domain.SearchResultMemory) string {
	if len(memories) == 0 {
		return systemPromptNoMemories
	}

	var sb strings.Builder
	for i, m := range memories {
		if i > 0 {
			sb.WriteString("\n---\n")
		}
		sb.WriteString(fmt.Sprintf("[%d] 标题: %s\n", i+1, m.Title))
		sb.WriteString(fmt.Sprintf("类型: %s\n", m.ContentType))
		if len(m.Tags) > 0 {
			sb.WriteString(fmt.Sprintf("标签: %s\n", strings.Join(m.Tags, ", ")))
		}
		sb.WriteString(fmt.Sprintf("保存时间: %s\n", m.CreatedAt.Format("2006-01-02")))
		sb.WriteString(fmt.Sprintf("内容:\n%s\n", m.Content))
		if m.Note != "" {
			sb.WriteString(fmt.Sprintf("备注: %s\n", m.Note))
		}
	}

	return fmt.Sprintf(systemPromptTemplate, sb.String())
}

// buildMessages constructs the messages array for the LLM API.
func (s *ChatService) buildMessages(query string, memories []domain.SearchResultMemory, history []domain.Message) []map[string]string {
	messages := make([]map[string]string, 0, MaxHistoryMessages+2)

	// 1. System message with RAG context
	systemContent := s.assembleSystemPrompt(memories)
	messages = append(messages, map[string]string{
		"role":    "system",
		"content": systemContent,
	})

	// 2. Recent history (up to MaxHistoryMessages, filter out system if any)
	historyCount := 0
	for i := len(history) - 1; i >= 0 && historyCount < MaxHistoryMessages; i-- {
		msg := history[i]
		if msg.Role == "system" {
			continue
		}
		// Prepend to maintain order
		messages = append([]map[string]string{{
			"role":    msg.Role,
			"content": msg.Content,
		}}, messages[1:]...)
		messages = append([]map[string]string{{
			"role":    "system",
			"content": systemContent,
		}}, messages...)
		historyCount++
	}

	// 3. Current user query
	messages = append(messages, map[string]string{
		"role":    "user",
		"content": query,
	})

	return messages
}

// parseCitations extracts [N] patterns from text and validates against retrieved memories.
func (s *ChatService) parseCitations(text string, memories []domain.SearchResultMemory) ([]domain.Citation, string) {
	if len(memories) == 0 {
		return nil, text
	}

	citationRegex := regexp.MustCompile(`\[(\d+)\]`)
	matches := citationRegex.FindAllStringSubmatch(text, -1)

	citationMap := make(map[int]domain.Citation)
	for _, match := range matches {
		if len(match) < 2 {
			continue
		}
		idx, err := strconv.Atoi(match[1])
		if err != nil {
			continue
		}
		// Validate index is within range
		if idx < 1 || idx > len(memories) {
			s.logger.Warn("invalid citation index",
				zap.Int("index", idx),
				zap.Int("memory_count", len(memories)))
			continue
		}
		m := memories[idx-1]
		citationMap[idx] = domain.Citation{
			Index:      idx,
			MemoryID:   m.ID.String(),
			Title:      m.Title,
			Similarity: m.Similarity,
		}
	}

	// Convert map to slice
	citations := make([]domain.Citation, 0, len(citationMap))
	for _, c := range citationMap {
		citations = append(citations, c)
	}

	return citations, text
}

// getUserLLMConfig fetches the user's LLM settings from User Service.
func (s *ChatService) getUserLLMConfig(ctx context.Context, userID uuid.UUID, authHeader string) (*userLLMConfig, error) {
	settingsURL := fmt.Sprintf("%s/api/v1/auth/me/settings", s.userServiceURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, settingsURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create settings request: %w", err)
	}
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}
	req.Header.Set("X-User-ID", userID.String())
	req.Header.Set("X-Internal-Request", "true")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("user service request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("user service returned status %d", resp.StatusCode)
	}

	var settingsResp struct {
		Success bool `json:"success"`
		Data    struct {
			LLMProvider    string  `json:"llm_provider"`
			LLMProtocol    string  `json:"llm_protocol"`
			LLMModel       string  `json:"llm_model"`
			LLMTemperature float64 `json:"llm_temperature"`
			APIKey         string  `json:"api_key"`
			BaseURL        string  `json:"base_url"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&settingsResp); err != nil {
		return nil, fmt.Errorf("failed to decode settings response: %w", err)
	}

	if !settingsResp.Success {
		return nil, fmt.Errorf("user service returned success=false")
	}

	cfg := &userLLMConfig{
		Provider:    settingsResp.Data.LLMProvider,
		Protocol:    settingsResp.Data.LLMProtocol,
		Model:       settingsResp.Data.LLMModel,
		Temperature: settingsResp.Data.LLMTemperature,
		APIKey:      settingsResp.Data.APIKey,
		BaseURL:     settingsResp.Data.BaseURL,
	}
	return cfg, nil
}

// callLLM sends the messages array to the Processor Service for generation.
func (s *ChatService) callLLM(ctx context.Context, messages []map[string]string, cfg *userLLMConfig) (string, error) {
	payload := map[string]interface{}{
		"messages":   messages,
		"max_tokens": MaxTokens,
	}
	if cfg != nil {
		if cfg.Provider != "" {
			payload["provider"] = cfg.Provider
		}
		if cfg.Protocol != "" {
			payload["protocol"] = cfg.Protocol
		}
		if cfg.Model != "" {
			payload["model"] = cfg.Model
		}
		if cfg.Temperature != 0 {
			payload["temperature"] = cfg.Temperature
		}
		if cfg.APIKey != "" {
			payload["api_key"] = cfg.APIKey
		}
		if cfg.BaseURL != "" {
			payload["base_url"] = cfg.BaseURL
		}
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal LLM request: %w", err)
	}

	llmURL := fmt.Sprintf("%s/api/v1/generate/chat", s.processorURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, llmURL, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("failed to create LLM request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("processor service call failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("processor service returned status %d", resp.StatusCode)
	}

	var llmResp struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&llmResp); err != nil {
		return "", fmt.Errorf("failed to decode LLM response: %w", err)
	}

	return llmResp.Content, nil
}
