-- Migration 004: File upload support + capture enhancements
ALTER TABLE memories ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT false;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- Index for starred queries
CREATE INDEX IF NOT EXISTS idx_memories_starred ON memories(user_id, is_starred, created_at DESC);

-- Note: content_type CHECK constraint updated in domain validation, not DB-level
-- to avoid migration complexity with existing data
