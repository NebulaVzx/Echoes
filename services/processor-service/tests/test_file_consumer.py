"""Tests for FileConsumer — derived task publishing with maxlen."""
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import redis.asyncio as redis

from app.consumers.file_consumer import FileConsumer
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
    return FileConsumer(mock_redis, mock_memory_client)


class TestDerivedTasks:
    def test_all_derived_tasks_use_maxlen(self, consumer, mock_redis, mock_memory_client):
        """Every derived task (vectorize, tag, suggestion) must use maxlen=5000."""
        with patch.object(consumer, '_minio') as mock_minio:
            mock_minio.fget_object = MagicMock()
            with patch('app.consumers.file_consumer.extract_text', return_value="extracted"):
                with patch('app.consumers.file_consumer.tempfile.NamedTemporaryFile') as mock_ntf:
                    mock_file = MagicMock()
                    mock_file.name = "/tmp/test.txt"
                    mock_ntf.return_value.__enter__ = MagicMock(return_value=mock_file)
                    mock_ntf.return_value.__exit__ = MagicMock(return_value=False)
                    with patch('os.unlink'):
                        consumer._update_memory_text = AsyncMock()
                        mock_memory_client.update_task_status = AsyncMock()
                        asyncio.run(consumer.process_message("msg-1", {
                            "memory_id": "m1",
                            "file_name": "test.txt",
                            "media_url": "http://echoes-minio:9000/echoes-files/u/m1/test.txt",
                        }))

        # Should publish exactly 3 derived tasks
        assert mock_redis.xadd.await_count == 3

        for call in mock_redis.xadd.await_args_list:
            assert call.kwargs.get("maxlen") == 5000
            assert call.kwargs.get("approximate") is True

    def test_derived_tasks_include_correct_streams(self, consumer, mock_redis, mock_memory_client):
        """Derived tasks must be published to the correct streams."""
        with patch.object(consumer, '_minio') as mock_minio:
            mock_minio.fget_object = MagicMock()
            with patch('app.consumers.file_consumer.extract_text', return_value="extracted"):
                with patch('app.consumers.file_consumer.tempfile.NamedTemporaryFile') as mock_ntf:
                    mock_file = MagicMock()
                    mock_file.name = "/tmp/test.txt"
                    mock_ntf.return_value.__enter__ = MagicMock(return_value=mock_file)
                    mock_ntf.return_value.__exit__ = MagicMock(return_value=False)
                    with patch('os.unlink'):
                        consumer._update_memory_text = AsyncMock()
                        mock_memory_client.update_task_status = AsyncMock()
                        asyncio.run(consumer.process_message("msg-1", {
                            "memory_id": "m1",
                            "file_name": "test.txt",
                            "media_url": "http://echoes-minio:9000/echoes-files/u/m1/test.txt",
                        }))

        streams = [call.args[0] for call in mock_redis.xadd.await_args_list]
        assert "text:vectorize" in streams
        assert "tag:generate" in streams
        assert "suggestion:generate" in streams
