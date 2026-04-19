from abc import ABC, abstractmethod
from typing import List


class LLMProvider(ABC):
    def __init__(self, model: str, temperature: float = 0.7):
        self.model = model
        self.temperature = temperature

    @abstractmethod
    async def generate(self, prompt: str, temperature: float = None, max_tokens: int = 500) -> str:
        pass

    @abstractmethod
    async def generate_tags(self, content: str) -> List[str]:
        """Generate 3-5 concise Chinese tags (2-6 characters each)."""
        pass
