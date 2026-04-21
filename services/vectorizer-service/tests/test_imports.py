"""Smoke tests for Vectorizer Service imports."""
import pytest


def test_import_main_app():
    from app.main import app
    assert app is not None


def test_import_embedder():
    from app.services.embedder import BGEM3Embedder
    assert BGEM3Embedder is not None


def test_import_consumer():
    from app.consumers.vectorize_consumer import VectorizeConsumer
    assert VectorizeConsumer is not None


def test_import_memory_client():
    from app.clients.memory_client import MemoryServiceClient
    assert MemoryServiceClient is not None
