import redis.asyncio as redis
from app.consumers.base import RedisStreamConsumer
from app.clients.memory_client import MemoryServiceClient
from app.services.llm.factory import LLMFactory
from app.config import settings
from app.crypto import decrypt


def _create_llm(fields: dict):
    """Create LLM provider with per-message overrides, decrypting API key if present."""
    provider = fields.get("llm_provider") or settings.llm_provider
    model = fields.get("llm_model") or settings.llm_model
    temp_raw = fields.get("llm_temperature")
    temperature = float(temp_raw) if temp_raw is not None else settings.llm_temperature
    api_key = None
    encrypted_key = fields.get("api_key")
    if encrypted_key:
        api_key = decrypt(encrypted_key)
    return LLMFactory.create(provider=provider, model=model, temperature=temperature, api_key=api_key)


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

        llm = _create_llm(fields)
        tags = await llm.generate_tags(content)
        if not tags:
            raise ValueError("LLM returned no tags")

        result = {"tags": tags}
        await self.memory_client.update_task_status(
            memory_id, "tag:generate", "completed", result=result
        )
