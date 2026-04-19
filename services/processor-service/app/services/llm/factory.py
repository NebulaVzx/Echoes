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
    def create(cls, provider: str = None, model: str = None, temperature: float = None, api_key: str = None, **kwargs) -> LLMProvider:
        provider = (provider or os.getenv("LLM_PROVIDER", "openai")).lower()
        model = model or os.getenv("LLM_MODEL", "gpt-4o-mini")
        temperature = temperature if temperature is not None else float(os.getenv("LLM_TEMPERATURE", "0.7"))
        if provider not in cls._providers:
            raise ValueError(f"Unknown LLM provider: {provider}")
        return cls._providers[provider](model=model, temperature=temperature, api_key=api_key, **kwargs)
