from abc import ABC, abstractmethod
from typing import List


class LLMProvider(ABC):
    @abstractmethod
    async def generate(self, prompt: str, temperature: float = 0.7, max_tokens: int = 500) -> str:
        pass

    @abstractmethod
    async def generate_tags(self, content: str) -> List[str]:
        """Generate 3-5 concise Chinese tags (2-6 characters each)."""
        pass
