import os
from .base import LLMProvider
from .openai_provider import OpenAIProvider
from .anthropic_provider import AnthropicProvider


class LLMFactory:
    _providers = {
        "openai": OpenAIProvider,
        "anthropic": AnthropicProvider,
    }

    # OpenAI-compatible protocols: most third-party providers (Kimi, DeepSeek,
    # Moonshot, Groq, etc.) use the OpenAI API format.
    _openai_compatible = {"kimi", "deepseek", "moonshot", "groq", "azure", "openrouter"}

    @classmethod
    def create(cls, protocol: str = None, provider: str = None, model: str = None, temperature: float = None, api_key: str = None, base_url: str = None, **kwargs) -> LLMProvider:
        # protocol determines the API format (openai/anthropic)
        # provider is the display name (openai, deepseek, moonshot, etc.)
        protocol = (protocol or provider or os.getenv("LLM_PROVIDER", "openai")).lower()
        model = model or os.getenv("LLM_MODEL", "gpt-4o-mini")
        temperature = temperature if temperature is not None else float(os.getenv("LLM_TEMPERATURE", "0.7"))
        # Map OpenAI-compatible protocols to the OpenAI provider implementation
        effective = "openai" if protocol in cls._openai_compatible else protocol
        if effective not in cls._providers:
            raise ValueError(f"Unknown LLM protocol: {protocol}")
        return cls._providers[effective](model=model, temperature=temperature, api_key=api_key, base_url=base_url, **kwargs)
