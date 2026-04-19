import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    service_name: str = "vectorizer-service"
    service_version: str = "0.2.0"
    redis_url: str = "redis://redis:6379/0"
    memory_service_url: str = "http://memory-service:8002"
    internal_api_token: str = ""
    model_name: str = "BAAI/bge-m3"
    device: str = "auto"  # auto, cpu, cuda
    enable_vectorize_consumer: bool = True

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


settings = Settings()
