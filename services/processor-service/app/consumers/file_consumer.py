import logging
import os
import tempfile

import httpx
import redis.asyncio as redis
from minio import Minio
from app.consumers.base import RedisStreamConsumer
from app.clients.memory_client import MemoryServiceClient
from app.services.file_extractor import extract_text

logger = logging.getLogger(__name__)


def _get_minio_client():
    """Create MinIO client from environment variables."""
    endpoint = os.getenv("MINIO_ENDPOINT", "echoes-minio:9000")
    access_key = os.getenv("MINIO_ACCESS_KEY", "echoes_minio")
    secret_key = os.getenv("MINIO_SECRET_KEY", "echoes_minio_secret")
    secure = os.getenv("MINIO_SECURE", "false").lower() == "true"
    return Minio(endpoint, access_key=access_key, secret_key=secret_key, secure=secure)


class FileConsumer(RedisStreamConsumer):
    def __init__(self, redis_client: redis.Redis, memory_client: MemoryServiceClient):
        super().__init__(
            redis_client=redis_client,
            stream="file:extract",
            group="processor-group",
            consumer="processor-file-1",
            memory_client=memory_client,
            max_retries=3,
        )
        self._redis = redis_client
        self._http = httpx.AsyncClient(timeout=30.0)
        self._minio = _get_minio_client()

    async def process_message(self, msg_id: str, fields: dict):
        memory_id = fields.get("memory_id", "")
        file_name = fields.get("file_name", "")
        media_url = fields.get("media_url", "")

        if not media_url:
            raise ValueError("media_url is required for file extraction")

        # Determine file type from extension
        file_ext = os.path.splitext(file_name)[1].lower()
        if file_ext not in (".txt", ".md", ".docx"):
            raise ValueError(f"Unsupported file type: {file_ext}")

        # Download file from MinIO to temp location
        suffix = file_ext if file_ext else ".tmp"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp_path = tmp.name

        try:
            # Try MinIO direct download first (handles private buckets)
            # Parse bucket/object from URL: http://host:port/bucket/object-path
            url_parts = media_url.replace("http://", "").replace("https://", "").split("/")
            if len(url_parts) >= 3:
                bucket = url_parts[1]
                object_name = "/".join(url_parts[2:])
                try:
                    self._minio.fget_object(bucket, object_name, tmp_path)
                    logger.info(f"[file:extract] memory={memory_id} downloaded via MinIO client")
                except Exception as e:
                    logger.warning(f"[file:extract] MinIO download failed, falling back to HTTP: {e}")
                    resp = await self._http.get(media_url)
                    resp.raise_for_status()
                    with open(tmp_path, "wb") as f:
                        f.write(resp.content)
            else:
                resp = await self._http.get(media_url)
                resp.raise_for_status()
                with open(tmp_path, "wb") as f:
                    f.write(resp.content)

            # Extract text
            logger.info(f"[file:extract] memory={memory_id} extracting text from {file_name}")
            extracted_text = extract_text(tmp_path, file_ext)
            logger.info(f"[file:extract] memory={memory_id} extracted {len(extracted_text)} chars")

            # Update memory text_content via internal API
            await self._update_memory_text(memory_id, extracted_text)

            # Report completion
            await self.memory_client.update_task_status(
                memory_id, "file:extract", "completed",
                result={"chars_extracted": len(extracted_text), "file_name": file_name}
            )

            # Publish derived tasks: vectorize + tag generate + suggestion generate
            vectorize_fields = {
                "memory_id": memory_id,
                "content": extracted_text,
            }
            # Propagate LLM config if present
            for key in ["llm_protocol", "llm_provider", "llm_model", "llm_temperature", "api_key", "base_url"]:
                if key in fields:
                    vectorize_fields[key] = fields[key]

            await self._redis.xadd("text:vectorize", vectorize_fields, maxlen=5000, approximate=True)

            tag_fields = {
                "memory_id": memory_id,
                "content": extracted_text,
            }
            if "note" in fields:
                tag_fields["note"] = fields["note"]
            for key in ["llm_protocol", "llm_provider", "llm_model", "llm_temperature", "api_key", "base_url"]:
                if key in fields:
                    tag_fields[key] = fields[key]

            await self._redis.xadd("tag:generate", tag_fields, maxlen=5000, approximate=True)

            # Publish suggestion:generate with file content treated as text
            suggestion_fields = {
                "memory_id": memory_id,
                "content_type": "text",
                "content": extracted_text,
                "style": fields.get("style", "inspiring"),
                "timeout": fields.get("timeout", 30),
                "max_retries": fields.get("max_retries", 3),
            }
            if "note" in fields:
                suggestion_fields["note"] = fields["note"]
            for key in ["llm_protocol", "llm_provider", "llm_model", "llm_temperature", "api_key", "base_url"]:
                if key in fields:
                    suggestion_fields[key] = fields[key]

            await self._redis.xadd("suggestion:generate", suggestion_fields, maxlen=5000, approximate=True)

        finally:
            # Clean up temp file
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    async def _update_memory_text(self, memory_id: str, text_content: str):
        """Update memory's text_content via internal PATCH API."""
        token = os.getenv("INTERNAL_API_TOKEN", "")
        memory_service_url = os.getenv("MEMORY_SERVICE_URL", "http://memory-service:8002")
        headers = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"

        resp = await self._http.patch(
            f"{memory_service_url}/api/v1/internal/memories/{memory_id}/text",
            json={"text_content": text_content},
            headers=headers,
        )
        resp.raise_for_status()

    async def stop(self):
        await self._http.aclose()
        await super().stop()
