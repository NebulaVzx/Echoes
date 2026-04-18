"""
Echoes Processor Service
Handles link scraping, content extraction, and auto-tag generation.
Consumes tasks from Redis Streams.
"""

import os
from fastapi import FastAPI
from contextlib import asynccontextmanager

# Service configuration
SERVICE_NAME = "processor-service"
SERVICE_VERSION = "0.1.0"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager - handles startup and shutdown."""
    # Startup: connect to Redis, start background workers
    print(f"{SERVICE_NAME} v{SERVICE_VERSION} starting up...")
    yield
    # Shutdown: cleanup resources
    print(f"{SERVICE_NAME} shutting down...")


app = FastAPI(
    title="Echoes Processor Service",
    description="Link scraping, content extraction, and auto-tagging",
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
        "description": "Link scraping and auto-tagging service",
    }
