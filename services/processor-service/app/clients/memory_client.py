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

    async def close(self):
        await self.client.aclose()
