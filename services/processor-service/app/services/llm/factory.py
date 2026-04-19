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
    def create(cls, provider: str = None, model: str = None, **kwargs) -> LLMProvider:
        provider = (provider or os.getenv("LLM_PROVIDER", "openai")).lower()
        model = model or os.getenv("LLM_MODEL", "gpt-4o-mini")
        if provider not in cls._providers:
            raise ValueError(f"Unknown LLM provider: {provider}")
        return cls._providers[provider](model=model, **kwargs)
