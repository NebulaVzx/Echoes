import os
import httpx
from typing import Optional


class MemoryServiceClient:
    def __init__(self, base_url: str = None, token: str = None):
        self.base_url = base_url or os.getenv("MEMORY_SERVICE_URL", "http://memory-service:8002")
        self.token = token or os.getenv("INTERNAL_API_TOKEN", "")
        self.client = httpx.AsyncClient(timeout=15.0)

    async def update_task_status(self, memory_id: str, task_type: str,
                                  status: str, error: str = None,
                                  result: dict = None):
        payload = {
            "task_type": task_type,
            "status": status,
        }
        if error:
            payload["error"] = error
        if result:
            payload["result"] = result

        headers = {}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        resp = await self.client.patch(
            f"{self.base_url}/api/v1/internal/memories/{memory_id}/tasks",
            json=payload,
            headers=headers,
        )
        resp.raise_for_status()
        return resp.json()

    async def create_suggestion(self, memory_id: str, content: str,
                                 suggestion_type: str = None,
                                 metadata: dict = None):
        """Create an AI suggestion for a memory via the internal API.

        Args:
            memory_id: The memory UUID.
            content: The generated suggestion text.
            suggestion_type: Optional type classification.
            metadata: Optional generation metadata (model, temperature, tokens, latency).

        Returns:
            The JSON response from the Memory Service.
        """
        payload = {
            "memory_id": memory_id,
            "content": content,
        }
        if suggestion_type:
            payload["suggestion_type"] = suggestion_type
        if metadata:
            payload["metadata"] = metadata

        headers = {}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        resp = await self.client.post(
            f"{self.base_url}/api/v1/internal/memories/{memory_id}/suggestion",
            json=payload,
            headers=headers,
        )
        resp.raise_for_status()
        return resp.json()

    async def close(self):
        await self.client.aclose()
