"""
Data models for buffer operations.

This module defines Pydantic models for buffer creation, updates, and responses.
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, validator
import uuid


class BufferBase(BaseModel):
    """Base model for buffer operations."""

    content: str = Field(..., description="Text content of the buffer")


class BufferCreate(BufferBase):
    """Model for creating a new buffer."""

    bucket_ids: Optional[List[str]] = Field(
        default=[], description="List of bucket IDs to associate with this buffer"
    )

    # Chunking options (override defaults if needed)
    chunk_size: Optional[int] = Field(
        default=None, description="Maximum size of each chunk in characters"
    )
    chunk_overlap: Optional[int] = Field(
        default=None, description="Number of characters to overlap between chunks"
    )


class BufferUpdate(BufferBase):
    """Model for updating an existing buffer (creating a new version)."""

    parent_id: str = Field(..., description="ID of the buffer being updated")

    # Chunking options (override defaults if needed)
    chunk_size: Optional[int] = Field(
        default=None, description="Maximum size of each chunk in characters"
    )
    chunk_overlap: Optional[int] = Field(
        default=None, description="Number of characters to overlap between chunks"
    )


class BufferMarkOutdated(BaseModel):
    """Model for marking a buffer as outdated."""

    reason: str = Field(
        ..., description="Reason for marking the buffer as outdated", min_length=3, max_length=500
    )


class BufferChunk(BaseModel):
    """Model for a buffer chunk."""

    id: str = Field(..., description="Unique identifier for the chunk")
    buffer_id: str = Field(..., description="ID of the parent buffer")
    content: str = Field(..., description="Text content of the chunk")
    chunk_index: int = Field(..., description="Index of the chunk within the buffer")
    embedding: Optional[List[float]] = Field(
        default=None, description="Vector embedding of the chunk"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default=None, description="Additional metadata for the chunk"
    )
    created_at: datetime = Field(..., description="Timestamp when the chunk was created")

    class Config:
        """Pydantic model configuration."""

        schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174001",
                "buffer_id": "123e4567-e89b-12d3-a456-426614174000",
                "content": "This is a chunk of text from a larger buffer.",
                "chunk_index": 0,
                "metadata": {"section": "introduction", "word_count": 10},
                "created_at": "2023-01-15T12:30:45Z",
            }
        }


class BufferResponse(BufferBase):
    """Response model for buffer operations."""

    id: str = Field(..., description="Unique identifier for the buffer")
    created_at: datetime = Field(..., description="Timestamp when the buffer was created")
    user_id: str = Field(..., description="ID of the user who created the buffer")
    version: int = Field(..., description="Version number of the buffer")
    bucket_ids: List[str] = Field(
        default=[], description="List of bucket IDs associated with this buffer"
    )
    is_outdated: bool = Field(
        default=False, description="Flag indicating if the buffer has been marked as outdated"
    )
    outdated_reason: Optional[str] = Field(
        default=None, description="Reason for marking the buffer as outdated"
    )
    outdated_at: Optional[datetime] = Field(
        default=None, description="Timestamp when the buffer was marked as outdated"
    )
    parent_id: Optional[str] = Field(
        default=None, description="ID of the parent buffer if this is an update"
    )
    chunk_count: Optional[int] = Field(
        default=None, description="Number of chunks this buffer was split into"
    )

    class Config:
        """Pydantic model configuration."""

        schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "content": "This is a sample buffer content with important information.",
                "created_at": "2023-01-15T12:30:45Z",
                "user_id": "auth0|123456789",
                "version": 1,
                "bucket_ids": ["456e4567-e89b-12d3-a456-426614174111"],
                "is_outdated": False,
                "outdated_reason": None,
                "outdated_at": None,
                "parent_id": None,
                "chunk_count": 2,
            }
        }
