import os
from typing import List
import asyncio
from openai import AsyncOpenAI, RateLimitError
from .base import LLMProvider


class OpenAIProvider(LLMProvider):
    def __init__(self, model: str = "gpt-4o-mini", api_key: str = None, temperature: float = 0.7):
        super().__init__(model=model, temperature=temperature)
        self.client = AsyncOpenAI(api_key=api_key or os.getenv("OPENAI_API_KEY"))

    async def generate(self, prompt: str, temperature: float = None, max_tokens: int = 500) -> str:
        temp = temperature if temperature is not None else self.temperature
        for attempt in range(3):
            try:
                resp = await asyncio.wait_for(
                    self.client.chat.completions.create(
                        model=self.model,
                        messages=[{"role": "user", "content": prompt}],
                        temperature=temp,
                        max_tokens=max_tokens,
                    ),
                    timeout=30.0,
                )
                return resp.choices[0].message.content
            except RateLimitError:
                wait = 2 ** attempt
                await asyncio.sleep(wait)
            except asyncio.TimeoutError:
                if attempt == 2:
                    raise
                await asyncio.sleep(1)
        raise RuntimeError("OpenAI generate failed after 3 attempts")

    async def generate_tags(self, content: str) -> List[str]:
        prompt = f"""Based on the following content, generate 3-5 concise Chinese tags (each 2-6 characters).
Tags should be nouns or noun phrases that capture key topics.
Output format: comma-separated list only, no explanation.

Content: {content[:2000]}"""
        result = await self.generate(prompt, temperature=0.3, max_tokens=100)
        tags = [t.strip() for t in result.split(",") if t.strip()]
        return tags[:5]
