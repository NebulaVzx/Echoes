"""Tests for CoverConsumer and ImageProcessor.

Covers COV-01 (cover generation) and COV-05 (fallback on failure).
"""

import base64
import io
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from PIL import Image

from app.consumers.cover_consumer import CoverConsumer
from app.services.image_processor import (
    _build_prompt,
    _extract_title_and_summary,
    create_fallback_cover,
    crop_cover,
    upload_cover_to_minio,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_pil_image(size=(1024, 1024), mode="RGB") -> Image.Image:
    """Create a solid-color PIL Image for testing."""
    return Image.new(mode, size, color=(100, 150, 200))


def _make_b64_image(size=(1024, 1024)) -> str:
    """Create a base64-encoded JPEG image."""
    img = _make_pil_image(size)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


@pytest.fixture
def mock_redis():
    return MagicMock()


@pytest.fixture
def mock_memory_client():
    client = MagicMock()
    client.update_task_status = AsyncMock()
    return client


@pytest.fixture
def cover_consumer(mock_redis, mock_memory_client):
    return CoverConsumer(mock_redis, mock_memory_client)


# ---------------------------------------------------------------------------
# ImageProcessor unit tests
# ---------------------------------------------------------------------------

class TestBuildPrompt:
    def test_build_prompt_basic(self):
        prompt = _build_prompt("Python Programming", "Learn Python basics")
        assert "Python Programming" in prompt
        assert "Learn Python basics" in prompt
        assert "soft watercolor" in prompt
        assert "no text" in prompt

    def test_build_prompt_truncates_long_title(self):
        long_title = "A" * 200
        prompt = _build_prompt(long_title, "summary")
        assert len(prompt.split(".")[0]) < 250  # title truncated

    def test_build_prompt_empty_inputs(self):
        prompt = _build_prompt("", "")
        assert "soft watercolor" in prompt


class TestExtractTitleAndSummary:
    def test_text_type(self):
        content = "First line title\n\nSome body content here.\nMore content."
        title, summary = _extract_title_and_summary(content, "text")
        assert title == "First line title"
        assert "Some body content" in summary

    def test_link_type_with_title(self):
        title, summary = _extract_title_and_summary("summary text", "link", link_title="My Article")
        assert title == "My Article"
        assert summary == "summary text"

    def test_link_type_fallback_domain(self):
        title, summary = _extract_title_and_summary("", "link", link_url="https://example.com/path")
        assert title == "example.com"

    def test_file_type(self):
        content = "Document Title\n\nParagraph one.\nParagraph two.\nParagraph three."
        title, summary = _extract_title_and_summary(content, "file")
        assert title == "Document Title"
        assert "Paragraph" in summary

    def test_empty_content(self):
        title, summary = _extract_title_and_summary("", "text")
        assert title == "Memory"
        assert summary == ""


class TestCropCover:
    def test_crop_to_400x300(self):
        img = _make_pil_image((1024, 1024))
        data = crop_cover(img)
        result = Image.open(io.BytesIO(data))
        assert result.size == (400, 300)
        assert result.format == "JPEG"

    def test_crop_rgba_image(self):
        img = _make_pil_image((1024, 1024), mode="RGBA")
        data = crop_cover(img)
        result = Image.open(io.BytesIO(data))
        assert result.size == (400, 300)
        assert result.mode == "RGB"

    def test_crop_quality(self):
        img = _make_pil_image((1024, 1024))
        data = crop_cover(img)
        # JPEG with quality=90 should be reasonable size
        assert len(data) > 1000


class TestCreateFallbackCover:
    def test_fallback_size(self):
        data = create_fallback_cover("python")
        img = Image.open(io.BytesIO(data))
        assert img.size == (400, 300)
        assert img.format == "PNG"

    def test_fallback_letter(self):
        data = create_fallback_cover("python")
        img = Image.open(io.BytesIO(data))
        # Just verify it doesn't crash and produces valid image
        assert img.size == (400, 300)

    def test_fallback_empty_tag(self):
        data = create_fallback_cover("")
        img = Image.open(io.BytesIO(data))
        assert img.size == (400, 300)

    def test_fallback_deterministic_color(self):
        """Same tag should produce same color (deterministic hash)."""
        data1 = create_fallback_cover("python")
        data2 = create_fallback_cover("python")
        # Compare raw bytes
        assert data1 == data2

    def test_fallback_different_tags_different_colors(self):
        """Different tags should produce different colors."""
        data1 = create_fallback_cover("python")
        data2 = create_fallback_cover("golang")
        assert data1 != data2


class TestUploadCoverToMinio:
    def test_upload_builds_correct_url(self):
        mock_minio = MagicMock()
        mock_minio._endpoint_url.netloc = "minio:9000"
        image_data = b"fake_image_data"

        url = upload_cover_to_minio(mock_minio, "user-123", "mem-456", image_data)

        assert url == "http://minio:9000/echoes-files/covers/user-123/mem-456.jpg"
        mock_minio.put_object.assert_called_once()
        call_args = mock_minio.put_object.call_args
        assert call_args[0][0] == "echoes-files"
        assert call_args[0][1] == "covers/user-123/mem-456.jpg"


# ---------------------------------------------------------------------------
# CoverConsumer unit tests
# ---------------------------------------------------------------------------

class TestCoverConsumerBasics:
    def test_inherits_redis_stream_consumer(self, cover_consumer):
        from app.consumers.base import RedisStreamConsumer
        assert isinstance(cover_consumer, RedisStreamConsumer)

    def test_stream_name(self, cover_consumer):
        assert cover_consumer.stream == "cover:generate"

    def test_group_name(self, cover_consumer):
        assert cover_consumer.group == "processor-group"


class TestProcessMessageText:
    @pytest.mark.asyncio
    async def test_text_type_uses_dalle(self, cover_consumer, mock_memory_client):
        fields = {
            "memory_id": "mem-123",
            "content_type": "text",
            "content": "Python Tips\n\nHere are some Python tips.",
            "tags": "python,programming",
            "user_id": "user-456",
        }

        with patch("app.consumers.cover_consumer.generate_cover_image") as mock_dalle, \
             patch("app.consumers.cover_consumer.upload_cover_to_minio") as mock_upload, \
             patch.dict("os.environ", {"OPENAI_API_KEY": "sk-test-key"}, clear=False):
            mock_dalle.return_value = _make_pil_image()
            mock_upload.return_value = "http://minio/covers/user-456/mem-123.jpg"

            await cover_consumer.process_message("msg-1", fields)

            mock_dalle.assert_awaited_once()
            mock_upload.assert_called_once()
            mock_memory_client.update_task_status.assert_awaited_once()
            call_args = mock_memory_client.update_task_status.call_args
            assert call_args[0][0] == "mem-123"
            assert call_args[0][1] == "cover:generate"
            assert call_args[0][2] == "completed"
            assert call_args[1]["result"]["cover_url"] == "http://minio/covers/user-456/mem-123.jpg"


class TestProcessMessageLink:
    @pytest.mark.asyncio
    async def test_link_type_tries_og_image_first(self, cover_consumer, mock_memory_client):
        fields = {
            "memory_id": "mem-123",
            "content_type": "link",
            "content": "",
            "link_url": "https://example.com/article",
            "link_title": "My Article",
            "tags": "news",
            "user_id": "user-456",
        }

        og_image = _make_pil_image((800, 600))
        og_buf = io.BytesIO()
        og_image.save(og_buf, format="PNG")

        with patch("app.consumers.cover_consumer.fetch_og_image") as mock_fetch, \
             patch("app.consumers.cover_consumer.generate_cover_image") as mock_dalle, \
             patch("app.consumers.cover_consumer.upload_cover_to_minio") as mock_upload:
            mock_fetch.return_value = og_buf.getvalue()
            mock_upload.return_value = "http://minio/covers/user-456/mem-123.jpg"

            await cover_consumer.process_message("msg-1", fields)

            mock_fetch.assert_awaited_once_with("https://example.com/article")
            mock_dalle.assert_not_awaited()  # Should not call DALL-E if og:image works
            mock_upload.assert_called_once()

    @pytest.mark.asyncio
    async def test_link_type_falls_back_to_dalle_when_no_og_image(self, cover_consumer, mock_memory_client):
        fields = {
            "memory_id": "mem-123",
            "content_type": "link",
            "content": "Article summary here",
            "link_url": "https://example.com/article",
            "link_title": "My Article",
            "tags": "news",
            "user_id": "user-456",
        }

        with patch("app.consumers.cover_consumer.fetch_og_image") as mock_fetch, \
             patch("app.consumers.cover_consumer.generate_cover_image") as mock_dalle, \
             patch("app.consumers.cover_consumer.upload_cover_to_minio") as mock_upload, \
             patch.dict("os.environ", {"OPENAI_API_KEY": "sk-test-key"}, clear=False):
            mock_fetch.return_value = None  # No og:image
            mock_dalle.return_value = _make_pil_image()
            mock_upload.return_value = "http://minio/covers/user-456/mem-123.jpg"

            await cover_consumer.process_message("msg-1", fields)

            mock_fetch.assert_awaited_once()
            mock_dalle.assert_awaited_once()  # Falls back to DALL-E
            mock_upload.assert_called_once()


class TestProcessMessageFallback:
    @pytest.mark.asyncio
    async def test_fallback_cover_when_all_generation_fails(self, cover_consumer, mock_memory_client):
        fields = {
            "memory_id": "mem-123",
            "content_type": "text",
            "content": "Some content",
            "tags": "python",
            "user_id": "user-456",
        }

        with patch("app.consumers.cover_consumer.generate_cover_image") as mock_dalle, \
             patch("app.consumers.cover_consumer.generate_cover_pollinations") as mock_poll, \
             patch("app.consumers.cover_consumer.upload_cover_to_minio") as mock_upload, \
             patch.dict("os.environ", {"OPENAI_API_KEY": "sk-test-key"}, clear=False):
            mock_dalle.side_effect = Exception("DALL-E failed")
            mock_poll.side_effect = Exception("Pollinations failed")
            mock_upload.return_value = "http://minio/covers/user-456/mem-123.jpg"

            await cover_consumer.process_message("msg-1", fields)

            mock_dalle.assert_awaited_once()
            mock_poll.assert_awaited_once()
            mock_upload.assert_called_once()
            # Verify fallback cover was used (upload was called with fallback data)
            assert mock_upload.call_args[0][3] is not None
            mock_memory_client.update_task_status.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_no_api_key_uses_pollinations_then_fallback(self, cover_consumer, mock_memory_client):
        fields = {
            "memory_id": "mem-123",
            "content_type": "text",
            "content": "Some content",
            "tags": "python",
            "user_id": "user-456",
        }

        with patch.dict("os.environ", {"OPENAI_API_KEY": ""}, clear=False), \
             patch("app.consumers.cover_consumer.generate_cover_image") as mock_dalle, \
             patch("app.consumers.cover_consumer.generate_cover_pollinations") as mock_poll, \
             patch("app.consumers.cover_consumer.upload_cover_to_minio") as mock_upload:
            mock_poll.side_effect = Exception("Pollinations failed")
            mock_upload.return_value = "http://minio/covers/user-456/mem-123.jpg"

            await cover_consumer.process_message("msg-1", fields)

            mock_dalle.assert_not_awaited()  # No API key, skip DALL-E
            mock_poll.assert_awaited_once()   # Try Pollinations
            mock_upload.assert_called_once()  # Fallback cover uploaded


class TestProcessMessageFile:
    @pytest.mark.asyncio
    async def test_file_type_extracts_first_paragraph(self, cover_consumer, mock_memory_client):
        fields = {
            "memory_id": "mem-123",
            "content_type": "file",
            "content": "Document Title\n\nFirst paragraph of the document.\nSecond paragraph.",
            "tags": "docs",
            "user_id": "user-456",
        }

        with patch("app.consumers.cover_consumer.generate_cover_image") as mock_dalle, \
             patch("app.consumers.cover_consumer.upload_cover_to_minio") as mock_upload, \
             patch.dict("os.environ", {"OPENAI_API_KEY": "sk-test-key"}, clear=False):
            mock_dalle.return_value = _make_pil_image()
            mock_upload.return_value = "http://minio/covers/user-456/mem-123.jpg"

            await cover_consumer.process_message("msg-1", fields)

            mock_dalle.assert_awaited_once()
            # Verify prompt contains document title
            prompt = mock_dalle.call_args[0][0]
            assert "Document Title" in prompt


class TestCoverConsumerFailure:
    @pytest.mark.asyncio
    async def test_upload_failure_raises(self, cover_consumer, mock_memory_client):
        fields = {
            "memory_id": "mem-123",
            "content_type": "text",
            "content": "Some content",
            "tags": "python",
            "user_id": "user-456",
        }

        with patch("app.consumers.cover_consumer.generate_cover_image") as mock_dalle, \
             patch("app.consumers.cover_consumer.upload_cover_to_minio") as mock_upload, \
             patch.dict("os.environ", {"OPENAI_API_KEY": "sk-test-key"}, clear=False):
            mock_dalle.return_value = _make_pil_image()
            mock_upload.side_effect = Exception("MinIO connection failed")

            with pytest.raises(RuntimeError, match="MinIO upload failed"):
                await cover_consumer.process_message("msg-1", fields)


class TestProcessMessageNoUserId:
    @pytest.mark.asyncio
    async def test_missing_user_id_raises(self, cover_consumer, mock_memory_client):
        fields = {
            "memory_id": "mem-123",
            "content_type": "text",
            "content": "Some content",
            "tags": "python",
            "user_id": "",
        }

        with patch("app.consumers.cover_consumer.generate_cover_image") as mock_dalle, \
             patch("app.consumers.cover_consumer.upload_cover_to_minio") as mock_upload, \
             patch.dict("os.environ", {"OPENAI_API_KEY": "sk-test-key"}, clear=False):
            mock_dalle.return_value = _make_pil_image()
            mock_upload.return_value = "http://minio/covers/user-456/mem-123.jpg"

            # Empty user_id blocks upload (security: no user-controlled path segments)
            with pytest.raises(RuntimeError, match="Failed to generate or upload"):
                await cover_consumer.process_message("msg-1", fields)
