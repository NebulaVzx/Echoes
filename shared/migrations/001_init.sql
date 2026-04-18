-- Echoes (拾忆) - Initial Database Migration
-- Version: 1.0.0
-- Created: 2026-04-18
-- Description: Initial schema for users, memories, and supporting structures

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS pgvector;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    username VARCHAR(100),
    avatar_url TEXT,
    oauth_provider VARCHAR(50),
    oauth_id VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Memories table (core entity)
CREATE TABLE IF NOT EXISTS memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('text', 'link')),

    -- Content fields
    text_content TEXT,
    link_url TEXT,
    link_title TEXT,
    link_summary TEXT,

    -- Reserved fields for future phases (voice, image, OCR, etc.)
    media_url TEXT,
    media_duration INT,
    ocr_text TEXT,
    transcript_text TEXT,

    -- Vector embedding for semantic search (BGE-M3 produces 768-dim vectors)
    vector VECTOR(768),

    -- Metadata
    tags VARCHAR(50)[] DEFAULT '{}',
    note TEXT,
    metadata JSONB DEFAULT '{}',
    processing_status VARCHAR(20) DEFAULT 'pending',
    visibility VARCHAR(20) DEFAULT 'private',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_user_created ON memories(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_vector ON memories USING ivfflat (vector vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_memories_tags ON memories USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_memories_processing ON memories(processing_status);

-- Auto-update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_memories_updated_at ON memories;
CREATE TRIGGER update_memories_updated_at
    BEFORE UPDATE ON memories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comment on tables for documentation
COMMENT ON TABLE users IS 'Registered users (email/password or OAuth)';
COMMENT ON TABLE memories IS 'User saved content (text snippets, links, future media)';
COMMENT ON COLUMN memories.vector IS 'BGE-M3 embedding (768 dimensions) for semantic search';
COMMENT ON COLUMN memories.processing_status IS 'pending -> processing -> completed/failed';
