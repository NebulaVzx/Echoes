"""Tests for LinkConsumer — derived task publishing with maxlen."""
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import redis.asyncio as redis

from app.consumers.link_consumer import LinkConsumer
from app.clients.memory_client import MemoryServiceClient


@pytest.fixture
def mock_redis():
    redis_mock = AsyncMock(spec=redis.Redis)
    redis_mock.xadd = AsyncMock(return_value="id-123")
    return redis_mock


@pytest.fixture
def mock_memory_client():
    return AsyncMock(spec=MemoryServiceClient)


@pytest.fixture
def consumer(mock_redis, mock_memory_client):
    return LinkConsumer(mock_redis, mock_memory_client)


class TestDerivedTasks:
    def test_vectorize_task_uses_maxlen(self, consumer, mock_redis, mock_memory_client):
        """Derived vectorize task must include maxlen=5000 to prevent stream growth."""
        with patch.object(consumer.scraper, 'scrape', new_callable=AsyncMock) as mock_scrape:
            mock_scrape.return_value = {"title": "Test Title", "content": "Test content"}
            with patch('app.consumers.link_consumer._create_llm') as mock_create_llm:
                mock_llm = AsyncMock()
                mock_llm.generate = AsyncMock(return_value="summary")
                mock_create_llm.return_value = mock_llm
                asyncio.run(consumer.process_message("msg-1", {
                    "memory_id": "m1",
                    "link_url": "https://example.com",
                }))

        mock_redis.xadd.assert_awaited_once()
        call = mock_redis.xadd.await_args
        assert call.args[0] == "text:vectorize"
        assert call.kwargs.get("maxlen") == 5000
        assert call.kwargs.get("approximate") is True

    def test_vectorize_includes_memory_id(self, consumer, mock_redis, mock_memory_client):
        """Derived task must propagate memory_id."""
        with patch.object(consumer.scraper, 'scrape', new_callable=AsyncMock) as mock_scrape:
            mock_scrape.return_value = {"title": "Test", "content": "Content"}
            with patch('app.consumers.link_consumer._create_llm') as mock_create_llm:
                mock_llm = AsyncMock()
                mock_llm.generate = AsyncMock(return_value="summary")
                mock_create_llm.return_value = mock_llm
                asyncio.run(consumer.process_message("msg-1", {
                    "memory_id": "mem-abc-123",
                    "link_url": "https://example.com",
                }))

        call = mock_redis.xadd.await_args
        assert call.args[1]["memory_id"] == "mem-abc-123"
