import logging
import time
import redis.asyncio as redis
from app.consumers.base import RedisStreamConsumer
from app.clients.memory_client import MemoryServiceClient
from app.services.llm.factory import LLMFactory
from app.services.llm.prompts.suggestion_prompts import (
    build_text_suggestion_prompt,
    build_link_suggestion_prompt,
    determine_suggestion_type,
)
from app.config import settings
from app.crypto import decrypt

logger = logging.getLogger(__name__)


def _create_llm(fields: dict):
    """Create LLM provider with per-message overrides, decrypting API key if present."""
    protocol = fields.get("llm_protocol") or fields.get("llm_provider") or settings.llm_provider
    model = fields.get("llm_model") or settings.llm_model
    temp_raw = fields.get("llm_temperature")
    temperature = float(temp_raw) if temp_raw is not None else settings.llm_temperature
    api_key = None
    encrypted_key = fields.get("api_key")
    if encrypted_key:
        api_key = decrypt(encrypted_key)
    base_url = fields.get("base_url")
    return LLMFactory.create(protocol=protocol, model=model, temperature=temperature, api_key=api_key, base_url=base_url)


class SuggestionConsumer(RedisStreamConsumer):
    def __init__(self, redis_client: redis.Redis, memory_client: MemoryServiceClient):
        super().__init__(
            redis_client=redis_client,
            stream="suggestion:generate",
            group="processor-group",
            consumer="processor-suggestion-1",
            memory_client=memory_client,
            max_retries=3,
        )

    async def process_message(self, msg_id: str, fields: dict):
        memory_id = fields.get("memory_id", "")
        content_type = fields.get("content_type", "")
        content = fields.get("content", "")
        style = fields.get("style", "inspiring")
        note = fields.get("note", "")

        if not content:
            raise ValueError("content is required")

        logger.info(f"[suggestion:generate] memory={memory_id} type={content_type} style={style}")

        # Build the appropriate prompt based on content type
        if content_type == "text":
            prompt = build_text_suggestion_prompt(content, note, style)
        elif content_type == "link":
            # For links, content is the URL; we don't have title/summary here
            # The link_consumer may have already fetched them, but we work with what we have
            prompt = build_link_suggestion_prompt(content, "", "", note, style)
        else:
            raise ValueError(f"unknown content_type: {content_type}")

        # Generate suggestion with timing
        llm = _create_llm(fields)
        start_time = time.time()
        suggestion_text = await llm.generate_suggestion(prompt, temperature=0.8, max_tokens=200)
        latency_ms = int((time.time() - start_time) * 1000)

        if not suggestion_text or not suggestion_text.strip():
            raise ValueError("LLM returned empty suggestion")

        suggestion_text = suggestion_text.strip()
        logger.info(f"[suggestion:generate] memory={memory_id} latency={latency_ms}ms length={len(suggestion_text)}")

        # Determine suggestion type heuristically
        suggestion_type = determine_suggestion_type(content_type, suggestion_text)

        # Build metadata
        metadata = {
            "model": fields.get("llm_model") or settings.llm_model,
            "temperature": 0.8,
            "latency_ms": latency_ms,
        }

        # Persist suggestion via Memory Service internal API
        await self.memory_client.create_suggestion(
            memory_id=memory_id,
            content=suggestion_text,
            suggestion_type=suggestion_type,
            metadata=metadata,
        )

        # Report task completion
        result = {
            "suggestion": suggestion_text,
            "suggestion_type": suggestion_type,
        }
        await self.memory_client.update_task_status(
            memory_id, "suggestion:generate", "completed", result=result
        )
