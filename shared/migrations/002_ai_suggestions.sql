-- Echoes (拾忆) - AI Suggestions Migration
-- Version: 1.2.0
-- Created: 2026-04-25
-- Description: Add ai_suggestions table and user settings fields for AI companion suggestions

-- AI Suggestions table: one-to-one with memories
CREATE TABLE IF NOT EXISTS ai_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    suggestion_type VARCHAR(20),      -- emotion_support, knowledge_expand, action_suggest, connection, general
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_feedback VARCHAR(20),        -- liked, disliked, ignored, null
    metadata JSONB DEFAULT '{}'       -- model, temperature, tokens, latency, retry_count
);

-- Index for fast lookup by memory_id
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_memory_id ON ai_suggestions(memory_id);

-- Comment on table and columns for documentation
COMMENT ON TABLE ai_suggestions IS 'AI-generated companion suggestions for each memory';
COMMENT ON COLUMN ai_suggestions.memory_id IS 'Foreign key to memories table (one-to-one)';
COMMENT ON COLUMN ai_suggestions.content IS 'The AI-generated suggestion text (50-150 Chinese characters)';
COMMENT ON COLUMN ai_suggestions.suggestion_type IS 'Type of suggestion: emotion_support, knowledge_expand, action_suggest, connection, general';
COMMENT ON COLUMN ai_suggestions.user_feedback IS 'User feedback: liked, disliked, ignored, or null';
COMMENT ON COLUMN ai_suggestions.metadata IS 'Generation metadata: model, temperature, tokens, latency, retry_count';
