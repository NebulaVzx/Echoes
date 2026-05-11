"""
Echoes Vectorizer Service - Observability Setup
Prometheus metrics + OpenTelemetry tracing initialization.
"""

from fastapi import FastAPI
from prometheus_client import make_asgi_app, Counter, Histogram
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
import os
import logging

# Prometheus metrics (per D-06)
http_requests_total = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['service', 'method', 'path', 'status_code']
)
http_request_duration_seconds = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration in seconds',
    ['service', 'method', 'path']
)


def setup_observability(app: FastAPI, service_name: str):
    """Setup Prometheus metrics and OpenTelemetry tracing."""
    # 1. Prometheus /metrics endpoint
    metrics_app = make_asgi_app()
    app.mount("/metrics", metrics_app)

    # 2. OpenTelemetry TracerProvider
    resource = Resource.create({
        "service.name": service_name,
        "service.version": os.getenv("SERVICE_VERSION", "0.2.0"),
    })
    provider = TracerProvider(resource=resource)

    # OTLP HTTP exporter -> Jaeger
    # Let OTLPSpanExporter read endpoint from OTEL_EXPORTER_OTLP_ENDPOINT env var
    # and auto-append /v1/traces path.
    exporter = OTLPSpanExporter()
    provider.add_span_processor(BatchSpanProcessor(exporter))

    trace.set_tracer_provider(provider)

    # 3. Auto instrument FastAPI
    FastAPIInstrumentor.instrument_app(app)

    # 4. Configure structured logging
    log_level = os.getenv("LOG_LEVEL", "INFO")
    logging.basicConfig(
        level=getattr(logging, log_level, logging.INFO),
        format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    return provider
