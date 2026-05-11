import logging
import redis.asyncio as redis
from app.consumers.base import RedisStreamConsumer
from app.clients.memory_client import MemoryServiceClient
from app.services.llm.factory import LLMFactory
from app.config import settings
from app.crypto import decrypt

logger = logging.getLogger(__name__)


def _create_llm(fields: dict):
    """Create LLM provider with per-message overrides, decrypting API key if present."""
    protocol = fields.get("llm_protocol") or fields.get("llm_provider") or settings.llm_protocol or settings.llm_provider
    model = fields.get("llm_model") or settings.llm_model
    temp_raw = fields.get("llm_temperature")
    temperature = float(temp_raw) if temp_raw is not None else settings.llm_temperature
    api_key = None
    encrypted_key = fields.get("api_key")
    if encrypted_key:
        try:
            api_key = decrypt(encrypted_key)
        except Exception:
            # Memory-service now decrypts before publishing; use as-is
            api_key = encrypted_key
    base_url = fields.get("base_url")
    return LLMFactory.create(protocol=protocol, model=model, temperature=temperature, api_key=api_key, base_url=base_url)


class TagConsumer(RedisStreamConsumer):
    def __init__(self, redis_client: redis.Redis, memory_client: MemoryServiceClient):
        super().__init__(
            redis_client=redis_client,
            stream="tag:generate",
            group="processor-group",
            consumer="processor-tag-1",
            memory_client=memory_client,
            max_retries=3,
        )

    async def process_message(self, msg_id: str, fields: dict):
        memory_id = fields.get("memory_id", "")
        content = fields.get("content", "")
        if not content:
            raise ValueError("content is required")

        # Append note to content if user enabled this option
        include_note = fields.get("include_note_in_analysis")
        note = fields.get("note", "")
        original_content = content
        if include_note and note:
            content = f"{content}\n\n备注: {note}"
            logger.info(f"[tag:generate] memory={memory_id} note_included=true note_length={len(note)}")
        else:
            logger.info(f"[tag:generate] memory={memory_id} note_included=false include_flag={include_note!r} has_note={bool(note)}")

        llm = _create_llm(fields)
        tags = await llm.generate_tags(content)
        if not tags:
            raise ValueError("LLM returned no tags")

        logger.info(f"[tag:generate] memory={memory_id} tags={tags}")
        result = {"tags": tags}
        await self.memory_client.update_task_status(
            memory_id, "tag:generate", "completed", result=result
        )
