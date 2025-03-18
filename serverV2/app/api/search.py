"""
API routes for search operations.

This module defines the FastAPI endpoints for searching buffer content
using vector similarity.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any

from app.utils.auth import get_current_user
from app.utils.errors import handle_recall_error
from app.models.search import SearchQuery
from app.services import search_service
from app.logging_config import get_logger

router = APIRouter(prefix="/search", tags=["search"])
logger = get_logger(__name__)


@router.post("/", response_model=Dict[str, Any])
async def search_buffers(query: SearchQuery, user=Depends(get_current_user)) -> Dict[str, Any]:
    """
    Search for buffers using vector similarity.

    - **query**: Text to search for
    - **bucket_ids**: Optional list of bucket IDs to search within
    - **limit**: Maximum number of results to return (default: 10)
    - **include_outdated**: Whether to include buffers marked as outdated (default: false)
    - **version_strategy**: Strategy for handling multiple versions ('latest', 'all') (default: 'latest')

    Returns search results with both chunk-level and buffer-level information.
    """
    try:
        return await search_service.search_buffers(query, user.id)
    except Exception as e:
        logger.exception(f"Error searching buffers: {str(e)}")
        raise handle_recall_error(e)
