import asyncio
import torch
import numpy as np
from sentence_transformers import SentenceTransformer
from app.config import settings


class BGEM3Embedder:
    def __init__(self, model_name: str = None, device: str = None):
        self.model_name = model_name or settings.model_name
        self.device = device or settings.device
        if self.device == "auto":
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model = None

    async def load(self):
        """Load model asynchronously to avoid blocking event loop."""
        loop = asyncio.get_event_loop()
        self.model = await loop.run_in_executor(
            None,
            lambda: SentenceTransformer(self.model_name, device=self.device)
        )
        print(f"BGE-M3 loaded on {self.device}")

    def encode(self, text: str) -> list:
        """Encode text to 1024-dim vector, return as list for JSON serialization."""
        if self.model is None:
            raise RuntimeError("Model not loaded. Call load() first.")
        if not text or not text.strip():
            raise ValueError("Text cannot be empty")
        embedding = self.model.encode(text, normalize_embeddings=True)
        return embedding.tolist()

    @property
    def dimension(self) -> int:
        return 1024

    @property
    def is_loaded(self) -> bool:
        return self.model is not None
