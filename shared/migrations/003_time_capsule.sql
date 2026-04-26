-- Migration 003: Time capsule support
ALTER TABLE memories ADD COLUMN IF NOT EXISTS sealed_until TIMESTAMP WITH TIME ZONE;

-- Index for efficient filtering of sealed/active memories
CREATE INDEX IF NOT EXISTS idx_memories_sealed_until ON memories(user_id, sealed_until);
