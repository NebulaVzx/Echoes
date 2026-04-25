import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    service_name: str = "processor-service"
    service_version: str = "0.2.0"
    redis_url: str = "redis://redis:6379/0"
    memory_service_url: str = "http://memory-service:8002"
    internal_api_token: str = ""
    llm_provider: str = "openai"
    llm_model: str = "gpt-4o-mini"
    llm_temperature: float = 0.7
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    enable_link_consumer: bool = True
    enable_tag_consumer: bool = True
    enable_suggestion_consumer: bool = True

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


settings = Settings()
