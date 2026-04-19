import asyncio
import redis.asyncio as redis
from abc import ABC, abstractmethod
from typing import Optional
from app.clients.memory_client import MemoryServiceClient


class RedisStreamConsumer(ABC):
    def __init__(self, redis_client: redis.Redis, stream: str, group: str,
                 consumer: str, memory_client: MemoryServiceClient,
                 max_retries: int = 3):
        self.redis = redis_client
        self.stream = stream
        self.group = group
        self.consumer = consumer
        self.memory_client = memory_client
        self.max_retries = max_retries
        self._shutdown = asyncio.Event()
        self._task: Optional[asyncio.Task] = None
        self._pending_recovered = False

    async def start(self):
        try:
            await self.redis.xgroup_create(
                name=self.stream, groupname=self.group,
                id="0", mkstream=True
            )
        except redis.ResponseError as e:
            if "BUSYGROUP" not in str(e):
                raise
        self._task = asyncio.create_task(self._run())

    async def _run(self):
        while not self._shutdown.is_set():
            try:
                # Phase 1: Recover pending messages from previous sessions
                # Using "0" reads messages already delivered to this consumer
                # but not yet ACKed (e.g., from a crashed previous session)
                if not self._pending_recovered:
                    pending_messages = await self.redis.xreadgroup(
                        groupname=self.group, consumername=self.consumer,
                        streams={self.stream: "0"},
                        count=10, block=1000
                    )
                    for stream_name, entries in pending_messages:
                        for msg_id, fields in entries:
                            if self._shutdown.is_set():
                                break
                            await self._process_with_retry(msg_id, fields)
                    self._pending_recovered = True
                    continue  # Re-loop to switch to new message mode

                # Phase 2: Read new messages with ">"
                messages = await self.redis.xreadgroup(
                    groupname=self.group, consumername=self.consumer,
                    streams={self.stream: ">"},
                    count=1, block=2000
                )
                for stream_name, entries in messages:
                    for msg_id, fields in entries:
                        if self._shutdown.is_set():
                            break
                        await self._process_with_retry(msg_id, fields)
            except asyncio.CancelledError:
                break
            except Exception:
                await asyncio.sleep(1)

    async def _process_with_retry(self, msg_id: str, fields: dict):
        retry_count = int(fields.get("retry_count", 0))
        memory_id = fields.get("memory_id", "")

        # Report processing status
        try:
            await self.memory_client.update_task_status(
                memory_id, self.stream, "processing"
            )
        except Exception:
            pass

        for attempt in range(retry_count, self.max_retries):
            try:
                await self.process_message(msg_id, fields)
                await self.redis.xack(self.stream, self.group, msg_id)
                # Report completed status
                try:
                    await self.memory_client.update_task_status(
                        memory_id, self.stream, "completed"
                    )
                except Exception:
                    pass
                return
            except Exception as e:
                if attempt == self.max_retries - 1:
                    # Report failure -- do NOT ack, keep in pending for manual retry
                    try:
                        await self.memory_client.update_task_status(
                            memory_id, self.stream, "failed", error=str(e)
                        )
                    except Exception:
                        pass
                    return
                wait = 2 ** attempt  # 1, 2, 4 seconds
                await asyncio.sleep(wait)

    @abstractmethod
    async def process_message(self, msg_id: str, fields: dict):
        pass

    async def stop(self):
        self._shutdown.set()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
