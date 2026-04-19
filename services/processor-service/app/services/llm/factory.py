import os
from .base import LLMProvider
from .openai_provider import OpenAIProvider
from .anthropic_provider import AnthropicProvider


class LLMFactory:
    _providers = {
        "openai": OpenAIProvider,
        "anthropic": AnthropicProvider,
    }

    @classmethod
    def create(cls, protocol: str = None, provider: str = None, model: str = None, temperature: float = None, api_key: str = None, base_url: str = None, **kwargs) -> LLMProvider:
        # protocol determines the API format (openai/anthropic)
        # provider is the display name (openai, deepseek, moonshot, etc.)
        protocol = (protocol or provider or os.getenv("LLM_PROVIDER", "openai")).lower()
        model = model or os.getenv("LLM_MODEL", "gpt-4o-mini")
        temperature = temperature if temperature is not None else float(os.getenv("LLM_TEMPERATURE", "0.7"))
        if protocol not in cls._providers:
            raise ValueError(f"Unknown LLM protocol: {protocol}")
        return cls._providers[protocol](model=model, temperature=temperature, api_key=api_key, base_url=base_url, **kwargs)
