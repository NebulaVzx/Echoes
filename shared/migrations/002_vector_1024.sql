-- Echoes (拾忆) - Migration: Update vector dimension for BGE-M3 compatibility
-- Version: 1.1.0
-- Created: 2026-04-19
-- Description: BGE-M3 outputs 1024 dimensions, update from 768

-- Drop existing vector index (depends on old dimension)
DROP INDEX IF EXISTS idx_memories_vector;

-- Update column type to 1024 dimensions
ALTER TABLE memories ALTER COLUMN vector TYPE vector(1024);

-- Recreate index with new dimension
CREATE INDEX idx_memories_vector ON memories USING ivfflat (vector vector_cosine_ops);

-- Update comment
COMMENT ON COLUMN memories.vector IS 'BGE-M3 embedding (1024 dimensions) for semantic search';
