import redis.asyncio as redis
from app.consumers.base import RedisStreamConsumer
from app.clients.memory_client import MemoryServiceClient
from app.services.llm.factory import LLMFactory
from app.config import settings


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
        self.llm = LLMFactory.create(settings.llm_provider, settings.llm_model)

    async def process_message(self, msg_id: str, fields: dict):
        memory_id = fields.get("memory_id", "")
        content = fields.get("content", "")
        if not content:
            raise ValueError("content is required")

        tags = await self.llm.generate_tags(content)
        if not tags:
            raise ValueError("LLM returned no tags")

        result = {"tags": tags}
        await self.memory_client.update_task_status(
            memory_id, "tag:generate", "completed", result=result
        )
