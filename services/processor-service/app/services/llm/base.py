from abc import ABC, abstractmethod
from typing import List, TypedDict


class LLMMessage(TypedDict):
    role: str  # "system" | "user" | "assistant"
    content: str


class LLMProvider(ABC):
    def __init__(self, model: str, temperature: float = 0.7):
        self.model = model
        self.temperature = temperature

    @abstractmethod
    async def generate(self, prompt: str, temperature: float = None, max_tokens: int = 500, timeout: float = None) -> str:
        pass

    @abstractmethod
    async def generate_tags(self, content: str) -> List[str]:
        """Generate 3-5 concise Chinese tags (2-6 characters each)."""
        pass

    @abstractmethod
    async def chat(self, messages: List[LLMMessage], temperature: float = None, max_tokens: int = 500) -> str:
        """Generate a response given a conversation history."""
        pass

    @abstractmethod
    async def generate_suggestion(self, prompt: str, temperature: float = None, max_tokens: int = 200, timeout: float = None) -> str:
        """Generate an AI companion suggestion given a crafted prompt.

        Args:
            prompt: The fully constructed suggestion prompt.
            temperature: Override temperature for this call.
            max_tokens: Maximum tokens for the response (default 200 for ~150 Chinese chars).
            timeout: Optional timeout in seconds for the LLM API call.

        Returns:
            The generated suggestion text.
        """
        pass

    @abstractmethod
    async def analyze_sentiment(self, content: str, content_type: str = "text") -> dict:
        """Analyze sentiment of content.

        Args:
            content: The memory content to analyze.
            content_type: Type of content (text, link, file, weave).

        Returns:
            Dict with keys: sentiment (positive|neutral|negative), score (1-10), reason (str).
        """
        pass

    @abstractmethod
    async def generate_echo(self, memory_content: str, style: str, years_ago: int) -> str:
        """Generate an echo message for a memory.

        Args:
            memory_content: The memory content to echo.
            style: Echo style (warm, humorous, concise, poetic).
            years_ago: Number of years since the memory was created.

        Returns:
            Echo message string (80-150 Chinese characters).
        """
        pass
