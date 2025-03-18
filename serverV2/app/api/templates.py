"""
API routes for template operations.

This module defines the FastAPI endpoints for managing response templates.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any

from app.utils.auth import get_current_user
from app.utils.errors import NotFoundError, handle_recall_error
from app.models.template import TemplateCreate, TemplateUpdate, TemplateResponse
from app.db import get_supabase_client
from app.logging_config import get_logger

router = APIRouter(prefix="/templates", tags=["templates"])
logger = get_logger(__name__)


@router.get("/", response_model=List[TemplateResponse])
async def list_templates(user=Depends(get_current_user)) -> List[Dict[str, Any]]:
    """
    List all available templates for the user.

    Returns a list of templates, including system templates and user-created ones.
    """
    try:
        supabase = get_supabase_client()

        # Get both system templates and user templates
        query = f"""
        SELECT *
        FROM response_templates
        WHERE user_id IS NULL
        OR user_id = '{user.id}'
        ORDER BY name ASC
        """

        result = supabase.table("response_templates").execute_raw(query)
        return result

    except Exception as e:
        logger.exception(f"Error listing templates: {str(e)}")
        raise handle_recall_error(e)


@router.post("/", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    template: TemplateCreate, user=Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Create a new template.

    - **name**: Unique name for the template (lowercase, numbers, hyphens, underscores)
    - **template**: Template content in Jinja2 format
    - **description**: Optional description of the template
    - **is_default**: Whether this template should be the default for the user

    Returns the created template.
    """
    try:
        supabase = get_supabase_client()

        # Check if name already exists for this user
        existing = (
            supabase.table("response_templates")
            .select("*")
            .eq("name", template.name)
            .eq("user_id", user.id)
            .execute()
        )

        if existing.data:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Template with name '{template.name}' already exists",
            )

        import uuid
        from datetime import datetime

        # Create template
        template_data = template.dict()
        template_data["id"] = str(uuid.uuid4())
        template_data["user_id"] = user.id
        template_data["created_at"] = datetime.utcnow().isoformat()

        result = supabase.table("response_templates").insert(template_data).execute()

        # If this is the default template, update user preferences
        if template.is_default:
            supabase.table("user_preferences").update({"preferred_template": template.name}).eq(
                "user_id", user.id
            ).execute()

        return result.data[0]

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error creating template: {str(e)}")
        raise handle_recall_error(e)


@router.get("/{template_name}", response_model=TemplateResponse)
async def get_template(template_name: str, user=Depends(get_current_user)) -> Dict[str, Any]:
    """
    Get a template by name.

    - **template_name**: Name of the template to retrieve

    Returns the template.
    """
    try:
        supabase = get_supabase_client()

        # Try to get user-specific template first
        template = (
            supabase.table("response_templates")
            .select("*")
            .eq("name", template_name)
            .eq("user_id", user.id)
            .execute()
        )

        if template.data:
            return template.data[0]

        # Try to get system template
        template = (
            supabase.table("response_templates")
            .select("*")
            .eq("name", template_name)
            .is_("user_id", "null")
            .execute()
        )

        if template.data:
            return template.data[0]

        raise NotFoundError(f"Template '{template_name}' not found")

    except NotFoundError as e:
        logger.warning(f"Template not found: {str(e)}")
        raise handle_recall_error(e)
    except Exception as e:
        logger.exception(f"Error retrieving template: {str(e)}")
        raise handle_recall_error(e)


@router.patch("/{template_name}", response_model=TemplateResponse)
async def update_template(
    template_name: str, template_update: TemplateUpdate, user=Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Update a template.

    - **template_name**: Name of the template to update
    - **template**: New template content
    - **description**: New description for the template
    - **is_default**: Whether this template should be the default for the user

    Returns the updated template.
    """
    try:
        supabase = get_supabase_client()

        # Check if template exists for this user
        existing = (
            supabase.table("response_templates")
            .select("*")
            .eq("name", template_name)
            .eq("user_id", user.id)
            .execute()
        )

        if not existing.data:
            # Check if it's a system template
            system_template = (
                supabase.table("response_templates")
                .select("*")
                .eq("name", template_name)
                .is_("user_id", "null")
                .execute()
            )

            if system_template.data:
                # Clone the system template for the user
                import uuid
                from datetime import datetime

                template_data = system_template.data[0].copy()
                template_data["id"] = str(uuid.uuid4())
                template_data["user_id"] = user.id
                template_data["created_at"] = datetime.utcnow().isoformat()

                # Apply updates
                update_data = template_update.dict(exclude_unset=True, exclude_none=True)
                for key, value in update_data.items():
                    template_data[key] = value

                # Insert the new template
                result = supabase.table("response_templates").insert(template_data).execute()

                # If this is the default template, update user preferences
                if template_update.is_default == True:
                    supabase.table("user_preferences").update(
                        {"preferred_template": template_name}
                    ).eq("user_id", user.id).execute()

                return result.data[0]

            raise NotFoundError(f"Template '{template_name}' not found")

        # Update template
        update_data = template_update.dict(exclude_unset=True, exclude_none=True)

        if not update_data:
            return existing.data[0]

        result = (
            supabase.table("response_templates")
            .update(update_data)
            .eq("name", template_name)
            .eq("user_id", user.id)
            .execute()
        )

        # If this is the default template, update user preferences
        if template_update.is_default == True:
            supabase.table("user_preferences").update({"preferred_template": template_name}).eq(
                "user_id", user.id
            ).execute()

        return result.data[0]

    except NotFoundError as e:
        logger.warning(f"Template not found: {str(e)}")
        raise handle_recall_error(e)
    except Exception as e:
        logger.exception(f"Error updating template: {str(e)}")
        raise handle_recall_error(e)


@router.delete("/{template_name}", status_code=status.HTTP_200_OK)
async def delete_template(template_name: str, user=Depends(get_current_user)) -> Dict[str, str]:
    """
    Delete a user template.

    - **template_name**: Name of the template to delete

    Returns a success message.
    """
    try:
        supabase = get_supabase_client()

        # Check if template exists and belongs to user
        existing = (
            supabase.table("response_templates")
            .select("*")
            .eq("name", template_name)
            .eq("user_id", user.id)
            .execute()
        )

        if not existing.data:
            # Check if it's a system template
            system_template = (
                supabase.table("response_templates")
                .select("*")
                .eq("name", template_name)
                .is_("user_id", "null")
                .execute()
            )

            if system_template.data:
                return {"message": "Cannot delete system templates"}

            raise NotFoundError(f"Template '{template_name}' not found")

        # Check if this is the user's default template
        preferences = (
            supabase.table("user_preferences")
            .select("preferred_template")
            .eq("user_id", user.id)
            .execute()
        )

        if preferences.data and preferences.data[0].get("preferred_template") == template_name:
            # Update user preferences to use default template
            supabase.table("user_preferences").update({"preferred_template": "default"}).eq(
                "user_id", user.id
            ).execute()

        # Delete template
        supabase.table("response_templates").delete().eq("name", template_name).eq(
            "user_id", user.id
        ).execute()

        return {"message": f"Template '{template_name}' deleted successfully"}

    except NotFoundError as e:
        logger.warning(f"Template not found: {str(e)}")
        raise handle_recall_error(e)
    except Exception as e:
        logger.exception(f"Error deleting template: {str(e)}")
        raise handle_recall_error(e)
