"""
Echoes Vectorizer Service
Generates BGE-M3 embeddings for text content.
Consumes vectorization tasks from Redis Streams.
"""

import os
from fastapi import FastAPI
from contextlib import asynccontextmanager

# Service configuration
SERVICE_NAME = "vectorizer-service"
SERVICE_VERSION = "0.1.0"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager - handles startup and shutdown."""
    # Startup: load BGE-M3 model
    print(f"{SERVICE_NAME} v{SERVICE_VERSION} starting up...")
    print("Loading BGE-M3 model...")
    # Model will be loaded here in Sprint 3
    yield
    # Shutdown: cleanup resources
    print(f"{SERVICE_NAME} shutting down...")


app = FastAPI(
    title="Echoes Vectorizer Service",
    description="BGE-M3 text embedding generation",
    version=SERVICE_VERSION,
    lifespan=lifespan,
)


@app.get("/health")
async def health_check():
    """Health check endpoint for Docker and load balancers."""
    return {
        "status": "ok",
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
    }


@app.get("/")
async def root():
    """Root endpoint with service information."""
    return {
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
        "description": "BGE-M3 text vectorization service",
    }
