"""
Data models for user operations.

This module defines Pydantic models for user management and preferences.
"""

from datetime import datetime
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field, validator

from app.models.search import LLMProvider, TemplateType


class UserBase(BaseModel):
    """Base model for user data."""

    email: str = Field(..., description="User's email address")


class UserProfile(UserBase):
    """User profile information."""

    id: str = Field(..., description="Unique identifier for the user")
    created_at: datetime = Field(..., description="Timestamp when the user was created")
    last_sign_in: Optional[datetime] = Field(
        default=None, description="Timestamp of the user's last sign-in"
    )

    class Config:
        """Pydantic model configuration."""

        schema_extra = {
            "example": {
                "id": "auth0|123456789",
                "email": "user@example.com",
                "created_at": "2023-01-15T12:30:45Z",
                "last_sign_in": "2023-03-20T09:15:30Z",
            }
        }


class UserPreferencesBase(BaseModel):
    """Base model for user preferences."""

    preferred_llm: Optional[LLMProvider] = Field(
        default=None, description="Preferred LLM provider for generating responses"
    )
    preferred_template: Optional[str] = Field(
        default=None, description="Preferred template for formatting responses"
    )
    chunk_size: Optional[int] = Field(
        default=None, description="Preferred chunk size for text splitting"
    )
    chunk_overlap: Optional[int] = Field(
        default=None, description="Preferred chunk overlap for text splitting"
    )
    default_temperature: Optional[float] = Field(
        default=None, description="Preferred temperature setting for LLM", ge=0.0, le=1.0
    )

    @validator("preferred_llm")
    def validate_preferred_llm(cls, v):
        """Validate the preferred LLM provider."""
        if v is not None and v not in [p.value for p in LLMProvider]:
            raise ValueError(f"Invalid LLM provider: {v}")
        return v


class UserPreferencesCreate(UserPreferencesBase):
    """Model for creating user preferences."""

    pass


class UserPreferencesUpdate(UserPreferencesBase):
    """Model for updating user preferences."""

    pass


class UserPreferencesResponse(UserPreferencesBase):
    """Response model for user preferences."""

    user_id: str = Field(..., description="ID of the user")
    settings: Optional[Dict[str, Any]] = Field(default=None, description="Additional user settings")

    class Config:
        """Pydantic model configuration."""

        schema_extra = {
            "example": {
                "user_id": "auth0|123456789",
                "preferred_llm": "openai",
                "preferred_template": "default",
                "chunk_size": 1000,
                "chunk_overlap": 100,
                "default_temperature": 0.3,
                "settings": {"theme": "dark", "language": "en"},
            }
        }
