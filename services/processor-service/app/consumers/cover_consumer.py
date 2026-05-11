"""Cover generation consumer for memory covers.

Processes cover:generate messages from Redis Stream, generates cover images
via DALL-E 3 (with Pollinations.AI fallback), crops to 400x300, uploads to MinIO,
and writes cover_url back to the memory via internal API.
"""

import logging
import os

import redis.asyncio as redis
from app.consumers.base import RedisStreamConsumer
from app.clients.memory_client import MemoryServiceClient
from app.services.image_processor import (
    _build_prompt,
    _extract_title_and_summary,
    crop_cover,
    create_fallback_cover,
    fetch_og_image,
    generate_cover_image,
    generate_cover_pollinations,
    get_minio_client,
    upload_cover_to_minio,
)
from app.config import settings

logger = logging.getLogger(__name__)


class CoverConsumer(RedisStreamConsumer):
    """Consumer that generates cover images for memories."""

    def __init__(self, redis_client: redis.Redis, memory_client: MemoryServiceClient):
        super().__init__(
            redis_client=redis_client,
            stream="cover:generate",
            group="processor-group",
            consumer="processor-cover-1",
            memory_client=memory_client,
            max_retries=3,
        )
        self._minio = get_minio_client()

    async def process_message(self, msg_id: str, fields: dict):
        memory_id = fields.get("memory_id", "")
        content_type = fields.get("content_type", "text")
        content = fields.get("content", "")
        link_url = fields.get("link_url", "")
        link_title = fields.get("link_title", "")
        tags_str = fields.get("tags", "")
        tags = [t.strip() for t in tags_str.split(",") if t.strip()] if tags_str else []
        user_id = fields.get("user_id", "")

        logger.info(f"[cover:generate] memory={memory_id} type={content_type}")

        image_data = None
        cover_url = None

        # Strategy 1: For links, try og:image first
        if content_type == "link" and link_url:
            og_image_bytes = await fetch_og_image(link_url)
            if og_image_bytes:
                try:
                    from PIL import Image
                    img = Image.open(__import__("io").BytesIO(og_image_bytes))
                    image_data = crop_cover(img)
                    logger.info(f"[cover:generate] memory={memory_id} used og:image")
                except Exception as e:
                    logger.warning(f"[cover:generate] memory={memory_id} og:image invalid: {e}")

        # Strategy 2: Generate AI cover (DALL-E 3 -> Pollinations fallback)
        if image_data is None:
            title, summary = _extract_title_and_summary(content, content_type, link_title, link_url)
            prompt = _build_prompt(title, summary)
            logger.info(f"[cover:generate] memory={memory_id} prompt={prompt[:80]}...")

            # Try DALL-E 3
            dall_e_failed = False
            api_key = None
            encrypted_key = fields.get("api_key")
            if encrypted_key:
                from app.crypto import decrypt
                api_key = decrypt(encrypted_key)
            else:
                api_key = os.getenv("OPENAI_API_KEY", "")

            if api_key:
                try:
                    img = await generate_cover_image(prompt, api_key)
                    image_data = crop_cover(img)
                    logger.info(f"[cover:generate] memory={memory_id} DALL-E 3 success")
                except Exception as e:
                    logger.warning(f"[cover:generate] memory={memory_id} DALL-E 3 failed: {e}")
                    dall_e_failed = True
            else:
                dall_e_failed = True
                logger.info(f"[cover:generate] memory={memory_id} no API key, skipping DALL-E 3")

            # Fallback to Pollinations.AI
            if dall_e_failed and settings.use_pollinations_fallback:
                try:
                    img = await generate_cover_pollinations(prompt)
                    image_data = crop_cover(img)
                    logger.info(f"[cover:generate] memory={memory_id} Pollinations.AI success")
                except Exception as e:
                    logger.warning(f"[cover:generate] memory={memory_id} Pollinations.AI failed: {e}")

        # Strategy 3: Fallback cover (solid color + letter)
        if image_data is None:
            first_tag = tags[0] if tags else "?"
            image_data = create_fallback_cover(first_tag)
            logger.info(f"[cover:generate] memory={memory_id} used fallback cover")

        # Upload to MinIO
        if image_data and user_id and memory_id:
            try:
                cover_url = upload_cover_to_minio(self._minio, user_id, memory_id, image_data)
                logger.info(f"[cover:generate] memory={memory_id} uploaded to {cover_url}")
            except Exception as e:
                logger.error(f"[cover:generate] memory={memory_id} MinIO upload failed: {e}")
                raise RuntimeError(f"MinIO upload failed: {e}")

        if not cover_url:
            raise RuntimeError("Failed to generate or upload cover image")

        # Report completion with cover_url
        result = {"cover_url": cover_url}
        await self.memory_client.update_task_status(
            memory_id, "cover:generate", "completed", result=result
        )
