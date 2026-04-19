import os
from typing import List
import asyncio
from anthropic import AsyncAnthropic
from anthropic import RateLimitError as AnthropicRateLimitError
from .base import LLMProvider


class AnthropicProvider(LLMProvider):
    def __init__(self, model: str = "claude-sonnet-4-20250514", api_key: str = None, temperature: float = 0.7):
        super().__init__(model=model, temperature=temperature)
        self.client = AsyncAnthropic(api_key=api_key or os.getenv("ANTHROPIC_API_KEY"))

    async def generate(self, prompt: str, temperature: float = None, max_tokens: int = 500) -> str:
        temp = temperature if temperature is not None else self.temperature
        for attempt in range(3):
            try:
                resp = await asyncio.wait_for(
                    self.client.messages.create(
                        model=self.model,
                        max_tokens=max_tokens,
                        temperature=temp,
                        messages=[{"role": "user", "content": prompt}],
                    ),
                    timeout=30.0,
                )
                return resp.content[0].text
            except AnthropicRateLimitError:
                wait = 2 ** attempt
                await asyncio.sleep(wait)
            except asyncio.TimeoutError:
                if attempt == 2:
                    raise
                await asyncio.sleep(1)
        raise RuntimeError("Anthropic generate failed after 3 attempts")

    async def generate_tags(self, content: str) -> List[str]:
        prompt = f"""Based on the following content, generate 3-5 concise Chinese tags (each 2-6 characters).
Tags should be nouns or noun phrases that capture key topics.
Output format: comma-separated list only, no explanation.

Content: {content[:2000]}"""
        result = await self.generate(prompt, temperature=0.3, max_tokens=100)
        tags = [t.strip() for t in result.split(",") if t.strip()]
        return tags[:5]
