"""Tests for Redis Stream consumer base class — ack behavior, CG creation, stream trimming.

These tests verify the critical bug fixes for Redis Stream backlog:
1. Failed messages are always acked (prevents pending accumulation)
2. Consumer groups use id='$' (prevents replaying all history on restart)
3. Streams are trimmed on startup (prevents unbounded growth)
"""
import asyncio
from unittest.mock import AsyncMock

import pytest
import redis.asyncio as redis

from app.consumers.base import RedisStreamConsumer
from app.clients.memory_client import MemoryServiceClient


class DummyConsumer(RedisStreamConsumer):
    """Concrete consumer for testing base class behavior."""

    def __init__(self, redis_client, memory_client, max_retries=2):
        super().__init__(
            redis_client=redis_client,
            stream="test:stream",
            group="test-group",
            consumer="test-consumer-1",
            memory_client=memory_client,
            max_retries=max_retries,
        )

    async def process_message(self, msg_id: str, fields: dict):
        pass


@pytest.fixture
def mock_redis():
    redis_mock = AsyncMock(spec=redis.Redis)
    redis_mock.xgroup_create = AsyncMock()
    redis_mock.xtrim = AsyncMock()
    redis_mock.xack = AsyncMock()
    redis_mock.xreadgroup = AsyncMock(return_value=[])
    return redis_mock


@pytest.fixture
def mock_memory_client():
    return AsyncMock(spec=MemoryServiceClient)


class TestStart:
    def test_creates_consumer_group_with_dollar_id(self, mock_redis, mock_memory_client):
        """Consumer group must be created with id='$' to avoid replaying all history."""
        consumer = DummyConsumer(mock_redis, mock_memory_client)
        async def _start_stop():
            await consumer.start()
            await consumer.stop()
        asyncio.run(_start_stop())
        mock_redis.xgroup_create.assert_awaited_once_with(
            name="test:stream",
            groupname="test-group",
            id="$",
            mkstream=True,
        )

    def test_trims_stream_on_start(self, mock_redis, mock_memory_client):
        """Stream must be trimmed to maxlen=5000 to prevent unbounded growth."""
        consumer = DummyConsumer(mock_redis, mock_memory_client)
        async def _start_stop():
            await consumer.start()
            await consumer.stop()
        asyncio.run(_start_stop())
        mock_redis.xtrim.assert_awaited_once_with(
            "test:stream", maxlen=5000, approximate=True
        )

    def test_busygroup_is_ignored(self, mock_redis, mock_memory_client):
        """If consumer group already exists, BUSYGROUP error must be swallowed."""
        redis_err = redis.ResponseError("BUSYGROUP Consumer Group name already exists")
        mock_redis.xgroup_create = AsyncMock(side_effect=redis_err)
        consumer = DummyConsumer(mock_redis, mock_memory_client)
        async def _start_stop():
            await consumer.start()
            await consumer.stop()
        asyncio.run(_start_stop())  # should not raise
        mock_redis.xgroup_create.assert_awaited_once()


class TestProcessWithRetry:
    def test_success_acks_message(self, mock_redis, mock_memory_client):
        """On successful processing, message must be acked."""
        consumer = DummyConsumer(mock_redis, mock_memory_client, max_retries=1)
        consumer.process_message = AsyncMock()
        asyncio.run(consumer._process_with_retry("msg-1", {"memory_id": "m1"}))
        mock_redis.xack.assert_awaited_once_with("test:stream", "test-group", "msg-1")

    def test_failure_acks_after_max_retries(self, mock_redis, mock_memory_client):
        """CRITICAL: Even after all retries fail, message MUST be acked.

        Previously missing this ack caused messages to stay pending forever,
        leading to Redis Stream backlog accumulation (156+ pending messages).
        """
        consumer = DummyConsumer(mock_redis, mock_memory_client, max_retries=1)
        consumer.process_message = AsyncMock(side_effect=RuntimeError("always fails"))
        asyncio.run(consumer._process_with_retry("msg-1", {"memory_id": "m1"}))
        # Must ack even on failure to prevent pending accumulation
        mock_redis.xack.assert_awaited_once_with("test:stream", "test-group", "msg-1")

    def test_failure_reports_status_to_memory_service(self, mock_redis, mock_memory_client):
        """On final failure, failure status must be reported to memory-service."""
        consumer = DummyConsumer(mock_redis, mock_memory_client, max_retries=1)
        consumer.process_message = AsyncMock(side_effect=RuntimeError("db down"))
        asyncio.run(consumer._process_with_retry("msg-1", {"memory_id": "m1"}))
        mock_memory_client.update_task_status.assert_any_call(
            "m1", "test:stream", "failed", error="db down"
        )

    def test_reports_processing_status(self, mock_redis, mock_memory_client):
        """Processing status must be reported at the start of each attempt."""
        consumer = DummyConsumer(mock_redis, mock_memory_client, max_retries=1)
        consumer.process_message = AsyncMock(return_value=None)
        asyncio.run(consumer._process_with_retry("msg-1", {"memory_id": "m1"}))
        mock_memory_client.update_task_status.assert_any_call(
            "m1", "test:stream", "processing"
        )
