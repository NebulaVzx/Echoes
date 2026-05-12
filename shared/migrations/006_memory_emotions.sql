-- Echoes (拾忆) - Phase 15: Mood & Echo Migration
-- Version: 1.3.0
-- Created: 2026-05-12
-- Description: Emotion analysis results for memories, supports model version evolution

CREATE TABLE IF NOT EXISTS memory_emotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    sentiment VARCHAR(20) NOT NULL CHECK (sentiment IN ('positive', 'neutral', 'negative')),
    score INT NOT NULL CHECK (score >= 1 AND score <= 10),
    reason TEXT,
    model_version VARCHAR(50) DEFAULT 'v1',
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(memory_id, model_version)
);

CREATE INDEX IF NOT EXISTS idx_memory_emotions_memory ON memory_emotions(memory_id);
CREATE INDEX IF NOT EXISTS idx_memory_emotions_sentiment ON memory_emotions(sentiment);
CREATE INDEX IF NOT EXISTS idx_memory_emotions_analyzed ON memory_emotions(analyzed_at);
CREATE INDEX IF NOT EXISTS idx_memory_emotions_user_date ON memory_emotions(memory_id, analyzed_at);

CREATE TRIGGER update_memory_emotions_updated_at
    BEFORE UPDATE ON memory_emotions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE memory_emotions IS '记忆情绪分析结果，支持模型版本演进';
