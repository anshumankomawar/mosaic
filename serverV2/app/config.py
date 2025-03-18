"""
Configuration settings for the Recall API.

This module loads environment variables and provides configuration
settings for the application.
"""

from functools import lru_cache
from pydantic import BaseSettings
from typing import Optional


class LLMSettings(BaseSettings):
    """Settings for LLM providers."""

    # Default provider
    DEFAULT_PROVIDER: str = "openai"

    # OpenAI
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4"
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-ada-002"
    OPENAI_EMBEDDING_DIMENSIONS: int = 1536

    # Anthropic
    ANTHROPIC_API_KEY: Optional[str] = None
    ANTHROPIC_MODEL: str = "claude-3-opus-20240229"

    # Cohere
    COHERE_API_KEY: Optional[str] = None
    COHERE_MODEL: str = "command-nightly"

    # Mistral
    MISTRAL_API_KEY: Optional[str] = None
    MISTRAL_MODEL: str = "mistral-large-latest"

    # Local model (e.g., Ollama)
    LOCAL_LLM_ENDPOINT: Optional[str] = None
    LOCAL_LLM_MODEL: str = "llama3"


class ChunkingSettings(BaseSettings):
    """Settings for text chunking."""

    DEFAULT_CHUNK_SIZE: int = 1000
    DEFAULT_CHUNK_OVERLAP: int = 100
    MIN_CHUNK_SIZE: int = 100
    MAX_CHUNK_SIZE: int = 8000


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # API configuration
    APP_NAME: str = "Recall API"
    APP_VERSION: str = "1.0.0"
    API_PREFIX: str = ""
    DEBUG: bool = False

    # Supabase credentials
    SUPABASE_URL: str
    SUPABASE_KEY: str

    # LLM settings
    LLM: LLMSettings = LLMSettings()

    # Chunking settings
    CHUNKING: ChunkingSettings = ChunkingSettings()

    # Search settings
    MAX_SEARCH_RESULTS: int = 100
    DEFAULT_SEARCH_LIMIT: int = 10
    SIMILARITY_THRESHOLD: float = 0.7

    # Optional Redis configuration
    REDIS_URL: str = "redis://redis:6379/0"
    ENABLE_CACHE: bool = True
    CACHE_TTL_SECONDS: int = 3600

    # Logging
    LOG_LEVEL: str = "INFO"

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """
    Get application settings from environment variables.

    Returns:
        Settings: Application settings
    """
    return Settings()
