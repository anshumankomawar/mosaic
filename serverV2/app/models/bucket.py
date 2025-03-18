"""
Data models for bucket operations.

This module defines Pydantic models for bucket creation, management, and responses.
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, validator, EmailStr


class BucketBase(BaseModel):
    """Base model for bucket operations."""

    name: str = Field(..., description="Name of the bucket", min_length=1, max_length=100)
    description: Optional[str] = Field(
        default=None, description="Description of the bucket", max_length=500
    )


class BucketCreate(BucketBase):
    """Model for creating a new bucket."""

    pass


class BucketResponse(BucketBase):
    """Response model for bucket operations."""

    id: str = Field(..., description="Unique identifier for the bucket")
    created_at: datetime = Field(..., description="Timestamp when the bucket was created")
    created_by: str = Field(..., description="ID of the user who created the bucket")

    class Config:
        """Pydantic model configuration."""

        schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "name": "Project Alpha",
                "description": "Documentation and notes for Project Alpha",
                "created_at": "2023-01-15T12:30:45Z",
                "created_by": "auth0|123456789",
            }
        }


class BucketMemberAdd(BaseModel):
    """Model for adding a member to a bucket."""

    user_email: EmailStr = Field(..., description="Email of the user to add to the bucket")
    role: str = Field(default="member", description="Role of the user in the bucket")

    @validator("role")
    def validate_role(cls, v):
        """Validate that the role is one of the allowed values."""
        allowed_roles = ["admin", "member", "readonly"]
        if v not in allowed_roles:
            raise ValueError(f"Role must be one of: {', '.join(allowed_roles)}")
        return v

    class Config:
        """Pydantic model configuration."""

        schema_extra = {"example": {"user_email": "user@example.com", "role": "member"}}


class BucketMemberResponse(BaseModel):
    """Response model for bucket member operations."""

    bucket_id: str = Field(..., description="ID of the bucket")
    user_id: str = Field(..., description="ID of the user")
    user_email: EmailStr = Field(..., description="Email of the user")
    role: str = Field(..., description="Role of the user in the bucket")

    class Config:
        """Pydantic model configuration."""

        schema_extra = {
            "example": {
                "bucket_id": "123e4567-e89b-12d3-a456-426614174000",
                "user_id": "auth0|123456789",
                "user_email": "user@example.com",
                "role": "member",
            }
        }
