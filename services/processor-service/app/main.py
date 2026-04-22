"""
Echoes Processor Service
Handles link scraping, content extraction, and auto-tag generation.
Consumes tasks from Redis Streams.
"""

import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
import redis.asyncio as redis
from app.config import settings
from app.clients.memory_client import MemoryServiceClient
from app.consumers.link_consumer import LinkConsumer
from app.consumers.tag_consumer import TagConsumer
from app.observability import setup_observability
from opentelemetry import trace


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager - handles startup and shutdown."""
    print(f"{settings.service_name} v{settings.service_version} starting up...")

    # Connect to Redis
    redis_client = redis.Redis.from_url(
        settings.redis_url,
        decode_responses=True
    )
    await redis_client.ping()
    print("Redis connected")

    # Create Memory Service client
    memory_client = MemoryServiceClient(
        base_url=settings.memory_service_url,
        token=settings.internal_api_token,
    )

    # Start consumers
    consumers = []
    if settings.enable_link_consumer:
        link_consumer = LinkConsumer(redis_client, memory_client)
        await link_consumer.start()
        consumers.append(link_consumer)
        print("Link consumer started")

    if settings.enable_tag_consumer:
        tag_consumer = TagConsumer(redis_client, memory_client)
        await tag_consumer.start()
        consumers.append(tag_consumer)
        print("Tag consumer started")

    app.state.redis = redis_client
    app.state.memory_client = memory_client
    app.state.consumers = consumers

    yield

    # Shutdown
    print("Shutting down consumers...")
    for consumer in consumers:
        await consumer.stop()
    await memory_client.close()
    await redis_client.aclose()

    # Shutdown tracer provider
    provider = trace.get_tracer_provider()
    if hasattr(provider, 'shutdown'):
        provider.shutdown()

    print(f"{settings.service_name} shut down")


app = FastAPI(
    title="Echoes Processor Service",
    description="Link scraping, content extraction, and auto-tagging",
    version=settings.service_version,
    lifespan=lifespan,
)

# Setup observability at module level (NOT inside lifespan)
# Per RESEARCH.md Pitfall 6: FastAPIInstrumentor must be called after app creation
provider = setup_observability(app, "processor-service")


@app.get("/health")
async def health_check():
    """Health check endpoint for Docker and load balancers."""
    return {
        "status": "ok",
        "service": settings.service_name,
        "version": settings.service_version,
    }


@app.get("/")
async def root():
    """Root endpoint with service information."""
    return {
        "service": settings.service_name,
        "version": settings.service_version,
        "description": "Link scraping and auto-tagging service",
    }


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    temperature: float = 0.7
    max_tokens: int = 1000


class ChatResponse(BaseModel):
    content: str


@app.post("/api/v1/generate/chat")
async def chat_generate(req: ChatRequest):
    """Generate a chat response from a conversation history."""
    from app.services.llm.factory import LLMFactory

    try:
        llm = LLMFactory.create()
    except Exception as e:
        logging.error(f"Failed to create LLM provider: {e}")
        raise HTTPException(status_code=500, detail=f"LLM provider error: {e}")

    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    try:
        content = await llm.chat(
            messages=messages,
            temperature=req.temperature,
            max_tokens=req.max_tokens,
        )
    except Exception as e:
        logging.error(f"LLM chat failed: {e}")
        raise HTTPException(status_code=500, detail=f"LLM generation error: {e}")

    return ChatResponse(content=content)
