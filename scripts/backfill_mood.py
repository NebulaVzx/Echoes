#!/usr/bin/env python3
"""
Echoes Mood Backfill Script
Publishes mood:generate tasks for all existing memories.
Run after deploying Phase 15 to analyze emotions for existing memories.

Usage:
    python scripts/backfill_mood.py [--batch-size 50] [--delay 1]
"""

import argparse
import os
import time
import sys

import psycopg2
import redis


def get_db_connection():
    """Get PostgreSQL connection from environment or defaults."""
    dsn = os.getenv("DATABASE_URL", "postgres://echoes_user:echoes_password@localhost:5432/echoes")
    return psycopg2.connect(dsn)


def get_redis_client():
    """Get Redis client from environment or defaults."""
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    return redis.Redis.from_url(redis_url, decode_responses=True)


def fetch_memories(conn, offset, limit):
    """Fetch memories paginated."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, user_id, content_type, text_content, link_url, link_title, link_summary, note
            FROM memories
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
        """, (limit, offset))
        return cur.fetchall()


def count_memories(conn):
    """Count total memories."""
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM memories")
        return cur.fetchone()[0]


def build_content(memory):
    """Build content for mood analysis based on content type."""
    content_type = memory[2]
    text_content = memory[3] or ""
    link_title = memory[5] or ""
    link_summary = memory[6] or ""
    note = memory[7] or ""

    if content_type == "link" and link_title:
        content = link_title
        if link_summary:
            content += "\n" + link_summary
        return content

    if content_type == "file":
        return text_content

    if content_type == "weave":
        return text_content

    # text or fallback
    content = text_content
    if note and content_type == "text":
        content += "\n\n备注: " + note
    return content


def publish_mood_task(redis_client, memory_id, content_type, content, note=""):
    """Publish a mood:generate task to Redis Stream."""
    fields = {
        "memory_id": str(memory_id),
        "content_type": content_type,
        "content": content[:3000],  # Limit content length
    }
    if note:
        fields["note"] = note[:1000]

    redis_client.xadd("mood:generate", fields, maxlen=5000, approximate=True)


def main():
    parser = argparse.ArgumentParser(description="Backfill mood analysis for existing memories")
    parser.add_argument("--batch-size", type=int, default=50, help="Memories per batch")
    parser.add_argument("--delay", type=float, default=1.0, help="Delay between batches (seconds)")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be done without publishing")
    args = parser.parse_args()

    conn = get_db_connection()
    redis_client = get_redis_client()

    total = count_memories(conn)
    print(f"Total memories to process: {total}")

    if total == 0:
        print("No memories found.")
        return

    processed = 0
    offset = 0
    batch = 0

    while True:
        memories = fetch_memories(conn, offset, args.batch_size)
        if not memories:
            break

        batch += 1
        print(f"Batch {batch}: Processing {len(memories)} memories (offset {offset})...")

        for memory in memories:
            memory_id = memory[0]
            content_type = memory[2]
            content = build_content(memory)
            note = memory[7] or ""

            if not content.strip():
                print(f"  Skipping {memory_id}: no content")
                continue

            if args.dry_run:
                print(f"  Would publish mood:generate for {memory_id} ({content_type}, {len(content)} chars)")
            else:
                publish_mood_task(redis_client, memory_id, content_type, content, note)

            processed += 1

        offset += len(memories)

        if memories and not args.dry_run:
            print(f"  Published {processed}/{total} tasks. Sleeping {args.delay}s...")
            time.sleep(args.delay)

    print(f"Done! Published {processed} mood:generate tasks.")
    conn.close()


if __name__ == "__main__":
    main()
