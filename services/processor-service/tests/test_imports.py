"""Smoke tests for Processor Service imports."""
import pytest


def test_import_main_app():
    from app.main import app
    assert app is not None


def test_import_llm_factory():
    from app.services.llm.factory import LLMFactory
    assert LLMFactory is not None


def test_import_scraper():
    from app.services.scraper import LinkScraper
    assert LinkScraper is not None


def test_import_consumers():
    from app.consumers.link_consumer import LinkConsumer
    from app.consumers.tag_consumer import TagConsumer
    assert LinkConsumer is not None
    assert TagConsumer is not None


def test_import_memory_client():
    from app.clients.memory_client import MemoryServiceClient
    assert MemoryServiceClient is not None
