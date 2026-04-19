"""
Echoes Processor Service
Handles link scraping, content extraction, and auto-tag generation.
Consumes tasks from Redis Streams.
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
import redis.asyncio as redis
from app.config import settings
from app.clients.memory_client import MemoryServiceClient
from app.consumers.link_consumer import LinkConsumer
from app.consumers.tag_consumer import TagConsumer


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
    print(f"{settings.service_name} shut down")


app = FastAPI(
    title="Echoes Processor Service",
    description="Link scraping, content extraction, and auto-tagging",
    version=settings.service_version,
    lifespan=lifespan,
)


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
