import logging
import redis.asyncio as redis
from app.consumers.base import RedisStreamConsumer
from app.clients.memory_client import MemoryServiceClient
from app.services.scraper import LinkScraper
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
        api_key = decrypt(encrypted_key)
    base_url = fields.get("base_url")
    return LLMFactory.create(protocol=protocol, model=model, temperature=temperature, api_key=api_key, base_url=base_url)


def _extract_llm_fields(fields: dict) -> dict:
    """Extract LLM config fields from message for propagation to derived tasks."""
    result = {}
    for key in ["llm_protocol", "llm_provider", "llm_model", "llm_temperature", "api_key", "base_url", "include_note_in_analysis", "note"]:
        if key in fields:
            result[key] = fields[key]
    return result


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
        self._redis = redis_client

    async def process_message(self, msg_id: str, fields: dict):
        memory_id = fields.get("memory_id", "")
        link_url = fields.get("link_url", "")
        if not link_url:
            raise ValueError("link_url is required")

        # Scrape the link
        scraped = await self.scraper.scrape(link_url)
        title = scraped.get("title", "")
        content = scraped.get("content", "")

        # Generate summary via LLM with per-user config
        llm = _create_llm(fields)
        summary = ""
        if content:
            include_note = fields.get("include_note_in_analysis")
            note = fields.get("note", "")
            note_section = ""
            if include_note and note:
                note_section = f"\n\n用户备注（请结合以下内容进行总结）: {note}"
                logger.info(f"[link:fetch] memory={memory_id} note_included=true note_length={len(note)}")
            else:
                logger.info(f"[link:fetch] memory={memory_id} note_included=false include_flag={include_note!r} has_note={bool(note)}")
            prompt = f"""请用2-3句简洁的中文总结以下网页内容。如提供了用户备注，请结合备注中的关注点进行总结。控制在200字以内。

标题: {title}
内容: {content[:4000]}{note_section}"""
            summary = await llm.generate(prompt, temperature=0.5, max_tokens=200)

        # Report link:fetch completion
        result = {
            "title": title,
            "summary": summary,
        }
        await self.memory_client.update_task_status(
            memory_id, "link:fetch", "completed", result=result
        )

        # Publish derived text:vectorize task with scraped content
        vectorize_content = f"{title}\n{summary}".strip()
        if vectorize_content:
            vectorize_fields = {
                "memory_id": memory_id,
                "content": vectorize_content,
            }
            # Propagate LLM config to derived task
            vectorize_fields.update(_extract_llm_fields(fields))
            await self._redis.xadd("text:vectorize", vectorize_fields, maxlen=5000, approximate=True)

    async def stop(self):
        await self.scraper.close()
        await super().stop()
