"""
Data models for search and augmentation operations.

This module defines Pydantic models for search queries, results, and augmented responses.
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, validator
from enum import Enum


class LLMProvider(str, Enum):
    """Supported LLM providers."""

    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    COHERE = "cohere"
    MISTRAL = "mistral"
    LOCAL = "local"


class TemplateType(str, Enum):
    """Supported response template types."""

    DEFAULT = "default"
    SUMMARY = "summary"
    CONCISE = "concise"
    CUSTOM = "custom"


class SearchQuery(BaseModel):
    """Model for search queries."""

    query: str = Field(..., description="Search query text", min_length=1)
    bucket_ids: Optional[List[str]] = Field(
        default=None, description="Optional list of bucket IDs to search within"
    )
    limit: int = Field(default=10, description="Maximum number of results to return", ge=1, le=100)
    include_outdated: bool = Field(
        default=False, description="Whether to include buffers marked as outdated in the results"
    )
    version_strategy: str = Field(
        default="latest", description="Strategy for handling multiple versions ('latest', 'all')"
    )

    @validator("version_strategy")
    def validate_version_strategy(cls, v):
        """Validate that the version strategy is one of the allowed values."""
        allowed_strategies = ["latest", "all"]
        if v not in allowed_strategies:
            raise ValueError(f"Version strategy must be one of: {', '.join(allowed_strategies)}")
        return v

    class Config:
        """Pydantic model configuration."""

        schema_extra = {
            "example": {
                "query": "project architecture design",
                "bucket_ids": ["123e4567-e89b-12d3-a456-426614174000"],
                "limit": 10,
                "include_outdated": False,
                "version_strategy": "latest",
            }
        }


class ChunkSearchResult(BaseModel):
    """Model for search results at the chunk level."""

    id: str = Field(..., description="Unique identifier for the chunk")
    buffer_id: str = Field(..., description="ID of the parent buffer")
    content: str = Field(..., description="Text content of the chunk")
    similarity: float = Field(
        ..., description="Similarity score between the query and the chunk", ge=0, le=1
    )
    chunk_index: int = Field(..., description="Index of the chunk within the buffer")
    created_at: datetime = Field(..., description="Timestamp when the chunk was created")
    metadata: Optional[Dict[str, Any]] = Field(
        default=None, description="Additional metadata for the chunk"
    )

    class Config:
        """Pydantic model configuration."""

        schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174001",
                "buffer_id": "123e4567-e89b-12d3-a456-426614174000",
                "content": "This is a chunk of text from a larger buffer.",
                "similarity": 0.89,
                "chunk_index": 0,
                "created_at": "2023-01-15T12:30:45Z",
                "metadata": {"section": "introduction", "word_count": 10},
            }
        }


class BufferSearchResult(BaseModel):
    """Model for search results at the buffer level."""

    id: str = Field(..., description="Unique identifier for the buffer")
    title: Optional[str] = Field(
        default=None, description="Title of the buffer (derived from content or metadata)"
    )
    chunks: List[ChunkSearchResult] = Field(
        ..., description="Chunks from this buffer that matched the search"
    )
    created_at: datetime = Field(..., description="Timestamp when the buffer was created")
    is_outdated: bool = Field(
        default=False, description="Flag indicating if the buffer has been marked as outdated"
    )
    bucket_ids: List[str] = Field(
        default=[], description="List of bucket IDs associated with this buffer"
    )

    class Config:
        """Pydantic model configuration."""

        schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "title": "Project Architecture Overview",
                "chunks": [
                    {
                        "id": "123e4567-e89b-12d3-a456-426614174001",
                        "buffer_id": "123e4567-e89b-12d3-a456-426614174000",
                        "content": "This is a chunk of text from a larger buffer.",
                        "similarity": 0.89,
                        "chunk_index": 0,
                        "created_at": "2023-01-15T12:30:45Z",
                    }
                ],
                "created_at": "2023-01-15T12:30:45Z",
                "is_outdated": False,
                "bucket_ids": ["456e4567-e89b-12d3-a456-426614174111"],
            }
        }


class Source(BaseModel):
    """Model for a source reference in an augmented response."""

    id: str = Field(..., description="Unique identifier for the buffer")
    title: Optional[str] = Field(default=None, description="Title of the source")
    created_at: datetime = Field(..., description="Timestamp when the source was created")
    chunk_ids: List[str] = Field(
        default=[], description="IDs of chunks from this source that were used"
    )

    class Config:
        """Pydantic model configuration."""

        schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "title": "Project Architecture Overview",
                "created_at": "2023-01-15T12:30:45Z",
                "chunk_ids": ["123e4567-e89b-12d3-a456-426614174001"],
            }
        }


class AugmentedSearchRequest(BaseModel):
    """Model for requesting an augmented search response."""

    query: SearchQuery = Field(..., description="Search query parameters")
    llm_provider: LLMProvider = Field(
        default=LLMProvider.OPENAI, description="LLM provider to use for generating the response"
    )
    template: str = Field(
        default="default", description="Template to use for formatting the response"
    )
    temperature: float = Field(
        default=0.3,
        description="Temperature setting for the LLM (higher = more creative)",
        ge=0.0,
        le=1.0,
    )
    max_tokens: Optional[int] = Field(
        default=None, description="Maximum number of tokens in the generated response"
    )


class AugmentedSearchResponse(BaseModel):
    """Model for augmented search responses."""

    query: str = Field(..., description="Original search query")
    response: str = Field(..., description="Generated response text")
    sources: List[Source] = Field(default=[], description="Sources used to generate the response")
    provider: LLMProvider = Field(..., description="LLM provider used")

    class Config:
        """Pydantic model configuration."""

        schema_extra = {
            "example": {
                "query": "project architecture design",
                "response": "The project architecture follows a microservices pattern with three main components...",
                "sources": [
                    {
                        "id": "123e4567-e89b-12d3-a456-426614174000",
                        "title": "Project Architecture Overview",
                        "created_at": "2023-01-15T12:30:45Z",
                        "chunk_ids": ["123e4567-e89b-12d3-a456-426614174001"],
                    }
                ],
                "provider": "openai",
            }
        }
