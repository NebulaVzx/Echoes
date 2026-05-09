import base64
import io
import os
from typing import List
import asyncio
from openai import AsyncOpenAI, RateLimitError
from PIL import Image
from .base import LLMProvider, LLMMessage


class OpenAIProvider(LLMProvider):
    def __init__(self, model: str = "gpt-4o-mini", api_key: str = None, temperature: float = 0.7, base_url: str = None):
        super().__init__(model=model, temperature=temperature)
        client_kwargs = {"api_key": api_key or os.getenv("OPENAI_API_KEY")}
        if base_url:
            client_kwargs["base_url"] = base_url.rstrip("/")
        self.client = AsyncOpenAI(**client_kwargs)

    async def generate(self, prompt: str, temperature: float = None, max_tokens: int = 500, timeout: float = None) -> str:
        temp = temperature if temperature is not None else self.temperature
        api_timeout = timeout if timeout is not None else 30.0
        for attempt in range(3):
            try:
                resp = await asyncio.wait_for(
                    self.client.chat.completions.create(
                        model=self.model,
                        messages=[{"role": "user", "content": prompt}],
                        temperature=temp,
                        max_tokens=max_tokens,
                    ),
                    timeout=api_timeout,
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
If the content includes user notes (marked with 备注:), consider them alongside the main content.
Output format: comma-separated list only, no explanation.

Content: {content[:2000]}"""
        result = await self.generate(prompt, temperature=0.3, max_tokens=100)
        tags = [t.strip() for t in result.split(",") if t.strip()]
        return tags[:5]

    async def chat(self, messages: List[LLMMessage], temperature: float = None, max_tokens: int = 500, timeout: float = None) -> str:
        temp = temperature if temperature is not None else self.temperature
        api_timeout = timeout if timeout is not None else 30.0
        for attempt in range(3):
            try:
                resp = await asyncio.wait_for(
                    self.client.chat.completions.create(
                        model=self.model,
                        messages=messages,
                        temperature=temp,
                        max_tokens=max_tokens,
                    ),
                    timeout=api_timeout,
                )
                return resp.choices[0].message.content
            except RateLimitError:
                wait = 2 ** attempt
                await asyncio.sleep(wait)
            except asyncio.TimeoutError:
                if attempt == 2:
                    raise
                await asyncio.sleep(1)
        raise RuntimeError("OpenAI chat failed after 3 attempts")

    async def generate_suggestion(self, prompt: str, temperature: float = None, max_tokens: int = 200, timeout: float = None) -> str:
        """Generate a suggestion using the standard generate with suggestion-optimized defaults."""
        # Suggestions should be warm and slightly creative; use temperature 0.8 default
        temp = temperature if temperature is not None else 0.8
        return await self.generate(prompt, temperature=temp, max_tokens=max_tokens, timeout=timeout)

    async def generate_image(self, prompt: str, size: str = "1024x1024", quality: str = "standard") -> Image.Image:
        """Generate image using DALL-E 3. Returns PIL Image.

        Args:
            prompt: English prompt for image generation.
            size: Image size (1024x1024, 1024x1536, 1536x1024). Default 1024x1024.
            quality: "standard" or "hd". Default "standard".

        Returns:
            PIL Image object decoded from b64_json response.

        Raises:
            RuntimeError: If image generation fails.
        """
        resp = await self.client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size=size,
            quality=quality,
            response_format="b64_json",
            n=1,
        )
        b64_data = resp.data[0].b64_json
        image_bytes = base64.b64decode(b64_data)
        return Image.open(io.BytesIO(image_bytes))
