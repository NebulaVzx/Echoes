import redis.asyncio as redis
from app.consumers.base import RedisStreamConsumer
from app.clients.memory_client import MemoryServiceClient
from app.services.embedder import BGEM3Embedder


class VectorizeConsumer(RedisStreamConsumer):
    def __init__(self, redis_client: redis.Redis, memory_client: MemoryServiceClient,
                 embedder: BGEM3Embedder):
        super().__init__(
            redis_client=redis_client,
            stream="text:vectorize",
            group="vectorizer-group",
            consumer="vectorizer-1",
            memory_client=memory_client,
            max_retries=3,
        )
        self.embedder = embedder

    async def process_message(self, msg_id: str, fields: dict):
        memory_id = fields.get("memory_id", "")
        content = fields.get("content", "")
        if not content:
            raise ValueError("content is required")

        # Encode to vector
        vector = self.embedder.encode(content)
        if not vector or len(vector) != self.embedder.dimension:
            raise ValueError(f"Invalid vector: expected {self.embedder.dimension} dims, got {len(vector) if vector else 0}")

        # Report result with vector
        result = {"vector": vector}
        await self.memory_client.update_task_status(
            memory_id, "text:vectorize", "completed", result=result
        )
