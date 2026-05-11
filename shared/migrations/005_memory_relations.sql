-- Echoes (拾忆) - Phase 13: Memory Relations Migration
-- Version: 1.3.0
-- Created: 2026-05-09
-- Description: Cache table for AI-generated association reasons between memories

CREATE TABLE IF NOT EXISTS memory_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    similarity FLOAT NOT NULL CHECK (similarity >= 0 AND similarity <= 1),
    reason TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_id, target_id)
);

CREATE INDEX IF NOT EXISTS idx_memory_relations_source ON memory_relations(source_id);
CREATE INDEX IF NOT EXISTS idx_memory_relations_target ON memory_relations(target_id);
CREATE INDEX IF NOT EXISTS idx_memory_relations_similarity ON memory_relations(similarity DESC);

CREATE TRIGGER update_memory_relations_updated_at
    BEFORE UPDATE ON memory_relations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE memory_relations IS '缓存记忆之间的语义关联说明，避免重复 LLM 调用';
