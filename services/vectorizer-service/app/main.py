"""
Echoes Vectorizer Service
Generates BGE-M3 embeddings for text content.
Consumes vectorization tasks from Redis Streams.
"""

import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import redis.asyncio as redis
from app.config import settings
from app.services.embedder import BGEM3Embedder
from app.clients.memory_client import MemoryServiceClient
from app.consumers.vectorize_consumer import VectorizeConsumer

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"{settings.service_name} v{settings.service_version} starting up...")

    # Connect to Redis
    redis_client = redis.Redis.from_url(
        settings.redis_url,
        decode_responses=True
    )
    await redis_client.ping()
    print("Redis connected")

    # Load BGE-M3 model asynchronously
    embedder = BGEM3Embedder()
    await embedder.load()
    print(f"BGE-M3 model loaded (dim={embedder.dimension})")

    # Create Memory Service client
    memory_client = MemoryServiceClient(
        base_url=settings.memory_service_url,
        token=settings.internal_api_token,
    )

    # Start consumer
    consumers = []
    if settings.enable_vectorize_consumer:
        vectorize_consumer = VectorizeConsumer(redis_client, memory_client, embedder)
        await vectorize_consumer.start()
        consumers.append(vectorize_consumer)
        print("Vectorize consumer started")

    app.state.redis = redis_client
    app.state.embedder = embedder
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
    title="Echoes Vectorizer Service",
    description="BGE-M3 text embedding generation",
    version=settings.service_version,
    lifespan=lifespan,
)

origins = [o.strip() for o in settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": settings.service_name,
        "version": settings.service_version,
    }


@app.get("/")
async def root():
    return {
        "service": settings.service_name,
        "version": settings.service_version,
        "description": "BGE-M3 text vectorization service",
    }


class EncodeRequest(BaseModel):
    text: str


class EncodeResponse(BaseModel):
    vector: list
    dimension: int


@app.post("/encode", response_model=EncodeResponse)
async def encode_text(request: EncodeRequest):
    embedder = app.state.embedder
    if not embedder.is_loaded:
        raise HTTPException(status_code=503, detail="Model not loaded")
    try:
        vector = embedder.encode(request.text)
        return EncodeResponse(vector=vector, dimension=embedder.dimension)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
