import redis.asyncio as redis
from app.consumers.base import RedisStreamConsumer
from app.clients.memory_client import MemoryServiceClient
from app.services.scraper import LinkScraper
from app.services.llm.factory import LLMFactory
from app.config import settings


class LinkConsumer(RedisStreamConsumer):
    def __init__(self, redis_client: redis.Redis, memory_client: MemoryServiceClient):
        super().__init__(
            redis_client=redis_client,
            stream="link:fetch",
            group="processor-group",
            consumer="processor-link-1",
            memory_client=memory_client,
            max_retries=3,
        )
        self.scraper = LinkScraper()
        self.llm = LLMFactory.create(settings.llm_provider, settings.llm_model)
        self._redis = redis_client  # Keep reference for publishing derived tasks

    async def process_message(self, msg_id: str, fields: dict):
        memory_id = fields.get("memory_id", "")
        link_url = fields.get("link_url", "")
        if not link_url:
            raise ValueError("link_url is required")

        # Scrape the link
        scraped = await self.scraper.scrape(link_url)
        title = scraped.get("title", "")
        content = scraped.get("content", "")

        # Generate summary via LLM
        summary = ""
        if content:
            prompt = f"""Summarize the following web page content in 2-3 concise Chinese sentences.
Focus on the main points. Keep it under 200 characters.

Title: {title}
Content: {content[:4000]}"""
            summary = await self.llm.generate(prompt, temperature=0.5, max_tokens=200)

        # Report link:fetch completion
        result = {
            "title": title,
            "summary": summary,
        }
        await self.memory_client.update_task_status(
            memory_id, "link:fetch", "completed", result=result
        )

        # Publish derived text:vectorize task with scraped content
        # Per RESEARCH.md Q3: link memories need vectorization with meaningful content
        vectorize_content = f"{title}\n{summary}".strip()
        if vectorize_content:
            await self._redis.xadd(
                "text:vectorize",
                {
                    "memory_id": memory_id,
                    "content": vectorize_content,
                }
            )

    async def stop(self):
        await self.scraper.close()
        await super().stop()
