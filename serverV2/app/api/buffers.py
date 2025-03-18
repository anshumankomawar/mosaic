"""
API routes for buffer operations.

This module defines the FastAPI endpoints for creating, updating,
and managing buffer content.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any

from app.utils.auth import get_current_user
from app.utils.errors import NotFoundError, handle_recall_error
from app.models.buffer import BufferCreate, BufferUpdate, BufferResponse, BufferMarkOutdated
from app.services import buffer_service
from app.logging_config import get_logger

router = APIRouter(prefix="/buffers", tags=["buffers"])
logger = get_logger(__name__)


@router.post("/", response_model=BufferResponse, status_code=status.HTTP_201_CREATED)
async def create_buffer(buffer: BufferCreate, user=Depends(get_current_user)) -> Dict[str, Any]:
    """
    Create a new buffer with the given content.

    - **content**: Text content to store in the buffer
    - **bucket_ids**: Optional list of bucket IDs to associate with this buffer
    - **chunk_size**: Optional maximum size of each chunk in characters
    - **chunk_overlap**: Optional number of characters to overlap between chunks

    Returns the created buffer with its ID and metadata.
    """
    try:
        return await buffer_service.create_buffer(buffer, user.id)
    except Exception as e:
        logger.exception(f"Error creating buffer: {str(e)}")
        raise handle_recall_error(e)


@router.post("/update", response_model=BufferResponse)
async def update_buffer_content(
    buffer: BufferUpdate, user=Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Create a new version of a buffer (update).

    - **content**: New text content
    - **parent_id**: ID of the buffer being updated
    - **chunk_size**: Optional maximum size of each chunk in characters
    - **chunk_overlap**: Optional number of characters to overlap between chunks

    Returns the created buffer with its ID and metadata.
    """
    try:
        return await buffer_service.update_buffer(buffer, user.id)
    except Exception as e:
        logger.exception(f"Error updating buffer: {str(e)}")
        raise handle_recall_error(e)


@router.post("/{buffer_id}/mark-outdated", response_model=BufferResponse)
async def mark_buffer_outdated(
    buffer_id: str, outdated_data: BufferMarkOutdated, user=Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Mark a buffer as outdated.

    - **buffer_id**: ID of the buffer to mark as outdated
    - **reason**: Reason for marking the buffer as outdated

    Returns the updated buffer.
    """
    try:
        return await buffer_service.mark_buffer_outdated(buffer_id, outdated_data, user.id)
    except Exception as e:
        logger.exception(f"Error marking buffer as outdated: {str(e)}")
        raise handle_recall_error(e)


@router.delete("/{buffer_id}", status_code=status.HTTP_200_OK)
async def soft_delete_buffer(buffer_id: str, user=Depends(get_current_user)) -> Dict[str, Any]:
    """
    Soft delete a buffer by marking it as inactive.

    - **buffer_id**: ID of the buffer to delete

    Returns a success message.
    """
    try:
        return await buffer_service.soft_delete_buffer(buffer_id, user.id)
    except Exception as e:
        logger.exception(f"Error deleting buffer: {str(e)}")
        raise handle_recall_error(e)


@router.get("/{buffer_id}", response_model=BufferResponse)
async def get_buffer(buffer_id: str, user=Depends(get_current_user)) -> Dict[str, Any]:
    """
    Get a buffer by its ID.

    - **buffer_id**: ID of the buffer to retrieve

    Returns the buffer with its content and metadata.
    """
    try:
        buffer = await buffer_service.get_buffer_by_id(buffer_id, user.id)
        if not buffer:
            raise NotFoundError(f"Buffer with ID {buffer_id} not found")
        return buffer
    except NotFoundError as e:
        logger.warning(f"Buffer not found: {str(e)}")
        raise handle_recall_error(e)
    except Exception as e:
        logger.exception(f"Error retrieving buffer: {str(e)}")
        raise handle_recall_error(e)
