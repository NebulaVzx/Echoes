import json
import os
import re
from typing import List
import asyncio
from anthropic import AsyncAnthropic
from anthropic import RateLimitError as AnthropicRateLimitError
from .base import LLMProvider, LLMMessage


def _normalize_base_url(base_url: str | None) -> str | None:
    """Strip /v1 suffix if present; AsyncAnthropic appends it internally."""
    if not base_url:
        return None
    base_url = base_url.rstrip("/")
    if base_url.endswith("/v1"):
        base_url = base_url[:-3]
    return base_url or None


class AnthropicProvider(LLMProvider):
    def __init__(self, model: str = "claude-sonnet-4-20250514", api_key: str = None, temperature: float = 0.7, base_url: str = None):
        super().__init__(model=model, temperature=temperature)
        client_kwargs = {"api_key": api_key or os.getenv("ANTHROPIC_API_KEY")}
        normalized = _normalize_base_url(base_url)
        if normalized:
            client_kwargs["base_url"] = normalized
        self.client = AsyncAnthropic(**client_kwargs)

    async def generate(self, prompt: str, temperature: float = None, max_tokens: int = 500, timeout: float = None) -> str:
        temp = temperature if temperature is not None else self.temperature
        api_timeout = timeout if timeout is not None else 30.0
        for attempt in range(3):
            try:
                resp = await asyncio.wait_for(
                    self.client.messages.create(
                        model=self.model,
                        max_tokens=max_tokens,
                        temperature=temp,
                        messages=[{"role": "user", "content": prompt}],
                    ),
                    timeout=api_timeout,
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
If the content includes user notes (marked with 备注:), consider them alongside the main content.
Output format: comma-separated list only, no explanation.

Content: {content[:2000]}"""
        result = await self.generate(prompt, temperature=0.3, max_tokens=100)
        tags = [t.strip() for t in result.split(",") if t.strip()]
        return tags[:5]

    async def chat(self, messages: List[LLMMessage], temperature: float = None, max_tokens: int = 500, timeout: float = None) -> str:
        temp = temperature if temperature is not None else self.temperature
        api_timeout = timeout if timeout is not None else 30.0
        # Anthropic uses "system" as top-level param, not in messages array
        system_msg = None
        chat_messages = []
        for m in messages:
            if m["role"] == "system":
                system_msg = m["content"]
            else:
                chat_messages.append({"role": m["role"], "content": m["content"]})

        for attempt in range(3):
            try:
                kwargs = {
                    "model": self.model,
                    "max_tokens": max_tokens,
                    "temperature": temp,
                    "messages": chat_messages,
                }
                if system_msg:
                    kwargs["system"] = system_msg

                resp = await asyncio.wait_for(
                    self.client.messages.create(**kwargs),
                    timeout=api_timeout,
                )
                return resp.content[0].text
            except AnthropicRateLimitError:
                wait = 2 ** attempt
                await asyncio.sleep(wait)
            except asyncio.TimeoutError:
                if attempt == 2:
                    raise
                await asyncio.sleep(1)
        raise RuntimeError("Anthropic chat failed after 3 attempts")

    async def generate_suggestion(self, prompt: str, temperature: float = None, max_tokens: int = 200, timeout: float = None) -> str:
        """Generate a suggestion using the standard generate with suggestion-optimized defaults."""
        # Suggestions should be warm and slightly creative; use temperature 0.8 default
        temp = temperature if temperature is not None else 0.8
        return await self.generate(prompt, temperature=temp, max_tokens=max_tokens, timeout=timeout)

    async def analyze_sentiment(self, content: str, content_type: str = "text") -> dict:
        """Analyze sentiment of content using LLM.

        Returns:
            Dict with keys: sentiment (positive|neutral|negative), score (1-10), reason (str).
        """
        from .prompts.sentiment_prompts import build_sentiment_prompt
        prompt = build_sentiment_prompt(content, content_type)
        result = await self.generate(prompt, temperature=0.3, max_tokens=200, timeout=15.0)
        return self._parse_sentiment_result(result)

    async def generate_echo(self, memory_content: str, style: str, years_ago: int) -> str:
        """Generate an echo message for a memory.

        Returns:
            Echo message string (80-150 Chinese characters).
        """
        from .prompts.echo_prompts import build_echo_prompt
        prompt = build_echo_prompt(memory_content, style, years_ago)
        return await self.generate(prompt, temperature=0.8, max_tokens=300, timeout=15.0)

    def _parse_sentiment_result(self, result: str) -> dict:
        """Parse sentiment analysis result from LLM output.
        Handles both JSON and plain text formats with fallback.
        """
        # Try to extract JSON from the response
        try:
            # Look for JSON object in the response
            json_match = re.search(r'\{[^}]*"sentiment"[^}]*\}', result)
            if json_match:
                data = json.loads(json_match.group())
                sentiment = data.get("sentiment", "neutral")
                score = int(data.get("score", 5))
                reason = data.get("reason", "")
            else:
                # Try parsing the whole response as JSON
                data = json.loads(result)
                sentiment = data.get("sentiment", "neutral")
                score = int(data.get("score", 5))
                reason = data.get("reason", "")
        except (json.JSONDecodeError, ValueError):
            # Fallback: parse from text
            sentiment = "neutral"
            if "积极" in result or "positive" in result.lower():
                sentiment = "positive"
            elif "消极" in result or "negative" in result.lower():
                sentiment = "negative"

            score = 5
            score_match = re.search(r'(\d+)', result)
            if score_match:
                score = max(1, min(10, int(score_match.group(1))))

            reason = result[:100] if len(result) > 100 else result

        # Validate sentiment
        if sentiment not in ("positive", "neutral", "negative"):
            sentiment = "neutral"

        # Validate score
        score = max(1, min(10, score))

        return {
            "sentiment": sentiment,
            "score": score,
            "reason": reason,
        }
