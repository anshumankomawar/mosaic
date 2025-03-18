"""
Data models for response template operations.

This module defines Pydantic models for template creation, management, and responses.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, validator


class TemplateBase(BaseModel):
    """Base model for template operations."""

    name: str = Field(
        ...,
        description="Unique name for the template",
        min_length=1,
        max_length=50,
        regex="^[a-z0-9_-]+$",
    )
    template: str = Field(..., description="Template content in Jinja2 format", min_length=1)
    description: Optional[str] = Field(
        default=None, description="Description of the template", max_length=500
    )


class TemplateCreate(TemplateBase):
    """Model for creating a new template."""

    is_default: bool = Field(
        default=False, description="Whether this template should be the default for the user"
    )


class TemplateUpdate(BaseModel):
    """Model for updating an existing template."""

    template: Optional[str] = Field(default=None, description="Template content in Jinja2 format")
    description: Optional[str] = Field(
        default=None, description="Description of the template", max_length=500
    )
    is_default: Optional[bool] = Field(
        default=None, description="Whether this template should be the default for the user"
    )

    @validator("template")
    def validate_template(cls, v):
        """Validate the template content."""
        if v is not None and not v.strip():
            raise ValueError("Template content cannot be empty")
        return v


class TemplateResponse(TemplateBase):
    """Response model for template operations."""

    id: str = Field(..., description="Unique identifier for the template")
    user_id: Optional[str] = Field(
        default=None,
        description="ID of the user who created the template (null for system templates)",
    )
    is_default: bool = Field(default=False, description="Whether this is the default template")
    created_at: datetime = Field(..., description="Timestamp when the template was created")

    class Config:
        """Pydantic model configuration."""

        schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "name": "custom_summary",
                "template": '# Summary for "{{query}}"\n\n{{response}}\n\n## Key Points\n{% for point in key_points %}- {{point}}\n{% endfor %}',
                "description": "A custom summary template with key points",
                "user_id": "auth0|123456789",
                "is_default": True,
                "created_at": "2023-01-15T12:30:45Z",
            }
        }
