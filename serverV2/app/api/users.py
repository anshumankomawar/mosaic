"""
API routes for user operations.

This module defines the FastAPI endpoints for user management and preferences.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any

from app.utils.auth import get_current_user
from app.utils.errors import NotFoundError, handle_recall_error
from app.models.user import (
    UserProfile,
    UserPreferencesCreate,
    UserPreferencesUpdate,
    UserPreferencesResponse,
)
from app.db import get_supabase_client
from app.logging_config import get_logger

router = APIRouter(prefix="/users", tags=["users"])
logger = get_logger(__name__)


@router.get("/me", response_model=UserProfile)
async def get_current_user_profile(user=Depends(get_current_user)) -> Dict[str, Any]:
    """
    Get the current user's profile information.

    Returns the user profile.
    """
    return {
        "id": user.id,
        "email": user.email,
        "created_at": user.created_at,
        "last_sign_in": getattr(user, "last_sign_in_at", None),
    }


@router.get("/preferences", response_model=UserPreferencesResponse)
async def get_user_preferences(user=Depends(get_current_user)) -> Dict[str, Any]:
    """
    Get the current user's preferences.

    Returns the user preferences.
    """
    logger.error(f"Getting preferences for user {user.id}")
    try:
        supabase = get_supabase_client()

        # Get user preferences
        preferences = (
            supabase.table("user_preferences").select("*").eq("user_id", user.id).execute()
        )

        if not preferences.data:
            # Create default preferences if not found
            default_preferences = {
                "user_id": user.id,
                "preferred_llm": "openai",
                "preferred_template": "default",
                "chunk_size": 1000,
                "chunk_overlap": 100,
                "default_temperature": 0.3,
                "settings": {},
            }

            result = supabase.table("user_preferences").insert(default_preferences).execute()
            return result.data[0]

        return preferences.data[0]

    except Exception as e:
        logger.exception(f"Error getting user preferences: {str(e)}")
        raise handle_recall_error(e)


@router.post("/preferences", response_model=UserPreferencesResponse)
async def create_user_preferences(
    preferences: UserPreferencesCreate, user=Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Create or overwrite the current user's preferences.

    - **preferred_llm**: Preferred LLM provider for generating responses
    - **preferred_template**: Preferred template for formatting responses
    - **chunk_size**: Preferred chunk size for text splitting
    - **chunk_overlap**: Preferred chunk overlap for text splitting
    - **default_temperature**: Preferred temperature setting for LLM

    Returns the created preferences.
    """
    try:
        supabase = get_supabase_client()

        # Create preferences object
        preferences_data = preferences.dict(exclude_unset=True)
        preferences_data["user_id"] = user.id

        # Check if preferences already exist
        existing = supabase.table("user_preferences").select("*").eq("user_id", user.id).execute()

        if existing.data:
            # Delete existing preferences
            supabase.table("user_preferences").delete().eq("user_id", user.id).execute()

        # Create new preferences
        result = supabase.table("user_preferences").insert(preferences_data).execute()

        return result.data[0]

    except Exception as e:
        logger.exception(f"Error creating user preferences: {str(e)}")
        raise handle_recall_error(e)


@router.patch("/preferences", response_model=UserPreferencesResponse)
async def update_user_preferences(
    preferences: UserPreferencesUpdate, user=Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Update the current user's preferences.

    - **preferred_llm**: Preferred LLM provider for generating responses
    - **preferred_template**: Preferred template for formatting responses
    - **chunk_size**: Preferred chunk size for text splitting
    - **chunk_overlap**: Preferred chunk overlap for text splitting
    - **default_temperature**: Preferred temperature setting for LLM

    Returns the updated preferences.
    """
    try:
        supabase = get_supabase_client()

        # Get user preferences
        existing = supabase.table("user_preferences").select("*").eq("user_id", user.id).execute()

        if not existing.data:
            # Create default preferences if not found
            preferences_data = preferences.dict(exclude_unset=True)
            preferences_data["user_id"] = user.id

            result = supabase.table("user_preferences").insert(preferences_data).execute()
            return result.data[0]

        # Update only the provided fields
        update_data = preferences.dict(exclude_unset=True, exclude_none=True)

        if not update_data:
            return existing.data[0]

        # Update preferences
        result = (
            supabase.table("user_preferences").update(update_data).eq("user_id", user.id).execute()
        )

        return result.data[0]

    except Exception as e:
        logger.exception(f"Error updating user preferences: {str(e)}")
        raise handle_recall_error(e)
